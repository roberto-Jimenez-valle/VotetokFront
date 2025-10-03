<script lang="ts">
  import { onMount, onDestroy, tick, createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
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
    
    console.log(`[Adaptive Zoom] Country area: ${area.toFixed(2)}°² → altitude: ${targetAltitude.toFixed(3)}`);
    
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
    
    console.log(`[Adaptive Zoom Subdivision] Area: ${area.toFixed(3)}°² → altitude: ${targetAltitude.toFixed(3)}`);
    
    // Asegurar que esté dentro de los límites permitidos
    return Math.max(MIN_ZOOM_ALTITUDE, Math.min(targetAltitude, MAX_ZOOM_ALTITUDE));
  }

  // Función para simular clic en una ciudad específica (para testing)
  function selectCity(cityName: string) {
    console.log(`[City] Selecting city: ${cityName}`);
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

  // Cargar datos de ciudades desde JSON
  async function loadCitiesData() {
    try {
      const response = await fetch('/data/cities.json');
      if (response.ok) {
        citiesData = await response.json();
        console.log('[Cities] Cities data loaded:', Object.keys(citiesData).length, 'cities');
      } else {
        console.warn('[Cities] Could not load cities.json, using fallback data');
        // Fallback data si no existe el archivo
        citiesData = {
          'Jaén': { 'Economía': 45, 'Educación': 32, 'Salud': 28, 'Medio Ambiente': 18, 'Transporte': 12 },
          'Sevilla': { 'Cultura': 52, 'Turismo': 38, 'Economía': 35, 'Educación': 25, 'Transporte': 15 },
          'Granada': { 'Educación': 48, 'Cultura': 35, 'Turismo': 30, 'Salud': 22, 'Economía': 18 },
          'Madrid': { 'Economía': 58, 'Transporte': 42, 'Cultura': 38, 'Educación': 35, 'Tecnología': 28 },
          'Barcelona': { 'Tecnología': 55, 'Cultura': 48, 'Turismo': 45, 'Economía': 40, 'Educación': 32 }
        };
      }
    } catch (error) {
      console.error('[Cities] Error loading cities data:', error);
      citiesData = {};
    }
  }

  // Generar datos específicos para una ciudad desde el JSON cargado
  function generateCityChartSegments(cityName: string) {
    const cityData = citiesData[cityName];
    if (cityData) {
      cityChartSegments = generateCountryChartSegments([cityData]);
      console.log(`[City] Generated chart for ${cityName} from JSON:`, cityChartSegments);
    } else {
      cityChartSegments = [];
      console.log(`[City] No data available for ${cityName} in cities.json`);
    }
  }

  // Obtener ciudades disponibles según la subdivisión actual
  function getAvailableCities(): string[] {
    if (!selectedSubdivisionName) return [];
    
    const subdivisionCities: Record<string, string[]> = {
      'Andalucía': ['Jaén', 'Sevilla', 'Granada'],
      'Andalusia': ['Jaén', 'Sevilla', 'Granada'],
      'Madrid': ['Madrid'],
      'Cataluña': ['Barcelona'],
      'Catalunya': ['Barcelona'],
      'Catalonia': ['Barcelona']
    };

    for (const [subdivision, cities] of Object.entries(subdivisionCities)) {
      if (selectedSubdivisionName.includes(subdivision)) {
        return cities;
      }
    }
    
    return [];
  }

  // Función para navegar directamente a una vista específica
  async function navigateToView(targetLevel: 'world' | 'country' | 'subdivision' | 'city') {
    if (!navigationManager) return;
    
    const currentLevel = navigationManager.getCurrentLevel();
    console.log(`[Navigation] Navigating from ${currentLevel} to ${targetLevel}`);
    
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
      globe?.pointOfView({ lat: 0, lng: 0, altitude: 2.0 }, 1000);
      
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
        globe?.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: adaptiveAltitude }, 800);
      }
      
      // Refresh altitudes to reset polygon heights
      setTimeout(() => {
        globe?.refreshPolyAltitudes?.();
      }, 100);
      
    } else if (targetLevel === 'subdivision' && selectedCountryIso && selectedSubdivisionName) {
      // Limpiar solo el nivel ciudad
      selectedCityName = null;
      selectedCityId = null;
      
      // Navegar a la subdivisión y hacer zoom apropiado
      if (selectedSubdivisionId) {
        await navigationManager.navigateToSubdivision(selectedCountryIso, selectedSubdivisionId, selectedSubdivisionName);
        
        // Buscar la subdivisión específica para hacer zoom
        const subdivisionFeature = worldPolygons?.find(p => 
          p.properties?.ISO_A3 === selectedCountryIso && 
          (p.properties?.ID_1 === selectedSubdivisionId || p.properties?._subdivisionId === selectedSubdivisionId)
        );
        if (subdivisionFeature) {
          const centroid = centroidOf(subdivisionFeature);
          const adaptiveAltitude = calculateAdaptiveZoomSubdivision(subdivisionFeature);
          globe?.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: adaptiveAltitude }, 600);
        }
      }
      
      // Refresh altitudes to reset polygon heights
      setTimeout(() => {
        globe?.refreshPolyAltitudes?.();
      }, 100);
      
    } else if (targetLevel === 'city') {
      // Para nivel ciudad, no mover el mapa, solo mostrar datos específicos
      console.log(`[Navigation] Showing city data for ${selectedCityName}`);
      // No hacer navegación del mapa, solo actualizar los datos del gráfico
    }
    
    console.log(`[Navigation] Updated state: Country=${selectedCountryName}, Subdivision=${selectedSubdivisionName}, City=${selectedCityName}`);
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
  function generateSubdivisionLabels(polygons: any[], currentAltitude?: number): SubdivisionLabel[] {
    const labels: SubdivisionLabel[] = [];
    console.log('[Labels] Processing', polygons.length, 'polygons for labels at altitude:', currentAltitude);
    
    // Calcular áreas de polígonos para priorización
    const polygonsWithArea = polygons.map(poly => ({
      poly,
      area: calculatePolygonArea(poly)
    }));
    
    // Ordenar por área (más grandes primero)
    polygonsWithArea.sort((a, b) => b.area - a.area);
    
    // Determinar cuántas etiquetas mostrar según la altitud
    // LÓGICA CORREGIDA: Cuanto MÁS CERCA (menor altitud), MÁS etiquetas
    let maxLabels = polygons.length;
    let minAreaThreshold = 0; // Área mínima para mostrar etiqueta
    
    if (currentAltitude !== undefined) {
      if (currentAltitude > 0.5) {
        // Zoom muy alejado: solo las 10 más grandes
        maxLabels = Math.min(10, polygons.length);
        minAreaThreshold = 0.1; // Filtrar polígonos pequeños
      } else if (currentAltitude > 0.3) {
        // Zoom medio: 50% de las etiquetas
        maxLabels = Math.ceil(polygons.length * 0.5);
        minAreaThreshold = 0.05;
      } else if (currentAltitude > 0.15) {
        // Zoom cercano: 75% de las etiquetas
        maxLabels = Math.ceil(polygons.length * 0.75);
        minAreaThreshold = 0.02;
      } else {
        // Zoom MUY CERCANO (< 0.15): MOSTRAR TODAS LAS ETIQUETAS
        maxLabels = polygons.length; // Todas las etiquetas
        minAreaThreshold = 0; // Sin filtro de área mínima
        console.log('[Labels] ✓ Very close zoom - showing ALL labels');
      }
    }
    
    console.log('[Labels] Showing', maxLabels, 'of', polygons.length, 'labels based on altitude', currentAltitude?.toFixed(3), ', minArea:', minAreaThreshold);
    
    // Sistema de detección de colisiones para evitar solapamiento
    const usedPositions: Array<{lat: number, lng: number}> = [];
    let minDistance = 0.2; // Distancia mínima en grados
    if (currentAltitude !== undefined) {
      if (currentAltitude < 0.08) {
        minDistance = 0.1; // Zoom extremo: etiquetas más juntas para mostrar más
      } else if (currentAltitude < 0.15) {
        minDistance = 0.15; // Zoom muy cercano: etiquetas cercanas
      } else if (currentAltitude < 0.3) {
        minDistance = 0.3; // Zoom cercano: distancia moderada
      }
    }
    
    for (let i = 0; i < Math.min(maxLabels, polygonsWithArea.length); i++) {
      const { poly, area } = polygonsWithArea[i];
      
      // Filtrar polígonos muy pequeños en zoom cercano
      if (area < minAreaThreshold) {
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
      
      if (name) {
        try {
          const centroid = centroidOf(poly);
          
          // Verificar colisión con etiquetas existentes (en zoom cercano)
          if (currentAltitude !== undefined && currentAltitude < 0.15 && minDistance > 0.2) {
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
          const MIN_FONT_SIZE = 10; // Tamaño mínimo absoluto - no bajar más de esto
          
          if (currentAltitude !== undefined) {
            if (currentAltitude > 0.4) {
              fontSize = Math.max(MIN_FONT_SIZE, Math.min(14, 8 + Math.sqrt(area) * 0.5));
            } else if (currentAltitude > 0.2) {
              fontSize = Math.max(MIN_FONT_SIZE, Math.min(12, 8 + Math.sqrt(area) * 0.3));
            } else if (currentAltitude < 0.06) {
              // En zoom EXTREMO, mantener tamaño mínimo legible
              fontSize = MIN_FONT_SIZE; // Tamaño fijo mínimo
            } else if (currentAltitude < 0.1) {
              // En zoom muy cercano, tamaño mínimo
              fontSize = Math.max(MIN_FONT_SIZE, Math.min(11, 8 + Math.sqrt(area) * 0.15));
            } else {
              fontSize = Math.max(MIN_FONT_SIZE, Math.min(11, 7 + Math.sqrt(area) * 0.2));
            }
          }
          
          const label: SubdivisionLabel = {
            id: `label_${labelType}_${poly.properties.ID_1 || poly.properties.id_1 || poly.properties.ISO_A3 || Math.random()}`,
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
    
    console.log('[Labels] Generated', labels.length, 'labels with anti-overlap filtering');
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
        // Cargar subdivisiones del país
        let subdivisionPolygons: any[] = [];
        try {
          subdivisionPolygons = await loadSubregionTopoAsGeoFeatures(iso, iso);
        } catch (e) {
          console.warn('[CountryView] No subdivision file for', iso, e);
        }

        // Marcar padres (país) y marcar hijos (subdivisiones)
        const parentMarked = countryPolygons.map(poly => ({
          ...poly,
          properties: { ...poly.properties, _isParent: true, _parentCountry: iso, _opacity: 0.25, _elevation: 0.002 }
        }));
        const childMarked = subdivisionPolygons.map(poly => ({
          ...poly,
          properties: { ...poly.properties, _isChild: true, _parentCountry: iso, _opacity: 1.0, _elevation: 0.004 }
        }));

        // Asignar colores por subdivisión (primero por votos reales, si no, proporcional al chart)
        subdivisionColorById = computeSubdivisionColorsFromVotes(iso, childMarked);
        if (Object.keys(subdivisionColorById).length === 0 && countryChartSegments?.length) {
          const byId = computeSubdivisionColorsProportional(childMarked, countryChartSegments);
          subdivisionColorById = byId;
        }
        // Propagar _forcedColor a cada polígono hijo
        for (const c of childMarked) {
          const props = c?.properties || {};
          const id1 = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1 || props.NAME_1 || props.name_1 || null;
          const col = id1 ? subdivisionColorById[String(id1)] : null;
          if (col) c.properties._forcedColor = col;
        }

        // Combinar y renderizar
        const combined = [...parentMarked, ...childMarked];
        this.globe?.setPolygonsData(combined);
        this.globe?.refreshPolyColors?.();
        this.globe?.refreshPolyAltitudes?.();
        this.globe?.refreshPolyLabels?.();
        
        // Generate and show subdivision labels (usar polígonos hijos)
        const currentPov = this.globe?.pointOfView();
        const labels = generateSubdivisionLabels(childMarked, currentPov?.altitude);
        console.log('[Navigation] Raw polygons for labels (children):', childMarked.length, 'polygons');
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
        
console.log('[Navigation] Level 3 polygons elevated with _elevation: 0.05 (3x default)');
        
        // Set ONLY the subdivision polygons (no background)
        this.globe?.setPolygonsData(markedPolygons);
        this.globe?.refreshPolyColors?.();
        this.globe?.refreshPolyAltitudes?.();
        this.globe?.refreshPolyLabels?.();
        
        // Generate and show sub-subdivision labels
        const currentPov = this.globe?.pointOfView();
        const labels = generateSubdivisionLabels(markedPolygons, currentPov?.altitude);
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
    console.log('[Dropdown] Toggle called, current state:', showDropdown);
    if (!navigationManager) {
      console.log('[Dropdown] No navigation manager');
      return;
    }
    
    if (showDropdown) {
      console.log('[Dropdown] Closing dropdown');
      showDropdown = false;
      dropdownOptions = [];
      dropdownSearchQuery = '';
    } else {
      console.log('[Dropdown] Opening dropdown, loading options...');
      showDropdown = true;
      dropdownSearchQuery = '';
      const options = await navigationManager.getAvailableOptions();
      dropdownOptions = options;
      console.log('[Dropdown] Loaded', dropdownOptions.length, 'options for current level:', dropdownOptions);
      console.log('[Dropdown] showDropdown is now:', showDropdown);
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
  async function selectDropdownOption(option: { id: string; name: string; iso?: string }) {
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
        
        // Zoom to country with adaptive zoom based on country size
        const centroid = centroidOf(countryFeature);
        const adaptiveAltitude = calculateAdaptiveZoom(countryFeature);
        globe?.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: adaptiveAltitude }, 700);
        
        // Navigate using manager
        await navigationManager.navigateToCountry(option.id, option.name);
        
        // Force refreshes to ensure polygons are visible
        setTimeout(() => {
          globe?.refreshPolyColors?.();
          globe?.refreshPolyAltitudes?.();
        }, 100);
        
        setTimeout(() => {
          globe?.refreshPolyLabels?.();
          globe?.refreshPolyStrokes?.();
        }, 300);
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
          
          // Zoom adaptativo basado en el tamaño de la subdivisión
          const targetAlt = Math.min(adaptiveAltitude, 0.06); // Máximo 0.06 para activar elevaciones bajas
          globe?.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: targetAlt }, 700);
          
          // Navigate using manager
          await navigationManager.navigateToSubdivision(state.countryIso, subdivisionId, option.name);
          
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
              
              // Navigate and zoom
              globe?.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: adaptiveAltitude }, 700);
              
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
  async function updateLabelsForCurrentView(pov: { lat: number; lng: number; altitude: number }) {
    try {
      const currentLevel = navigationManager?.getCurrentLevel() || 'world';
      const alt = pov.altitude;
      
      console.log(`[LOD] Altitude: ${alt.toFixed(3)}, Level: ${currentLevel}`);
      console.log(`[LOD] Thresholds - Country: ${COUNTRY_LABELS_ALT}, Subdivision: ${SUBDIVISION_LABELS_ALT}, Detailed: ${DETAILED_LABELS_ALT}`);
      
      // LÓGICA CORREGIDA: Cuanto MÁS CERCA (menor altitud), MÁS etiquetas
      // Las etiquetas NUNCA desaparecen, incluso en zoom extremo
      // La altitud baja significa zoom alto (muy cerca)
      
      // Nivel mundial: mostrar países cuando te acercas
      if (currentLevel === 'world') {
        if (alt < COUNTRY_LABELS_ALT) {
          console.log('[LOD] ✓ Showing world country labels (altitude < COUNTRY_LABELS_ALT)');
          await generateWorldCountryLabels();
        } else {
          console.log('[LOD] ✗ Too far - hiding labels (altitude >= COUNTRY_LABELS_ALT)');
          updateSubdivisionLabels(false);
        }
      }
      // Nivel país: cuanto más cerca, más detalle
      else if (currentLevel === 'country') {
        const state = navigationManager?.getState();
        if (state?.countryIso) {
          // Si estás MUY cerca, muestra subdivisiones
          if (alt < SUBDIVISION_LABELS_ALT) {
            console.log('[LOD] ✓ Showing subdivision labels (altitude < SUBDIVISION_LABELS_ALT)');
            await generateCountrySubdivisionLabels(state.countryIso, pov);
          } 
          // Si estás lejos, solo muestra el nombre del país
          else {
            console.log('[LOD] ✓ Showing only country name (altitude >= SUBDIVISION_LABELS_ALT)');
            await generateCountryNameLabel();
          }
        }
      }
      // Nivel subdivisión: cuanto más cerca, más detalle
      else if (currentLevel === 'subdivision') {
        const state = navigationManager?.getState();
        if (state?.countryIso && state?.subdivisionId) {
          // Si estás MUY MUY cerca, muestra sub-subdivisiones detalladas
          if (alt < DETAILED_LABELS_ALT) {
            console.log('[LOD] ✓ Showing detailed sub-subdivision labels (altitude < DETAILED_LABELS_ALT)');
            await generateSubSubdivisionLabels(state.countryIso, state.subdivisionId, pov);
          } 
          // Si estás a distancia media, solo muestra el nombre de la subdivisión
          else {
            console.log('[LOD] ✓ Showing only subdivision name (altitude >= DETAILED_LABELS_ALT)');
            await generateSubdivisionNameLabel();
          }
        }
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
          opacity: 0.8,
          feature: feat // Incluir feature para hacer las etiquetas clicables
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
        const currentPov = globe?.pointOfView();
        const labels = generateSubdivisionLabels(countryPolygons, currentPov?.altitude);
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
            
            const currentPov = globe?.pointOfView();
            const labels = generateSubdivisionLabels(markedPolygons, currentPov?.altitude);
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
  let selectedSubdivisionName: string | null = null;
  let selectedSubdivisionId: string | null = null; // ID de la subdivisión seleccionada
  let selectedCityName: string | null = null;
  let selectedCityId: string | null = null; // ID de la ciudad/provincia seleccionada para resaltado (nivel 4)
  let SHEET_STATE: SheetState = 'peek'; // Mostrar información mundial por defecto
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
  
  // Opciones de votación basadas en los datos reales del mapa
  $: voteOptions = legendItems.length > 0 ? legendItems.map(item => ({
    key: item.key,
    label: item.key,
    color: item.color,
    votes: item.count || 0
  })) : [
    // Opciones de prueba para testing del scroll - muchas más opciones
    { key: 'option1', label: 'Opción A - Política', color: '#ff6b6b', votes: 125 },
    { key: 'option2', label: 'Opción B - Economía', color: '#4ecdc4', votes: 89 },
    { key: 'option3', label: 'Opción C - Educación', color: '#45b7d1', votes: 67 },
    { key: 'option4', label: 'Opción D - Salud', color: '#96ceb4', votes: 43 },
    { key: 'option5', label: 'Opción E - Tecnología', color: '#feca57', votes: 21 },
    { key: 'option6', label: 'Opción F - Medio Ambiente', color: '#ff9ff3', votes: 18 },
    { key: 'option7', label: 'Opción G - Deportes', color: '#54a0ff', votes: 15 },
    { key: 'option8', label: 'Opción H - Cultura', color: '#5f27cd', votes: 12 },
    { key: 'option9', label: 'Opción I - Transporte', color: '#00d2d3', votes: 9 },
    { key: 'option10', label: 'Opción J - Vivienda', color: '#ff6348', votes: 6 },
    { key: 'option11', label: 'Opción K - Seguridad', color: '#ff7675', votes: 5 },
    { key: 'option12', label: 'Opción L - Turismo', color: '#74b9ff', votes: 4 },
    { key: 'option13', label: 'Opción M - Agricultura', color: '#00b894', votes: 3 },
    { key: 'option14', label: 'Opción N - Industria', color: '#fdcb6e', votes: 2 },
    { key: 'option15', label: 'Opción O - Comercio', color: '#e17055', votes: 1 },
    { key: 'option16', label: 'Opción P - Justicia', color: '#a29bfe', votes: 8 },
    { key: 'option17', label: 'Opción Q - Defensa', color: '#fd79a8', votes: 7 },
    { key: 'option18', label: 'Opción R - Ciencia', color: '#6c5ce7', votes: 11 },
    { key: 'option19', label: 'Opción S - Arte', color: '#00cec9', votes: 14 },
    { key: 'option20', label: 'Opción T - Religión', color: '#55a3ff', votes: 16 }
  ];
  
  // Función para manejar votos
  function handleVote(optionKey: string) {
    console.log(`[Vote] Usuario votó por: ${optionKey}`);
    
    // Incrementar el contador de votos para la opción seleccionada
    voteOptions = voteOptions.map(option => 
      option.key === optionKey 
        ? { ...option, votes: option.votes + 1 }
        : option
    );
    
    // Aquí podrías enviar el voto al servidor
    // await sendVoteToServer(optionKey, selectedCountryName, selectedSubdivisionName, selectedCityName);
    
    // Mostrar feedback visual (opcional)
    console.log(`[Vote] Voto registrado para ${optionKey}. Nuevos totales:`, voteOptions);
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
  let bgColor = '#000000';
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
  
  // Array de encuestas adicionales para scroll infinito
  let additionalPolls: Poll[] = [];
  let isLoadingMorePolls = false;
  
  // Función para generar encuestas de ejemplo
  function generateMockPolls(region: string, count: number = 5): Poll[] {
    const polls: Poll[] = [];
    const questions = [
      '¿Debería el gobierno priorizar la inversión en infraestructura de transporte público sostenible, incluyendo metro, autobuses eléctricos y carriles bici, o enfocarse en la construcción de nuevas autopistas y carreteras para reducir el tráfico urbano?',
      '¿Cuál crees que es la mejor estrategia para combatir el cambio climático en nuestra región: aumentar los impuestos a las emisiones de carbono, subsidiar masivamente las energías renovables, o implementar restricciones estrictas a las industrias contaminantes?',
      '¿Qué política educativa consideras más efectiva para mejorar la calidad de la enseñanza: aumentar significativamente los salarios de los profesores, reducir el número de alumnos por aula, invertir en tecnología educativa, o reformar completamente el currículo académico?',
      '¿En qué área debería el gobierno invertir más recursos públicos durante los próximos cinco años?',
      '¿Qué medida consideras más urgente para mejorar la calidad de vida en las ciudades?',
      '¿Cuál es tu opinión sobre la implementación de una renta básica universal financiada con impuestos progresivos?',
      '¿Qué tipo de vivienda pública debería priorizar el gobierno para resolver la crisis habitacional?',
      '¿Cómo debería abordarse la transición energética en el sector industrial?',
      '¿Qué política de salud pública consideras más importante implementar?',
      '¿Cuál es la mejor forma de fomentar la innovación tecnológica en pequeñas y medianas empresas?',
      '¿Qué medidas deberían tomarse para proteger el medio ambiente local?',
      '¿Cómo mejorar la seguridad ciudadana sin comprometer las libertades civiles?'
    ];
    
    const hashtags = [
      'CambioClimáticoYa',
      'EducaciónParaTodos',
      'SaludPúblicaUniversal',
      'TransporteSostenible',
      'EnergíaLimpiaAhora',
      'ViviendaDignaYAccesible',
      'TecnologíaParaTodos',
      'CulturaYPatrimonio',
      'MedioAmbienteSano',
      'InnovaciónSocial',
      'DerechosHumanosFundamentales',
      'EconomíaCircular'
    ];
    
    const types: Array<'poll' | 'hashtag' | 'trending'> = ['poll', 'hashtag', 'trending'];
    
    // Garantizar encuestas con 20, 10, 7, 100 y 330 opciones, más variedad adicional
    const requiredOptionCounts = [20, 10, 7, 100, 330];
    const optionCounts = Array.from(new Set([
      ...requiredOptionCounts,
      1, 2, 3, 4, 5, 6, 8, 9, 11, 12, 15, 18, 25, 30, 40, 60, 90, 120, 150, 200
    ]));
    
    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const question = type === 'hashtag' 
        ? hashtags[Math.floor(Math.random() * hashtags.length)]
        : questions[Math.floor(Math.random() * questions.length)];
      
      // Generar opciones basadas en las claves disponibles
      const availableKeys = Object.keys(colorMap);
      
      // Seleccionar número de opciones - asegurar que las primeras encuestas tengan 1 y 2 opciones
      let numOptions;
      if (i === 0 && count > 0) {
        numOptions = 1; // Primera encuesta con 1 opción
      } else if (i === 1 && count > 1) {
        numOptions = 2; // Segunda encuesta con 2 opciones
      } else {
        numOptions = optionCounts[i % optionCounts.length];
      }
      
      // Generar opciones duplicando y variando las claves disponibles
      const options = [];
      for (let j = 0; j < numOptions; j++) {
        const keyIndex = j % availableKeys.length;
        const key = availableKeys[keyIndex];
        const suffix = Math.floor(j / availableKeys.length);
        
        options.push({
          key: suffix > 0 ? `${key}-${suffix}` : key,
          label: suffix > 0 ? `${key} ${suffix + 1}` : key,
          color: colorMap[key] || '#888888',
          votes: Math.random() * 100
        });
      }
      
      const totalVotes = Math.floor(Math.random() * 50000) + 5000;
      const totalViews = Math.floor(totalVotes * (1.5 + Math.random() * 2));
      
      polls.push({
        id: `poll-${Date.now()}-${i}`,
        question,
        type,
        region,
        options,
        totalVotes,
        totalViews,
        creator: {
          id: `user-${i}`,
          name: ['Ana García Rodríguez', 'Carlos López Martínez', 'María Silva González', 'Juan Pérez Fernández', 'Laura Martínez Sánchez'][i % 5],
          verified: Math.random() > 0.3
        }
      });
    }
    
    return polls;
  }
  
  // Función para cargar más encuestas
  function loadMorePolls() {
    if (isLoadingMorePolls) return;
    
    isLoadingMorePolls = true;
    
    // Simular carga asíncrona
    setTimeout(() => {
      const region = selectedSubdivisionName || selectedCountryName || 'Global';
      const newPolls = generateMockPolls(region, 3);
      additionalPolls = [...additionalPolls, ...newPolls];
      isLoadingMorePolls = false;
    }, 500);
  }
  
  // Generar encuestas iniciales cuando cambia la región
  $: {
    const region = selectedSubdivisionName || selectedCountryName || 'Global';
    // Solo regenerar si la región cambió realmente
    if (additionalPolls.length === 0 || (additionalPolls[0] && additionalPolls[0].region !== region)) {
      additionalPolls = generateMockPolls(region, 5);
    }
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
    const fallbackColor = segs[0]?.color || '#9ca3af';
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

 

  // DISABLED: Zoom-based polygon loading removed - now handled by NavigationManager only
  async function ensureLocalCountryPolygons(pov: { lat: number; lng: number; altitude: number } | undefined) {
    // This function is now disabled - polygon loading only happens via clicks
    console.log('[Country] Zoom-based polygon loading disabled - use click navigation instead');
    return;
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
    return generateCountryChartSegments([rec]);
  })();

  // Reactive statement para generar gráfico mundial
  $: worldChartSegments = (() => {
    if (!answersData) {
      console.log('[World Chart Reactive] No answersData available');
      return [];
    }
    
    console.log('[World Chart Reactive] Generating world chart from answersData');
    
    // Agregar todos los datos de todos los países
    const allCountryData = Object.values(answersData);
    console.log('[World Chart Reactive] Processing', allCountryData.length, 'countries');
    
    const worldSegments = generateCountryChartSegments(allCountryData);
    console.log('[World Chart Reactive] Generated world segments:', worldSegments);
    
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
      console.log('[Fullscreen] Change detected, recalculating BottomSheet positions');
      // Esperar un momento para que el navegador actualice las dimensiones
      setTimeout(() => {
        if (sheetCtrl) {
          const currentState = sheetCtrl.state;
          sheetCtrl.onWindowResize(); // Recalcula basado en nueva altura
          console.log(`[Fullscreen] BottomSheet recalculated for state: ${currentState}`);
        }
      }, 100);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    
    console.log('[Mount] BottomSheet initialized with world data');
    
    // Cargar datos de ciudades
    await loadCitiesData();
    
    // Función de testing para probar zoom adaptativo con diferentes países
    (window as any).testAdaptiveZoom = (countryIso: string) => {
      console.log(`[Test] Testing adaptive zoom for country: ${countryIso}`);
      const countryFeature = worldPolygons?.find(p => p.properties?.ISO_A3 === countryIso);
      if (countryFeature) {
        const area = calculatePolygonArea(countryFeature);
        const adaptiveAltitude = calculateAdaptiveZoom(countryFeature);
        const centroid = centroidOf(countryFeature);
        
        console.log(`[Test] Country: ${countryIso}`);
        console.log(`[Test] Area: ${area.toFixed(2)} degrees²`);
        console.log(`[Test] Adaptive altitude: ${adaptiveAltitude}`);
        console.log(`[Test] Centroid: ${centroid.lat.toFixed(4)}, ${centroid.lng.toFixed(4)}`);
        
        // Aplicar el zoom
        globe?.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: adaptiveAltitude }, 1000);
        
        return { area, adaptiveAltitude, centroid };
      } else {
        console.warn(`[Test] Country ${countryIso} not found in worldPolygons`);
        return null;
      }
    };

    // Función de testing para probar zoom adaptativo con subdivisiones
    (window as any).testAdaptiveZoomSubdivision = (countryIso: string, subdivisionName: string) => {
      console.log(`[Test] Testing adaptive zoom for subdivision: ${subdivisionName} in ${countryIso}`);
      
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
        
        console.log(`[Test] Subdivision: ${subdivisionName} (${countryIso})`);
        console.log(`[Test] Area: ${area.toFixed(4)} degrees²`);
        console.log(`[Test] Adaptive altitude: ${adaptiveAltitude}`);
        console.log(`[Test] Centroid: ${centroid.lat.toFixed(4)}, ${centroid.lng.toFixed(4)}`);
        
        // Aplicar el zoom
        globe?.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: adaptiveAltitude }, 1000);
        
        return { area, adaptiveAltitude, centroid };
      } else {
        console.warn(`[Test] Subdivision ${subdivisionName} in ${countryIso} not found`);
        console.log(`[Test] Available subdivisions in localPolygons:`, localPolygons?.map(p => p.properties?.NAME_1 || p.properties?.name_1 || p.properties?._subdivisionName).filter(Boolean));
        return null;
      }
    };

    // Exponer funciones globalmente para testing
    (window as any).selectCity = selectCity;
    (window as any).testAltitude = testAltitude;
    (window as any).getAvailableCities = getAvailableCities;
    console.log('[Mount] Global functions available:');
    console.log('  - selectCity("Jaén") - Select a specific city');
    console.log('  - getAvailableCities() - Get cities for current subdivision');
    console.log('  - testAltitude(0.5) - Test camera altitude');
    console.log('  - testAdaptiveZoom("ESP") - Test adaptive zoom for a country (ESP, USA, RUS, etc.)');
    console.log('  - testAdaptiveZoomSubdivision("ESP", "Andalucía") - Test adaptive zoom for a subdivision');
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
          console.log('[Mount] Data loaded from stores');
        }
      }
    } else {
      // Si hay props, inicializar desde ellas inmediatamente
      await initFrom(geo, dataJson);
      console.log('[Mount] Data from props');
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
    
    // Listen for search selection events from BottomSheet
    searchSelectHandler = async (event: Event) => {
      console.log('[GlobeGL] searchSelect event received:', event);
      const customEvent = event as CustomEvent;
      const option = customEvent.detail;
      console.log('[GlobeGL] Option detail:', option);
      if (option && option.id && option.name) {
        console.log('[GlobeGL] Calling selectDropdownOption with:', option);
        await selectDropdownOption(option);
      } else {
        console.warn('[GlobeGL] Invalid option received:', option);
      }
    };
    console.log('[GlobeGL] Adding searchSelect event listener');
    window.addEventListener('searchSelect', searchSelectHandler);
  });

  function resize() { /* GlobeCanvas maneja su propio tamaño vía CSS */ }

  // Store handler reference for cleanup
  let searchSelectHandler: ((event: Event) => Promise<void>) | null = null;

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
  });

