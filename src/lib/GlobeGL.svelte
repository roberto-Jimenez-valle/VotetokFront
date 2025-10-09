<script lang="ts">
  import { onMount, onDestroy, tick, createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  
  const dispatch = createEventDispatcher();
  
  // Helper para delays con Promesas
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Función centralizada para actualizar colores del globo
  async function updateGlobeColors() {
    // Verificar que los datos necesarios existen
    if (!colorMap || Object.keys(colorMap).length === 0 || !isoDominantKey || Object.keys(isoDominantKey).length === 0) {
      return;
    }
    
    // Forzar actualización del callback de colores
    globe?.refreshPolyColors?.();
    
    // Esperar un frame y volver a refrescar para asegurar que se aplica
    await new Promise(resolve => requestAnimationFrame(resolve));
    globe?.refreshPolyColors?.();
  }
  import TopTabs from './TopTabs.svelte';
  import './GlobeGL.css';
  import { worldMap$, worldData$, loadGlobeData } from './stores/globeData';
  import { get as getStore } from 'svelte/store';
  import { clamp, hexToRgba } from './utils/colors';
  import { centroidOf, isoOf, pointInFeature } from './utils/geo';
  import SettingsPanel from './globe/SettingsPanel.svelte';
  import SearchBar from './globe/SearchBar.svelte';
  import TagBar from './globe/TagBar.svelte';
  import BottomSheet from './globe/BottomSheet.svelte';
  import GlobeCanvas from './globe/GlobeCanvas.svelte';
  import { nameOf as nameOfUtil, getDominantKey as getDominantKeyUtil, opacityForIso as opacityForIsoUtil, alphaForTag as alphaForTagUtil } from './utils/globeHelpers';
  import { BottomSheetController, type SheetState } from './globe/bottomSheet';
  import { computeGlobeViewModel } from './utils/globeDataProc';
  import themeConfig from './config/theme.json';

  // Permitir modo "data-in": el padre pasa datos directamente y GlobeGL se auto-configura
  export let geo: any = null;
  export let dataJson: any = null;
  export let autoLoad: boolean = true; // si true y no hay props, carga desde store
  // Loader opcional para datos por región (bbox) cuando el usuario se acerca (no usado actualmente)
  export const loadRegionData: null | ((bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number }) => Promise<any>) = null;

  let globe: any = null; // ref al componente GlobeCanvas
  let answersData: Record<string, Record<string, number>> = {};
  let colorMap: Record<string, string> = {};
  let isoIntensity: Record<string, number> = {};
  
  // Cache de datos por nivel para mantener contexto de encuesta
  let worldLevelAnswers: Record<string, Record<string, number>> = {};
  let countryLevelAnswers: Record<string, Record<string, number>> = {};
  let subdivisionLevelAnswers: Record<string, Record<string, number>> = {};
  
  // Cache de colorMap por nivel para trending
  let worldLevelColorMap: Record<string, string> = {};
  let countryLevelColorMap: Record<string, string> = {};
  let subdivisionLevelColorMap: Record<string, string> = {};
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
  
  // Dropdown state for navigation breadcrumb
  let showDropdown = false;
  let dropdownOptions: Array<{ id: string; name: string; iso?: string }> = [];
  let dropdownSearchQuery = '';
  
  // Filtered dropdown options based on search
  $: filteredDropdownOptions = dropdownOptions.filter(option => 
    option.name.toLowerCase().includes(dropdownSearchQuery.toLowerCase())
  );
  // Visibilidad de polígonos (capa coroplética)
  let polygonsVisible = true;
  // Polígonos del dataset global (choropleth): se preservan siempre
  let worldPolygons: any[] = [];
  const ALT_THRESHOLD = 0.6; // si la altitud es menor, ocultamos polígonos
  const VERY_CLOSE_ALT = 0.15; // por debajo de este valor, sin clustering: puntos exactos

  // Umbrales de altitud para mostrar textos (Level of Detail)
  // Cuanto MENOR es la altitud, MÁS cerca estás y MÁS etiquetas debes ver
  const COUNTRY_LABELS_ALT = 2.5; // mostrar etiquetas de países cuando altitud < 2.5
  const SUBDIVISION_LABELS_ALT = 0.8; // mostrar etiquetas de subdivisiones cuando altitud < 0.8
  const DETAILED_LABELS_ALT = 0.3; // mostrar etiquetas detalladas cuando altitud < 0.3
  
  // Límites de zoom del globo
  const MIN_ZOOM_ALTITUDE = 0.005; // límite mínimo de zoom (más cerca) - ampliado para permitir más acercamiento
  const MAX_ZOOM_ALTITUDE = 4.0; // límite máximo de zoom (más lejos)

  // Función para calcular el área aproximada de un polígono (en grados cuadrados)
  function calculatePolygonArea(feature: any): number {
    try {
      if (!feature?.geometry?.coordinates) return 0;
      
      let totalArea = 0;
      const coords = feature.geometry.coordinates;
      
      // Manejar MultiPolygon y Polygon
      if (feature.geometry.type === 'MultiPolygon') {
        for (const polygon of coords) {
          totalArea += calculateRingArea(polygon[0]); // Solo el anillo exterior
        }
      } else if (feature.geometry.type === 'Polygon') {
        totalArea = calculateRingArea(coords[0]); // Solo el anillo exterior
      }
      
      return Math.abs(totalArea);
    } catch (e) {
      console.warn('[Area] Error calculating polygon area:', e);
      return 0;
    }
  }
  
  // Función auxiliar para calcular el área de un anillo de coordenadas
  function calculateRingArea(ring: number[][]): number {
    if (!ring || ring.length < 3) return 0;
    
    let area = 0;
    const n = ring.length;
    
    for (let i = 0; i < n - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      area += (x1 * y2 - x2 * y1);
    }
    
    return area / 2;
  }
  
  // Función para calcular el zoom adaptativo basado en el tamaño del país
  function calculateAdaptiveZoom(feature: any): number {
    const area = calculatePolygonArea(feature);
    
    // Calcular altitud de forma más proporcional usando una fórmula logarítmica
    // Esto da un zoom más suave y proporcional al tamaño
    let targetAltitude: number;
    
    if (area > 2000) {
      // Países extremadamente grandes (Rusia): muy alejado
      targetAltitude = 2.2;
    } else if (area > 1000) {
      // Países muy grandes (Canadá, China, USA, Brasil): alejado
      targetAltitude = 1.5 + (area - 1000) / 1000 * 0.7;
    } else if (area > 500) {
      // Países grandes (Australia, India): medio-alejado
      targetAltitude = 1.1 + (area - 500) / 500 * 0.4;
    } else if (area > 200) {
      // Países medianos-grandes (Argentina, Kazajistán): medio
      targetAltitude = 0.75 + (area - 200) / 300 * 0.35;
    } else if (area > 50) {
      // Países medianos (Francia, España, Alemania, Italia): medio-cercano
      targetAltitude = 0.45 + (area - 50) / 150 * 0.30;
    } else if (area > 10) {
      // Países pequeños-medianos (Portugal, Grecia, Bélgica): cercano
      targetAltitude = 0.28 + (area - 10) / 40 * 0.17;
    } else if (area > 1) {
      // Países pequeños (Holanda, Suiza, Dinamarca): muy cercano
      targetAltitude = 0.18 + (area - 1) / 9 * 0.10;
    } else if (area > 0.1) {
      // Países muy pequeños (Luxemburgo, Malta): extremadamente cercano
      targetAltitude = 0.12 + (area - 0.1) / 0.9 * 0.06;
    } else {
      // Micro-estados (Mónaco, Vaticano, San Marino): máximo acercamiento
      targetAltitude = 0.08 + area / 0.1 * 0.04;
    }
    
    // Asegurar que esté dentro de los límites permitidos
    return Math.max(MIN_ZOOM_ALTITUDE, Math.min(targetAltitude, MAX_ZOOM_ALTITUDE));
  }

  // Función para calcular el zoom adaptativo para subdivisiones (estados/comunidades)
  function calculateAdaptiveZoomSubdivision(feature: any): number {
    const area = calculatePolygonArea(feature);
    
    // Calcular altitud proporcional para subdivisiones con interpolación suave
    let targetAltitude: number;
    
    if (area > 100) {
      // Subdivisiones extremadamente grandes (Alaska, Yakutia, Queensland): muy alejado
      targetAltitude = 1.0 + (area - 100) / 200 * 0.5;
    } else if (area > 50) {
      // Subdivisiones muy grandes (Territorio del Noroeste, Nunavut): alejado
      targetAltitude = 0.70 + (area - 50) / 50 * 0.30;
    } else if (area > 20) {
      // Subdivisiones grandes (Texas, California, Ontario): medio-alejado
      targetAltitude = 0.48 + (area - 20) / 30 * 0.22;
    } else if (area > 5) {
      // Subdivisiones medianas-grandes (Castilla y León, Aragón, Bavaria): medio
      targetAltitude = 0.30 + (area - 5) / 15 * 0.18;
    } else if (area > 1) {
      // Subdivisiones medianas (Andalucía, Cataluña, regiones francesas): medio-cercano
      targetAltitude = 0.19 + (area - 1) / 4 * 0.11;
    } else if (area > 0.3) {
      // Subdivisiones pequeñas (provincias españolas, departamentos pequeños): cercano
      targetAltitude = 0.13 + (area - 0.3) / 0.7 * 0.06;
    } else if (area > 0.05) {
      // Subdivisiones muy pequeñas (Delaware, Rhode Island, islas pequeñas): muy cercano
      targetAltitude = 0.08 + (area - 0.05) / 0.25 * 0.05;
    } else {
      // Subdivisiones minúsculas (Washington D.C., ciudades-estado, islas diminutas): máximo acercamiento
      targetAltitude = 0.05 + area / 0.05 * 0.03;
    }
    
    // Asegurar que esté dentro de los límites permitidos
    return Math.max(MIN_ZOOM_ALTITUDE, Math.min(targetAltitude, MAX_ZOOM_ALTITUDE));
  }

  // Función para simular clic en una ciudad específica (para testing)
  function selectCity(cityName: string) {
    selectedCityName = cityName;
    
    // Generar datos específicos para la ciudad
    generateCityChartSegments(cityName);
    
    // Mostrar el BottomSheet si está oculto
    if (SHEET_STATE === 'hidden') {
      SHEET_STATE = 'peek';
      sheetCtrl?.setState('peek');
    }
  }

  // Datos de ciudades cargados desde JSON
  let citiesData: Record<string, any> = {};


  // Generar datos específicos para una ciudad desde el JSON cargado
  function generateCityChartSegments(cityName: string) {
    const cityData = citiesData[cityName];
    if (cityData) {
      cityChartSegments = generateCountryChartSegments([cityData]);
    } else {
      cityChartSegments = [];
    }
  }

  // Función para navegar directamente a una vista específica
  async function navigateToView(targetLevel: 'world' | 'country' | 'subdivision' | 'city') {
    if (!navigationManager) return;
    
    const currentLevel = navigationManager.getCurrentLevel();
    
    if (targetLevel === 'world') {
      // Limpiar todos los niveles inferiores
      selectedCountryName = null;
      selectedCountryIso = null;
      selectedSubdivisionName = null;
      selectedSubdivisionId = null;
      selectedCityName = null;
      selectedCityId = null;
      
      // Navegar al mundo y hacer zoom hacia atrás
      await navigationManager.navigateToWorld();
      scheduleZoom(0, 0, 2.0, 1000);
      
    } else if (targetLevel === 'country' && selectedCountryIso) {
      // Limpiar niveles inferiores
      selectedSubdivisionName = null;
      selectedSubdivisionId = null;
      selectedCityName = null;
      selectedCityId = null;
      
      // Navegar al país y hacer zoom apropiado
      await navigationManager.navigateToCountry(selectedCountryIso, selectedCountryName || 'Unknown');
      
      // Encontrar el centroide del país para hacer zoom
      const countryFeature = worldPolygons?.find(p => p.properties?.ISO_A3 === selectedCountryIso);
      if (countryFeature) {
        const centroid = centroidOf(countryFeature);
        const adaptiveAltitude = calculateAdaptiveZoom(countryFeature);
        scheduleZoom(centroid.lat, centroid.lng, adaptiveAltitude, 800);
      }
      
      // Refresh altitudes to reset polygon heights
      requestAnimationFrame(() => {
        globe?.refreshPolyAltitudes?.();
      });
      
    } else if (targetLevel === 'subdivision' && selectedCountryIso && selectedSubdivisionName) {
      // Limpiar solo el nivel ciudad
      selectedCityName = null;
      selectedCityId = null;
      
      // Navegar a la subdivisión
      if (selectedSubdivisionId) {
        // Navegar primero (carga polígonos)
        await navigationManager.navigateToSubdivision(selectedCountryIso, selectedSubdivisionId, selectedSubdivisionName);
        
        // NO hacer zoom aquí - el zoom ya se hizo en el handler de clic
        // Solo refrescar visual
        requestAnimationFrame(() => {
          globe?.refreshPolyAltitudes?.();
          globe?.refreshPolyStrokes?.();
        });
      }
      
    } else if (targetLevel === 'city') {
      // Para nivel ciudad, no mover el mapa, solo mostrar datos específicos
            // No hacer navegación del mapa, solo actualizar los datos del gráfico
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
        // Inicializar con altitud máxima y dar dos vueltas rápidas
        const initialAltitude = MAX_ZOOM_ALTITUDE;
        // Posición inicial
        globe?.pointOfView({ lat: 20, lng: 0, altitude: MAX_ZOOM_ALTITUDE }, 0);
        
        // Después de un pequeño delay, iniciar la rotación de dos vueltas
        setTimeout(() => {
          if (globe && _initVersion === 1) {
            // Dos vueltas completas (720 grados) en 2 segundos
            globe?.pointOfView({ lat: 20, lng: 720, altitude: MAX_ZOOM_ALTITUDE }, 2000);
          }
        }, 200);
      } catch {}
    }
    _initVersion++;
    // Ajustar visibilidad según POV actual (evitar reactivar polígonos si estamos cerca)
    try { updatePolygonsVisibilityExt(); } catch {}
  }

  // Encontrar el ID_1 del polígono local más cercano al centro de la vista
  function nearestLocalFeatureId1(pov: { lat: number; lng: number }): string | null {
    try {
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
                    return String(id1);
        }
      }
      
      // Fallback: nearest centroid
      let bestId: string | null = null;
      let bestD = Infinity;
      for (const feat of localPolygons) {
        const props = feat?.properties || {};
        let id1: any = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1 || null;
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
              }
      
      return bestId;
    } catch { return null; }
  }

  // DISABLED: Zoom-based subdivision loading removed - now handled by NavigationManager only
  async function ensureSubregionPolygons(pov: { lat: number; lng: number; altitude: number }) {
    // This function is now disabled - subdivision loading only happens via clicks
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
      // NO sobrescribir ID_1 si ya existe (viene del GeoJSON)
      // Solo asignar si no existe
      if (!f.properties.ID_1 && !f.properties.id_1) {
        f.properties.ID_1 = id1;
      }
      
      // Extraer nombre de la subdivisión de varias propiedades posibles
      const name = f.properties.NAME_1 || f.properties.name_1 ||
                   f.properties.NAME_2 || f.properties.name_2 || 
                   f.properties.NAME || f.properties.name ||
                   f.properties.VARNAME_2 || f.properties.varname_2 ||
                   f.properties.NL_NAME_2 || f.properties.nl_name_2 ||
                   `Subdivisión ${id1}`;
      f.properties._subdivisionName = name;
    }
    return feats;
  }

  // Generar etiquetas tanto para países (NAME_1) como subdivisiones (NAME_2)
  function generateSubdivisionLabels(polygons: any[], currentAltitude?: number): SubdivisionLabel[] {
    const labels: SubdivisionLabel[] = [];
    const currentLevel = navigationManager?.getCurrentLevel() || 'world';
    const debug = currentLevel === 'subdivision'; // Debug solo en nivel subdivisión
        
    // Calcular áreas de polígonos para priorización
    const polygonsWithArea = polygons.map(poly => ({
      poly,
      area: calculatePolygonArea(poly)
    }));
    
    // Ordenar por área (más grandes primero)
    polygonsWithArea.sort((a, b) => b.area - a.area);
    
    // Determinar cuántas etiquetas mostrar según la altitud
    // SISTEMA LOD: Cuanto MÁS CERCA (menor altitud), MÁS etiquetas
    let maxLabels = polygons.length;
    let minAreaThreshold = 0; // Área mínima para mostrar etiqueta
    
    if (currentAltitude !== undefined) {
      if (currentAltitude > 0.5) {
        // Zoom muy alejado: solo las 10 más grandes
        maxLabels = Math.min(10, polygons.length);
        minAreaThreshold = 0.1;
      } else if (currentAltitude > 0.3) {
        // Zoom medio: 50% de las etiquetas
        maxLabels = Math.ceil(polygons.length * 0.5);
        minAreaThreshold = 0.05;
      } else if (currentAltitude > 0.15) {
        // Zoom cercano: 75% de las etiquetas
        maxLabels = Math.ceil(polygons.length * 0.75);
        minAreaThreshold = 0.02;
      } else {
        // Zoom EXTREMO (< 0.15): TODAS las etiquetas
        maxLabels = polygons.length;
        minAreaThreshold = 0; // Sin filtro de área
      }
    }
    
        
    // Sistema de detección de colisiones para evitar solapamiento
    // DESACTIVADO: Ahora usamos removeOverlappingLabels después, que es más inteligente
    const usedPositions: Array<{lat: number, lng: number}> = [];
    let minDistance = 0; // Sin filtro interno, se aplica después con removeOverlappingLabels
    
    let skippedByArea = 0;
    let skippedByName = 0;
    
    for (let i = 0; i < Math.min(maxLabels, polygonsWithArea.length); i++) {
      const { poly, area } = polygonsWithArea[i];
      
      // Filtrar polígonos muy pequeños en zoom cercano
      if (area < minAreaThreshold) {
        skippedByArea++;
        continue;
      }
      
      let name = null;
      let labelType = '';
      
      // Prioridad: nivel 2 (NAME_2), luego subdivisiones (hijos), luego países (padres)
      if (poly?.properties?._isLevel2) {
        name = poly.properties.NAME_2 || poly.properties.name_2 || 
               poly.properties.NAME || poly.properties.name ||
               poly.properties.VARNAME_2 || poly.properties.varname_2 ||
               poly.properties.NL_NAME_2 || poly.properties.nl_name_2;
        labelType = 'level2';
      } else if (poly?.properties?._isChild && poly?.properties?._subdivisionName) {
        name = poly.properties._subdivisionName;
        labelType = 'subdivision';
      } else if (poly?.properties?._isParent) {
        name = poly.properties.NAME_1 || poly.properties.name_1 || 
               poly.properties.NAME || poly.properties.name ||
               poly.properties.VARNAME_1 || poly.properties.varname_1 ||
               poly.properties.NL_NAME_1 || poly.properties.nl_name_1;
        labelType = 'country';
      } else {
        name = poly.properties?.NAME_1 || poly.properties?.name_1 || 
               poly.properties?.NAME_2 || poly.properties?.name_2 ||
               poly.properties?.NAME || poly.properties?.name ||
               poly.properties?.VARNAME_1 || poly.properties?.varname_1;
        labelType = 'fallback';
      }
      
      if (!name) {
        skippedByName++;
        if (debug) {
          console.log('[Labels] Polígono sin nombre:', {
            area: area.toFixed(3),
            props: Object.keys(poly?.properties || {})
          });
        }
      }
      
      if (name) {
        try {
          const centroid = centroidOf(poly);
          
          // Verificar colisión con etiquetas existentes (SIEMPRE activo)
          if (currentAltitude !== undefined && minDistance > 0) {
            let tooClose = false;
            for (const pos of usedPositions) {
              const dist = Math.sqrt(
                Math.pow(centroid.lat - pos.lat, 2) + 
                Math.pow(centroid.lng - pos.lng, 2)
              );
              if (dist < minDistance) {
                tooClose = true;
                break;
              }
            }
            if (tooClose) {
              continue; // Saltar esta etiqueta si está muy cerca de otra
            }
          }
          
          // Calcular tamaño de fuente basado en área y altitud
          let fontSize = 11; // Tamaño base
          const MIN_FONT_SIZE = 9; // Tamaño mínimo más grande para legibilidad
          const MAX_FONT_SIZE = 14; // Tamaño máximo
          
          if (currentAltitude !== undefined) {
            if (currentAltitude > 0.5) {
              // Zoom alejado: textos más grandes
              fontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, 10 + Math.sqrt(area) * 0.3));
            } else if (currentAltitude > 0.3) {
              // Zoom medio: textos medianos
              fontSize = Math.max(MIN_FONT_SIZE, Math.min(12, 9 + Math.sqrt(area) * 0.2));
            } else {
              // Zoom cercano/subdivisión: tamaño más uniforme y visible
              // En nivel subdivisión, usar tamaño base sin mucha variación
              fontSize = Math.max(MIN_FONT_SIZE, Math.min(11, 9 + Math.sqrt(area) * 0.1));
            }
          }
          
          const label: SubdivisionLabel = {
            id: `label_${labelType}_${poly.properties.ID_1 || poly.properties.id_1 || poly.properties.ISO_A3 || Math.floor(Math.random() * 10000)}`,
            name: name,
            lat: centroid.lat,
            lng: centroid.lng,
            feature: poly, // Incluir el feature completo para que las etiquetas sean clicables
            size: fontSize, // Tamaño dinámico basado en área y zoom
            area: area // Guardar área para referencia
          };
          labels.push(label);
          usedPositions.push({ lat: centroid.lat, lng: centroid.lng });
        } catch (e) {
          console.warn('[Labels] Failed to generate label for polygon:', poly.properties);
        }
      }
    }
    
    if (debug) {
      console.log(`[Labels] Resumen generación:`, {
        total: polygons.length,
        procesados: Math.min(maxLabels, polygonsWithArea.length),
        saltados_area: skippedByArea,
        saltados_sin_nombre: skippedByName,
        generados: labels.length,
        altitude: currentAltitude?.toFixed(3)
      });
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
        const color = colorMap?.[tag] ?? polygonNoDataColor;
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
          label.style.color = '#c9d1d9';
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
        const currentLevel = navigationManager?.getCurrentLevel() || 'world';
        if (currentLevel === 'subdivision') {
          console.log(`[UpdateLabels] Enviando ${subdivisionLabels.length} etiquetas al globo`);
          
          // Buscar Santa Cruz específicamente
          const santaCruz = subdivisionLabels.find(l => 
            (l.name || l.text || '').toLowerCase().includes('santa cruz')
          );
          if (santaCruz) {
            console.log(`[UpdateLabels] Santa Cruz ENCONTRADA:`, {
              name: santaCruz.name || santaCruz.text,
              lat: santaCruz.lat,
              lng: santaCruz.lng,
              size: santaCruz.size
            });
          } else {
            console.warn(`[UpdateLabels] Santa Cruz NO encontrada en las ${subdivisionLabels.length} etiquetas`);
          }
        }
                globe.setTextLabels?.(subdivisionLabels);
      } else {
                globe.setTextLabels?.([]);
      }
    } catch (e) {
      console.warn('Error updating labels:', e);
    }
  }

  /**
   * Agrega votos por nivel jerárquico desde IDs granulares de BD
   * Ejemplo: Si BD tiene votos con ESP.1.1, ESP.1.2, ESP.2.1
   * - Nivel 1 (ESP.1): suma votos de ESP.1.1 + ESP.1.2
   * - Nivel 2 (ESP.2): suma votos de ESP.2.1
   */
  function aggregateVotesByLevel(
    rawVotes: Record<string, Record<string, number>>,
    targetLevel: 1 | 2
  ): Record<string, Record<string, number>> {
    const aggregated: Record<string, Record<string, number>> = {};
    
    for (const [subdivisionId, votes] of Object.entries(rawVotes)) {
      // Extraer el nivel deseado del ID
      // ESP.1.1 → nivel 1 = ESP.1, nivel 2 = ESP.1.1
      const parts = subdivisionId.split('.');
      let targetKey: string;
      
      if (targetLevel === 1 && parts.length >= 2) {
        // Nivel 1: ESP.1
        targetKey = `${parts[0]}.${parts[1]}`;
      } else if (targetLevel === 2 && parts.length >= 3) {
        // Nivel 2: ESP.1.1
        targetKey = `${parts[0]}.${parts[1]}.${parts[2]}`;
      } else {
        // Si el ID ya está en el nivel correcto, usarlo tal cual
        targetKey = subdivisionId;
      }
      
      // Agregar votos al nivel objetivo
      if (!aggregated[targetKey]) {
        aggregated[targetKey] = {};
      }
      
      for (const [optionKey, count] of Object.entries(votes)) {
        aggregated[targetKey][optionKey] = (aggregated[targetKey][optionKey] || 0) + count;
      }
    }
    
    return aggregated;
  }

  /**
   * Encuentra la opción ganadora (con más votos) para un conjunto de votos
   */
  function findWinningOption(votes: Record<string, number>): { option: string; count: number } | null {
    let maxVotes = 0;
    let winningOption: string | null = null;
    
    for (const [optionKey, voteCount] of Object.entries(votes)) {
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        winningOption = optionKey;
      }
    }
    
    return winningOption ? { option: winningOption, count: maxVotes } : null;
  }

  // NUEVA FUNCIÓN: Cargar colores reales desde la base de datos (nivel 1: subdivisiones)
  async function computeSubdivisionColorsFromDatabase(countryIso: string, polygons: any[]): Promise<Record<string, string>> {
    const byId: Record<string, string> = {};
    
    // Solo cargar si hay encuesta activa
    if (!activePoll || !activePoll.id) {
            return byId;
    }
    
                
    try {
      // Cargar votos reales por subdivisión desde la API
      const response = await fetch(`/api/polls/${activePoll.id}/votes-by-subdivisions?country=${countryIso}`);
      
      if (!response.ok) {
        return byId;
      }
      
      const { data } = await response.json();
      // data puede tener IDs granulares: { "ESP.1.1": {...}, "ESP.1.2": {...}, "ESP.2.1": {...} }
      
                  
      // Agregar votos por nivel 1 (ESP.1, ESP.2, etc.)
      const level1Votes = aggregateVotesByLevel(data, 1);
            
      // Para cada subdivisión nivel 1, calcular la opción ganadora
      for (const [subdivisionKey, votes] of Object.entries(level1Votes)) {
        const winner = findWinningOption(votes);
        
        if (winner && colorMap?.[winner.option]) {
          const color = colorMap[winner.option];
          
          // Buscar el polígono que coincida con esta subdivisión
          for (const poly of polygons) {
            const props = poly?.properties || {};
            const id1 = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1;
            const name1 = props.NAME_1 || props.name_1 || props.VARNAME_1 || props.varname_1;
            
            // Normalizar ID para comparación (ESP.1 o solo "1")
            const normalizedId1 = String(id1).includes('.') ? id1 : `${countryIso}.${id1}`;
            const normalizedSubKey = subdivisionKey.includes('.') ? subdivisionKey : `${countryIso}.${subdivisionKey}`;
            
            // Coincidir por ID_1 normalizado o por nombre
            if (normalizedId1 === normalizedSubKey || name1 === subdivisionKey) {
              byId[String(id1)] = color;
                            break;
            }
          }
        }
      }
      
            
    } catch (error) {
      console.error('[Colors] ❌ Error loading subdivision votes from database:', error);
    }
    
    return byId;
  }

  // NUEVA FUNCIÓN: Cargar colores reales de sub-subdivisiones (nivel 2)
  async function computeSubSubdivisionColorsFromDatabase(
    countryIso: string, 
    subdivisionId: string, 
    polygons: any[]
  ): Promise<Record<string, string>> {
    const byId: Record<string, string> = {};
    
    // Solo cargar si hay encuesta activa
    if (!activePoll || !activePoll.id) {
            return byId;
    }
    
    // Normalizar subdivisionId para la API (debe ser solo el número, ej: "1" no "ESP.1")
    const cleanSubdivisionId = subdivisionId.includes('.') ? subdivisionId.split('.').pop() : subdivisionId;
    
                    
    try {
      // Cargar votos reales por sub-subdivisión desde la API
      const apiUrl = `/api/polls/${activePoll.id}/votes-by-subsubdivisions?country=${countryIso}&subdivision=${cleanSubdivisionId}`;
            
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        // Si no hay endpoint, usar datos del nivel superior como fallback
                return await computeSubdivisionColorsFromVotesLevel3(countryIso, subdivisionId, polygons);
      }
      
      const { data } = await response.json();
                        
      // Si no hay datos, usar fallback
      if (!data || Object.keys(data).length === 0) {
                return await computeSubdivisionColorsFromVotesLevel3(countryIso, subdivisionId, polygons);
      }
      
      // Agregar votos por nivel 2 (ESP.1.1, ESP.1.2, etc.)
      const level2Votes = aggregateVotesByLevel(data, 2);
            
      // Para cada sub-subdivisión nivel 2, calcular la opción ganadora
      for (const [subSubdivisionKey, votes] of Object.entries(level2Votes)) {
        const winner = findWinningOption(votes);
        
        if (winner && colorMap?.[winner.option]) {
          const color = colorMap[winner.option];
          
          // Buscar el polígono que coincida con esta sub-subdivisión
          for (const poly of polygons) {
            const props = poly?.properties || {};
            const id2 = props.ID_2 || props.id_2 || props.GID_2 || props.gid_2;
            const name2 = props.NAME_2 || props.name_2 || props.VARNAME_2 || props.varname_2;
            
                        
            // Múltiples estrategias de coincidencia
            let matched = false;
            
            // Estrategia 1: Coincidencia directa de ID
            if (String(id2) === subSubdivisionKey) {
              matched = true;
            }
            
            // Estrategia 2: Coincidencia de nombre
            if (!matched && name2 === subSubdivisionKey) {
              matched = true;
            }
            
            // Estrategia 3: Extraer última parte del ID y comparar
            if (!matched) {
              const id2Parts = String(id2).split('.');
              const keyParts = subSubdivisionKey.split('.');
              const id2Last = id2Parts[id2Parts.length - 1];
              const keyLast = keyParts[keyParts.length - 1];
              if (id2Last === keyLast) {
                matched = true;
              }
            }
            
            if (matched) {
              byId[String(id2)] = color;
                            break;
            }
          }
        }
      }
      
            
    } catch (error) {
      console.error('[Colors L3] ❌ Error loading sub-subdivision votes from database:', error);
      // Fallback en caso de error
      return await computeSubdivisionColorsFromVotesLevel3(countryIso, subdivisionId, polygons);
    }
    
    return byId;
  }

  // Fallback: Usar datos de la subdivisión padre para colorear proporcionalmente
  async function computeSubdivisionColorsFromVotesLevel3(
    countryIso: string,
    subdivisionId: string,
    polygons: any[]
  ): Promise<Record<string, string>> {
    const byId: Record<string, string> = {};
    
                    
    // Usar los datos del país para obtener proporciones
    const countryRecord = answersData?.[countryIso];
    if (!countryRecord) {
                  return byId;
    }
    
        
    // Generar segmentos de gráfico basados en datos del país
    const segments = generateCountryChartSegments([countryRecord]);
    if (!segments || segments.length === 0) {
            return byId;
    }
    
        
    // Asignar colores proporcionalmente
    const total = polygons.length;
    let cursor = 0;
    
        
    for (const segment of segments) {
      const count = Math.round((segment.pct / 100) * total);
            
      for (let i = 0; i < count && cursor < polygons.length; i++, cursor++) {
        const poly = polygons[cursor];
        const id2 = poly.properties?.ID_2 || poly.properties?.id_2 || poly.properties?.NAME_2 || poly.properties?.name_2;
        if (id2) {
          byId[String(id2)] = segment.color;
                  } else {
                  }
      }
    }
    
    // Rellenar los restantes con el color del primer segmento
    const fallbackColor = segments[0]?.color || polygonNoDataColor;
        
    while (cursor < polygons.length) {
      const poly = polygons[cursor];
      const id2 = poly.properties?.ID_2 || poly.properties?.id_2 || poly.properties?.NAME_2 || poly.properties?.name_2;
      if (id2 && !byId[String(id2)]) {
        byId[String(id2)] = fallbackColor;
              }
      cursor++;
    }
    
            return byId;
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
        
        // Sync with reactive navigationState
        navigationState = { ...this.state };
        
        // Update selection variables
        selectedCountryName = countryName;
        selectedCountryIso = iso;
        selectedSubdivisionName = null;
        selectedSubdivisionId = null;
        selectedCityName = null;
        selectedCityId = null;

        // Update history
        this.history = [
          { level: 'world', name: 'World' },
          { level: 'country', name: countryName, iso }
        ];

        // Render country view PRIMERO
        await this.renderCountryView(iso, countryPolygons);
        
        // Try to load subdivisions automatically
        await this.loadSubdivisions(iso);
        
        // Cargar datos de subdivisiones y actualizar answersData DESPUÉS de renderizar
        if (activePoll && activePoll.id) {
          // MODO ENCUESTA ESPECÍFICA: Cargar datos de esa encuesta
          try {
            const response = await fetch(`/api/polls/${activePoll.id}/votes-by-subdivisions?country=${iso}`);
            if (response.ok) {
              const { data } = await response.json();
                            
              // Agregar a nivel 1 (ESP.1, ESP.2, etc.)
              const level1Data = aggregateVotesByLevel(data, 1);
                            
              // Guardar en cache de nivel country
              countryLevelAnswers = level1Data;
              
              // Actualizar answersData con datos de nivel 1
              answersData = level1Data;
              
              // USAR countryPolygons (los que se pasaron a la función) en lugar de intentar obtenerlos del globo
              const subdivisionPolygons = countryPolygons.filter((p: any) => !p.properties?._isParent);
              
              // Solo calcular si hay polígonos de subdivisión
              if (subdivisionPolygons.length > 0) {
                // Recalcular isoDominantKey y legendItems con los polígonos de subdivisión
                const geoData = { type: 'FeatureCollection', features: subdivisionPolygons };
                const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
                isoDominantKey = vm.isoDominantKey;
                legendItems = vm.legendItems;
                isoIntensity = vm.isoIntensity;
              }
              
                                                      }
          } catch (error) {
            // Error loading subdivision data
          }
        } else if (!activePoll) {
          // MODO TRENDING: Cargar datos de trending para este país
          try {
            const response = await fetch(`/api/polls/trending-by-region?region=${encodeURIComponent(selectedCountryName || iso)}&limit=20`);
            if (response.ok) {
              const { data: trendingPolls } = await response.json();
              
              // Agregar datos de trending por subdivisión
              const aggregatedData: Record<string, Record<string, number>> = {};
              const aggregatedColors: Record<string, string> = {};
              const pollColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'];
              
              // Actualizar activePollOptions con las encuestas trending
              activePollOptions = [];
              
              for (let i = 0; i < trendingPolls.length; i++) {
                const poll = trendingPolls[i];
                const pollKey = `poll_${poll.id}`;
                const pollColor = pollColors[i % pollColors.length];
                
                // Agregar color al mapa
                aggregatedColors[pollKey] = pollColor;
                
                // Agregar a activePollOptions
                activePollOptions.push({
                  key: pollKey,
                  label: poll.question || poll.title || `Encuesta ${poll.id}`,
                  color: pollColor,
                  votes: 0, // Se actualizará después
                  pollData: poll
                });
                
                // Cargar datos de votos por subdivisión para cada encuesta trending
                try {
                  const pollResponse = await fetch(`/api/polls/${poll.id}/votes-by-subdivisions?country=${iso}`);
                  if (pollResponse.ok) {
                    const { data: pollData } = await pollResponse.json();
                    
                    // Agregar a nivel 1 (ESP.1, ESP.2, etc.)
                    const level1Data = aggregateVotesByLevel(pollData, 1);
                    
                    // Sumar TODOS los votos de esta encuesta por subdivisión
                    for (const [subdivisionId, votes] of Object.entries(level1Data as Record<string, Record<string, number>>)) {
                      if (!aggregatedData[subdivisionId]) {
                        aggregatedData[subdivisionId] = {};
                      }
                      
                      const totalVotes = Object.values(votes).reduce((sum, count) => sum + (count as number), 0);
                      aggregatedData[subdivisionId][pollKey] = totalVotes;
                    }
                  }
                } catch (error) {
                  console.warn(`[Trending] ⚠️ Error loading data for poll ${poll.id}:`, error);
                }
              }
              
              // Actualizar votos totales en activePollOptions
              activePollOptions = activePollOptions.map(option => {
                const totalVotesForPoll = Object.values(aggregatedData).reduce((sum, subdivisionData) => {
                  return sum + (subdivisionData[option.key] || 0);
                }, 0);
                return { ...option, votes: totalVotesForPoll };
              });
              
              // Actualizar datos y colorMap
              countryLevelAnswers = aggregatedData;
              answersData = aggregatedData;
              colorMap = aggregatedColors;
              
              // Recalcular colores dominantes
              const subdivisionPolygons = countryPolygons.filter((p: any) => !p.properties?._isParent);
              if (subdivisionPolygons.length > 0) {
                const geoData = { type: 'FeatureCollection', features: subdivisionPolygons };
                const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
                isoDominantKey = vm.isoDominantKey;
                legendItems = vm.legendItems;
                isoIntensity = vm.isoIntensity;
              }
            }
          } catch (error) {
            // Error loading trending data
          }
        }
        
        // Forzar refresh de colores después de actualizar datos
        await new Promise<void>((resolve) => {
          this.globe?.refreshPolyColors?.();
          resolve();
        });

      } catch (error) {
        await this.navigateToWorld();
      }
    }

    async navigateToSubdivision(countryIso: string, subdivisionId: string, subdivisionName: string) {
      try {
        // Ensure we're in country context
        if (this.state.countryIso !== countryIso) {
          throw new Error('Invalid navigation: subdivision without country context');
        }

        // Load subdivision data
        const subdivisionPolygons = await this.loadSubdivisionPolygons(countryIso, subdivisionId);
        if (!subdivisionPolygons?.length) {
          return;
        }

        // Update state
        this.state = {
          level: 'subdivision',
          countryIso,
          subdivisionId,
          path: [countryIso, subdivisionId]
        };
        
        // Sync with reactive navigationState
        navigationState = { ...this.state };
        
        // Update selection variables
        selectedSubdivisionName = subdivisionName;
        selectedSubdivisionId = subdivisionId;
        selectedCityName = null;
        selectedCityId = null;

        // Update history
        this.history = [
          { level: 'world', name: 'World' },
          { level: 'country', name: this.history[1]?.name || countryIso, iso: countryIso },
          { level: 'subdivision', name: subdivisionName, iso: countryIso, id: subdivisionId }
        ];

        // Render subdivision view PRIMERO
        await this.renderSubdivisionView(countryIso, subdivisionId, subdivisionPolygons);
        
        // Cargar datos de sub-subdivisiones y actualizar answersData DESPUÉS de renderizar
        if (activePoll && activePoll.id) {
          try {
            const cleanSubdivisionId = subdivisionId.includes('.') ? subdivisionId.split('.').pop() : subdivisionId;
            const response = await fetch(`/api/polls/${activePoll.id}/votes-by-subsubdivisions?country=${countryIso}&subdivision=${cleanSubdivisionId}`);
            if (response.ok) {
              const { data } = await response.json();
                            
              // Agregar a nivel 2 (ESP.1.1, ESP.1.2, etc.)
              const level2Data = aggregateVotesByLevel(data, 2);
              
              // Guardar en cache de nivel subdivision
              subdivisionLevelAnswers = level2Data;
              
              // Actualizar answersData con datos de nivel 2
              answersData = level2Data;
              
              // Solo calcular si hay polígonos
              if (subdivisionPolygons.length > 0) {
                // Recalcular isoDominantKey y legendItems con los polígonos de subdivisión
                const geoData = { type: 'FeatureCollection', features: subdivisionPolygons };
                const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
                isoDominantKey = vm.isoDominantKey;
                legendItems = vm.legendItems;
                isoIntensity = vm.isoIntensity;
              }
            }
          } catch (error) {
            // Error loading sub-subdivision data
          }
        } else if (!activePoll) {
          // MODO TRENDING: Cargar datos de trending para esta subdivisión
          try {
            const response = await fetch(`/api/polls/trending-by-region?region=${encodeURIComponent(subdivisionName)}&limit=20`);
            if (response.ok) {
              const { data: trendingPolls } = await response.json();
              
              // Agregar datos de trending por sub-subdivisión
              const aggregatedData: Record<string, Record<string, number>> = {};
              const aggregatedColors: Record<string, string> = {};
              const pollColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'];
              
              // Actualizar activePollOptions con las encuestas trending
              activePollOptions = [];
              
              for (let i = 0; i < trendingPolls.length; i++) {
                const poll = trendingPolls[i];
                const pollKey = `poll_${poll.id}`;
                const pollColor = pollColors[i % pollColors.length];
                
                // Agregar color al mapa
                aggregatedColors[pollKey] = pollColor;
                
                // Agregar a activePollOptions
                activePollOptions.push({
                  key: pollKey,
                  label: poll.question || poll.title || `Encuesta ${poll.id}`,
                  color: pollColor,
                  votes: 0, // Se actualizará después
                  pollData: poll
                });
                
                // Cargar datos de votos por sub-subdivisión para cada encuesta trending
                try {
                  const cleanSubdivisionId = subdivisionId.includes('.') ? subdivisionId.split('.').pop() : subdivisionId;
                  const pollResponse = await fetch(`/api/polls/${poll.id}/votes-by-subsubdivisions?country=${countryIso}&subdivision=${cleanSubdivisionId}`);
                  if (pollResponse.ok) {
                    const { data: pollData } = await pollResponse.json();
                    
                    // Agregar a nivel 2 (ESP.1.1, ESP.1.2, etc.)
                    const level2Data = aggregateVotesByLevel(pollData, 2);
                    
                    // Sumar TODOS los votos de esta encuesta por sub-subdivisión
                    for (const [subsubdivisionId, votes] of Object.entries(level2Data as Record<string, Record<string, number>>)) {
                      if (!aggregatedData[subsubdivisionId]) {
                        aggregatedData[subsubdivisionId] = {};
                      }
                      
                      const totalVotes = Object.values(votes).reduce((sum, count) => sum + (count as number), 0);
                      aggregatedData[subsubdivisionId][pollKey] = totalVotes;
                    }
                  }
                } catch (error) {
                  // Error loading poll data
                }
              }
              
              // Actualizar votos totales en activePollOptions
              activePollOptions = activePollOptions.map(option => {
                const totalVotesForPoll = Object.values(aggregatedData).reduce((sum, subsubdivisionData) => {
                  return sum + (subsubdivisionData[option.key] || 0);
                }, 0);
                return { ...option, votes: totalVotesForPoll };
              });
              
              // Actualizar datos y colorMap
              subdivisionLevelAnswers = aggregatedData;
              answersData = aggregatedData;
              colorMap = aggregatedColors;
              
              // Recalcular colores dominantes
              if (subdivisionPolygons.length > 0) {
                const geoData = { type: 'FeatureCollection', features: subdivisionPolygons };
                const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
                isoDominantKey = vm.isoDominantKey;
                legendItems = vm.legendItems;
                isoIntensity = vm.isoIntensity;
              }
            }
          } catch (error) {
            // Error loading trending data
          }
        }
        
        // Forzar refresh de colores después de actualizar datos
        await new Promise<void>((resolve) => {
          this.globe?.refreshPolyColors?.();
          resolve();
        });

      } catch (error) {
        // Error navigating to subdivision
      }
    }

    async navigateToWorld() {
      
      this.state = {
        level: 'world',
        countryIso: null,
        subdivisionId: null,
        path: []
      };
      
      // Sync with reactive navigationState
      navigationState = { ...this.state };
      
      // Clear selection variables PRIMERO
      selectedCountryName = null;
      selectedCountryIso = null;
      selectedSubdivisionName = null;
      selectedSubdivisionId = null;
      selectedCityName = null;
      selectedCityId = null;

      this.history = [{ level: 'world', name: 'World' }];

      // Restaurar datos mundiales desde cache
      if (activePoll && activePoll.id) {
        try {
          // Si ya tenemos datos en cache, usarlos
          if (Object.keys(worldLevelAnswers).length > 0) {
            answersData = worldLevelAnswers;
            console.log('[Navigation] 📦 Datos mundiales restaurados desde cache:', Object.keys(worldLevelAnswers).length);
          } else {
            // Si no hay cache, cargar desde API
            const response = await fetch(`/api/polls/${activePoll.id}/votes-by-country`);
            if (response.ok) {
              const { data } = await response.json();
              
              // Guardar en cache
              worldLevelAnswers = data;
              answersData = data;
              
              console.log('[Navigation] 📊 Datos mundiales cargados desde API:', Object.keys(data).length);
            }
          }
          
          // Recalcular isoDominantKey y legendItems
          const geoData = { type: 'FeatureCollection', features: worldPolygons || [] };
          const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
          isoDominantKey = vm.isoDominantKey;
          legendItems = vm.legendItems;
          isoIntensity = vm.isoIntensity;
        } catch (error) {
          // Error restoring world data
        }
      } else if (!activePoll) {
        // MODO TRENDING: Cargar datos de trending mundial
        // Si ya hay datos de trending mundial en cache, usarlos
        
        if (Object.keys(worldLevelAnswers).length > 0 && Object.keys(worldLevelColorMap).length > 0) {
          answersData = worldLevelAnswers;
          colorMap = worldLevelColorMap; // CRÍTICO: Restaurar también el colorMap mundial
          
          // Recalcular isoDominantKey con los datos mundiales
          const geoData = { type: 'FeatureCollection', features: worldPolygons || [] };
          const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
          isoDominantKey = vm.isoDominantKey;
          legendItems = vm.legendItems;
          isoIntensity = vm.isoIntensity;
        }
      }

      await this.renderWorldView();
      
      // Forzar refresh INMEDIATO de colores después de limpiar variables
      // Esto asegura que onPolyCapColor use el nivel correcto (world) y no aplique atenuación
      await new Promise<void>((resolve) => {
        this.globe?.refreshPolyColors?.();
        resolve();
      });
    }

    async navigateBack() {
      
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
        // Show ALL countries - LIMPIAR propiedades de navegación previa
        if (worldPolygons?.length) {
          // Limpiar propiedades _isParent, _isChild, _forcedColor de navegaciones previas
          const cleanPolygons = worldPolygons.map(poly => {
            const cleanPoly = { ...poly };
            if (cleanPoly.properties) {
              const { _isParent, _isChild, _forcedColor, _opacity, _elevation, _parentCountry, _subdivisionName, ...restProps } = cleanPoly.properties;
              cleanPoly.properties = restProps;
            }
            return cleanPoly;
          });
          
          this.globe?.setPolygonsData(cleanPolygons);
          polygonsVisible = true;
        }
        
        // Forzar refresh de colores con los datos actuales
        // Esto asegura que si hay encuesta activa, los países se coloreen correctamente
        await Promise.all([
          new Promise<void>((resolve) => { this.globe?.refreshPolyColors?.(); resolve(); }),
          new Promise<void>((resolve) => { this.globe?.refreshPolyAltitudes?.(); resolve(); })
          // Labels se actualizan después del zoom automáticamente
        ]);
        
        // Clear subdivision labels
        subdivisionLabels = [];
        updateSubdivisionLabels(false);
      } catch (error) {
        console.error('[Navigation] Error rendering world view:', error);
      }
    }

    private async renderCountryView(iso: string, countryPolygons: any[]) {
      try {
        // Cargar subdivisiones del país
        let subdivisionPolygons: any[] = [];
        try {
          subdivisionPolygons = await loadSubregionTopoAsGeoFeatures(iso, iso);
        } catch (e) {
          console.warn('[CountryView] No subdivision file for', iso, e);
        }

        // FILTRAR polígonos inválidos ANTES de procesarlos
        const validSubdivisions = subdivisionPolygons.filter(poly => {
          return poly && poly.geometry && poly.properties;
        });
        
        
        // Marcar padres (país) y marcar hijos (subdivisiones)
        const parentMarked = countryPolygons.map(poly => ({
          ...poly,
          properties: { ...poly.properties, _isParent: true, _parentCountry: iso, _opacity: 0.25, _elevation: 0.002 }
        }));
        const childMarked = validSubdivisions.map(poly => ({
          ...poly,
          properties: { ...poly.properties, _isChild: true, _parentCountry: iso, _opacity: 1.0, _elevation: 0.004 }
        }));
                
        // PRIORIDAD 1: Cargar colores REALES desde la base de datos (si hay encuesta activa)
        if (activePoll && activePoll.id) {
                    subdivisionColorById = await computeSubdivisionColorsFromDatabase(iso, childMarked);
        }
        
        // PRIORIDAD 2: Fallback a marcadores simulados (legacy)
        if (Object.keys(subdivisionColorById).length === 0) {
                    subdivisionColorById = computeSubdivisionColorsFromVotes(iso, childMarked);
        }
        
        // PRIORIDAD 3: Fallback a distribución proporcional (último recurso)
        if (Object.keys(subdivisionColorById).length === 0 && countryChartSegments?.length) {
                    const byId = computeSubdivisionColorsProportional(childMarked, countryChartSegments);
          subdivisionColorById = byId;
                  }
        
        // Propagar _forcedColor a cada polígono hijo
                        
        let colorsApplied = 0;
        for (const c of childMarked) {
          const props = c?.properties || {};
          const id1 = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1 || props.NAME_1 || props.name_1 || null;
          
          if (id1) {
            const col = subdivisionColorById[String(id1)];
            if (col) {
              c.properties._forcedColor = col;
              colorsApplied++;
                          } else {
                          }
          } else {
                      }
        }
        
        
        // Combinar y renderizar
        const combined = [...parentMarked, ...childMarked];
        this.globe?.setPolygonsData(combined);
        
        // IMPORTANTE: Hacer refresh INMEDIATO para aplicar colores de BD
                this.globe?.refreshPolyColors?.();
        this.globe?.refreshPolyAltitudes?.();
        // Labels se generarán automáticamente después del zoom
        
                
              } catch (error) {
        console.error('[Navigation] Error rendering country view:', error);
      }
    }

    private async renderSubdivisionView(countryIso: string, subdivisionId: string, subdivisionPolygons: any[]) {
      try {
        // Filter out null or invalid polygons first
        const validPolygons = subdivisionPolygons.filter(poly => {
          return poly && poly.geometry && poly.geometry.type && poly.properties;
        });
        
                
        if (validPolygons.length === 0) {
          console.error('[Navigation] No valid polygons found for subdivision view');
          return;
        }
        
        // Show ONLY the selected subdivision (no country or world background)
        // ELEVAR significativamente los polígonos de nivel 3
        const markedPolygons = validPolygons.map(poly => ({
          ...poly,
          properties: {
            ...poly.properties,
            _isChild: true,
            _parentCountry: countryIso,
            _parentSubdivision: subdivisionId,
            _subdivisionName: poly.properties?.NAME_2 || poly.properties?.name_2 || 
                             poly.properties?.NAME || poly.properties?.name ||
                             poly.properties?.VARNAME_2 || poly.properties?.varname_2,
            _elevation: 0.05 // Elevación MUY alta para nivel 3 (subdivisión) - 3x más que el default
          }
        }));
        
                
        // Cargar colores ANTES de setPolygonsData
        if (activePoll && activePoll.id) {
                    
          // Cargar colores reales de sub-subdivisiones (nivel 2)
          const subSubdivisionColorById = await computeSubSubdivisionColorsFromDatabase(
            countryIso, 
            subdivisionId, 
            markedPolygons
          );
          
                              
          // NO aplicar _forcedColor aquí - dejar que isoDominantKey lo maneje
          // Esto permite que el sistema use los datos actualizados de answersData
                            }
        
        // Set subdivision polygons con colores ya aplicados
        await new Promise<void>((resolve) => {
          this.globe?.setPolygonsData(markedPolygons);
          resolve();
        });
        
        // Refresh visual usando promesas
        await Promise.all([
          new Promise<void>((resolve) => {
            this.globe?.refreshPolyColors?.();
            resolve();
          }),
          new Promise<void>((resolve) => {
            this.globe?.refreshPolyAltitudes?.();
            resolve();
          })
          // Labels se actualizan después del zoom automáticamente
        ]);
        
        // Labels se generarán automáticamente después del zoom
        
                
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
    
    // Get available options for next level
    async getAvailableOptions(): Promise<Array<{ id: string; name: string; iso?: string }>> {
      const options: Array<{ id: string; name: string; iso?: string }> = [];
      
      if (this.state.level === 'world') {
        // Return all countries from worldPolygons
        if (worldPolygons?.length) {
          const countryMap = new Map<string, string>();
          worldPolygons.forEach(poly => {
            const iso = isoOf(poly);
            const name = nameOf(poly);
            if (iso && name && !countryMap.has(iso)) {
              countryMap.set(iso, name);
            }
          });
          countryMap.forEach((name, iso) => {
            options.push({ id: iso, name, iso });
          });
        }
      } else if (this.state.level === 'country' && this.state.countryIso) {
        // Return all subdivisions for current country
        try {
          const subdivisionPolygons = await loadSubregionTopoAsGeoFeatures(this.state.countryIso, this.state.countryIso);
          const subdivisionMap = new Map<string, string>();
          subdivisionPolygons.forEach(poly => {
            const props = poly?.properties || {};
            const id1 = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1;
            const name1 = props.NAME_1 || props.name_1 || props.VARNAME_1 || props.varname_1;
            if (id1 && name1 && !subdivisionMap.has(String(id1))) {
              subdivisionMap.set(String(id1), String(name1));
            }
          });
          subdivisionMap.forEach((name, id) => {
            options.push({ id: `${this.state.countryIso}.${id}`, name });
          });
        } catch (e) {
          console.warn('[Navigation] Could not load subdivisions for dropdown:', e);
        }
      } else if (this.state.level === 'subdivision' && this.state.countryIso && this.state.subdivisionId) {
        // Return all sub-subdivisions for current subdivision
        try {
          const numericPart = this.state.subdivisionId.split('.').pop();
          if (numericPart) {
            const subdivisionFile = `${this.state.countryIso}.${numericPart}`;
            const subSubPolygons = await loadSubregionTopoAsGeoFeatures(this.state.countryIso, subdivisionFile);
            const subSubMap = new Map<string, string>();
            subSubPolygons.forEach(poly => {
              const props = poly?.properties || {};
              const id2 = props.ID_2 || props.id_2 || props.GID_2 || props.gid_2;
              const name2 = props.NAME_2 || props.name_2 || props.VARNAME_2 || props.varname_2;
              if (id2 && name2 && !subSubMap.has(String(id2))) {
                subSubMap.set(String(id2), String(name2));
              }
            });
            subSubMap.forEach((name, id) => {
              options.push({ id: `${this.state.countryIso}.${numericPart}.${id}`, name });
            });
          }
        } catch (e) {
          console.warn('[Navigation] Could not load sub-subdivisions for dropdown:', e);
        }
      }
      
      // Sort alphabetically by name
      return options.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  // Initialize navigation manager
  let navigationManager: NavigationManager;
  $: if (globe && !navigationManager) {
    navigationManager = new NavigationManager(globe);
  }
  
  // Function to toggle dropdown and load options
  async function toggleDropdown(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
        if (!navigationManager) {
            return;
    }
    
    if (showDropdown) {
            showDropdown = false;
      dropdownOptions = [];
      dropdownSearchQuery = '';
    } else {
            showDropdown = true;
      dropdownSearchQuery = '';
      const options = await navigationManager.getAvailableOptions();
      dropdownOptions = options;
                }
  }
  
  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (showDropdown) {
      const target = event.target as HTMLElement;
      const dropdown = target.closest('.breadcrumb-dropdown-wrapper');
      if (!dropdown) {
        showDropdown = false;
        dropdownOptions = [];
        dropdownSearchQuery = '';
      }
    }
  }
  
  // Function to select an option from dropdown
  async function selectDropdownOption(option: { id: string; name: string; type?: string }) {
    // BLOQUEAR durante animaciones de zoom
    if (isZooming) {
      console.log('[Dropdown] Selección bloqueada durante animación de zoom');
      return;
    }
    
    if (!navigationManager) return;
    
    const currentLevel = navigationManager.getCurrentLevel();
    showDropdown = false;
    dropdownOptions = [];
    dropdownSearchQuery = '';
    
    
    // Show bottom sheet
    setSheetState('collapsed');
    
    if (currentLevel === 'world') {
      // Navigate to country
      const countryFeature = worldPolygons?.find(p => isoOf(p) === option.id);
      if (countryFeature) {
        
        // Set selected country info for bottom sheet
        selectedCountryName = option.name;
        selectedCountryIso = option.id;
        
        // Update country chart segments for bottom sheet
        const countryRecord = answersData?.[option.id];
        if (countryRecord) {
          const countryData = [countryRecord];
          countryChartSegments = generateCountryChartSegments(countryData);
        } else {
          countryChartSegments = [];
        }
        
        // Navigate using manager PRIMERO
        await navigationManager.navigateToCountry(option.id, option.name);
        
        // LUEGO hacer zoom con adaptación al tamaño del país (sin delay, más rápido)
        const centroid = centroidOf(countryFeature);
        const adaptiveAltitude = calculateAdaptiveZoom(countryFeature);
        scheduleZoom(centroid.lat, centroid.lng, adaptiveAltitude, 500, 0);
        
        // Force refreshes to ensure polygons are visible (NO labels - se actualizan después del zoom)
        (async () => {
          await new Promise(resolve => requestAnimationFrame(resolve));
          globe?.refreshPolyColors?.();
          globe?.refreshPolyAltitudes?.();
          globe?.refreshPolyStrokes?.();
        })();
      }
    } else if (currentLevel === 'country') {
      // Navigate to subdivision
      const state = navigationManager.getState();
      if (state.countryIso) {
        const subdivisionPolygons = await loadSubregionTopoAsGeoFeatures(state.countryIso, state.countryIso);
        const subdivisionFeature = subdivisionPolygons.find(poly => {
          const props = poly?.properties || {};
          const id1 = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1;
          return option.id === `${state.countryIso}.${id1}`;
        });
        
        if (subdivisionFeature) {
          const centroid = centroidOf(subdivisionFeature);
          const adaptiveAltitude = calculateAdaptiveZoomSubdivision(subdivisionFeature);
          
          // Extract just the subdivision ID (the part after the country ISO)
          // option.id is like "ESP.3", we need just "3"
          const subdivisionId = subdivisionFeature.properties?.ID_1 || 
                               subdivisionFeature.properties?.id_1 || 
                               subdivisionFeature.properties?.GID_1 || 
                               subdivisionFeature.properties?.gid_1;
          
          
          // Update subdivision data for bottom sheet
          const countryRecord = answersData?.[state.countryIso];
          if (countryRecord) {
            const subdivisionData = [countryRecord];
            countryChartSegments = generateCountryChartSegments(subdivisionData);
          } else {
            countryChartSegments = [];
          }
          
          // Navigate using manager PRIMERO
          await navigationManager.navigateToSubdivision(state.countryIso, subdivisionId, option.name);
          
          // LUEGO hacer zoom adaptativo basado en el tamaño de la subdivisión (sin delay, más rápido)
          const targetAlt = Math.min(adaptiveAltitude, 0.06); // Máximo 0.06 para activar elevaciones bajas
          scheduleZoom(centroid.lat, centroid.lng, targetAlt, 500, 0);
          
          // Update selected subdivision name and ID
          selectedSubdivisionName = option.name;
          selectedSubdivisionId = option.id;
          selectedCityId = null;
          
          // Elevate level 3 polygons
          const subdivisionKey = `${state.countryIso}/${option.id}`;
          const loadedPolygons = navigationManager?.['polygonCache']?.get(subdivisionKey);
          if (loadedPolygons?.length) {
            loadedPolygons.forEach((poly: any) => {
              if (poly.properties) {
                poly.properties._elevation = 0.05;
              }
            });
          }
          
          // Refresh altitudes
          setTimeout(() => {
            globe?.refreshPolyAltitudes?.();
          }, 100);
        }
      }
    } else if (currentLevel === 'subdivision') {
      // Navigate to sub-subdivision (level 4)
      const state = navigationManager.getState();
      if (state.countryIso && state.subdivisionId) {
        const numericPart = state.subdivisionId.split('.').pop();
        if (numericPart) {
          const subdivisionFile = `${state.countryIso}.${numericPart}`;
          try {
            const subSubPolygons = await loadSubregionTopoAsGeoFeatures(state.countryIso, subdivisionFile);
            const subSubFeature = subSubPolygons.find(poly => {
              const props = poly?.properties || {};
              const id2 = props.ID_2 || props.id_2 || props.GID_2 || props.gid_2;
              return option.id === `${state.countryIso}.${numericPart}.${id2}`;
            });
            
            if (subSubFeature) {
              const centroid = centroidOf(subSubFeature);
              const adaptiveAltitude = calculateAdaptiveZoomSubdivision(subSubFeature);
              
              
              // Activar nivel 4
              selectedCityName = option.name;
              selectedSubdivisionName = state.subdivisionId ? (subSubFeature.properties?.NAME_1 || selectedSubdivisionName) : selectedSubdivisionName;
              selectedCityId = subSubFeature.properties?.ID_2;
              
              // Navigate and zoom (sin delay, más rápido)
              scheduleZoom(centroid.lat, centroid.lng, adaptiveAltitude, 500, 0);
              
              // Refresh visual (igual que en polygonClick)
              setTimeout(() => {
                globe?.refreshPolyStrokes?.();
                globe?.refreshPolyAltitudes?.();
              }, 100);
              
              // Generate city chart segments
              generateCityChartSegments(option.name);
              
            }
          } catch (e) {
            console.warn('[Dropdown] Could not load sub-subdivision:', e);
          }
        }
      }
    }
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
  let lastLabelUpdate = 0;
  const LABEL_UPDATE_THROTTLE = 300; // Actualizar etiquetas solo cada 300ms
  let pendingLabelUpdate: any = null;
  
  // Watcher reactivo: cuando termina el zoom, actualizar etiquetas
  $: if (!isZooming && pendingLabelUpdate) {
    const pov = pendingLabelUpdate;
    pendingLabelUpdate = null;
    // Usar requestAnimationFrame para sincronizar con el navegador
    requestAnimationFrame(() => {
      updateLabelsForCurrentView(pov);
    });
  }
  
  async function updateLabelsForCurrentView(pov: { lat: number; lng: number; altitude: number }) {
    // NO actualizar etiquetas durante animaciones de zoom
    if (isZooming) {
      // Guardar para actualizar cuando termine el zoom
      pendingLabelUpdate = pov;
      return;
    }
    
    // Throttle: solo actualizar si han pasado al menos 300ms desde la última actualización
    const now = performance.now();
    if (now - lastLabelUpdate < LABEL_UPDATE_THROTTLE) {
      return;
    }
    lastLabelUpdate = now;
    
    try {
      const currentLevel = navigationManager?.getCurrentLevel() || 'world';
      const alt = pov.altitude;
      
      // LOD DINÁMICO: Mostrar etiquetas según nivel y altitud
      // Cuanto más cerca (menor altitud), más etiquetas
      
      if (currentLevel === 'world') {
        // Nivel mundial: mostrar países solo cuando estás cerca
        if (alt < COUNTRY_LABELS_ALT) {
          await generateWorldCountryLabels(alt);
        } else {
          // Muy lejos: sin etiquetas
          updateSubdivisionLabels(false);
        }
      }
      else if (currentLevel === 'country') {
        const state = navigationManager?.getState();
        if (state?.countryIso) {
          // Nivel país: mostrar subdivisiones con filtrado según zoom
          await generateCountrySubdivisionLabels(state.countryIso, pov);
        }
      }
      else if (currentLevel === 'subdivision') {
        const state = navigationManager?.getState();
        if (state?.countryIso && state?.subdivisionId) {
          // Nivel subdivisión: mostrar sub-subdivisiones con filtrado según zoom
          await generateSubSubdivisionLabels(state.countryIso, state.subdivisionId, pov);
        }
      }
    } catch (e) {
      console.warn('[Labels] Error updating labels for current view:', e);
    }
  }

  // Función para evitar superposición de etiquetas con LOD dinámico
  function removeOverlappingLabels(labels: any[], altitude: number) {
    // Calcular distancia mínima según altitud y nivel de navegación
    // IMPORTANTE: El filtrado debe ser proporcional al nivel, no absoluto
    
    const currentLevel = navigationManager?.getCurrentLevel() || 'world';
    let minDistance: number;
    
    // ESTRATEGIA: En cada nivel, usar un porcentaje del área visible
    // Así es relativo al tamaño del polígono
    
    if (currentLevel === 'world') {
      // Nivel mundial: filtrado progresivo según altitud
      if (altitude > 1.5) {
        minDistance = 10 + (altitude - 1.5) * 10; // Muy lejos: pocos países
      } else if (altitude > 0.8) {
        minDistance = 3 + (altitude - 0.8) * 10; // Medio: más países
      } else {
        minDistance = 1 + (altitude - 0.0) * 2.5; // Cerca: muchos países
      }
    } else if (currentLevel === 'country') {
      // Nivel país: mostrar subdivisiones proporcionalmente
      // El zoom adaptativo pone altitudes entre 0.15-0.8 según tamaño del país
      if (altitude > 0.4) {
        minDistance = 2 + (altitude - 0.4) * 5; // Alejado: pocas subdivisiones
      } else if (altitude > 0.2) {
        minDistance = 0.3 + (altitude - 0.2) * 8.5; // Medio: más subdivisiones  
      } else {
        minDistance = 0.05; // Cerca: todas las subdivisiones
      }
    } else {
      // Nivel subdivisión: SIEMPRE mostrar todas las etiquetas
      // Ya estamos en el nivel más detallado, el usuario quiere verlas todas
      minDistance = 0.01; // Casi sin filtro - solo evitar superposición real
    }
    
    const filtered: any[] = [];
    const rejected: any[] = [];
    
    for (const label of labels) {
      let overlaps = false;
      let closestDistance = Infinity;
      
      for (const existing of filtered) {
        const dx = label.lng - existing.lng;
        const dy = label.lat - existing.lat;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < closestDistance) {
          closestDistance = distance;
        }
        
        if (distance < minDistance) {
          overlaps = true;
          break;
        }
      }
      
      if (!overlaps) {
        filtered.push(label);
      } else {
        rejected.push({ ...label, closestDistance });
      }
    }
    
    // Debug: mostrar etiquetas rechazadas en nivel subdivisión
    if (currentLevel === 'subdivision') {
      console.log(`[LOD] Filtrado de superposiciones:`, {
        entrada: labels.length,
        salida: filtered.length,
        rechazadas: rejected.length,
        minDistance: minDistance,
        altitude: altitude.toFixed(3)
      });
      
      if (rejected.length > 0 && rejected.length <= 10) {
        console.log(`[LOD] Etiquetas rechazadas:`, 
          rejected.map(r => `${r.name || r.text} (dist: ${r.closestDistance.toFixed(3)})`));
      }
    }
    
    return filtered;
  }
  
  async function generateWorldCountryLabels(altitude: number) {
    try {
      if (!worldPolygons?.length) return;
      
      // NO usar cache - necesitamos recalcular según altitud para LOD dinámico
      
      // Generate labels for world countries
      const allLabels = worldPolygons.map((feat, index) => {
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
          color: '#c9d1d9',
          opacity: 0.8,
          feature: feat
        };
      }).filter(label => label.text);
      
      // Filtrar etiquetas superpuestas según altitud (LOD dinámico)
      const labels = removeOverlappingLabels(allLabels, altitude);
      
      subdivisionLabels = labels;
      updateSubdivisionLabels(true);
      
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
        color: '#c9d1d9',
        opacity: 1.0
      }];
      
      subdivisionLabels = labels;
      updateSubdivisionLabels(true);
      
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
        color: '#c9d1d9',
        opacity: 1.0
      }];
      
      subdivisionLabels = labels;
      updateSubdivisionLabels(true);
      
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
                try {
          countryPolygons = await loadSubregionTopoAsGeoFeatures(iso, iso);
        } catch (e) {
          console.warn('[Labels] Could not load subdivision file:', `${iso}.topojson`, e);
          return;
        }
      }
      
      if (countryPolygons?.length) {
        const allLabels = generateSubdivisionLabels(countryPolygons, pov?.altitude);
        // Filtrar según altitud para LOD dinámico
        const filteredLabels = removeOverlappingLabels(allLabels, pov.altitude);
        subdivisionLabels = filteredLabels;
        updateSubdivisionLabels(true);
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
                return;
      }
      
      // The pattern is always: ISO.number.topojson (e.g., ESP.1, RUS.40)
      const subdivisionFile = `${countryIso}.${numericPart}`;
      
            
      try {
        // Check if the subdivision file exists
        const path = `/geojson/${countryIso}/${subdivisionFile}.topojson`;
        const resp = await fetch(path, { method: 'HEAD' });
        
        if (resp.ok) {
                    const subSubPolygons = await loadSubregionTopoAsGeoFeatures(countryIso, subdivisionFile);
          
          if (subSubPolygons?.length) {
            // Filter out null or invalid polygons
            const validPolygons = subSubPolygons.filter(poly => {
              return poly && poly.geometry && poly.geometry.type && poly.properties;
            });
            
                        
            if (validPolygons.length === 0) {
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
            
            const allLabels = generateSubdivisionLabels(markedPolygons, pov?.altitude);
            // Filtrar según altitud para LOD dinámico
            const filteredLabels = removeOverlappingLabels(allLabels, pov.altitude);
            subdivisionLabels = filteredLabels;
            updateSubdivisionLabels(true);
            return;
          }
        } else {
                  }
      } catch (e) {
              }
      
      // Fallback: keep current subdivision labels (level 1)
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
      }

  function onMapMovementEnd() {
    if (mapMovementTimeout) {
      clearTimeout(mapMovementTimeout);
    }
    
    mapMovementTimeout = setTimeout(async () => {
      isMapMoving = false;
            
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
  let selectedSubdivisionName: string | null = null;
  let selectedSubdivisionId: string | null = null; // ID de la subdivisión seleccionada
  let selectedCityName: string | null = null;
  let selectedCityId: string | null = null; // ID de la ciudad/provincia seleccionada para resaltado (nivel 4)
  let SHEET_STATE: SheetState = 'peek'; // Mostrar información mundial por defecto
  
  // CONTEXTO DE ENCUESTA ACTIVA
  // MODO EXCLUSIVO: El globo trabaja en modo trending O en modo encuesta específica (NUNCA ambos)
  let activePoll: any = null; // Encuesta actualmente abierta (null = modo trending)
  let activePollOptions: Array<{ key: string; label: string; color: string; votes: number; pollData?: any }> = []; // Opciones de la encuesta activa
  
  // Watcher para detectar cambios inesperados en activePoll y loggear el modo actual
  let lastActivePollId: string | null = null;
  $: {
    const currentId = activePoll?.id || null;
    if (currentId !== lastActivePollId) {
      if (currentId) {
        console.log('[ActivePoll] ✅ Encuesta activa:', currentId);
      } else if (lastActivePollId) {
        console.warn('[ActivePoll] ⚠️ Encuesta cerrada inesperadamente. Anterior:', lastActivePollId);
        console.trace(); // Mostrar stack trace para ver quién lo cerró
      }
      lastActivePollId = currentId;
    }
  }
  
  // Función para cerrar la encuesta activa y volver a modo trending
  async function closePoll() {
    // Limpiar contexto de encuesta
    activePoll = null;
    activePollOptions = [];
    
    // Limpiar caches de datos por nivel
    worldLevelAnswers = {};
    countryLevelAnswers = {};
    subdivisionLevelAnswers = {};
    worldLevelColorMap = {};
    countryLevelColorMap = {};
    subdivisionLevelColorMap = {};
    
    // Limpiar datos y colores
    isoDominantKey = {};
    colorMap = {};
    answersData = {};
    legendItems = [];
    regionVotes = [];
    worldChartSegments = [];
    countryChartSegments = [];
    subdivisionChartSegments = [];
    cityChartSegments = [];
    
    await tick();
    
    // Reset del globe.gl
    globe?.resetGlobe?.();
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Actualizar colores
    await updateGlobeColors();
    
    // Navegar a mundo
    if (navigationManager) {
      await navigationManager.navigateToWorld();
    }
    
    // Esperar a que worldPolygons esté disponible (máximo 2 segundos)
    let attempts = 0;
    while ((!worldPolygons || worldPolygons.length === 0) && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }
    
    // Recargar polígonos mundiales
    if (worldPolygons && worldPolygons.length > 0) {
      globe?.setPolygonsData?.(worldPolygons);
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    
    // Hacer zoom out
    scheduleZoom(0, 0, 2.0, 500);
    await delay(600);
    
    // Cargar datos de trending mundial
    await loadTrendingData();
    await updateGlobeColors();
  }
  
  // Función para cargar datos de trending (múltiples encuestas agregadas)
  async function loadTrendingData() {
    
    try {
      // Cargar encuestas trending desde la API
      const response = await fetch('/api/polls/trending-by-region?region=Global&limit=20');
      if (!response.ok) {
        return;
      }
      
      const { data: trendingPolls } = await response.json();
            
      // MODO TRENDING: Cada encuesta es una "opción"
      // Los países se pintan según qué encuesta tiene más votos totales
      const aggregatedData: Record<string, Record<string, number>> = {};
      const aggregatedColors: Record<string, string> = {};
      
      // Asignar un color a cada encuesta
      const pollColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'];
      
      // Crear activePollOptions con las encuestas trending como opciones
      activePollOptions = [];
      
      for (let i = 0; i < trendingPolls.length; i++) {
        const poll = trendingPolls[i];
        const pollKey = `poll_${poll.id}`;
        const pollColor = pollColors[i % pollColors.length];
        aggregatedColors[pollKey] = pollColor;
        
        // Agregar encuesta a activePollOptions con datos completos para poder abrirla
        activePollOptions.push({
          key: pollKey,
          label: poll.question || poll.title || `Encuesta ${poll.id}`,
          color: pollColor,
          votes: 0, // Se actualizará después
          pollData: poll // IMPORTANTE: Guardar datos completos de la encuesta
        });
        
        // Cargar datos de votos por país para cada encuesta trending
        try {
          const pollResponse = await fetch(`/api/polls/${poll.id}/votes-by-country`);
          if (pollResponse.ok) {
            const { data: pollData } = await pollResponse.json();
            
            // Sumar TODOS los votos de esta encuesta por país
            for (const [iso, votes] of Object.entries(pollData as Record<string, Record<string, number>>)) {
              if (!aggregatedData[iso]) {
                aggregatedData[iso] = {};
              }
              
              // Sumar todos los votos de todas las opciones de esta encuesta
              const totalVotes = Object.values(votes).reduce((sum, count) => sum + (count as number), 0);
              aggregatedData[iso][pollKey] = totalVotes;
            }
          }
        } catch (error) {
          // Error loading poll data - continuar con siguiente encuesta
        }
      }
      
      // Actualizar votos totales en activePollOptions
      activePollOptions = activePollOptions.map(option => {
        const totalVotesForPoll = Object.values(aggregatedData).reduce((sum, countryData) => {
          return sum + (countryData[option.key] || 0);
        }, 0);
        return { ...option, votes: totalVotesForPoll };
      });
      
      // Si no hay datos, usar fallback
      if (Object.keys(aggregatedData).length === 0) {
                // Generar datos de fallback con las encuestas trending
        const fallbackOptions = trendingPolls.slice(0, 5).map((poll: any, index: number) => ({
          key: `poll_${poll.id}`,
          label: poll.title || poll.question,
          color: poll.options?.[0]?.color || `hsl(${index * 72}, 70%, 60%)`,
          votes: poll.totalVotes || 100,
          pollData: poll
        }));
        generateFallbackPollData(aggregatedData, fallbackOptions);
        fallbackOptions.forEach((opt: { key: string; label: string; color: string; votes: number }) => {
          aggregatedColors[opt.key] = opt.color;
        });
        activePollOptions = fallbackOptions;
      }
      
      // Actualizar datos globales
      answersData = aggregatedData;
      colorMap = aggregatedColors;
      
      // CRÍTICO: Guardar en cache mundial para poder restaurar después
      worldLevelAnswers = aggregatedData;
      worldLevelColorMap = aggregatedColors;
      
      // Esperar a que worldPolygons esté disponible (máximo 2 segundos)
      let attempts = 0;
      while ((!worldPolygons || worldPolygons.length === 0) && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
      
      if (!worldPolygons || worldPolygons.length === 0) {
        return;
      }
      
      // Recalcular colores dominantes
      const geoData = { type: 'FeatureCollection', features: worldPolygons || [] };
      const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
      isoDominantKey = vm.isoDominantKey;
      legendItems = vm.legendItems;
      isoIntensity = vm.isoIntensity;
      intensityMin = vm.intensityMin;
      intensityMax = vm.intensityMax;
      
      // Refrescar colores del globo
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Forzar actualización de polígonos con los nuevos colores
      if (globe?.setPolygonsData) {
        globe.setPolygonsData(worldPolygons);
      }
      
      await updateGlobeColors();
      globe?.refreshPolyColors?.();
      
    } catch (error) {
      // Error crítico cargando trending
      console.error('[GlobeGL] Error loading trending:', error);
    }
  }
  
  // SISTEMA DE CONTROL DE ZOOM CENTRALIZADO
  // Evita múltiples llamadas simultáneas a pointOfView que causan parpadeos
  let pendingZoom: { lat: number; lng: number; altitude: number; duration: number } | null = null;
  let zoomTimeout: ReturnType<typeof setTimeout> | null = null;
  let isZooming = false;
  
  function scheduleZoom(lat: number, lng: number, altitude: number, duration: number = 700, delay: number = 0) {
    // Cancelar cualquier zoom pendiente
    if (zoomTimeout) {
      clearTimeout(zoomTimeout);
      zoomTimeout = null;
    }
    
    // CRÍTICO: Marcar como zooming INMEDIATAMENTE para bloquear etiquetas
    isZooming = true;
    
    // Si ya hay un zoom en progreso, esperar a que termine
    if (delay === 0 && pendingZoom) {
      delay = 100;
    }
    
    pendingZoom = { lat, lng, altitude, duration };
    
        
    zoomTimeout = setTimeout(() => {
      if (pendingZoom && globe) {
                globe.pointOfView(pendingZoom, pendingZoom.duration);
        
        // Marcar como completado después de la duración de la animación
        setTimeout(() => {
          isZooming = false;
          pendingZoom = null;
          
          // IMPORTANTE: Forzar actualización de etiquetas cuando termine el zoom
          const pov = globe?.pointOfView();
          if (pov) {
            requestAnimationFrame(() => {
              updateLabelsForCurrentView(pov);
            });
          }
                  }, pendingZoom.duration + 50);
      }
      zoomTimeout = null;
    }, delay);
  }
  
  const BOTTOM_BAR_PX = 0; // altura del menú inferior
  const EXPAND_SNAP_PX = 10; // umbral de arrastre hacia arriba para expandir totalmente (más sensible)
  const COLLAPSED_VISIBLE_RATIO = 0.27; // en estado colapsado, se ve el 30% superior de la sheet
  const PEEK_VISIBLE_RATIO = 0.10;      // tercer stop: 10% visible
  // Inicializa fuera de pantalla para evitar parpadeo visible al cargar
  let sheetY = 10000; // translateY actual en px (0 = expandido, >0 hacia abajo)
  let sheetIsTransitioning = false; // Controla si debe usar transición CSS
  let sheetCtrl: BottomSheetController;
  // Feed (encuestas) en modo expandido
  let feedCount = 10;
  let isLoadingMore = false;
  let worldChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  let cityChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  let voteOptions: Array<{ key: string; label: string; color: string; votes: number }> = [];
  
  // Opciones de votación: SEPARAR CLARAMENTE trending vs encuesta específica
  $: {
    if (activePoll && activePoll.id) {
      // MODO ENCUESTA ESPECÍFICA: Usar activePollOptions (opciones de votación de la encuesta)
      voteOptions = activePollOptions.length > 0 ? activePollOptions : [];
    } else {
      // MODO TRENDING: Usar activePollOptions (encuestas trending como opciones)
      // Si no hay activePollOptions, usar fallback
      voteOptions = activePollOptions.length > 0 ? activePollOptions : [
  
      ];
    }
    
    console.log('[VoteOptions] 📋 Actualizado:', {
      mode: activePoll ? 'ENCUESTA_ESPECÍFICA' : 'TRENDING',
      source: activePollOptions.length > 0 ? 'activePollOptions' : 'fallback',
      count: voteOptions.length,
      sampleKey: voteOptions[0]?.key,
      activePollId: activePoll?.id || 'none'
    });
  }
  
  // Función helper para generar datos de fallback cuando la API no está disponible
  function generateFallbackPollData(answersData: Record<string, Record<string, number>>, options: Array<{ key: string; label: string; color: string; votes: number }>) {
        
    // Obtener todos los códigos ISO de los países
    const countryCodes = worldPolygons?.map(p => p.properties?.ISO_A3).filter(Boolean) || [];
    
    // Para cada país, asignar votos simulados basados en los votos totales de cada opción
    countryCodes.forEach(iso => {
      const countryAnswers: Record<string, number> = {};
      options.forEach(option => {
        // Distribuir votos de forma más realista (no completamente aleatorio)
        const baseVotes = option.votes || 100;
        const randomFactor = 0.5 + Math.random(); // Factor entre 0.5 y 1.5
        countryAnswers[option.key] = Math.floor((baseVotes / countryCodes.length) * randomFactor);
      });
      answersData[iso] = countryAnswers;
    });
    
      }
  
  // Función para manejar votos
  function handleVote(optionKey: string) {
        
    // Incrementar el contador de votos para la opción seleccionada
    voteOptions = voteOptions.map(option => 
      option.key === optionKey 
        ? { ...option, votes: option.votes + 1 }
        : option
    );
    
    // Aquí podrías enviar el voto al servidor
    // await sendVoteToServer(optionKey, selectedCountryName, selectedSubdivisionName, selectedCityName);
    
    // Mostrar feedback visual (opcional)
      }
  
  // Función para abrir una encuesta en el globo con sus opciones visualizadas
  async function handleOpenPollInGlobe(event: CustomEvent<{ poll: any; options: Array<{ key: string; label: string; color: string; votes: number }> }>) {
    const { poll, options } = event.detail;
    
    // IMPORTANTE: Colapsar el BottomSheet inmediatamente para ver mejor el globo
    SHEET_STATE = 'collapsed';
    setSheetState('collapsed');
    
    // CRÍTICO: Iniciar zoom inmediatamente para que se ejecute en paralelo con la carga de datos
    scheduleZoom(20, 0, 2.5, 1000, 100);
    
    console.log('[HandleOpenPoll] 🔵 Llamada recibida:', {
      pollId: poll?.id || 'null',
      currentActivePoll: activePoll?.id || 'none',
      optionsCount: options.length,
      modoActual: activePoll ? 'ENCUESTA_ESPECÍFICA' : 'TRENDING'
    });
    
    // Si poll es null (trending/main poll), cerrar encuesta activa
    if (!poll || !poll.id) {
      if (activePoll) {
        console.log('[HandleOpenPoll] 🔄 Cerrando encuesta para mostrar trending');
        await closePoll();
      }
      // Cargar datos de trending
      await loadTrendingData();
      return;
    }
    
    // Si es la misma encuesta, no hacer nada
    if (activePoll && activePoll.id === poll.id) {
      console.log('[HandleOpenPoll] ⏭️ Misma encuesta ya abierta, saltando');
      return;
    }
    
    // Si hay una encuesta diferente abierta, cerrarla primero
    if (activePoll && activePoll.id !== poll.id) {
      console.log('[HandleOpenPoll] 🔄 Cerrando encuesta anterior:', activePoll.id, '→ nueva:', poll.id);
      await closePoll();
    }
    
            
    // GUARDAR CONTEXTO DE ENCUESTA ACTIVA (MODO EXCLUSIVO)
    console.log('[HandleOpenPoll] 📋 MODO ENCUESTA ESPECÍFICA ACTIVADO');
    console.log('[HandleOpenPoll] Encuesta:', poll.id, '| Opciones:', options.length);
    
    activePoll = poll;
    activePollOptions = options;
    
    // Actualizar colorMap con los colores de las opciones DE LA ENCUESTA
    const newColorMap: Record<string, string> = {};
    options.forEach(option => {
      newColorMap[option.key] = option.color;
      newColorMap[option.label] = option.color; // También por label
    });
    colorMap = newColorMap;
    
    console.log('[HandleOpenPoll] ColorMap actualizado con opciones de encuesta:', Object.keys(newColorMap));
        
    // CARGAR DATOS REALES DE LA ENCUESTA DESDE LA API
    const newAnswersData: Record<string, Record<string, number>> = {};
    
    try {
      const response = await fetch(`/api/polls/${poll.id}/votes-by-country`);
      if (response.ok) {
        const { data } = await response.json();
        Object.assign(newAnswersData, data);
      } else {
        // Fallback: generar datos simulados basados en las opciones de la encuesta
        generateFallbackPollData(newAnswersData, options);
      }
    } catch (error) {
      console.error('[GlobeGL] ❌ Error loading poll data from API:', error);
      // Fallback: generar datos simulados
      generateFallbackPollData(newAnswersData, options);
    }
    
    // Guardar en cache mundial
    worldLevelAnswers = newAnswersData;
    answersData = newAnswersData;
    
    console.log('[OpenPoll] 📊 Encuesta abierta:', poll.id, '| Países con datos:', Object.keys(newAnswersData).length);
    
    // IMPORTANTE: Navegar a vista mundial para mostrar los colores de la encuesta
    if (navigationManager) {
      await navigationManager.navigateToWorld();
      await tick();
    }
    
    // Recalcular intensidades y colores dominantes basados en los datos de la encuesta activa
    const geoData = { type: 'FeatureCollection', features: worldPolygons || [] };
    const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
    isoDominantKey = vm.isoDominantKey;
    legendItems = vm.legendItems;
    isoIntensity = vm.isoIntensity;
    intensityMin = vm.intensityMin;
    intensityMax = vm.intensityMax;
    
    console.log('[OpenPoll] 🎨 Colores calculados para', Object.keys(isoDominantKey).length, 'países');
    
    // Generar marcadores geográficos
    
    const pollMarkers: VotePoint[] = [];
    let markerId = 0;
    
    options.forEach((option, optionIndex) => {
      const numMarkers = Math.max(5, Math.ceil((option.votes / 100) * 50));
      
      for (let i = 0; i < numMarkers; i++) {
        const lat = (Math.random() - 0.5) * 160;
        const lng = ((optionIndex / options.length) * 360) + (Math.random() - 0.5) * 90 - 180;
        
        pollMarkers.push({
          id: `poll_marker_${poll?.id || 'main'}_${option.key}_${markerId++}`,
          iso3: 'POLL',
          lat,
          lng,
          tag: option.key
        });
      }
    });
    
    regionVotes = pollMarkers;
    
    // El zoom ya se inició al principio, ahora solo actualizamos colores
    await updateGlobeColors();
    
    // Emit poll data to update header with poll-specific information
    const pollOptions = options.map(option => ({
      key: option.label || option.key,
      color: option.color,
      avatar: '/default-avatar.png'
    }));
    
    // NUEVO: Emitir evento para la barra de opciones (NO para el header)
    // El header ahora es independiente y no cambia
    dispatch('pollselected', {
      poll: poll,
      options: options
    });
    
      }
  
  
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

  // Configuración del tema desde JSON
  const globeTheme = themeConfig.theme.colors.globe;
  
  // Controles de color (color pickers) y opacidad (sliders) - Inicializados desde theme.json
  let capColor = themeConfig.theme.colors.accent.blue;
  let capOpacityPct = 100;
  let sphereColor = globeTheme.sphere; // #0a0a0a
  let sphereOpacityPct = 100;
  let strokeColor = globeTheme.stroke; // #333333 gris
  let strokeOpacityPct = globeTheme.strokeOpacity; // 40 visible
  let bgColor = globeTheme.background; // #0a0a0a casi negro
  let polygonNoDataColor = globeTheme.polygonDefault; // #0a0a0a
  let atmosphereColor = globeTheme.atmosphere; // #1a1a1a muy sutil
  let atmosphereAltitude = globeTheme.atmosphereAltitude; // 0.12
  let isDarkTheme = true; // Estado del tema

  // Colores derivados (conveniencia)
  $: capBaseColor = capColor;
  $: sphereBaseColor = sphereColor;
  $: strokeBaseColor = strokeColor;
  let showSettings = false;
  let panelTop = 52;
  let panelEl: HTMLDivElement | null = null;
  
  // Observar cambios de tema - TODO unificado desde theme.json
  function updateColorsForTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    isDarkTheme = isDark; // Actualizar estado del tema
    
    // Cargar colores desde theme.json
    const theme = themeConfig.theme.colors;
    const globeConfig = isDark ? theme.globe : theme.globeLight;
    
    // Aplicar configuración del tema seleccionado
    bgColor = globeConfig.background;
    sphereColor = globeConfig.sphere;
    strokeColor = globeConfig.stroke;
    strokeOpacityPct = globeConfig.strokeOpacity;
    atmosphereColor = globeConfig.atmosphere;
    atmosphereAltitude = globeConfig.atmosphereAltitude;
    capColor = theme.accent.blue;
    polygonNoDataColor = globeConfig.polygonDefault;
    
    // Forzar actualización visual del globo
    if (globe) {
      setTimeout(() => {
        globe.refreshPolyColors?.();
        globe.refreshPolyStrokes?.();
      }, 50);
    }
  }
  
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
  type SubdivisionLabel = { id: string; name: string; lat: number; lng: number; feature?: any; size?: number; area?: number; text?: string; color?: string; opacity?: number };
  let subdivisionLabels: SubdivisionLabel[] = [];
  // Amigos por opción (para enriquecer tarjetas en BottomSheet). Claves deben coincidir con los keys de segmentos/opciones
  let friendsByOption: Record<string, Array<{ id: string; name: string; avatarUrl?: string }>> = {};
  // Visitas por opción (para chips y header)
  let visitsByOption: Record<string, number> = {};
  // Creadores y fechas por opción (para header profesional)
  let creatorsByOption: Record<string, { id: string; name: string; handle?: string; avatarUrl?: string; verified?: boolean }> = {};
  let publishedAtByOption: Record<string, string | Date> = {};
  
  // Interfaz para encuestas adicionales (scroll infinito)
  interface Poll {
    id: string;
    question: string;
    type: 'poll' | 'hashtag' | 'trending';
    region: string;
    options: Array<{ key: string; label: string; color: string; votes: number }>;
    totalVotes: number;
    totalViews: number;
    creator?: { id: string; name: string; handle?: string; avatarUrl?: string; verified?: boolean };
    publishedAt?: string | Date;
    friendsByOption?: Record<string, Array<{ id: string; name: string; avatarUrl?: string }>>;
  }
  
  // Array de encuestas adicionales para scroll infinito (se cargan desde la API en BottomSheet)
  let additionalPolls: Poll[] = [];
  let isLoadingMorePolls = false;
  
  // ELIMINADO: generateMockPolls
  // Las encuestas se cargan desde la API en el componente BottomSheet
  // Esta función ya no hace nada, BottomSheet maneja su propio scroll infinito
  function loadMorePolls() {
    // No-op: BottomSheet carga sus propias encuestas
  }

  // Asignación de color por subdivisión (ID_1/NAME_1), para vista país
  let subdivisionColorById: Record<string, string> = {};

  function pickDominantTag(counts: Record<string, number>): string | null {
    let bestKey: string | null = null;
    let bestVal = -1;
    for (const [k, v] of Object.entries(counts)) {
      if (v > bestVal) { bestVal = v; bestKey = k; }
    }
    return bestKey;
  }

  
  // FUNCIÓN LEGACY: Usar marcadores (datos simulados) - mantener como fallback
  function computeSubdivisionColorsFromVotes(countryIso: string, polygons: any[]): Record<string, string> {
    const byId: Record<string, string> = {};
    const pts = regionVotes?.length ? regionVotes.filter(p => p.iso3 === countryIso) : [];
    if (!pts.length) return byId;
    for (const poly of polygons) {
      const props = poly?.properties || {};
      const id1 = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1 || props.NAME_1 || props.name_1 || null;
      if (!id1) continue;
      const counts: Record<string, number> = {};
      for (const p of pts) {
        if (!p.tag) continue;
        if (pointInFeature(p.lat, p.lng, poly)) {
          counts[p.tag] = (counts[p.tag] || 0) + 1;
        }
      }
      const dom = pickDominantTag(counts);
      if (dom && colorMap?.[dom]) byId[String(id1)] = colorMap[dom];
    }
    return byId;
  }

  function computeSubdivisionColorsProportional(polygons: any[], segs: Array<{ key: string; pct: number; color: string }>): Record<string, string> {
    const byId: Record<string, string> = {};
    if (!polygons?.length || !segs?.length) return byId;
    const total = polygons.length;
    const alloc: Array<{ key: string; color: string; count: number }> = segs.map(s => ({ key: s.key, color: s.color, count: Math.max(0, Math.round((s.pct / 100) * total)) }));
    // Ajuste por redondeo para que sume total
    let diff = total - alloc.reduce((a, b) => a + b.count, 0);
    let i = 0;
    while (diff !== 0 && alloc.length) {
      const idx = (i++) % alloc.length;
      alloc[idx].count += (diff > 0 ? 1 : -1);
      diff += (diff > 0 ? -1 : 1);
    }
    // Asignar recorrido simple
    let cursor = 0;
    for (const a of alloc) {
      for (let k = 0; k < a.count && cursor < polygons.length; k++, cursor++) {
        const props = polygons[cursor]?.properties || {};
        const id1 = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1 || props.NAME_1 || props.name_1 || null;
        if (id1) byId[String(id1)] = a.color;
      }
    }
    // Si quedaron sin asignar por alguna razón, rellenar con el color del primer segmento
    const fallbackColor = segs[0]?.color || polygonNoDataColor;
    for (const poly of polygons) {
      const props = poly?.properties || {};
      const id1 = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1 || props.NAME_1 || props.name_1 || null;
      if (id1 && !byId[String(id1)]) byId[String(id1)] = fallbackColor;
    }
    return byId;
  }
  let labelsInitialized = false;
  
  // Variable para mostrar la altitud actual
  let currentAltitude = 3.5;
  
  // Debounce para cargar polígonos solo cuando el mapa esté parado
  let mapMovementTimeout: NodeJS.Timeout | null = null;
  let isMapMoving = false;
  const MAP_STOP_DELAY = 300; // ms para considerar que el mapa está parado
  let tagQuery = '';
  let showSearch = false;
  // Mostrar solo hashtags (sin toggle de cuentas)
  let showAccountsLine = false; // siempre false, solo hashtags
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
  const seenKeyForTag = (k: string) => '#' + k;
  const seenKeyForAccount = (h: string) => '@' + h;
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
      scheduleZoom(lat, lng, targetAltitude, 1000);
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
                // Activar tiles y alternar a polígonos locales del país centrado
        if (polygonsVisible) {
          polygonsVisible = false; // deja de estar visible el dataset global
          setTilesEnabled(true);
        }
        try {
                    await ensureLocalCountryPolygons(pov);
        } catch {}
        // Si estamos aún más cerca, intentar cargar subregión por ID_1 (después de tener localPolygons)
        try {
                    await ensureSubregionPolygons(pov);
        } catch {}
        // Mostrar/actualizar marcadores en cada cambio mientras estamos cerca
        try { updateMarkers(true); } catch {}
      } else {
        // DISABLED: Auto-loading world polygons on zoom out - now controlled by NavigationManager
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

 

  // DISABLED: Zoom-based polygon loading removed - now handled by NavigationManager only
  async function ensureLocalCountryPolygons(pov: { lat: number; lng: number; altitude: number } | undefined) {
    // This function is now disabled - polygon loading only happens via clicks
        return;
  }

  

  async function loadCountryTopoAsGeoFeatures(iso: string): Promise<any[]> {
    const path = '/geojson/' + iso + '/' + iso + '.topojson';
    const resp = await fetch(path);
    if (!resp.ok) throw new Error('HTTP ' + resp.status + ' al cargar ' + path);
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

  // El modo ahora lo controla la barrita inferior

  // Segmentos de chart por país seleccionado (top categorías por votos)
  type ChartSeg = { key: string; value: number; pct: number; color: string };
  let countryChartSegments: ChartSeg[] = [];
  let subdivisionChartSegments: ChartSeg[] = [];
  
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
      color: colorMap?.[k] ?? polygonNoDataColor 
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
    return generateCountryChartSegments([rec]);
  })();

  // Reactive statement para generar gráfico mundial
  $: worldChartSegments = (() => {
    if (!answersData) {
            return [];
    }
    
        
    // Agregar todos los datos de todos los países
    const allCountryData = Object.values(answersData);
        
    const worldSegments = generateCountryChartSegments(allCountryData);
        
    return worldSegments;
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

  // DESACTIVADO: El header ahora es independiente y no cambia con la navegación
  // Los avatares siempre muestran usuarios trending globales
  // $: {
  //   const currentLevel = navigationState.level;
  //   let pollTitle = '';
  //   let pollOptions: Array<{ key: string; color: string; avatar?: string }> = [];
  //   let isWorldView = currentLevel === 'world';
  //   
  //   if (currentLevel === 'world') {
  //     pollTitle = 'Global Trends';
  //   } else if (currentLevel === 'country' && selectedCountryName) {
  //     pollTitle = selectedCountryName;
  //   } else if (currentLevel === 'subdivision' && selectedSubdivisionName) {
  //     pollTitle = selectedSubdivisionName;
  //   }
  //   
  //   // Map legend items to poll options with avatars
  //   if (legendItems.length > 0) {
  //     pollOptions = legendItems.map(item => ({
  //       key: item.key,
  //       color: item.color,
  //       avatar: '/default-avatar.png'
  //     }));
  //     
  //     dispatch('polldata', { 
  //       title: pollTitle, 
  //       options: pollOptions, 
  //       isWorldView 
  //     });
  //   }
  // }

  onMount(async () => {
    // Inicializar controlador de bottom sheet
    sheetCtrl = new BottomSheetController({
      bottomBarPx: BOTTOM_BAR_PX,
      collapsedVisibleRatio: COLLAPSED_VISIBLE_RATIO,
      peekVisibleRatio: PEEK_VISIBLE_RATIO,
      expandSnapPx: EXPAND_SNAP_PX,
      onChange: (newState: any, newY: number, isTransitioning: boolean) => {
        SHEET_STATE = newState;
        sheetY = newY;
        sheetIsTransitioning = isTransitioning;
        // Emitir evento para que el padre pueda reaccionar al cambio de estado
        dispatch('sheetstatechange', { state: newState });
      }
    });
    // Posicionar inicialmente en peek para mostrar info mundial
    sheetCtrl.setState('peek');
    // Emitir el estado inicial después de un tick para que el listener esté conectado
    setTimeout(() => {
      dispatch('sheetstatechange', { state: 'peek' });
    }, 0);
    
    // Listener para cambios de pantalla completa - recalcular BottomSheet
    const handleFullscreenChange = () => {
            // Esperar un momento para que el navegador actualice las dimensiones
      setTimeout(() => {
        if (sheetCtrl) {
          const currentState = sheetCtrl.state;
          sheetCtrl.onWindowResize(); // Recalcula basado en nueva altura
                  }
      }, 100);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    
    
    // Función de testing para probar zoom adaptativo con diferentes países
    (window as any).testAdaptiveZoom = (countryIso: string) => {
            const countryFeature = worldPolygons?.find(p => p.properties?.ISO_A3 === countryIso);
      if (countryFeature) {
        const area = calculatePolygonArea(countryFeature);
        const adaptiveAltitude = calculateAdaptiveZoom(countryFeature);
        const centroid = centroidOf(countryFeature);
        
                                        
        // Aplicar el zoom
        globe?.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: adaptiveAltitude }, 1000);
        
        return { area, adaptiveAltitude, centroid };
      } else {
        console.warn('[Test] Country ' + countryIso + ' not found in worldPolygons');
        return null;
      }
    };

    // Función de testing para probar zoom adaptativo con subdivisiones
    (window as any).testAdaptiveZoomSubdivision = (countryIso: string, subdivisionName: string) => {
            
      // Buscar en polígonos locales primero (si están cargados)
      let subdivisionFeature = localPolygons?.find(p => 
        p.properties?.ISO_A3 === countryIso && 
        (p.properties?.NAME_1 === subdivisionName || 
         p.properties?.name_1 === subdivisionName ||
         p.properties?.NAME_2 === subdivisionName || 
         p.properties?.name_2 === subdivisionName ||
         p.properties?._subdivisionName === subdivisionName)
      );
      
      // Si no está en locales, buscar en worldPolygons
      if (!subdivisionFeature) {
        subdivisionFeature = worldPolygons?.find(p => 
          p.properties?.ISO_A3 === countryIso && 
          (p.properties?.NAME_1 === subdivisionName || p.properties?.name_1 === subdivisionName)
        );
      }
      
      if (subdivisionFeature) {
        const area = calculatePolygonArea(subdivisionFeature);
        const adaptiveAltitude = calculateAdaptiveZoomSubdivision(subdivisionFeature);
        const centroid = centroidOf(subdivisionFeature);
        
                                        
        // Aplicar el zoom
        globe?.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: adaptiveAltitude }, 1000);
        
        return { area, adaptiveAltitude, centroid };
      } else {
        console.warn('[Test] Subdivision ' + subdivisionName + ' in ' + countryIso + ' not found');
                return null;
      }
    };

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
          // Inicializar con datos vacíos primero para cargar polígonos
          await initFrom(g, { ANSWERS: {}, colors: {} });
          
          // Esperar un momento para que los polígonos se rendericen
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // AHORA cargar trending si NO hay encuesta activa
          if (!activePoll) {
            console.log('[Init] 🌍 Cargando trending inicial...');
            await loadTrendingData();
            
            // Forzar actualización de colores después de cargar trending
            await new Promise(resolve => requestAnimationFrame(resolve));
            await updateGlobeColors();
          }
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
    
    // Listen for search selection events from BottomSheet
    searchSelectHandler = async (event: Event) => {
            const customEvent = event as CustomEvent;
      const option = customEvent.detail;
            if (option && option.id && option.name) {
                await selectDropdownOption(option);
      } else {
        console.warn('[GlobeGL] Invalid option received:', option);
      }
    };
        window.addEventListener('searchSelect', searchSelectHandler);
    
    // Inicializar colores según tema actual
    updateColorsForTheme();
    
    // Observar cambios en el tema
    const themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateColorsForTheme();
        }
      });
    });
    
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    // Escuchar cambios de paleta random
    paletteChangeHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const palette = customEvent.detail;
      
      // Aplicar nueva paleta (solo en dark mode)
      if (isDarkTheme) {
        bgColor = palette.bg;
        sphereColor = palette.sphere;
        strokeColor = palette.stroke;
        polygonNoDataColor = palette.noData;
        
        // Forzar actualización
        if (globe) {
          setTimeout(() => {
            globe.refreshPolyColors?.();
            globe.refreshPolyStrokes?.();
          }, 50);
        }
      }
    };
    
    window.addEventListener('palettechange', paletteChangeHandler);
  });

  function resize() { /* GlobeCanvas maneja su propio tamaño vía CSS */ }

  // Store handler reference for cleanup
  let searchSelectHandler: ((event: Event) => Promise<void>) | null = null;
  let paletteChangeHandler: ((event: Event) => void) | null = null;

  onDestroy(() => {
    try {
      window.removeEventListener('resize', resize);
      window.removeEventListener('resize', onWindowResizeForSheet);
      try { globe && globe.htmlElementsData && globe.htmlElementsData([]); } catch {}
    } catch {}
    try { sheetCtrl?.destroy(); } catch {}
    // Remove search select listener
    if (searchSelectHandler) {
      window.removeEventListener('searchSelect', searchSelectHandler);
    }
    // Remove palette change listener
    if (paletteChangeHandler) {
      window.removeEventListener('palettechange', paletteChangeHandler);
    }
  });

