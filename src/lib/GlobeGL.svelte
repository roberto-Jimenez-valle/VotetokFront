<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import TopTabs from './TopTabs.svelte';
  import './GlobeGL.css';
  import { worldMap$, worldData$, loadGlobeData } from './stores/globeData';
  import { get as getStore } from 'svelte/store';
  import { clamp, hexToRgba } from './utils/colors';
  import { centroidOf, isoOf, pointInFeature } from './utils/geo';
  import LegendPanel from './globe/LegendPanel.svelte';
  import SettingsPanel from './globe/SettingsPanel.svelte';
  import SearchBar from './globe/SearchBar.svelte';
  import TagBar from './globe/TagBar.svelte';
  import BottomSheet from './globe/BottomSheet.svelte';
  import GlobeCanvas from './globe/GlobeCanvas.svelte';
  import { nameOf as nameOfUtil, getDominantKey as getDominantKeyUtil, opacityForIso as opacityForIsoUtil, alphaForTag as alphaForTagUtil } from './utils/globeHelpers';
  import { BottomSheetController, type SheetState } from './globe/bottomSheet';
  import { computeGlobeViewModel } from './utils/globeDataProc';

  // Permitir modo "data-in": el padre pasa datos directamente y GlobeGL se auto-configura
  export let geo: any = null;
  export let dataJson: any = null;
  export let autoLoad: boolean = true; // si true y no hay props, carga desde store
  // Loader opcional para datos por región (bbox) cuando el usuario se acerca
  export let loadRegionData: null | ((bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number }) => Promise<any>) = null;

  let globe: any = null; // ref al componente GlobeCanvas
  let answersData: Record<string, Record<string, number>> = {};
  let colorMap: Record<string, string> = {};
  let isoIntensity: Record<string, number> = {};
  let intensityMin = 0;
  let intensityMax = 1;
  // Professional 3-level navigation system
  type NavigationLevel = 'world' | 'country' | 'subdivision';
  type NavigationState = {
    level: NavigationLevel;
    countryIso: string | null;
    subdivisionId: string | null;
    path: string[];
  };

  let navigationState: NavigationState = {
    level: 'world',
    countryIso: null,
    subdivisionId: null,
    path: []
  };

  // Navigation history for breadcrumbs
  let navigationHistory: Array<{
    level: NavigationLevel;
    name: string;
    iso?: string;
    id?: string;
  }> = [{ level: 'world', name: 'World' }];
  // Visibilidad de polígonos (capa coroplética)
  let polygonsVisible = true;
  // Polígonos del dataset global (choropleth): se preservan siempre
  let worldPolygons: any[] = [];
  const ALT_THRESHOLD = 0.6; // si la altitud es menor, ocultamos polígonos
  const VERY_CLOSE_ALT = 0.15; // por debajo de este valor, sin clustering: puntos exactos

  // Umbrales de altitud para mostrar textos (Level of Detail)
  const COUNTRY_LABELS_ALT = 1.0; // mostrar etiquetas de países cuando altitud < 2.5
  const SUBDIVISION_LABELS_ALT = 0.4; // mostrar etiquetas de subdivisiones cuando altitud < 0.8
  const DETAILED_LABELS_ALT = 0.21; // mostrar etiquetas detalladas cuando altitud < 0.3
  
  // Límites de zoom del globo
  const MIN_ZOOM_ALTITUDE = 0.02; // límite mínimo de zoom (más cerca)
  const MAX_ZOOM_ALTITUDE = 4.0; // límite máximo de zoom (más lejos)

  // Debug function para mostrar información del sistema LOD
  function debugLODSystem(pov: { lat: number; lng: number; altitude: number }) {
    const currentLevel = navigationManager?.getCurrentLevel() || 'world';
    console.log(`[LOD Debug] 
      Altitude: ${pov.altitude.toFixed(3)}
      Level: ${currentLevel}
      Country Labels Threshold: ${COUNTRY_LABELS_ALT}
      Subdivision Labels Threshold: ${SUBDIVISION_LABELS_ALT}
      Detailed Labels Threshold: ${DETAILED_LABELS_ALT}
      
      Labels Status:
      - Country Labels: ${pov.altitude < COUNTRY_LABELS_ALT ? 'VISIBLE' : 'HIDDEN'}
      - Subdivision Labels: ${pov.altitude < SUBDIVISION_LABELS_ALT ? 'VISIBLE' : 'HIDDEN'}
      - Detailed Labels: ${pov.altitude < DETAILED_LABELS_ALT ? 'VISIBLE' : 'HIDDEN'}
    `);
  }

  // Función de prueba para testear diferentes altitudes
  function testAltitude(altitude: number) {
    if (globe) {
      const pov = globe.pointOfView();
      globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude }, 500);
    }
  }

  // Polígonos locales por país (zoom cercano)
  let localPolygons: any[] = [];
  let currentLocalIso: string | null = null;
  const countryPolygonsCache = new Map<string, any[]>();
  const countryCentroidCache = new Map<string, { lat: number; lng: number }>();
  // Subregiones: cuando estamos aún más cerca, cargar TopoJSON por ID_1 (ej.: ESP.1.topojson)
  let currentSubregionId1: string | null = null;
  const SUBREGION_ALT = 0.2; // umbral de altitud para activar subregión (por debajo de 0.50 activa)
  const SUBREGION_EXIT_ALT = 0.25; // histéresis: salir de subregión solo al superar este valor
  const subregionPolygonsCache = new Map<string, any[]>(); // clave: `${ISO}/${ID_1}`
  const subregionCentroidCache = new Map<string, { lat: number; lng: number }>();
  let lastSubregionSwitchAt = 0;

  // Variables for globe data processing
  let mode: 'intensity' | 'trend' = 'intensity';
  let isoDominantKey: Record<string, string> = {}; // ISO -> categoría dominante
  let legendItems: Array<{ key: string; color: string; count: number }> = [];
  let trendingTags: Array<{ key: string; count: number }> = [];
  let tagTotals: Record<string, number> = {};
  let tagMin = 0;
  let tagMax = 1;

  // Inicialización desde datos externos o stores
  let _initVersion = 0;
  async function initFrom(geoIn: any, dataIn: any) {
    if (!geoIn || !dataIn) return;
    // Asegurar que GlobeCanvas esté listo para recibir polígonos
    try { await tick(); } catch {}
    const vm = computeGlobeViewModel(geoIn, dataIn);
    answersData = dataIn?.ANSWERS ?? {};
    colorMap = dataIn?.colors ?? {};
    isoDominantKey = vm.isoDominantKey;
    legendItems = vm.legendItems;
    trendingTags = vm.trendingTags;
    tagTotals = vm.tagTotals;
    tagMin = vm.tagMin;
    tagMax = vm.tagMax;
    isoIntensity = vm.isoIntensity;
    intensityMin = vm.intensityMin;
    intensityMax = vm.intensityMax;
    worldPolygons = vm.polygons;
    // Pre-cache centroides por ISO para búsqueda rápida del país centrado
    try {
      countryCentroidCache.clear();
      for (const feat of worldPolygons) {
        const iso = isoOf(feat);
        if (iso && !countryCentroidCache.has(iso)) {
          countryCentroidCache.set(iso, centroidOf(feat));
        }
      }
    } catch {}
    try {
      globe && globe.setPolygonsData && globe.setPolygonsData(vm.polygons);
      polygonsVisible = true;
      setTilesEnabled(false);
      globe?.refreshPolyColors?.();
      globe?.refreshPolyAltitudes?.();
      globe?.refreshPolyLabels?.();
    } catch {}
    // Solo establecer POV inicial la primera vez
    if (_initVersion === 0) {
      try { 
        // Inicializar en vista alejada de 200km (200000/675000 = 0.296)
        const initialAltitude = 200000 / 675000; // 0.296 para 200km
        globe?.pointOfView({ lat: 20, lng: 0, altitude: initialAltitude }); 
      } catch {}
    }
    _initVersion++;
    // Ajustar visibilidad según POV actual (evitar reactivar polígonos si estamos cerca)
    try { updatePolygonsVisibilityExt(); } catch {}
  }

  // Encontrar el ID_1 del polígono local más cercano al centro de la vista
  function nearestLocalFeatureId1(pov: { lat: number; lng: number }): string | null {
    try {
      console.log(localPolygons);
      if (!localPolygons || localPolygons.length === 0) return null;
      
      // First, try point-in-polygon detection
      for (const feat of localPolygons) {
        const props = feat?.properties || {};
        let id1: any = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1 || null;
        if (!id1) continue;
        
        if (pointInFeature(pov.lat, pov.lng, feat)) {
          if (typeof id1 === 'string') {
            if (!id1.includes('.') && currentLocalIso) {
              id1 = `${currentLocalIso}.${id1}`;
            }
            const us = id1.indexOf('_');
            if (us > 0) id1 = id1.slice(0, us);
          } else if (typeof id1 === 'number' && currentLocalIso) {
            id1 = `${currentLocalIso}.${id1}`;
          }
          console.log('[Subregion] Point-in-polygon match:', String(id1), 'at', pov.lat.toFixed(4), pov.lng.toFixed(4));
          return String(id1);
        }
      }
      
      // Fallback: nearest centroid
      let bestId: string | null = null;
      let bestD = Infinity;
      for (const feat of localPolygons) {
        const props = feat?.properties || {};
        let id1: any = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1 || null;
        console.log(id1);
        if (!id1) continue;
        if (typeof id1 === 'string') {
          if (!id1.includes('.') && currentLocalIso) {
            id1 = `${currentLocalIso}.${id1}`;
          }
          // Quitar sufijo después de '_'
          const us = id1.indexOf('_');
          if (us > 0) id1 = id1.slice(0, us);
        } else if (typeof id1 === 'number' && currentLocalIso) {
          id1 = `${currentLocalIso}.${id1}`;
        }
        const c = centroidOf(feat);
        const d = Math.abs(c.lat - pov.lat) + Math.abs((((pov.lng - c.lng + 540) % 360) - 180));
        if (d < bestD) { bestD = d; bestId = String(id1); }
      }
      
      if (bestId) {
        console.log('[Subregion] Fallback centroid match:', bestId, 'at', pov.lat.toFixed(4), pov.lng.toFixed(4));
      }
      
      return bestId;
    } catch { return null; }
  }

  // DISABLED: Zoom-based subdivision loading removed - now handled by NavigationManager only
  async function ensureSubregionPolygons(pov: { lat: number; lng: number; altitude: number }) {
    // This function is now disabled - subdivision loading only happens via clicks
    console.log('[Subregion] Zoom-based subdivision loading disabled - use click navigation instead');
    return;
  }

  // Función helper para combinar polígonos padre e hijos con diferentes opacidades y elevaciones
  function combinePolygonsWithOpacity(parentPolygons: any[], childPolygons: any[], parentOpacity: number = 0.3): any[] {
    const combined = [];
    
    // Agregar polígonos padre con opacidad reducida y elevación base
    if (parentPolygons && parentPolygons.length > 0) {
      for (const poly of parentPolygons) {
        const parentPoly = { 
          ...poly, 
          properties: { 
            ...poly.properties, 
            _isParent: true, 
            _opacity: parentOpacity,
            _elevation: 0.002 // Elevación más alta para polígonos padre
          } 
        };
        combined.push(parentPoly);
      }
    }
    
    // Agregar polígonos hijos con opacidad completa y elevación mayor
    if (childPolygons && childPolygons.length > 0) {
      console.log('[CombinePolygons] Adding', childPolygons.length, 'child polygons');
      for (const poly of childPolygons) {
        const childPoly = { 
          ...poly, 
          properties: { 
            ...poly.properties, 
            _isChild: true, 
            _opacity: 1.0,
            _elevation: 0.004 // Elevación más alta para subdivisiones
          } 
        };
        console.log('[CombinePolygons] Child polygon:', childPoly.properties._subdivisionName, 'isChild:', childPoly.properties._isChild);
        combined.push(childPoly);
      }
    }
    
    return combined;
  }

  async function loadSubregionTopoAsGeoFeatures(iso: string, id1: string): Promise<any[]> {
    const path = `/geojson/${iso}/${id1}.topojson`;
    const resp = await fetch(path);
    if (!resp.ok) {
      console.warn(`[Subregion] No se encontró el archivo: ${path} (HTTP ${resp.status})`);
      throw new Error(`HTTP ${resp.status} al cargar ${path}`);
    }
    const topo = await resp.json();
    const mod = await import(/* @vite-ignore */ 'topojson-client');
    const objects = topo.objects || {};
    const firstKey = Object.keys(objects)[0];
    if (!firstKey) return [];
    const fc = (mod as any).feature(topo, objects[firstKey]);
    const feats: any[] = Array.isArray(fc?.features) ? fc.features : [];
    for (const f of feats) {
      if (!f.properties) f.properties = {};
      if (!f.properties.ISO_A3) f.properties.ISO_A3 = iso;
      if (!f.properties.ID_1) f.properties.ID_1 = id1;
      
      // Extraer nombre de la subdivisión de varias propiedades posibles
      const name = f.properties.NAME_2 || f.properties.name_2 || 
                   f.properties.NAME || f.properties.name ||
                   f.properties.VARNAME_2 || f.properties.varname_2 ||
                   f.properties.NL_NAME_2 || f.properties.nl_name_2 ||
                   `Subdivisión ${id1}`;
      f.properties._subdivisionName = name;
      
      // Debug: log para verificar extracción de nombres
      console.log('[Subregion] Extracted name:', name, 'from properties:', Object.keys(f.properties));
    }
    return feats;
  }

  // Generar etiquetas tanto para países (NAME_1) como subdivisiones (NAME_2)
  function generateSubdivisionLabels(polygons: any[]): SubdivisionLabel[] {
    const labels: SubdivisionLabel[] = [];
    console.log('[Labels] Processing', polygons.length, 'polygons for labels');
    
    for (const poly of polygons) {
      let name = null;
      let labelType = '';
      
      console.log('[Labels] Polygon properties:', poly?.properties);
      
      // Prioridad: nivel 2 (NAME_2), luego subdivisiones (hijos), luego países (padres)
      if (poly?.properties?._isLevel2) {
        // Para sub-subdivisiones (nivel 2), extraer NAME_2
        name = poly.properties.NAME_2 || poly.properties.name_2 || 
               poly.properties.NAME || poly.properties.name ||
               poly.properties.VARNAME_2 || poly.properties.varname_2 ||
               poly.properties.NL_NAME_2 || poly.properties.nl_name_2;
        labelType = 'level2';
        console.log('[Labels] Found level 2 subdivision (NAME_2):', name);
      } else if (poly?.properties?._isChild && poly?.properties?._subdivisionName) {
        name = poly.properties._subdivisionName;
        labelType = 'subdivision';
        console.log('[Labels] Found child subdivision:', name);
      } else if (poly?.properties?._isParent) {
        // Para países, extraer NAME_1
        name = poly.properties.NAME_1 || poly.properties.name_1 || 
               poly.properties.NAME || poly.properties.name ||
               poly.properties.VARNAME_1 || poly.properties.varname_1 ||
               poly.properties.NL_NAME_1 || poly.properties.nl_name_1;
        labelType = 'country';
        console.log('[Labels] Found parent country subdivision (NAME_1):', name);
      } else {
        // Fallback: try to extract any name from properties (prefer NAME_1, then NAME_2)
        name = poly.properties?.NAME_1 || poly.properties?.name_1 || 
               poly.properties?.NAME_2 || poly.properties?.name_2 ||
               poly.properties?.NAME || poly.properties?.name ||
               poly.properties?.VARNAME_1 || poly.properties?.varname_1;
        labelType = 'fallback';
        console.log('[Labels] Fallback name extraction:', name);
      }
      
      if (name) {
        try {
          const centroid = centroidOf(poly);
          const label: SubdivisionLabel = {
            id: `label_${labelType}_${poly.properties.ID_1 || poly.properties.id_1 || poly.properties.ISO_A3 || Math.random()}`,
            name: name,
            lat: centroid.lat,
            lng: centroid.lng
          };
          labels.push(label);
          console.log('[Labels] Generated', labelType, 'label:', label.name, 'at precise centroid:', 
                     `${centroid.lat.toFixed(4)}, ${centroid.lng.toFixed(4)}`);
        } catch (e) {
          console.warn('[Labels] Failed to generate label for polygon:', poly.properties);
        }
      }
    }
    
    return labels;
  }

  // Configuración de marcadores HTML para votos
  let markersInitialized = false;
  function ensureMarkerSetup() {
    if (markersInitialized || !globe) return;
    try {
      globe.htmlLat((d: VotePoint) => d.lat);
      globe.htmlLng((d: VotePoint) => d.lng);
      // Altitud base muy baja para evitar que se "eleven" demasiado al acercar
      globe.htmlAltitude(() => 0.001);
      globe.htmlTransitionDuration(200);
      globe.htmlElement((d: any) => {
        const el = document.createElement('div');
        el.className = 'vote-marker';
        const tag = (d.tag ?? '').toString();
        const color = colorMap?.[tag] ?? '#9ca3af';
        const count = Number((d.count ?? 1));
        const size = Math.max(10, Math.min(36, Math.round(8 + Math.sqrt(count) * 5)));
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.borderRadius = '50%';
        // Fondo con opacidad, sin borde
        el.style.background = hexToRgba(color, 0.75);
        el.style.boxShadow = 'none';
        el.style.pointerEvents = 'none';
        // Asegurar que los grandes queden por encima de los pequeños
        el.style.zIndex = String(100 + size);
        el.style.transform = 'translate(-50%, -50%)';
        el.title = (tag || '') + (count > 1 ? ` (${count})` : '');
        const showLabel = Boolean((d as any).showLabel);
        if (showLabel && count > 1) {
          const label = document.createElement('div');
          label.textContent = String(count);
          label.style.position = 'absolute';
          label.style.left = '50%';
          label.style.top = '50%';
          label.style.transform = 'translate(-50%, -50%)';
          label.style.color = '#fff';
          label.style.fontWeight = '600';
          label.style.fontSize = `${Math.max(9, Math.min(14, Math.round(size * 0.45)))}px`;
          label.style.textShadow = '0 1px 2px rgba(0,0,0,0.6)';
          el.appendChild(label);
        }
        return el;
      });
      markersInitialized = true;
    } catch {}
  }

  // Configuración de etiquetas HTML para subdivisiones
  function ensureLabelsSetup() {
    if (labelsInitialized || !globe) return;
    try {
      // Usar un segundo conjunto de elementos HTML para las etiquetas
      // Como globe.gl solo permite un conjunto de htmlElements, vamos a usar los labels de polígonos
      // pero configurados para ser siempre visibles
      labelsInitialized = true;
    } catch {}
  }

  // Update labels for both countries and subdivisions
  function updateSubdivisionLabels(visible: boolean) {
    if (!globe) return;
    try {
      if (visible && subdivisionLabels?.length) {
        console.log('[Labels] Showing', subdivisionLabels.length, 'labels (countries + subdivisions)');
        globe.setTextLabels?.(subdivisionLabels);
      } else {
        console.log('[Labels] Clearing all labels');
        globe.setTextLabels?.([]);
      }
    } catch (e) {
      console.warn('Error updating labels:', e);
    }
  }

  // Professional Navigation Manager Class
  class NavigationManager {
    private globe: any;
    private state: NavigationState;
    private history: Array<{level: NavigationLevel; name: string; iso?: string; id?: string;}>;
    private polygonCache: Map<string, any[]> = new Map();
    private labelCache: Map<string, SubdivisionLabel[]> = new Map();

    constructor(globeRef: any) {
      this.globe = globeRef;
      this.state = {
        level: 'world',
        countryIso: null,
        subdivisionId: null,
        path: []
      };
      this.history = [{ level: 'world', name: 'World' }];
    }

    // Public API
    async navigateToCountry(iso: string, countryName: string) {
      console.log('[Navigation] Navigating to country:', iso);
      
      try {
        // Load country data
        const countryPolygons = await this.loadCountryPolygons(iso);
        if (!countryPolygons?.length) {
          throw new Error(`No polygons found for country ${iso}`);
        }

        // Update state
        this.state = {
          level: 'country',
          countryIso: iso,
          subdivisionId: null,
          path: [iso]
        };

        // Update history
        this.history = [
          { level: 'world', name: 'World' },
          { level: 'country', name: countryName, iso }
        ];

        // Render country view
        await this.renderCountryView(iso, countryPolygons);
        
        // Try to load subdivisions automatically
        await this.loadSubdivisions(iso);

      } catch (error) {
        console.error('[Navigation] Error navigating to country:', error);
        await this.navigateToWorld();
      }
    }

    async navigateToSubdivision(countryIso: string, subdivisionId: string, subdivisionName: string) {
      console.log('[Navigation] Navigating to subdivision:', subdivisionId);
      
      try {
        // Ensure we're in country context
        if (this.state.countryIso !== countryIso) {
          throw new Error('Invalid navigation: subdivision without country context');
        }

        // Load subdivision data
        const subdivisionPolygons = await this.loadSubdivisionPolygons(countryIso, subdivisionId);
        if (!subdivisionPolygons?.length) {
          console.warn('[Navigation] No subdivision polygons found for', subdivisionId);
          return;
        }

        // Update state
        this.state = {
          level: 'subdivision',
          countryIso,
          subdivisionId,
          path: [countryIso, subdivisionId]
        };

        // Update history
        this.history = [
          { level: 'world', name: 'World' },
          { level: 'country', name: this.history[1]?.name || countryIso, iso: countryIso },
          { level: 'subdivision', name: subdivisionName, iso: countryIso, id: subdivisionId }
        ];

        // Render subdivision view
        await this.renderSubdivisionView(countryIso, subdivisionId, subdivisionPolygons);

      } catch (error) {
        console.error('[Navigation] Error navigating to subdivision:', error);
      }
    }

    async navigateToWorld() {
      console.log('[Navigation] Navigating to world view');
      
      this.state = {
        level: 'world',
        countryIso: null,
        subdivisionId: null,
        path: []
      };

      this.history = [{ level: 'world', name: 'World' }];

      await this.renderWorldView();
    }

    async navigateBack() {
      console.log('[Navigation] Navigating back from', this.state.level);
      
      if (this.state.level === 'subdivision') {
        // From subdivision back to country
        const countryIso = this.state.countryIso;
        const countryName = this.history.find(h => h.level === 'country')?.name || countryIso;
        
        if (countryIso && countryName) {
          await this.navigateToCountry(countryIso, countryName);
        } else {
          await this.navigateToWorld();
        }
      } else if (this.state.level === 'country') {
        // From country back to world
        await this.navigateToWorld();
      }
      // Already at world level - do nothing
    }

    // Private rendering methods
    private async renderWorldView() {
      try {
        // Show ALL countries
        if (worldPolygons?.length) {
          this.globe?.setPolygonsData(worldPolygons);
          polygonsVisible = true;
        }
        this.globe?.refreshPolyColors?.();
        this.globe?.refreshPolyAltitudes?.();
        this.globe?.refreshPolyLabels?.();
        
        // Clear subdivision labels
        subdivisionLabels = [];
        updateSubdivisionLabels(false);
        
        console.log('[Navigation] World view rendered - showing all countries');
      } catch (error) {
        console.error('[Navigation] Error rendering world view:', error);
      }
    }

    private async renderCountryView(iso: string, countryPolygons: any[]) {
      try {
        // Show ONLY the selected country with its subdivisions (NO world background)
        const markedPolygons = countryPolygons.map(poly => ({
          ...poly,
          properties: {
            ...poly.properties,
            _isParent: true,
            _parentCountry: iso
          }
        }));
        
        // Set ONLY the country polygons (no world background)
        this.globe?.setPolygonsData(markedPolygons);
        this.globe?.refreshPolyColors?.();
        this.globe?.refreshPolyAltitudes?.();
        this.globe?.refreshPolyLabels?.();
        
        // Generate and show subdivision labels
        const labels = generateSubdivisionLabels(markedPolygons);
        console.log('[Navigation] Raw polygons for labels:', markedPolygons.length, 'polygons');
        console.log('[Navigation] Generated labels:', labels);
        subdivisionLabels = labels;
        updateSubdivisionLabels(true);
        
        console.log('[Navigation] Generated', labels.length, 'subdivision labels for country view');
        
        console.log('[Navigation] Country view rendered for', iso, '- showing ONLY this country (no world background)');
      } catch (error) {
        console.error('[Navigation] Error rendering country view:', error);
      }
    }

    private async renderSubdivisionView(countryIso: string, subdivisionId: string, subdivisionPolygons: any[]) {
      try {
        // Filter out null or invalid polygons first
        const validPolygons = subdivisionPolygons.filter(poly => {
          if (!poly) {
            console.warn('[Navigation] Filtering out null polygon in subdivision view');
            return false;
          }
          if (!poly.geometry || !poly.geometry.type) {
            console.warn('[Navigation] Filtering out polygon with invalid geometry in subdivision view:', poly);
            return false;
          }
          if (!poly.properties) {
            console.warn('[Navigation] Filtering out polygon without properties in subdivision view:', poly);
            return false;
          }
          return true;
        });
        
        console.log('[Navigation] Filtered', subdivisionPolygons.length - validPolygons.length, 'invalid polygons in subdivision view, keeping', validPolygons.length, 'valid ones');
        
        if (validPolygons.length === 0) {
          console.error('[Navigation] No valid polygons found for subdivision view');
          return;
        }
        
        // Show ONLY the selected subdivision (no country or world background)
        const markedPolygons = validPolygons.map(poly => ({
          ...poly,
          properties: {
            ...poly.properties,
            _isChild: true,
            _parentCountry: countryIso,
            _parentSubdivision: subdivisionId,
            _subdivisionName: poly.properties?.NAME_2 || poly.properties?.name_2 || 
                             poly.properties?.NAME || poly.properties?.name ||
                             poly.properties?.VARNAME_2 || poly.properties?.varname_2
          }
        }));
        
        // Set ONLY the subdivision polygons (no background)
        this.globe?.setPolygonsData(markedPolygons);
        this.globe?.refreshPolyColors?.();
        this.globe?.refreshPolyAltitudes?.();
        this.globe?.refreshPolyLabels?.();
        
        // Generate and show sub-subdivision labels
        const labels = generateSubdivisionLabels(markedPolygons);
        subdivisionLabels = labels;
        updateSubdivisionLabels(true);
        
        console.log('[Navigation] Generated', labels.length, 'sub-subdivision labels for subdivision view');
        
        console.log('[Navigation] Subdivision view rendered for', subdivisionId, '- showing ONLY this subdivision (no background)');
      } catch (error) {
        console.error('[Navigation] Error rendering subdivision view:', error);
      }
    }

    // Private data loading methods
    private async loadCountryPolygons(iso: string): Promise<any[]> {
      // Check cache first
      if (this.polygonCache.has(iso)) {
        return this.polygonCache.get(iso)!;
      }

      try {
        const polygons = await loadCountryTopoAsGeoFeatures(iso);
        this.polygonCache.set(iso, polygons);
        localPolygons = polygons; // Update global reference
        currentLocalIso = iso;
        return polygons;
      } catch (error) {
        console.error('[Navigation] Error loading country polygons:', error);
        return [];
      }
    }

    private async loadSubdivisions(iso: string): Promise<void> {
      try {
        const firstSubdivision = await findFirstAvailableSubdivision(iso);
        if (firstSubdivision) {
          await this.loadSubdivisionPolygons(iso, firstSubdivision);
        }
      } catch (error) {
        console.warn('[Navigation] Could not load subdivisions for', iso, error);
      }
    }

    private async loadSubdivisionPolygons(countryIso: string, subdivisionId: string): Promise<any[]> {
      const key = `${countryIso}/${subdivisionId}`;
      
      // Check cache first
      if (this.polygonCache.has(key)) {
        return this.polygonCache.get(key)!;
      }

      try {
        const polygons = await loadSubregionTopoAsGeoFeatures(countryIso, subdivisionId);
        this.polygonCache.set(key, polygons);
        return polygons;
      } catch (error) {
        console.error('[Navigation] Error loading subdivision polygons:', error);
        return [];
      }
    }

    // Getters
    getState(): NavigationState { return { ...this.state }; }
    getHistory(): typeof this.history { return [...this.history]; }
    getCurrentLevel(): NavigationLevel { return this.state.level; }
  }

  // Initialize navigation manager
  let navigationManager: NavigationManager;
  $: if (globe && !navigationManager) {
    navigationManager = new NavigationManager(globe);
  }

  // Find first available subdivision for a country
  async function findFirstAvailableSubdivision(iso: string): Promise<string | null> {
    // Try common subdivision patterns
    const patterns = [`${iso}.1`, `${iso}.01`, `${iso}.001`];
    
    for (const pattern of patterns) {
      try {
        const path = `/geojson/${iso}/${pattern}.topojson`;
        const resp = await fetch(path, { method: 'HEAD' });
        if (resp.ok) {
          return pattern;
        }
      } catch {}
    }
    
    return null;
  }

  // Label generation functions for zoom-based display with Level of Detail (LOD)
  async function updateLabelsForCurrentView(pov: { lat: number; lng: number; altitude: number }) {
    try {
      const currentLevel = navigationManager?.getCurrentLevel() || 'world';
      
      console.log(`[LOD] Altitude: ${pov.altitude.toFixed(3)}, Level: ${currentLevel}`);
      
      // Lógica simplificada: mostrar etiquetas según altitud y nivel
      if (currentLevel === 'world' && pov.altitude < COUNTRY_LABELS_ALT) {
        console.log('[LOD] Showing world country labels');
        await generateWorldCountryLabels();
      } else if (currentLevel === 'country' && pov.altitude < SUBDIVISION_LABELS_ALT) {
        console.log('[LOD] Showing subdivision labels');
        const state = navigationManager?.getState();
        if (state?.countryIso) {
          await generateCountrySubdivisionLabels(state.countryIso, pov);
        }
      } else if (currentLevel === 'subdivision' && pov.altitude < DETAILED_LABELS_ALT) {
        console.log('[LOD] Showing detailed subdivision labels');
        const state = navigationManager?.getState();
        if (state?.countryIso && state?.subdivisionId) {
          await generateSubSubdivisionLabels(state.countryIso, state.subdivisionId, pov);
        }
      } else {
        // Ocultar todas las etiquetas si no se cumplen las condiciones
        console.log('[LOD] Hiding all labels - conditions not met');
        updateSubdivisionLabels(false);
      }
    } catch (e) {
      console.warn('[Labels] Error updating labels for current view:', e);
    }
  }

  async function generateWorldCountryLabels() {
    try {
      if (!worldPolygons?.length) return;
      
      // Generate labels for world countries
      const labels = worldPolygons.map((feat, index) => {
        const centroid = centroidOf(feat);
        const name = nameOf(feat);
        const iso = isoOf(feat);
        
        return {
          id: `country-${iso || index}`,
          name: name || iso || `Country-${index}`,
          lat: centroid.lat,
          lng: centroid.lng,
          text: name || iso,
          size: 12,
          color: '#ffffff',
          opacity: 0.8
        };
      }).filter(label => label.text);
      
      subdivisionLabels = labels;
      updateSubdivisionLabels(true);
      
      console.log('[Labels] Generated', labels.length, 'world country labels');
    } catch (e) {
      console.warn('[Labels] Error generating world country labels:', e);
    }
  }

  // Generar solo el nombre del país actual cuando estamos en nivel país pero lejos
  async function generateCountryNameLabel() {
    try {
      const state = navigationManager?.getState();
      if (!state?.countryIso) return;
      
      // Obtener el centroide del país desde el cache
      const centroid = countryCentroidCache.get(state.countryIso);
      if (!centroid) return;
      
      // Obtener el nombre del país desde el historial de navegación
      const countryName = navigationManager?.getHistory()?.find(h => h.level === 'country')?.name || state.countryIso;
      
      const labels = [{
        id: `country-name-${state.countryIso}`,
        name: countryName,
        lat: centroid.lat,
        lng: centroid.lng,
        text: countryName,
        size: 16,
        color: '#ffffff',
        opacity: 1.0
      }];
      
      subdivisionLabels = labels;
      updateSubdivisionLabels(true);
      
      console.log('[Labels] Generated country name label:', countryName);
    } catch (e) {
      console.warn('[Labels] Error generating country name label:', e);
    }
  }

  // Generar solo el nombre de la subdivisión actual cuando estamos en nivel subdivisión pero no muy cerca
  async function generateSubdivisionNameLabel() {
    try {
      const state = navigationManager?.getState();
      if (!state?.countryIso || !state?.subdivisionId) return;
      
      // Obtener el centroide de la subdivisión desde el cache
      const subdivisionKey = `${state.countryIso}/${state.subdivisionId}`;
      const centroid = subregionCentroidCache.get(subdivisionKey);
      if (!centroid) {
        // Si no tenemos el centroide en cache, intentar calcularlo desde los polígonos
        const subdivisionPolygons = navigationManager?.['polygonCache']?.get(subdivisionKey);
        if (subdivisionPolygons?.length) {
          const calculatedCentroid = centroidOf(subdivisionPolygons[0]);
          subregionCentroidCache.set(subdivisionKey, calculatedCentroid);
        } else {
          return;
        }
      }
      
      // Obtener el nombre de la subdivisión desde el historial de navegación
      const subdivisionName = navigationManager?.getHistory()?.find(h => h.level === 'subdivision')?.name || state.subdivisionId;
      
      const finalCentroid = centroid || subregionCentroidCache.get(subdivisionKey);
      if (!finalCentroid) return;
      
      const labels = [{
        id: `subdivision-name-${state.subdivisionId}`,
        name: subdivisionName,
        lat: finalCentroid.lat,
        lng: finalCentroid.lng,
        text: subdivisionName,
        size: 14,
        color: '#ffffff',
        opacity: 1.0
      }];
      
      subdivisionLabels = labels;
      updateSubdivisionLabels(true);
      
      console.log('[Labels] Generated subdivision name label:', subdivisionName);
    } catch (e) {
      console.warn('[Labels] Error generating subdivision name label:', e);
    }
  }

  async function generateCountrySubdivisionLabels(iso: string, pov: { lat: number; lng: number; altitude: number }) {
    try {
      // Level 1 subdivisions are in ISO.topojson (e.g., RUS.topojson, ESP.topojson)
      // First try to get from NavigationManager cache
      let countryPolygons = navigationManager?.['polygonCache']?.get(iso);
      
      if (!countryPolygons?.length) {
        // If not in cache, load the subdivision file directly
        console.log('[Labels] Loading subdivision file for zoom labels:', `${iso}.topojson`);
        try {
          countryPolygons = await loadSubregionTopoAsGeoFeatures(iso, iso);
        } catch (e) {
          console.warn('[Labels] Could not load subdivision file:', `${iso}.topojson`, e);
          return;
        }
      }
      
      if (countryPolygons?.length) {
        // Use the existing generateSubdivisionLabels function that works correctly
        const labels = generateSubdivisionLabels(countryPolygons);
        subdivisionLabels = labels;
        updateSubdivisionLabels(true);
        
        console.log('[Labels] Generated', labels.length, 'subdivision labels for', iso, 'from', `${iso}.topojson`);
      } else {
        console.warn('[Labels] No subdivision polygons found for', iso);
      }
    } catch (e) {
      console.warn('[Labels] Error generating country subdivision labels:', e);
    }
  }

  async function generateSubSubdivisionLabels(countryIso: string, subdivisionId: string, pov: { lat: number; lng: number; altitude: number }) {
    try {
      // For sub-subdivisions, look for separate files like ESP.1.topojson, RUS.40.topojson, etc.
      // Extract the numeric part from subdivisionId (e.g., "RUS.40" -> "40", "ESP.1" -> "1")
      const numericPart = subdivisionId.split('.').pop();
      if (!numericPart) {
        console.log('[Labels] Cannot extract numeric part from subdivisionId:', subdivisionId);
        return;
      }
      
      // The pattern is always: ISO.number.topojson (e.g., ESP.1, RUS.40)
      const subdivisionFile = `${countryIso}.${numericPart}`;
      
      console.log('[Labels] Looking for sub-subdivision file:', subdivisionFile);
      
      try {
        // Check if the subdivision file exists
        const path = `/geojson/${countryIso}/${subdivisionFile}.topojson`;
        const resp = await fetch(path, { method: 'HEAD' });
        
        if (resp.ok) {
          console.log('[Labels] Found sub-subdivision file:', path);
          const subSubPolygons = await loadSubregionTopoAsGeoFeatures(countryIso, subdivisionFile);
          
          if (subSubPolygons?.length) {
            // Filter out null or invalid polygons
            const validPolygons = subSubPolygons.filter(poly => {
              if (!poly) {
                console.warn('[Labels] Filtering out null polygon');
                return false;
              }
              if (!poly.geometry || !poly.geometry.type) {
                console.warn('[Labels] Filtering out polygon with invalid geometry:', poly);
                return false;
              }
              if (!poly.properties) {
                console.warn('[Labels] Filtering out polygon without properties:', poly);
                return false;
              }
              return true;
            });
            
            console.log('[Labels] Filtered', subSubPolygons.length - validPolygons.length, 'invalid polygons, keeping', validPolygons.length, 'valid ones');
            
            if (validPolygons.length === 0) {
              console.warn('[Labels] No valid polygons found in', subdivisionFile);
              return;
            }
            
            // Mark polygons as level 2 (sub-subdivisions) so they use NAME_2
            const markedPolygons = validPolygons.map(poly => ({
              ...poly,
              properties: {
                ...poly.properties,
                _isLevel2: true, // Mark as level 2 for NAME_2 extraction
                _parentCountry: countryIso,
                _parentSubdivision: subdivisionId
              }
            }));
            
            const labels = generateSubdivisionLabels(markedPolygons);
            subdivisionLabels = labels;
            updateSubdivisionLabels(true);
            
            console.log('[Labels] Generated', labels.length, 'sub-subdivision labels (NAME_2) for', subdivisionId, 'from file', subdivisionFile);
            return;
          }
        } else {
          console.log('[Labels] Sub-subdivision file not found:', path, '(this is normal if no level 2 subdivisions exist)');
        }
      } catch (e) {
        console.log('[Labels] Error loading sub-subdivision file:', subdivisionFile, e instanceof Error ? e.message : String(e));
      }
      
      // Fallback: keep current subdivision labels (level 1)
      console.log('[Labels] No sub-subdivision file available for', subdivisionId, '- keeping current labels');
    } catch (e) {
      console.warn('[Labels] Error generating sub-subdivision labels:', e);
    }
  }

  // Debounce functions for map movement
  function onMapMovementStart() {
    isMapMoving = true;
    if (mapMovementTimeout) {
      clearTimeout(mapMovementTimeout);
      mapMovementTimeout = null;
    }
    console.log('[Movement] Map movement started - pausing polygon/label updates');
  }

  function onMapMovementEnd() {
    if (mapMovementTimeout) {
      clearTimeout(mapMovementTimeout);
    }
    
    mapMovementTimeout = setTimeout(async () => {
      isMapMoving = false;
      console.log('[Movement] Map stopped - resuming polygon/label updates');
      
      // Trigger polygon and label updates now that map is stopped
      const pov = globe?.pointOfView?.();
      if (pov) {
        try {
          await ensureLocalCountryPolygons(pov);
          await ensureSubregionPolygons(pov);
          updateMarkers(true);
        } catch (e) {
          console.warn('[Movement] Error updating after map stop:', e);
        }
      }
    }, MAP_STOP_DELAY);
  }


  // Disabled vote markers - now using subdivision labels instead
  function updateMarkers(visible: boolean) {
    // Vote markers disabled - subdivision labels are used instead
    return;
  }

  // Cluster regional votes by tag using a viewport-dependent grid
  function clusterRegionalVotes(
    votes: VotePoint[],
    pov: { lat: number; lng: number; altitude: number } | undefined,
    cam: { fov: number; aspect: number } | undefined
  ): ClusterPoint[] {
    const res: ClusterPoint[] = [];
    if (!votes || votes.length === 0) return res;
    // Filtrar por tags que tengan color asignado
    const valid = votes.filter((v) => {
      const t = (v.tag ?? '').toString();
      return !!t && !!colorMap?.[t];
    });
    if (valid.length === 0) return res;
    // Estimar span visible en grados
    const povSafe = pov ?? { lat: 0, lng: 0, altitude: 1 } as any;
    const base = Math.min(120, Math.max(2, povSafe.altitude * 70));
    const fov = cam?.fov ?? 50;
    const aspect = cam?.aspect ?? 1.6;
    const vFactor = fov / 50;
    const spanLat = base * vFactor;
    const spanLng = spanLat * Math.max(1, aspect);
    // Definir tamaño de celda: más celdas cuando estamos cerca
    const cells = Math.round(Math.max(14, Math.min(40, 24 * (1 / Math.max(0.3, Math.min(3, povSafe.altitude))))));
    const stepLat = Math.max(0.1, spanLat / cells);
    const stepLng = Math.max(0.1, spanLng / cells);

    // Mapear por tag -> grid -> acumulación
    const byTag = new Map<string, Map<string, { latSum: number; lngSum: number; count: number }>>();
    for (const v of valid) {
      const tag = (v.tag as string);
      const gx = Math.floor(v.lng / stepLng);
      const gy = Math.floor(v.lat / stepLat);
      const key = `${gx}:${gy}`;
      let grid = byTag.get(tag);
      if (!grid) { grid = new Map(); byTag.set(tag, grid); }
      let acc = grid.get(key);
      if (!acc) { acc = { latSum: 0, lngSum: 0, count: 0 }; grid.set(key, acc); }
      acc.latSum += v.lat; acc.lngSum += v.lng; acc.count += 1;
    }
    // Convertir a clusters por tag
    for (const [tag, grid] of byTag.entries()) {
      for (const acc of grid.values()) {
        res.push({ tag, lat: acc.latSum / acc.count, lng: acc.lngSum / acc.count, count: acc.count });
      }
    }
    return res;
  }

  // Reaccionar a cambios de props (modo data-in)
  $: if (geo && dataJson) {
    initFrom(geo, dataJson);
  }

  
  // Bottom sheet (tipo Google Maps)
  let selectedCountryName: string | null = null;
  let selectedCountryIso: string | null = null;
  let SHEET_STATE: SheetState = 'hidden';
  const BOTTOM_BAR_PX = 0; // altura del menú inferior
  const EXPAND_SNAP_PX = 10; // umbral de arrastre hacia arriba para expandir totalmente (más sensible)
  const COLLAPSED_VISIBLE_RATIO = 0.27; // en estado colapsado, se ve el 30% superior de la sheet
  const PEEK_VISIBLE_RATIO = 0.10;      // tercer stop: 10% visible
  // Inicializa fuera de pantalla para evitar parpadeo visible al cargar
  let sheetY = 10000; // translateY actual en px (0 = expandido, >0 hacia abajo)
  let sheetCtrl: BottomSheetController;
  // Feed (encuestas) en modo expandido
  let feedCount = 10;
  let isLoadingMore = false;
  $: if (SHEET_STATE === 'expanded') { feedCount = 10; }
  
  function onSheetScroll(e: Event) {
    if (SHEET_STATE !== 'expanded') return;
    const el = e.currentTarget as HTMLElement | null;
    if (!el || isLoadingMore) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
    if (nearBottom) {
      isLoadingMore = true;
      // Simular pequeña latencia para UX; aumentar lote de elementos
      setTimeout(() => {
        feedCount += 10;
        isLoadingMore = false;
      }, 80);
    }
  }


  function setSheetState(state: SheetState) {
    try { sheetCtrl?.setState(state); } catch {}
  }
  function onWindowResizeForSheet() {
    try { sheetCtrl?.onWindowResize(); } catch {}
  }
  function onSheetPointerDown(e: PointerEvent | TouchEvent) { try { sheetCtrl?.pointerDown(e); } catch {} }

  // Controles de color (color pickers) y opacidad (sliders)
  let capColor = '#ff0000';        // color principal países
  let capOpacityPct = 100;         // 0-100
  let sphereColor = '#441220';     // color esfera (océanos)
  let sphereOpacityPct = 100;      // 0-100
  let strokeColor = '#961A50';     // color del trazo (bordes)
  let strokeOpacityPct = 75;       // 0-100

  // Colores derivados (conveniencia)
  let capBaseColor = capColor;
  let sphereBaseColor = sphereColor;
  let strokeBaseColor = strokeColor;
  let showSettings = false;
  let panelTop = 52; // posición vertical del panel de ajustes
  let panelEl: HTMLDivElement | null = null;
  // Fondo del lienzo (color de background del globo)
  let bgColor = '#111827';
  // Filtros/Trending
  let activeTag: string | null = null; // etiqueta seleccionada para resaltar
  // Votos regionales (para renderizar marcadores cuando estamos cerca)
  type VotePoint = { id: string; iso3: string; lat: number; lng: number; tag?: string };
  type ClusterPoint = { lat: number; lng: number; tag: string; count: number };
  let regionVotes: VotePoint[] = [];
  // Cache de clústeres para evitar "bailes" al rotar
  let clusteredVotes: ClusterPoint[] = [];
  let lastClusterAlt = -1;
  
  // Etiquetas de subdivisiones (para mostrar nombres permanentemente)
  type SubdivisionLabel = { id: string; name: string; lat: number; lng: number };
  let subdivisionLabels: SubdivisionLabel[] = [];
  let labelsInitialized = false;
  
  // Variable para mostrar la altitud actual
  let currentAltitude = 3.5;
  
  // Debounce para cargar polígonos solo cuando el mapa esté parado
  let mapMovementTimeout: NodeJS.Timeout | null = null;
  let isMapMoving = false;
  const MAP_STOP_DELAY = 300; // ms para considerar que el mapa está parado
  let tagQuery = '';
  let showSearch = false;
  // Estado de las pestañas superiores (ya declarado arriba junto con dataset)
  // Alternar línea visible (hashtags vs cuentas) según dirección de scroll
  let showAccountsLine = false; // false => hashtags, true => cuentas
  // Modo del toggle minimal en tabs ("#" o "@")
  let symbolMode: '#' | '@' = '#';
  let lastScrollY = 0;
  function handleScroll() {
    const y = window.scrollY || 0;
    // Ya no alternamos barras con el scroll; solo actualizamos el estado interno
    lastScrollY = y;
  }
  // Soporte para wheel/touch cuando la ventana no desplaza (layout fijo)
  let wheelAcc = 0;
  const switchThreshold = 40; // px acumulados antes de alternar
  function handleWheel(e: WheelEvent) {
    wheelAcc += e.deltaY;
    // Sin alternar: resetear acumulador si se supera umbral para evitar overflow
    if (wheelAcc > switchThreshold || wheelAcc < -switchThreshold) { wheelAcc = 0; }
  }
  let touchStartY = 0;
  function onTouchStart(e: TouchEvent) { touchStartY = e.touches?.[0]?.clientY ?? 0; }
  function onTouchMove(e: TouchEvent) {
    const y = e.touches?.[0]?.clientY ?? 0;
    const dy = y - touchStartY;
    // No alternar con gestos; solo actualizar ancla para no acumular delta indefinidamente
    if (dy <= -30 || dy >= 30) { touchStartY = y; }
  }



  // Estado: elementos vistos (para ring del avatar)
  let seenSet: Set<string> = new Set();
  const seenKeyForTag = (k: string) => `#${k}`;
  const seenKeyForAccount = (h: string) => `@${h}`;
  const isSeen = (key: string) => seenSet.has(key);
  function markSeen(key: string) {
    if (!seenSet.has(key)) {
      const next = new Set(seenSet);
      next.add(key);
      seenSet = next;
    }
  }
 
  // Listas separadas para mostrar por línea
  // Declaraciones para variables reactivas derivadas de Para ti
  let paraTiTags: Array<{ type: 'tag'; key: string }> = [];
  let paraTiAccounts: Array<{ type: 'account'; handle: string; avatar: string }> = [];
  // Declaraciones para listas derivadas de Tendencias
  let trendingTagsOnly: Array<{ type: 'tag'; key: string }> = [];
  let trendingAccountsOnly: Array<{ type: 'account'; handle: string; avatar: string }> = [];
 
  

  // Activar/desactivar teselas OSM según visibilidad de polígonos
  function setTilesEnabled(enabled: boolean) {
    try {
      if (globe && typeof globe.setTilesEnabled === 'function') {
        globe.setTilesEnabled(enabled);
      }
    } catch {}
  }




  // Volar a mi ubicación
  async function locateMe() {
    try {
      if (!('geolocation' in navigator)) {
        alert('Geolocalización no disponible en este dispositivo/navegador.');
        return;
      }
      if (!(window.isSecureContext)) {
        alert('La geolocalización requiere conexión segura (https) en móviles. Abre el sitio con https.');
        return;
      }
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      // Detener cualquier rotación automática antes de mover la cámara
     
      const targetAltitude = MIN_ZOOM_ALTITUDE; // límite mínimo permitido
      if (polygonsVisible && targetAltitude < ALT_THRESHOLD) {
        globe?.setPolygonsData([]);
        polygonsVisible = false;
        setTilesEnabled(true);
      }
      globe?.pointOfView({ lat, lng, altitude: targetAltitude }, 1000);
    } catch (e) {
      console.warn('No se pudo obtener la ubicación:', e);
      alert('No se pudo obtener tu ubicación. Revisa permisos de ubicación del navegador.');
    }
  }

  // Util para rotular desde diversas propiedades
  function nameOf(d: any): string { return nameOfUtil(d); }

  // (el conversor HSL ya no es necesario)

  // geo helpers moved to $lib/utils/geo

  

  function opacityForIso(iso: string): number { return opacityForIsoUtil(iso, isoIntensity, intensityMin, intensityMax); }

  // Opacidad para hashtag según totales normalizados
  function alphaForTag(key: string): number { return alphaForTagUtil(key, tagTotals, tagMin, tagMax); }

  function baseCapColor(feat: any): string {
    const iso = isoOf(feat);
    const intensityAlpha = opacityForIso(iso);
    let factor = clamp(capOpacityPct / 100, 0, 1);
    
    // Aplicar opacidad personalizada si el polígono tiene metadatos de jerarquía
    const customOpacity = feat?.properties?._opacity;
    if (typeof customOpacity === 'number') {
      factor *= customOpacity;
    }
    
    return hexToRgba(capBaseColor, intensityAlpha * factor);
  }

  // Actualiza visibilidad de polígonos según altitud (para usar fuera de onMount)
  async function updatePolygonsVisibilityExt() {
    try {
      const pov = globe?.pointOfView();
      if (!pov) return;
      if (pov.altitude > MAX_ZOOM_ALTITUDE) {
        globe?.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: MAX_ZOOM_ALTITUDE }, 0);
        return;
      }
      if (pov.altitude < MIN_ZOOM_ALTITUDE) {
        globe?.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: MIN_ZOOM_ALTITUDE }, 0);
        return;
      }
      if (pov.altitude < ALT_THRESHOLD) {
        console.log('[Vis]', 'ALT<th', { alt: pov.altitude.toFixed(3), ALT_THRESHOLD, currentLocalIso, polygonsVisible });
        // Activar tiles y alternar a polígonos locales del país centrado
        if (polygonsVisible) {
          polygonsVisible = false; // deja de estar visible el dataset global
          setTilesEnabled(true);
        }
        try {
          console.log('[Vis] calling ensureLocalCountryPolygons');
          await ensureLocalCountryPolygons(pov);
        } catch {}
        // Si estamos aún más cerca, intentar cargar subregión por ID_1 (después de tener localPolygons)
        try {
          console.log('[Vis] calling ensureSubregionPolygons');
          await ensureSubregionPolygons(pov);
        } catch {}
        // Mostrar/actualizar marcadores en cada cambio mientras estamos cerca
        try { updateMarkers(true); } catch {}
      } else {
        // DISABLED: Auto-loading world polygons on zoom out - now controlled by NavigationManager
        console.log('[Zoom] Auto-loading world polygons disabled - use NavigationManager instead');
        // Reiniciar estado de subregión
        currentSubregionId1 = null;
      }
    } catch {}
  }

  // Calcular un bbox aproximado a partir del POV actual y parámetros de cámara
  function povToBBox(pov: { lat: number; lng: number; altitude: number }) {
    // Base: span en grados proporcional a la altitud
    const base = Math.min(120, Math.max(2, pov.altitude * 70));
    const cam = globe?.getCameraParams?.();
    const fov = cam?.fov ?? 50;      // vertical FOV en grados
    const aspect = cam?.aspect ?? 1.6; // w/h
    // Ajustes: más FOV => más cobertura; más aspect => más ancho
    const vFactor = fov / 50; // 50 es referencia por defecto
    const spanLat = base * vFactor;
    const spanLng = spanLat * Math.max(1, aspect);
    const halfLat = spanLat / 2;
    const halfLng = spanLng / 2;
    let minLat = Math.max(-90, pov.lat - halfLat);
    let maxLat = Math.min(90, pov.lat + halfLat);
    let minLng = pov.lng - halfLng;
    let maxLng = pov.lng + halfLng;
    // Normalizar longitudes a [-180,180]
    const norm = (x: number) => ((x + 180 + 360 * 10) % 360) - 180;
    minLng = norm(minLng);
    maxLng = norm(maxLng);
    return { minLat, minLng, maxLat, maxLng };
  }

  // Fetch de datos regionales (si el padre provee loadRegionData)
  let _fetchTimer: number | null = null;
  let _lastFetchHash = '';
  async function maybeFetchRegion() {
    if (!globe) return;
    const pov = globe?.pointOfView?.();
    if (!pov) return;
    // Solo si estamos en zoom cercano (mostrar tiles)
    if (pov.altitude >= ALT_THRESHOLD) return;
    const bbox = povToBBox(pov as any);
    const hash = `${Math.round(bbox.minLat)}:${Math.round(bbox.minLng)}:${Math.round(bbox.maxLat)}:${Math.round(bbox.maxLng)}:${Math.round(pov.altitude*100)/100}`;
    if (_lastFetchHash === hash) return;
    _lastFetchHash = hash;
    try {
      let regionData: any = null;
      if (loadRegionData) {
        regionData = await loadRegionData(bbox);
      } else {
        // Fallback por defecto al endpoint interno
        const qs = new URLSearchParams({
          minLat: String(bbox.minLat),
          minLng: String(bbox.minLng),
          maxLat: String(bbox.maxLat),
          maxLng: String(bbox.maxLng)
        });
        const resp = await fetch(`/api/data/answers?${qs.toString()}`);
        if (resp.ok) regionData = await resp.json();
      }
      if (regionData) {
        // No recalculamos VM global; solo actualizamos puntos regionales
        try {
          const votesArr = Array.isArray(regionData?.votes) ? regionData.votes : [];
          regionVotes = votesArr as VotePoint[];
          // Forzar recálculo de clústeres cuando llegan nuevos datos
          clusteredVotes = [];
          lastClusterAlt = -1;
          updateMarkers(true);
        } catch {}
      }
    } catch (err) {
      console.warn('Fallo al cargar datos regionales:', err);
    }
  }

  // DISABLED: Zoom-based polygon loading removed - now handled by NavigationManager only
  async function ensureLocalCountryPolygons(pov: { lat: number; lng: number; altitude: number } | undefined) {
    // This function is now disabled - polygon loading only happens via clicks
    console.log('[Country] Zoom-based polygon loading disabled - use click navigation instead');
    return;
  }

  function nearestCountryIso(lat: number, lng: number): string | null {
    try {
      if (!worldPolygons || worldPolygons.length === 0) return null;
      
      // First, try point-in-polygon detection
      for (const feat of worldPolygons) {
        const iso = isoOf(feat);
        if (!iso) continue;
        
        if (pointInFeature(lat, lng, feat)) {
          console.log('[Country] Point-in-polygon match:', iso, 'at', lat.toFixed(4), lng.toFixed(4));
          return iso;
        }
      }
      
      // Fallback: nearest centroid (for edge cases or ocean points)
      let bestIso: string | null = null;
      let bestD = Infinity;
      for (const feat of worldPolygons) {
        const iso = isoOf(feat);
        if (!iso) continue;
        let c = countryCentroidCache.get(iso);
        if (!c) { c = centroidOf(feat); countryCentroidCache.set(iso, c); }
        const d = Math.abs(c.lat - lat) + Math.abs((((lng - c.lng + 540) % 360) - 180));
        if (d < bestD) { bestD = d; bestIso = iso; }
      }
      
      if (bestIso) {
        console.log('[Country] Fallback centroid match:', bestIso, 'at', lat.toFixed(4), lng.toFixed(4));
      }
      
      return bestIso;
    } catch { return null; }
  }

  async function loadCountryTopoAsGeoFeatures(iso: string): Promise<any[]> {
    const path = `/geojson/${iso}/${iso}.topojson`;
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} al cargar ${path}`);
    const topo = await resp.json();
    // Carga dinámica de topojson-client para convertir a GeoJSON
    const mod = await import(/* @vite-ignore */ 'topojson-client');
    const objects = topo.objects || {};
    const firstKey = Object.keys(objects)[0];
    if (!firstKey) return [];
    const fc = (mod as any).feature(topo, objects[firstKey]);
    const feats: any[] = Array.isArray(fc?.features) ? fc.features : [];
    for (const f of feats) {
      if (!f.properties) f.properties = {};
      if (!f.properties.ISO_A3) f.properties.ISO_A3 = iso;
    }
    return feats;
  }

  // Old handlePolygonClick function removed - now using new click-based navigation system

  function getDominantKey(iso: string): string { return getDominantKeyUtil(iso, answersData); }

  function polyCapColor(feat: any): string {
    // Si hay una etiqueta activa, resaltamos solo países relacionados con esa etiqueta
    const iso = isoOf(feat);
    if (activeTag) {
      const rec = answersData?.[iso];
      const has = rec && Number(rec[activeTag] ?? 0) > 0;
      if (!has) {
        // País no relacionado: atenuar
        return hexToRgba(capBaseColor, 0.1);
      }
      // País relacionado: resaltar según el modo
      if (mode === 'trend') {
        return colorMap?.[activeTag] ?? hexToRgba(capBaseColor, 0.9);
      } else {
        const alpha = Math.max(opacityForIso(iso), 0.6);
        return hexToRgba(capBaseColor, alpha);
      }
    }
    if (mode === 'intensity') return baseCapColor(feat);
    const key = isoDominantKey[iso] ?? getDominantKey(iso);
    return colorMap?.[key] ?? colorMap?.['No data'] ?? capBaseColor;
  }

  // Reactivo: aplicar cambios de color/opacity
  $: capBaseColor = capColor;
  $: sphereBaseColor = sphereColor;
  $: strokeBaseColor = strokeColor;
  // El modo ahora lo controla la barrita inferior

  // Segmentos de chart por país seleccionado (top categorías por votos)
  type ChartSeg = { key: string; value: number; pct: number; color: string };
  let countryChartSegments: ChartSeg[] = [];
  
  // Function to generate chart segments from data
  function generateCountryChartSegments(data: Record<string, number>[]): ChartSeg[] {
    if (!data || data.length === 0) return [];
    
    // Aggregate data by key
    const aggregated: Record<string, number> = {};
    data.forEach(item => {
      if (item && typeof item === 'object') {
        Object.entries(item).forEach(([key, value]) => {
          const numValue = typeof value === 'number' ? value : Number(value) || 0;
          aggregated[key] = (aggregated[key] || 0) + numValue;
        });
      }
    });
    
    const entries = Object.entries(aggregated).map(([k, v]) => [k, v] as [string, number]);
    const total = entries.reduce((a, [, n]) => a + n, 0);
    if (total <= 0) return [];
    
    entries.sort((a, b) => b[1] - a[1]);
    const TOP_N = 6;
    const top = entries.slice(0, TOP_N);
    const rest = entries.slice(TOP_N);
    const restSum = rest.reduce((a, [, n]) => a + n, 0);
    
    const segs: ChartSeg[] = top.map(([k, n]) => ({ 
      key: k, 
      value: n, 
      pct: (n / total) * 100, 
      color: colorMap?.[k] ?? '#9ca3af' 
    }));
    
    if (restSum > 0) {
      segs.push({ 
        key: 'Otros', 
        value: restSum, 
        pct: (restSum / total) * 100, 
        color: 'rgba(148,163,184,0.45)' 
      });
    }
    
    return segs;
  }
  
  $: countryChartSegments = (() => {
    if (!selectedCountryIso) return [];
    const rec = answersData?.[selectedCountryIso];
    if (!rec) return [];
    const entries = Object.entries(rec).map(([k, v]) => [k, (typeof v === 'number' ? v : Number(v) || 0)] as [string, number]);
    const total = entries.reduce((a, [, n]) => a + n, 0);
    if (total <= 0) return [];
    entries.sort((a, b) => b[1] - a[1]);
    const TOP_N = 6;
    const top = entries.slice(0, TOP_N);
    const rest = entries.slice(TOP_N);
    const restSum = rest.reduce((a, [, n]) => a + n, 0);
    const segs: ChartSeg[] = top.map(([k, n]) => ({ key: k, value: n, pct: (n / total) * 100, color: colorMap?.[k] ?? '#9ca3af' }));
    if (restSum > 0) segs.push({ key: 'Otros', value: restSum, pct: (restSum / total) * 100, color: 'rgba(148,163,184,0.45)' });
    return segs;
  })();

  // Lista mixta para Tendencias: intercalar hashtags, cuentas y ubicaciones
  type TrendItem =
    | { type: 'tag'; key: string }
    | { type: 'account'; handle: string; avatar: string }
    | { type: 'location'; name: string; lat: number; lng: number };

 
  let trendingMixed: TrendItem[] = [];
  // Derivados de trendingMixed (declarados más arriba)
  $: trendingTagsOnly = trendingMixed.filter((i) => i.type === 'tag');
  $: trendingAccountsOnly = trendingMixed.filter((i) => i.type === 'account');
  // GlobeCanvas actualiza materiales y colores de forma reactiva a través de sus props
  // Si cambia la etiqueta activa, GlobeCanvas actualiza via onPolyCapColor

  onMount(async () => {
    // Inicializar controlador de bottom sheet
    sheetCtrl = new BottomSheetController({
      bottomBarPx: BOTTOM_BAR_PX,
      collapsedVisibleRatio: COLLAPSED_VISIBLE_RATIO,
      peekVisibleRatio: PEEK_VISIBLE_RATIO,
      expandSnapPx: EXPAND_SNAP_PX,
      onChange: (state, y) => { SHEET_STATE = state; sheetY = y; }
    });
    // Si no hay props, cargar desde stores (modo auto)
    if (!geo || !dataJson) {
      if (autoLoad) {
        await loadGlobeData();
        try { await tick(); } catch {}
        const g = getStore(worldMap$);
        const dj = getStore(worldData$);
        if (!g || !dj) {
          console.error('No se pudo cargar datos del globo');
        } else {
          await initFrom(g, dj);
        }
      }
    } else {
      // Si hay props, inicializar desde ellas inmediatamente
      await initFrom(geo, dataJson);
    }

    // Listeners de interacción ya gestionados vía eventos del componente

    // Mostrar/ocultar capa coroplética según altitud de la cámara
    const updatePolygonsVisibility = () => {
      try {
        const pov = globe?.pointOfView();
        if (!pov) return;
        // Limitar el zoom de alejamiento a una altitud máxima (con histéresis ligera)
        if (pov.altitude > MAX_ZOOM_ALTITUDE) {
          globe?.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: MAX_ZOOM_ALTITUDE }, 0);
          return; // evitamos evaluar el resto en este tick
        }
        // Limitar el zoom de acercamiento a una altitud mínima
        if (pov.altitude < MIN_ZOOM_ALTITUDE) {
          globe?.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: MIN_ZOOM_ALTITUDE }, 0);
          return;
        }
        if (pov.altitude < ALT_THRESHOLD) {
          if (polygonsVisible) {
            polygonsVisible = false;
            setTilesEnabled(true); // al acercar, mostrar OSM
          }
          // Asegurar polígonos locales del país centrado
          try { ensureLocalCountryPolygons(pov as any); } catch {}
        } else {
          // DISABLED: Auto-loading world polygons on zoom out - now controlled by NavigationManager
          console.log('[Zoom] Auto-loading world polygons on zoom out disabled - use NavigationManager instead');
        }
        // Recalcular marcadores tras cualquier cambio de visibilidad o POV
      } catch {}
    };
    // Comprobar visibilidad inicial
    updatePolygonsVisibility();

    // Ajuste inicial de tamaño
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('resize', onWindowResizeForSheet);
    // Inicializar la bottom sheet oculta
    setSheetState('hidden');
  });

  function resize() { /* GlobeCanvas maneja su propio tamaño vía CSS */ }

  onDestroy(() => {
    try {
      window.removeEventListener('resize', resize);
      window.removeEventListener('resize', onWindowResizeForSheet);
      try { globe && globe.htmlElementsData && globe.htmlElementsData([]); } catch {}
    } catch {}
    try { sheetCtrl?.destroy(); } catch {}
  });

</script>

<GlobeCanvas
  bind:this={globe}
  {bgColor}
  onPolyCapColor={(feat) => {
    const iso = isoOf(feat);
    const key = isoDominantKey[iso] ?? '';
    return colorMap?.[key] ?? '#9ca3af';
  }}
  on:movementStart={onMapMovementStart}
  on:movementEnd={onMapMovementEnd}
  on:ready={() => {
    try {
      // DISABLED: Auto-loading world polygons on ready - now controlled by NavigationManager
      // Only initialize NavigationManager to world view
      if (navigationManager) {
        navigationManager.navigateToWorld();
      }
      
      setTilesEnabled(false);
      globe?.refreshPolyColors?.();
      updatePolygonsVisibilityExt();
      
      // Inicializar marcadores según altitud actual
      const pov = globe?.pointOfView?.();
      if (pov && pov.altitude < ALT_THRESHOLD) {
        // Zoom-based polygon loading DISABLED - only update markers
        updateMarkers(true);
      } else {
        updateMarkers(false);
      }
    } catch {}
  }}
  on:controlsChange={() => {
    try {
      const pov = globe?.pointOfView?.();
      if (!pov) return;
      
      // APLICAR LÍMITES DE ZOOM ANTES QUE NADA
      if (pov.altitude < MIN_ZOOM_ALTITUDE) {
        globe?.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: MIN_ZOOM_ALTITUDE }, 0);
        return; // Salir para evitar procesar valores inválidos
      }
      if (pov.altitude > MAX_ZOOM_ALTITUDE) {
        globe?.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: MAX_ZOOM_ALTITUDE }, 0);
        return;
      }
      
      // Actualizar altitud para mostrar en la UI
      currentAltitude = pov.altitude;
      
      // Update visibility based on altitude
      const shouldShow = pov.altitude < ALT_THRESHOLD;
      if (shouldShow !== polygonsVisible) {
        polygonsVisible = shouldShow;
        updatePolygonsVisibilityExt();
      }
      
      // Zoom-based polygon loading DISABLED - only update markers and labels with LOD
      if (!isMapMoving) {
        if (pov.altitude < ALT_THRESHOLD) {
          updateMarkers(true);
        } else {
          updateMarkers(false);
        }
      }
      
      // Siempre actualizar etiquetas con el nuevo sistema LOD (incluso durante movimiento)
      updateLabelsForCurrentView(pov).catch(e => console.warn('Label update error:', e));
    } catch {}
  }}
  on:polygonClick={async (e) => {
    if (!navigationManager) return;
    try {
      const feat = e.detail?.feat;
      if (!feat) return;
      
      // Show bottom sheet with polygon data when clicking on polygons
      setSheetState('collapsed');
      
      const currentLevel = navigationManager.getCurrentLevel();
      const iso = isoOf(feat);
      const name = nameOf(feat);
      
      console.log('[Click] Polygon clicked:', { iso, name, currentLevel, feat: feat.properties });
      
      if (currentLevel === 'world' && iso) {
        // Click on country from world view
        console.log('[Click] Country clicked from world:', iso, name);
        
        // Set selected country info for bottom sheet
        selectedCountryName = name;
        selectedCountryIso = iso;
        
        // Update country chart segments for bottom sheet
        const countryRecord = answersData?.[iso];
        if (countryRecord) {
          const countryData = [countryRecord];
          countryChartSegments = generateCountryChartSegments(countryData);
        } else {
          countryChartSegments = [];
        }
        
        // Zoom to country
        const centroid = centroidOf(feat);
        globe?.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: 0.3 }, 700);
        
        // Navigate using manager
        await navigationManager.navigateToCountry(iso, name);
        
      } else if (currentLevel === 'country' && feat.properties?.ID_1) {
        // Click on subdivision from country view
        const subdivisionId = feat.properties.ID_1;
        const subdivisionName = feat.properties.NAME_1 || feat.properties.name_1 || name;
        
        console.log('[Click] Subdivision clicked from country:', subdivisionId, subdivisionName);
        
        // Update selected country info for bottom sheet
        selectedCountryName = subdivisionName;
        selectedCountryIso = iso;
        
        // Update subdivision data for bottom sheet
        const countryRecord = answersData?.[iso];
        if (countryRecord) {
          // For subdivisions, we still use the country-level data since answersData is organized by country ISO
          const subdivisionData = [countryRecord];
          countryChartSegments = generateCountryChartSegments(subdivisionData);
        } else {
          countryChartSegments = [];
        }
        
        // Zoom to subdivision
        const centroid = centroidOf(feat);
        globe?.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: 0.2 }, 500);
        
        // Navigate using manager
        await navigationManager.navigateToSubdivision(iso, subdivisionId, subdivisionName);
      }
    } catch (e) {
      console.error('[Click] Error handling polygon click:', e);
    }
  }}
  on:globeClick={async (e) => {
    if (!navigationManager) return;
    
    try {
      const currentLevel = navigationManager.getCurrentLevel();
      if (currentLevel !== 'world') {
        console.log('[Click] Empty space clicked → Navigating back to previous view');
        
        // Navigate back to previous level
        await navigationManager.navigateBack();
        
        // Adjust zoom based on new level
        const newLevel = navigationManager.getCurrentLevel();
        if (newLevel === 'world') {
          // Vista mundial a 200km de distancia
          const worldViewAltitude = 200000 / 675000; // 0.296 para 200km
          globe?.pointOfView({ lat: 20, lng: 0, altitude: worldViewAltitude }, 1000);
          selectedCountryName = null;
          selectedCountryIso = null;
        } else if (newLevel === 'country') {
          // Stay at country zoom level
          globe?.pointOfView({ lat: globe?.pointOfView()?.lat || 0, lng: globe?.pointOfView()?.lng || 0, altitude: 0.3 }, 700);
        }
      }
    } catch (e) {
      console.error('[Click] Error handling globe click:', e);
    }
  }}
/>
<!-- Degradado superior usando el color de fondo actual -->
<div
  class="globe-top-fade"
  style={`background: linear-gradient(to bottom, ${bgColor} 0%, ${hexToRgba(bgColor, 1)} 25%, ${hexToRgba(bgColor, 0.3)} 70%, transparent 100%)`}
></div>

<!-- Navigation breadcrumb -->
{#if navigationManager && navigationManager.getCurrentLevel() !== 'world'}
<div class="navigation-breadcrumb">
  {#each navigationManager.getHistory() as item, index}
    {#if index > 0}
      <span class="breadcrumb-separator">→</span>
    {/if}
    
    {#if item.level === 'world'}
      <button on:click={() => navigationManager.navigateToWorld()} class="breadcrumb-item">
        🌍 {item.name}
      </button>
    {:else if item.level === 'country'}
      <button on:click={() => navigationManager.navigateToCountry(item.iso || '', item.name)} 
              class="breadcrumb-item {navigationManager.getCurrentLevel() === 'country' ? 'active' : ''}">
        🏴 {item.name}
      </button>
    {:else if item.level === 'subdivision'}
      <span class="breadcrumb-item active">📍 {item.name}</span>
    {/if}
  {/each}
  
  <div class="breadcrumb-help">
    <small>Click country → Only that country • Click subdivision → Only that subdivision • Click outside → Back</small>
  </div>
</div>
{/if}
<svelte:window
  on:keydown={async (e) => {
    if (e.key === "Escape") {
      if (navigationManager && navigationManager.getCurrentLevel() !== 'world') {
        await navigationManager.navigateBack();
        
        // Adjust zoom based on new level
        const newLevel = navigationManager.getCurrentLevel();
        if (newLevel === 'world') {
          // Vista mundial a 200km de distancia
          const worldViewAltitude = 200000 / 675000; // 0.296 para 200km
          globe?.pointOfView({ lat: 20, lng: 0, altitude: worldViewAltitude }, 1000);
          selectedCountryName = null;
          selectedCountryIso = null;
        } else if (newLevel === 'country') {
          globe?.pointOfView({ lat: globe?.pointOfView()?.lat || 0, lng: globe?.pointOfView()?.lng || 0, altitude: 0.3 }, 700);
        }
      } else {
        showSettings = false;
      }
    }
  }}
  on:scroll={handleScroll}
  on:wheel={handleWheel}
  on:touchstart={onTouchStart}
  on:touchmove={onTouchMove}
/>

<!-- Tabs compactos (Para ti -> menú) junto a la lupa -->
<div class="tabs-float">
  <TopTabs
    bind:symbolMode
    options={["Para ti", "Tendencias", "Live"]}
    on:symbolChange={(e) => {
      const m = e.detail as "#" | "@";
      showAccountsLine = m === "@";
    }}
  />
</div>

<SearchBar bind:show={showSearch} bind:query={tagQuery} />

<TagBar
  bind:activeTag
  {showAccountsLine}
  {paraTiTags}
  {paraTiAccounts}
  {trendingTagsOnly}
  {trendingAccountsOnly}
  {colorMap}
  {alphaForTag}
  {isSeen}
  {seenKeyForTag}
  {seenKeyForAccount}
  {markSeen}
/>

<!-- Panel de ajustes (se abre desde la barra de la leyenda) -->
{#if showSettings}
  <div class="settings-overlay" role="presentation" on:click={() => (showSettings = false)}></div>
  <div class="settings-panel" role="dialog" aria-label="Ajustes de colores" bind:this={panelEl} style={`top:${panelTop}px; left:10px;`}>
    <SettingsPanel
      bind:panelTop
      bind:mode
      bind:capColor
      bind:capOpacityPct
      bind:sphereColor
      bind:sphereOpacityPct
      bind:strokeColor
      bind:strokeOpacityPct
      bind:bgColor
      {capBaseColor}
      {sphereBaseColor}
      {legendItems}
    />
  </div>
{/if}


<!-- Barra de escala estilo Google Maps (abajo izquierda) -->
<div class="altitude-indicator">
  <div class="scale-bar">
    <div class="altitude-value">
      {(() => {
        // Convertir altitud a kilómetros aproximados
        // 4.0 altitud = 2700 km, por lo tanto multiplicador = 675000 (en metros)
        const meters = Math.round(currentAltitude * 675000);
        
        if (meters < 1000) {
          return `${meters} m`;
        } else {
          const km = meters / 1000;
          if (km < 10) {
            return `${km.toFixed(1)} km`;
          } else {
            return `${Math.round(km)} km`;
          }
        }
      })()}
    </div>
  </div>
</div>

<!-- Botón de ajustes (abajo derecha, arriba del de localización) -->
<button
  class="settings-btn"
  type="button"
  aria-label="Abrir ajustes"
  title="Ajustes de colores y visualización"
  on:click={() => { showSettings = !showSettings; }}
>
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="2"></circle>
    <circle cx="12" cy="12" r="2"></circle>
    <circle cx="12" cy="19" r="2"></circle>
  </svg>
</button>

<!-- Botón para ir a mi ubicación (abajo derecha) -->
<button
  class="locate-btn"
  type="button"
  aria-label="Ir a mi ubicación"
  title="Ir a mi ubicación"
  on:click={locateMe}
  on:touchend|preventDefault={locateMe}
>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
</button>
<span class="sr-only">Ir a mi ubicación</span>

<BottomSheet
  state={SHEET_STATE}
  y={sheetY}
  {selectedCountryName}
  {countryChartSegments}
  onPointerDown={onSheetPointerDown}
  onScroll={onSheetScroll}
  on:close={() => setSheetState('hidden')}
/>