</script>

<GlobeCanvas
  bind:this={globe}
  {bgColor}
  {selectedCityId}
  onPolyCapColor={(feat) => {
    const iso = isoOf(feat);
    // Si hay país seleccionado, colorear ese país con el color del segmento líder del chart
    if (selectedCountryIso) {
      if (iso === selectedCountryIso) {
        const topSeg = (countryChartSegments && countryChartSegments.length > 0) ? countryChartSegments[0] : null;
        if (topSeg?.color) return topSeg.color;
        // Fallback al color dominante por ISO si no hay segmentos
        const k = isoDominantKey[iso] ?? '';
        return colorMap?.[k] ?? '#9ca3af';
      }
      // Otros países atenuados para enfatizar el foco
      return hexToRgba(capBaseColor, 0.15);
    }
    // Vista global: usar la clave dominante por país
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
    if (!navigationManager) return;
    try {
      const feat = e.detail?.feat;
      if (!feat) return;
      
      console.log('[PolygonClick Event] Received polygon click event');
      console.log('[PolygonClick Event] Feature properties:', feat.properties);
      
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
        
        // Zoom to country with adaptive zoom based on country size
        const centroid = centroidOf(feat);
        const adaptiveAltitude = calculateAdaptiveZoom(feat);
        globe?.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: adaptiveAltitude }, 700);
        
        // Navigate using manager
        await navigationManager.navigateToCountry(iso, name);
        
      } else if (currentLevel === 'country' && feat.properties?.ID_1) {
        // Click on subdivision from country view
        const subdivisionId = feat.properties.ID_1;
        const subdivisionName = feat.properties.NAME_1 || feat.properties.name_1 || name;
        
        console.log('[Click] Subdivision clicked from country:', subdivisionId, subdivisionName);
        
        // Mantener el nombre del país (no cambiarlo por la subdivisión)
        // selectedCountryName ya debería tener el nombre del país del nivel anterior
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
        
        // Preparar contexto para ciudades según la subdivisión
        console.log(`[City Context] Subdivision ${subdivisionName} selected. Cities available for selection.`);
        if (subdivisionName.includes('Andalucía') || subdivisionName.includes('Andalusia')) {
          console.log('[City Context] Andalucía selected. Try: selectCity("Jaén"), selectCity("Sevilla"), selectCity("Granada")');
        }
        
        // Zoom adaptativo basado en el tamaño de la subdivisión
        const centroid = centroidOf(feat);
        const adaptiveAltitude = calculateAdaptiveZoomSubdivision(feat);
        // Asegurar que el zoom sea lo suficientemente cercano para activar elevaciones bajas
        const targetAlt = Math.min(adaptiveAltitude, 0.06); // Máximo 0.06 para activar elevaciones bajas
        globe?.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: targetAlt }, 700);
        
        // Navigate using manager
        await navigationManager.navigateToSubdivision(iso, subdivisionId, subdivisionName);
        
        // Update selected subdivision name and ID for view buttons
        selectedSubdivisionName = subdivisionName;
        selectedSubdivisionId = subdivisionId;
        // Limpiar ciudad seleccionada al cambiar de subdivisión
        selectedCityId = null;
        
        // ELEVAR los polígonos del nivel 3 significativamente
        // Actualizar la elevación de los polígonos cargados
        const subdivisionKey = `${iso}/${subdivisionId}`;
        const loadedPolygons = navigationManager?.['polygonCache']?.get(subdivisionKey);
        if (loadedPolygons?.length) {
          console.log('[Elevation] Elevating level 3 polygons:', loadedPolygons.length);
          loadedPolygons.forEach((poly: any) => {
            if (poly.properties) {
poly.properties._elevation = 0.05; // Elevación MUY alta para nivel 3 - 3x más que el default
            }
          });
        }
        
        // Refresh altitudes to apply the new elevation
        setTimeout(() => {
          globe?.refreshPolyAltitudes?.();
        }, 100);
        
      } else if (currentLevel === 'subdivision' && feat.properties?.ID_2) {
        // NIVEL 4: Activar selección (viene de etiqueta o sistema de proximidad)
        const cityName = feat.properties.NAME_2 || feat.properties.name_2 || name;
        const subdivisionName = feat.properties.NAME_1 || feat.properties.name_1;
        
        console.log('[Click] Level 4 - City/Province selected:', cityName, 'in', subdivisionName);
        
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
        
        console.log(`[City] Level 4 activated! Navigation: Global / ${selectedCountryName} / ${selectedSubdivisionName} / ${selectedCityName}`);
      }
    } catch (e) {
      console.error('[Click] Error handling polygon click:', e);
    }
  }}
  on:globeClick={async (e) => {
    if (!navigationManager) return;
    
    try {
      const currentLevel = navigationManager.getCurrentLevel();
      
      // Check if we're in city level (4th level)
      if (selectedCityName) {
        console.log('[Click] Empty space clicked in level 4 → Going back to country level (level 2)');
        
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
        console.log('[Click] Empty space clicked → Navigating back to previous view');
        
        // Navigate back to previous level
        await navigationManager.navigateBack();
        
        // Clear appropriate level data
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
          selectedCityId = null;
        } else if (newLevel === 'country') {
          // Stay at country zoom level, clear subdivision
          selectedSubdivisionName = null;
          selectedCityId = null;
          globe?.pointOfView({ lat: globe?.pointOfView()?.lat || 0, lng: globe?.pointOfView()?.lng || 0, altitude: 0.8 }, 700);
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

<!-- Tabs compactos (Para ti -> menú) junto a la lupa -->
<div class="tabs-float">
  <TopTabs
    options={["Para ti", "Tendencias", "Live"]}
  />
</div>

<!-- SearchBar movido al BottomSheet -->

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

<BottomSheet
  state={SHEET_STATE}
  y={sheetY}
  isTransitioning={sheetIsTransitioning}
  {selectedCountryName}
  {selectedSubdivisionName}
  {selectedCityName}
  {countryChartSegments}
  {worldChartSegments}
  {cityChartSegments}
  {voteOptions}
  {friendsByOption}
  {visitsByOption}
  {creatorsByOption}
  {publishedAtByOption}
  {navigationManager}
  {currentAltitude}
  {additionalPolls}
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
    console.log('[GlobeGL] Vote event received:', e.detail);
  }}
/>

<!-- Dropdown flotante renderizado fuera del BottomSheet -->
{#if showDropdown}
  <div 
    class="global-dropdown-overlay" 
    on:click={() => {
      showDropdown = false;
      dropdownOptions = [];
      dropdownSearchQuery = '';
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
      on:click={(e) => e.stopPropagation()}
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