</script>

<GlobeCanvas
  bind:this={globe}
  {bgColor}
  sphereBaseColor={sphereBaseColor}
  strokeBaseColor={strokeBaseColor}
  strokeOpacityPct={strokeOpacityPct}
  {atmosphereColor}
  {atmosphereAltitude}
  {selectedCityId}
  {isDarkTheme}
  onPolyCapColor={(feat) => {
    const props = feat?.properties || {};
    const currentLevel = navigationManager?.getCurrentLevel() || 'world';
    
    // Extraer ID correcto según el nivel
    let featureId = '';
    if (currentLevel === 'world') {
      // Nivel 1: ISO_A3
      featureId = isoOf(feat);
    } else if (currentLevel === 'country') {
      // Nivel 2: ID_1
      featureId = String(props.ID_1 || props.id_1 || props.GID_1 || props.gid_1 || '');
    } else if (currentLevel === 'subdivision') {
      // Nivel 3: ID_2
      featureId = String(props.ID_2 || props.id_2 || props.GID_2 || props.gid_2 || '');
    }
    
    // VERIFICACIÓN CRÍTICA: Si activePoll es null, SOLO usar datos si isoDominantKey tiene contenido
    // Esto evita que se muestren colores de encuestas cerradas
    if (!activePoll) {
      // Modo trending: verificar que isoDominantKey tenga datos válidos
      if (!isoDominantKey || Object.keys(isoDominantKey).length === 0) {
        // OPTIMIZACIÓN: Gris muy oscuro para polígonos sin datos
        // Un pelín más claro que el fondo negro
        return 'rgba(26,26,26,1)';
      }
    }
    
    // PRIORIDAD 1: Si el polígono tiene color forzado (subdivisiones), usarlo SOLO en niveles 2 y 3 Y SOLO SI HAY ENCUESTA ACTIVA
    // En modo trending, NO usar _forcedColor para evitar colores de encuestas cerradas
    if (props._forcedColor && currentLevel !== 'world' && activePoll) {
      return props._forcedColor;
    }
    
    // PRIORIDAD 2: Si es un polígono padre (_isParent) en nivel país, usar color del país
    if (props._isParent && currentLevel === 'country') {
      const topSeg = (countryChartSegments && countryChartSegments.length > 0) ? countryChartSegments[0] : null;
      if (topSeg?.color) {
        return topSeg.color;
      }
      const k = isoDominantKey[featureId] ?? '';
      const mapColor = colorMap?.[k];
      // OPTIMIZACIÓN: Gris muy oscuro para polígonos sin datos
      return mapColor ?? 'rgba(26,26,26,1)';
    }
    
    // PRIORIDAD 3: Usar isoDominantKey con el featureId correcto
    const key = isoDominantKey[featureId] ?? '';
    const color = colorMap?.[key];
    
    // OPTIMIZACIÓN: Si no hay color, gris muy oscuro para polígonos inactivos
    // Un pelín más claro que el fondo para sutilmente distinguirlos
    if (!color) {
      return 'rgba(26,26,26,1)';
    }
    
    return color;
  }}
  on:movementStart={onMapMovementStart}
  on:movementEnd={onMapMovementEnd}
  on:ready={() => {
    try {
                  
      // DISABLED: Auto-loading world polygons on ready - now controlled by NavigationManager
      // Only initialize NavigationManager to world view
      // NO navegar a mundo si ya hay encuesta abierta
      if (navigationManager && !activePoll) {
                navigationManager.navigateToWorld();
      } else if (activePoll) {
              }
      
      setTilesEnabled(false);
      updateGlobeColors();
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
      // Emitir evento de cambio de altitud
      dispatch('altitudechange', { altitude: currentAltitude });
      
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
      
      // ACTUALIZAR ELEVACIONES DE POLÍGONOS continuamente según altitud de cámara
      // Esto hace que los polígonos se aplanen cuando haces zoom extremo
      globe?.refreshPolyAltitudes?.();
      
      // Siempre actualizar etiquetas con el nuevo sistema LOD (incluso durante movimiento)
      updateLabelsForCurrentView(pov).catch(e => console.warn('Label update error:', e));
    } catch {}
  }}
  on:polygonClick={async (e) => {
    // BLOQUEAR clics durante animaciones de zoom
    if (isZooming) {
      console.log('[Click] Clic bloqueado durante animación de zoom');
      return;
    }
    
    if (!navigationManager) return;
    try {
      const feat = e.detail?.feat;
      if (!feat) return;
      
                  
      // Show bottom sheet with polygon data when clicking on polygons
      setSheetState('collapsed');
      
      const currentLevel = navigationManager.getCurrentLevel();
      const iso = isoOf(feat);
      const name = nameOf(feat);
      
            
      if (currentLevel === 'world' && iso) {
        // Click on country from world view
        
        // PASO 1: Verificar si hay datos ANTES de permitir la navegación
        // IMPORTANTE: answersData ya está filtrado por la encuesta activa (si existe)
        const countryRecord = answersData?.[iso];
        if (!countryRecord) {
          console.log('[Click País] 🚫 No hay datos para el país:', iso, '- Click bloqueado');
          return; // BLOQUEAR navegación si no hay datos
        }
        
        // PASO 2: Calcular zoom INMEDIATAMENTE para respuesta instantánea
        const centroid = centroidOf(feat);
        const adaptiveAltitude = calculateAdaptiveZoom(feat);
        scheduleZoom(centroid.lat, centroid.lng, adaptiveAltitude, 500, 0);
        
        // PASO 3: Actualizar datos del país
        const countryData = [countryRecord];
        countryChartSegments = generateCountryChartSegments(countryData);
        console.log('[Click País] 📊 countryChartSegments generados:', countryChartSegments.length, countryChartSegments);
        
        // PASO 4: Navegar DESPUÉS de la animación (500ms + margen)
        setTimeout(async () => {
          await tick();
          await navigationManager.navigateToCountry(iso, name);
          
          // Forzar refresh de colores DESPUÉS de la navegación
          await new Promise(resolve => requestAnimationFrame(resolve));
          await updateGlobeColors();
        }, 600);
        
      } else if (currentLevel === 'country' && feat.properties?.ID_1) {
        // Click on subdivision from country view
        const subdivisionId = feat.properties.ID_1;
        const subdivisionName = feat.properties.NAME_1 || feat.properties.name_1 || name;
        
        // PASO 1: Verificar si hay datos ANTES de permitir la navegación
        const subdivisionKey = subdivisionId; // subdivisionId ya es "ESP.1"
        const subdivisionRecord = answersData?.[subdivisionKey];
        console.log('[Click Subdivisión] 🔍 Buscando datos:', { subdivisionKey, hasData: !!subdivisionRecord, answersDataKeys: Object.keys(answersData).slice(0, 5) });
        
        if (!subdivisionRecord) {
          console.log('[Click Subdivisión] 🚫 No hay datos para:', subdivisionKey, '- Click bloqueado');
          return; // BLOQUEAR navegación si no hay datos
        }
        
        // PASO 2: Calcular zoom INMEDIATAMENTE para respuesta instantánea
        const centroid = centroidOf(feat);
        const adaptiveAltitude = calculateAdaptiveZoomSubdivision(feat);
        const targetAlt = Math.min(adaptiveAltitude, 0.06);
        scheduleZoom(centroid.lat, centroid.lng, targetAlt, 500, 0);
        
        // PASO 3: Actualizar datos
        subdivisionChartSegments = generateCountryChartSegments([subdivisionRecord]);
        console.log('[Click Subdivisión] 📊 subdivisionChartSegments generados:', subdivisionChartSegments.length, subdivisionChartSegments);
        selectedCountryIso = iso;
        
        // PASO 4: Navigate DESPUÉS de la animación (500ms + margen)
        setTimeout(async () => {
          await navigationManager.navigateToSubdivision(iso, subdivisionId, subdivisionName);
          
          // Refresh colores después de la navegación
          await new Promise(resolve => requestAnimationFrame(resolve));
          await updateGlobeColors();
        }, 600);
        
      } else if (currentLevel === 'subdivision' && feat.properties?.ID_2) {
        // NIVEL 4: Activar selección (viene de etiqueta o sistema de proximidad)
        const cityName = feat.properties.NAME_2 || feat.properties.name_2 || name;
        const subdivisionName = feat.properties.NAME_1 || feat.properties.name_1;
        
                
        // Activar nivel 4
        selectedCityName = cityName;
        selectedSubdivisionName = subdivisionName;
        selectedCityId = feat.properties.ID_2;
        
        // Refresh visual
        setTimeout(() => {
          globe?.refreshPolyStrokes?.();
          globe?.refreshPolyAltitudes?.();
        }, 100);
        
        // Generate city data
        generateCityChartSegments(cityName);
        
              }
    } catch (e) {
      console.error('[Click] Error handling polygon click:', e);
    }
  }}
  on:globeClick={async (e) => {
    // BLOQUEAR clics durante animaciones de zoom
    if (isZooming) {
      console.log('[Click] Clic en globo bloqueado durante animación de zoom');
      return;
    }
    
    if (!navigationManager) return;
    
    try {
      const currentLevel = navigationManager.getCurrentLevel();
      
      // Check if we're in city level (4th level)
      if (selectedCityName) {
                
        // Limpiar nivel ciudad
        selectedCityName = null;
        selectedCityId = null;
        
        // Ir directamente al nivel país (nivel 2)
        if (selectedCountryIso) {
          await navigateToView('country');
          
          // Refresh altitudes to reset polygon heights
          setTimeout(() => {
            globe?.refreshPolyAltitudes?.();
          }, 100);
        }
        return;
      }
      if (currentLevel !== 'world') {
        
        // PASO 1: OCULTAR ETIQUETAS INMEDIATAMENTE antes de cualquier animación
        subdivisionLabels = [];
        updateSubdivisionLabels(false);
        
        // PASO 2: Iniciar zoom para bloquear nuevas etiquetas
        const currentPov = globe?.pointOfView();
        const newLevel = currentLevel === 'subdivision' ? 'country' : 'world';
        
        if (newLevel === 'world') {
          // Vista mundial: iniciar zoom PRIMERO
          const worldViewAltitude = MAX_ZOOM_ALTITUDE;
          scheduleZoom(
            currentPov?.lat || 20, 
            currentPov?.lng || 0, 
            worldViewAltitude,
            1000
          );
        }
        
        // PASO 3: Navigate back to previous level
        await navigationManager.navigateBack();
        
        if (newLevel === 'world') {
          selectedCountryName = null;
          selectedCountryIso = null;
          selectedSubdivisionName = null;
          selectedCityId = null;
          
          // Los datos YA están cargados (answersData, colorMap, isoDominantKey)
          // Solo necesitamos refrescar los colores INMEDIATAMENTE
          
          // Refresh INMEDIATO
          (async () => {
            await new Promise(resolve => requestAnimationFrame(resolve));
            await updateGlobeColors();
          })();
          
        } else if (newLevel === 'country') {
          // Volver a vista de país desde subdivisión
          selectedSubdivisionName = null;
          selectedCityId = null;
          
          // Iniciar zoom ANTES de recargar datos (ya se limpió etiquetas arriba)
          const currentPov = globe?.pointOfView();
          scheduleZoom(currentPov?.lat || 0, currentPov?.lng || 0, 0.8, 700);
          
          // Recargar colores de subdivisiones DESPUÉS
          if (selectedCountryIso && activePoll?.id) {
            const countryIso = selectedCountryIso;
                        setTimeout(async () => {
              const subdivisionColorById = await computeSubdivisionColorsFromDatabase(countryIso, localPolygons || []);
              
              for (const poly of (localPolygons || [])) {
                const id1 = poly.properties?.ID_1;
                if (id1 && subdivisionColorById[String(id1)]) {
                  poly.properties._forcedColor = subdivisionColorById[String(id1)];
                }
              }
              
              await updateGlobeColors();
            }, 200);
          }
        } else if (newLevel === 'subdivision') {
          // Clear only city level (already handled above)
          selectedCityName = null;
          selectedCityId = null;
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

<!-- Navigation breadcrumb - DISABLED, using BottomSheet nav-chips instead -->
{#if false && navigationManager}
<div class="navigation-breadcrumb">
  {#each navigationManager.getHistory() as item, index}
    {#if index > 0}
      <span class="breadcrumb-separator">→</span>
    {/if}
    
    {#if item.level === 'world'}
      {@const isLastItem = index === navigationManager.getHistory().length - 1}
      {#if isLastItem && navigationManager.getCurrentLevel() === 'world'}
        <!-- World level with dropdown to select countries -->
        <div class="breadcrumb-dropdown-wrapper">
          <button on:click={toggleDropdown} 
                  class="breadcrumb-item active dropdown-trigger">
            🌍 {item.name}
            <span style="margin-left: 6px; display: inline-block; transition: transform 0.2s; {showDropdown ? 'transform: rotate(180deg);' : ''}">
              ▼
            </span>
          </button>
          
          {#if showDropdown}
            <div class="breadcrumb-dropdown">
              {#if dropdownOptions.length === 0}
                <div class="dropdown-loading">Cargando...</div>
              {:else}
                <div class="dropdown-search">
                  <input 
                    type="text" 
                    placeholder="Buscar país..." 
                    bind:value={dropdownSearchQuery}
                    on:click={(e) => e.stopPropagation()}
                  />
                </div>
                <div class="dropdown-options">
                  {#if filteredDropdownOptions.length === 0}
                    <div class="dropdown-no-results">No se encontraron resultados</div>
                  {:else}
                    {#each filteredDropdownOptions as option}
                      <button class="dropdown-option" on:click={() => selectDropdownOption(option)}>
                        {option.name}
                      </button>
                    {/each}
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {:else}
        <!-- Not last item or not in world level -->
        <button on:click={() => {
          if (isZooming) return; // Bloquear durante zoom
          
          // Limpiar etiquetas PRIMERO
          subdivisionLabels = [];
          updateSubdivisionLabels(false);
          
          navigationManager.navigateToWorld();
          selectedCountryIso = null;
          selectedCountryName = null;
          selectedSubdivisionName = null;
          showDropdown = false;
        }} class="breadcrumb-item">
          🌍 {item.name}
        </button>
      {/if}
    {:else if item.level === 'country'}
      {@const isLastItem = index === navigationManager.getHistory().length - 1}
      {#if isLastItem}
        <!-- Last item: show as dropdown button -->
        <div class="breadcrumb-dropdown-wrapper">
          <button on:click={toggleDropdown} 
                  class="breadcrumb-item active dropdown-trigger">
            🏴 {item.name}
            <span style="margin-left: 6px; display: inline-block; transition: transform 0.2s; {showDropdown ? 'transform: rotate(180deg);' : ''}">
              ▼
            </span>
          </button>
          
          {#if showDropdown}
            <div class="breadcrumb-dropdown">
              {#if dropdownOptions.length === 0}
                <div class="dropdown-loading">Cargando...</div>
              {:else}
                <div class="dropdown-search">
                  <input 
                    type="text" 
                    placeholder="Buscar..." 
                    bind:value={dropdownSearchQuery}
                    on:click={(e) => e.stopPropagation()}
                  />
                </div>
                <div class="dropdown-options">
                  {#if filteredDropdownOptions.length === 0}
                    <div class="dropdown-no-results">No se encontraron resultados</div>
                  {:else}
                    {#each filteredDropdownOptions as option}
                      <button class="dropdown-option" on:click={() => selectDropdownOption(option)}>
                        {option.name}
                      </button>
                    {/each}
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {:else}
        <!-- Not last item: regular clickable button -->
        <button on:click={() => {
          if (isZooming) return; // Bloquear durante zoom
          
          // Limpiar etiquetas PRIMERO (volviendo de subdivisión a país)
          subdivisionLabels = [];
          updateSubdivisionLabels(false);
          
          navigationManager.navigateToCountry(item.iso || '', item.name);
          showDropdown = false;
        }} 
                class="breadcrumb-item">
          🏴 {item.name}
        </button>
      {/if}
    {:else if item.level === 'subdivision'}
      {@const isLastItem = index === navigationManager.getHistory().length - 1}
      {#if isLastItem}
        <!-- Last item: show as dropdown button -->
        <div class="breadcrumb-dropdown-wrapper">
          <button on:click={toggleDropdown} 
                  class="breadcrumb-item active dropdown-trigger">
            📍 {item.name}
            <span style="margin-left: 6px; display: inline-block; transition: transform 0.2s; {showDropdown ? 'transform: rotate(180deg);' : ''}">
              ▼
            </span>
          </button>
          
          {#if showDropdown}
            <div class="breadcrumb-dropdown">
              {#if dropdownOptions.length === 0}
                <div class="dropdown-loading">Cargando...</div>
              {:else}
                <div class="dropdown-search">
                  <input 
                    type="text" 
                    placeholder="Buscar..." 
                    bind:value={dropdownSearchQuery}
                    on:click={(e) => e.stopPropagation()}
                  />
                </div>
                <div class="dropdown-options">
                  {#if filteredDropdownOptions.length === 0}
                    <div class="dropdown-no-results">No se encontraron resultados</div>
                  {:else}
                    {#each filteredDropdownOptions as option}
                      <button class="dropdown-option" on:click={() => selectDropdownOption(option)}>
                        {option.name}
                      </button>
                    {/each}
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {:else}
        <!-- Not last item: regular span -->
        <span class="breadcrumb-item">📍 {item.name}</span>
      {/if}
    {/if}
  {/each}
  
  <div class="breadcrumb-help">
    <small>Click to navigate • Last item shows dropdown with available options</small>
  </div>
</div>
{/if}
<svelte:window
  on:keydown={async (e) => {
    if (e.key === "Escape") {
      // Close dropdown if open
      if (showDropdown) {
        showDropdown = false;
        dropdownOptions = [];
        dropdownSearchQuery = '';
        return;
      }
      
      if (navigationManager && navigationManager.getCurrentLevel() !== 'world') {
        await navigationManager.navigateBack();
        
        // Adjust zoom based on new level
        const newLevel = navigationManager.getCurrentLevel();
        if (newLevel === 'world') {
          // Vista mundial: mantener posición actual, solo cambiar zoom
          const currentPov = globe?.pointOfView();
          const worldViewAltitude = MAX_ZOOM_ALTITUDE; // Vista más alejada sin rotar
          globe?.pointOfView({ 
            lat: currentPov?.lat || 20, 
            lng: currentPov?.lng || 0, 
            altitude: worldViewAltitude 
          }, 1000);
          selectedCountryName = null;
          selectedCountryIso = null;
          selectedSubdivisionName = null;
        } else if (newLevel === 'country') {
          globe?.pointOfView({ lat: globe?.pointOfView()?.lat || 0, lng: globe?.pointOfView()?.lng || 0, altitude: 0.3 }, 700);
        }
      } else {
        showSettings = false;
      }
    }
  }}
  on:click={handleClickOutside}
  on:scroll={handleScroll}
  on:wheel={handleWheel}
  on:touchstart={onTouchStart}
  on:touchmove={onTouchMove}
/>

<!-- Tabs compactos (Para ti → menú) junto a la lupa -->
<div class="tabs-float" class:blocked-during-animation={isZooming}>
  <TopTabs
    options={["Para ti", "Tendencias", "Live"]}
  />
</div>

<!-- SearchBar movido al BottomSheet -->

<div class:blocked-during-animation={isZooming}>
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
</div>

<!-- Panel de ajustes (se abre desde la barra de la leyenda) -->
{#if showSettings}
  <div class="settings-overlay" role="presentation" on:click={() => (showSettings = false)}></div>
  <div class="settings-panel {isZooming ? 'blocked-during-animation' : ''}" role="dialog" aria-label="Ajustes de colores" bind:this={panelEl} style={`top:${panelTop}px; left:10px;`}>
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

<BottomSheet
  state={SHEET_STATE}
  y={sheetY}
  isTransitioning={sheetIsTransitioning}
  isCameraAnimating={isZooming}
  {selectedCountryName}
  {selectedSubdivisionName}
  {selectedCityName}
  {countryChartSegments}
  {subdivisionChartSegments}
  {worldChartSegments}
  {cityChartSegments}
  {voteOptions}
  {legendItems}
  {activePoll}
  {friendsByOption}
  {visitsByOption}
  {creatorsByOption}
  {publishedAtByOption}
  {navigationManager}
  {currentAltitude}
  additionalPolls={[]}
  onToggleDropdown={toggleDropdown}
  bind:showSearch
  bind:tagQuery
  onToggleSearch={() => showSearch = !showSearch}
  onPointerDown={onSheetPointerDown}
  onScroll={onSheetScroll}
  onNavigateToView={navigateToView}
  onVote={handleVote}
  onLoadMorePolls={loadMorePolls}
  onLocateMe={locateMe}
  onToggleSettings={() => { showSettings = !showSettings; }}
  on:requestExpand={() => {
    SHEET_STATE = 'expanded';
    try { sheetCtrl?.setState('expanded'); } catch {}
  }}
  on:close={() => {
    SHEET_STATE = 'hidden';
  }}
  on:vote={(e) => {
      }}
  on:openPollInGlobe={handleOpenPollInGlobe}
/>

<!-- Dropdown flotante renderizado fuera del BottomSheet -->
{#if showDropdown}
  <div 
    class="global-dropdown-overlay"
    role="button"
    tabindex="0"
    on:click={() => {
      showDropdown = false;
      dropdownOptions = [];
      dropdownSearchQuery = '';
    }}
    on:keydown={(e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        showDropdown = false;
        dropdownOptions = [];
        dropdownSearchQuery = '';
      }
    }}
    on:touchstart|capture={(e) => {
      // Allow touch events on the dropdown itself
      const target = e.target as HTMLElement;
      if (target.closest('.global-dropdown')) {
        e.stopPropagation();
      }
    }}
  >
    <div 
      class="global-dropdown"
      role="menu"
      tabindex="-1"
      on:click={(e) => e.stopPropagation()}
      on:keydown={(e) => e.stopPropagation()}
      on:touchmove|stopPropagation
      on:touchstart|stopPropagation
    >
      {#if dropdownOptions.length === 0}
        <div class="dropdown-loading">Cargando opciones...</div>
      {:else}
        <div class="dropdown-search">
          <input 
            type="text" 
            placeholder="Buscar..." 
            bind:value={dropdownSearchQuery}
            on:click={(e) => e.stopPropagation()}
          />
        </div>
        <div 
          class="dropdown-options"
          on:touchmove|stopPropagation
        >
          {#if filteredDropdownOptions.length === 0}
            <div class="dropdown-no-results">No se encontraron resultados</div>
          {:else}
            {#each filteredDropdownOptions as option}
              <button class="dropdown-option" on:click={() => selectDropdownOption(option)}>
                {option.name}
              </button>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Overlay semi-transparente para bloquear clics -->
{#if isZooming}
  <div class="zoom-overlay" transition:fade={{ duration: 150 }}></div>
{/if}

<style>
  /* Bloquear elementos durante animaciones de cámara */
  .blocked-during-animation {
    pointer-events: none !important;
    user-select: none !important;
    opacity: 0.6;
    transition: opacity 0.2s ease;
  }

  /* Overlay semi-transparente para bloquear clics */
  .zoom-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(1px);
    z-index: 9998;
    pointer-events: all;
    cursor: wait;
  }
</style>
