<script lang="ts">
  import { onMount, onDestroy, tick, createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { apiGet, apiCall } from '$lib/api/client';
  
  // ========================================
  // STORES CENTRALIZADOS (Fase 3 - Refactorización)
  // ========================================
  import { 
    navigationState as globalNavigationState,
    activePoll as globalActivePoll,
    answersData as globalAnswersData,
    colorMap as globalColorMap,
    themeState as globalThemeState,
    isDarkTheme as globalIsDarkTheme
  } from '$lib/stores/globalState';
   
  // ========================================
  // SERVICIOS REUTILIZABLES (Fase 3 - Refactorización)
  // ========================================
  import { geocodeService } from '$lib/services/GeocodeService';
  import { pollDataService } from '$lib/services/PollDataService';
  import { labelManager } from '$lib/services/LabelManager';
  import { colorManager } from '$lib/services/ColorManager';
  
  // ========================================
  // EVENT LISTENER MANAGEMENT (Fase 3 - Refactorización)
  // ========================================
  import { createEventListenerManager } from '$lib/utils/eventListenerCleanup';
  
  const dispatch = createEventDispatcher();
  const eventListeners = createEventListenerManager(); // Gestión automática de listeners
  
  // Helper para delays con Promesas
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Helper para limitar concurrencia de promesas (evita sobrecarga de requests)
  async function limitConcurrency<T = any>(
    items: T[],
    handler: (item: T, index: number) => Promise<any>,
    concurrencyLimit: number = 5
  ): Promise<any[]> {
    const results: any[] = [];
    const executing: Promise<any>[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const promise = handler(item, i).then(result => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });
      
      results.push(promise);
      executing.push(promise);
      
      if (executing.length >= concurrencyLimit) {
        await Promise.race(executing);
      }
    }
    
    return Promise.all(results);
  }
  
  // Sistema de cache para evitar repintados innecesarios
  let lastColorMapHash = '';
  let isRefreshing = false;
  
  // Función para animar fade-in de colores (desvanecimiento suave)
  function animateFadeIn(duration = 600) {
    if (isFading) return; // Ya hay animación en curso
    
    isFading = true;
    fadeOpacity = 0.0;
    const startTime = performance.now();
    
    function animate() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);
      
      // Easing suave (ease-in-out para más visibilidad)
      fadeOpacity = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      // Forzar repintado con nueva opacidad
      globe?.refreshPolyColors?.();
      
      if (progress < 1.0) {
        requestAnimationFrame(animate);
      } else {
        fadeOpacity = 1.0;
        isFading = false;
      }
    }
    
    requestAnimationFrame(animate);
  }
  
  // Función centralizada para actualizar colores del globo (OPTIMIZADA + FADE)
  async function updateGlobeColors(withFade = false) {
    // Verificar que los datos necesarios existen
    if (!colorMap || Object.keys(colorMap).length === 0 || !isoDominantKey || Object.keys(isoDominantKey).length === 0) {
      return;
    }
    
    // FORZAR refresh completo (temporal para debug)
    // Evitar múltiples refreshes simultáneos (EXCEPTO si es con fade)
    // if (isRefreshing && !withFade) {
    //   return;
    // }
    
    // Generar hash de colorMap para detectar cambios
    const currentHash = JSON.stringify(Object.keys(colorMap).sort());
    if (currentHash === lastColorMapHash && !withFade) {
      return; // No hay cambios, no repintar
    }
    
    isRefreshing = true;
    lastColorMapHash = currentHash;
    
    // Si se solicita fade, animar SIEMPRE
    if (withFade) {
      animateFadeIn(600); // 0.6 segundos - rápido pero visible
    } else {
      // Una sola llamada a refresh (eliminada la redundancia)
      await new Promise(resolve => requestAnimationFrame(resolve));
      globe?.refreshPolyColors?.();
    }
    
    isRefreshing = false;
  }
  import TopTabs from './TopTabs.svelte';
  import './GlobeGL.css';
  import { worldMap$, worldData$, loadGlobeData } from './stores/globeData';
  import { currentUser } from './stores';
  import { get as getStore } from 'svelte/store';
  import { clamp, hexToRgba } from './utils/colors';
  import { centroidOf, isoOf, pointInFeature } from './utils/geo';
  import SearchBar from './globe/SearchBar.svelte';
  import TagBar from './globe/TagBar.svelte';
  import BottomSheet from './globe/BottomSheet.svelte';
  import GlobeCanvas from './globe/GlobeCanvas.svelte';
  import { nameOf as nameOfUtil, getDominantKey as getDominantKeyUtil, opacityForIso as opacityForIsoUtil, alphaForTag as alphaForTagUtil } from './utils/globeHelpers';
  import { BottomSheetController, type SheetState } from './globe/bottomSheet';
  import { computeGlobeViewModel, getFeatureId } from './utils/globeDataProc';
  import themeConfig from './config/theme.json';
  import { getCountryPath } from './config/file-map';

  // Permitir modo "data-in": el padre pasa datos directamente y GlobeGL se auto-configura
  export let geo: any = null;
  export let dataJson: any = null;
  export let autoLoad: boolean = true; // si true y no hay props, carga desde store
  // Loader opcional para datos por región (bbox) cuando el usuario se acerca (no usado actualmente)
  export const loadRegionData: null | ((bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number }) => Promise<any>) = null;

  let globe: any = null; // ref al componente GlobeCanvas
  
  // ========================================
  // FASE 3: MIGRACIÓN A STORES CENTRALIZADOS
  // ========================================
  // Subscripciones a stores globales (auto-reactive con $)
  $: answersData = $globalAnswersData;
  $: colorMap = $globalColorMap;
  
  let isoIntensity: Record<string, number> = {};
  
  // Cache de datos por nivel - migrado a stores
  $: worldLevelAnswers = $globalAnswersData; // Temporal: mantener compatibilidad
  $: countryLevelAnswers = $globalAnswersData;
  $: subdivisionLevelAnswers = $globalAnswersData;
  
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
  let originalSheetY: number | null = null; // Para guardar la posición original del sheet
  let originalSheetState: SheetState | null = null; // Para guardar el estado original del sheet
  
  // Filtered dropdown options based on search
  $: filteredDropdownOptions = dropdownOptions.filter(option => 
    option.name.toLowerCase().includes(dropdownSearchQuery.toLowerCase())
  );
  
  // Tab activo para "Para ti" vs "Tendencias"
  // Por defecto "Tendencias" hasta que Prisma se regenere correctamente
  let activeTopTab: 'Para ti' | 'Tendencias' | 'Live' = 'Tendencias';
  
  // Obtener usuario actual del store
  let userData: typeof $currentUser = null;
  $: userData = $currentUser;
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
  const MIN_ZOOM_ALTITUDE = 0.04; // límite mínimo de zoom (más cerca) - ajustado para evitar acercamiento excesivo
  const MAX_ZOOM_ALTITUDE = 4.0; // límite máximo de zoom (más lejos)

  // Caches para optimización (evitar recálculos)
  const areaCache = new Map<string, number>();
  const zoomCache = new Map<string, number>();
  const chartSegmentsCache = new Map<string, ChartSeg[]>();
  
  // Pre-carga inteligente: cachear próximo nivel durante animación
  let preloadedPolygons: any[] | null = null;
  let preloadedCountryIso: string | null = null;
  
  // Sistema de fade-in para colores de polígonos
  let fadeOpacity = 1.0; // 0.0 = transparente, 1.0 = opaco
  let isFading = false;

  // Función para calcular el área aproximada de un polígono (en grados cuadrados) - CON CACHE
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
  
  // Función para calcular el zoom adaptativo basado en el tamaño del país - CON CACHE
  function calculateAdaptiveZoom(feature: any): number {
    const featureId = feature?.properties?.ISO_A3 || feature?.properties?.ID_1 || feature?.properties?.ID_2 || '';
    
    // Revisar cache primero
    if (featureId && zoomCache.has(featureId)) {
      return zoomCache.get(featureId)!;
    }
    
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
    const result = Math.max(MIN_ZOOM_ALTITUDE, Math.min(targetAltitude, MAX_ZOOM_ALTITUDE));
    
    // Guardar en cache para futuros usos
    if (featureId) {
      zoomCache.set(featureId, result);
    }
    
    return result;
  }

  // Función para calcular el zoom adaptativo para subdivisiones (estados/comunidades) - CON CACHE
  function calculateAdaptiveZoomSubdivision(feature: any): number {
    const featureId = feature?.properties?.ID_1 || feature?.properties?.ID_2 || feature?.properties?.GID_2 || '';
    
    // Revisar cache primero
    if (featureId && zoomCache.has(featureId)) {
      return zoomCache.get(featureId)!;
    }
    
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
      targetAltitude = 0.24 + (area - 1) / 4 * 0.11;
    } else if (area > 0.3) {
      // Subdivisiones pequeñas (provincias españolas, departamentos pequeños): cercano
      targetAltitude = 0.18 + (area - 0.3) / 0.7 * 0.06;
    } else if (area > 0.05) {
      // Subdivisiones muy pequeñas (Delaware, Rhode Island, islas pequeñas): muy cercano
      targetAltitude = 0.13 + (area - 0.05) / 0.25 * 0.05;
    } else {
      // Subdivisiones minúsculas (Washington D.C., ciudades-estado, islas diminutas): zoom controlado
      targetAltitude = 0.10 + area / 0.05 * 0.03;
    }
    
    // Asegurar que esté dentro de los límites permitidos
    const result = Math.max(MIN_ZOOM_ALTITUDE, Math.min(targetAltitude, MAX_ZOOM_ALTITUDE));
    
    // Guardar en cache para futuros usos
    if (featureId) {
      zoomCache.set(featureId, result);
    }
    
    return result;
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


  // 🔧 FUNCIÓN CENTRALIZADA: Actualizar votos y barra para cualquier nivel
  function updateVoteDataForLevel(voteData: Record<string, number>, levelName: string) {
    if (!voteData || !activePollOptions.length) return;
    
    console.log(`[updateVoteData] Actualizando ${levelName}:`, voteData);
    
    // ✅ ACTUALIZAR LEGENDITEMS para la barra de resumen horizontal
    legendItems = activePollOptions.map(opt => ({
      key: opt.key,
      color: opt.color,
      count: voteData[opt.key] || 0
    }));
    
    // ✅ ACTUALIZAR VOTOS en las opciones
    const updatedOptions = activePollOptions.map(opt => ({
      ...opt,
      votes: voteData[opt.key] || 0
    }));
    
    activePollOptions = [...updatedOptions];
    voteOptions = [...updatedOptions];
    voteOptionsUpdateTrigger++;
    
    tick().then(() => {
      console.log(`[updateVoteData] ✅ ${levelName} actualizado`);
    });
  }

  // Generar datos específicos para una ciudad desde answersData
  function generateCityChartSegments(cityName: string, cityId?: string) {
    console.log('[CityChart] 🔍 Generando datos para:', { cityName, cityId });
    
    // Intentar obtener datos desde answersData usando el cityId
    if (cityId && answersData) {
      // Construir posibles IDs para buscar
      const state = navigationManager?.getState();
      const countryIso = state?.countryIso || selectedCountryIso || '';
      const parentSubdivisionId = state?.subdivisionId || selectedSubdivisionId || '';
      
      let possibleIds: string[] = [cityId];
      if (!cityId.includes('.')) {
        if (parentSubdivisionId.includes('.')) {
          possibleIds.push(`${parentSubdivisionId}.${cityId}`);
        } else if (parentSubdivisionId) {
          possibleIds.push(`${countryIso}.${parentSubdivisionId}.${cityId}`);
        }
      }
      
      console.log('[CityChart] 🔍 IDs posibles:', possibleIds);
      console.log('[CityChart] 🔍 Claves disponibles en answersData (nivel 3-4):', 
        Object.keys(answersData).filter(k => k.split('.').length >= 3).slice(0, 20)
      );
      
      // Buscar datos con cualquier ID posible
      for (const id of possibleIds) {
        const cityData = answersData[id];
        if (cityData) {
          console.log('[CityChart] ✅ Generando barra con datos de:', id, cityData);
          cityChartSegments = generateCountryChartSegments([cityData]);
          console.log('[CityChart] ✅ cityChartSegments generado:', cityChartSegments);
          return;
        }
      }
      
      console.log('[CityChart] ⚠️ No se encontraron datos en answersData para ninguno de los IDs posibles');
    }
    
    // Fallback: intentar con citiesData (datos estáticos)
    const cityData = citiesData[cityName];
    if (cityData) {
      console.log('[CityChart] ⚠️ Usando datos estáticos de citiesData para:', cityName);
      cityChartSegments = generateCountryChartSegments([cityData]);
    } else {
      console.log('[CityChart] ❌ No se encontraron datos para:', cityName);
      cityChartSegments = [];
    }
  }

  // Flag global para indicar si estamos navegando desde popstate
  let isNavigatingFromHistory = false;
  
  // Función para navegar directamente a una vista específica
  async function navigateToView(targetLevel: 'world' | 'country' | 'subdivision' | 'city', fromHistory = false) {
    if (!navigationManager) return;
    
    isNavigatingFromHistory = fromHistory;
    const currentLevel = navigationManager!.getCurrentLevel();
    
    if (targetLevel === 'world') {
      // Limpiar todos los niveles inferiores
      selectedCountryName = null;
      selectedCountryIso = null;
      selectedSubdivisionName = null;
      selectedSubdivisionId = null;
      selectedCityName = null;
      selectedCityId = null;
      
      // Navegar al mundo y hacer zoom hacia atrás
      await navigationManager!.navigateToWorld();
      scheduleZoom(0, 0, 2.0, 1000);
      
    } else if (targetLevel === 'country' && selectedCountryIso) {
      // Limpiar niveles inferiores
      selectedSubdivisionName = null;
      selectedSubdivisionId = null;
      selectedCityName = null;
      selectedCityId = null;
      
      // Navegar al país y hacer zoom apropiado
      await navigationManager!.navigateToCountry(selectedCountryIso, selectedCountryName || 'Unknown');
      
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
        await navigationManager!.navigateToSubdivision(selectedCountryIso, selectedSubdivisionId, selectedSubdivisionName);
        
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
    
    isNavigatingFromHistory = false;
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
    const path = getCountryPath(iso, id1);
    const resp = await fetch(path);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} al cargar ${path}`);
    }
    const topo = await resp.json();
    const mod = await import(/* @vite-ignore */ 'topojson-client');
    const objects = topo.objects || {};
    const firstKey = Object.keys(objects)[0];
    if (!firstKey) return [];
    const fc = (mod as any).feature(topo, objects[firstKey]);
    const feats: any[] = Array.isArray(fc?.features) ? fc.features : [];
    
    // FILTRAR features nulos o mal formados ANTES de procesarlos
    const validFeats = feats.filter(f => 
      f !== null && 
      f !== undefined && 
      f.type === 'Feature' &&
      f.geometry !== null && 
      f.geometry !== undefined &&
      f.geometry.type !== null
    );
    
    for (const f of validFeats) {
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
    
    return validFeats;
  }

  // Generar etiquetas SOLO para polígonos con datos activos (votos)
  // SIMPLIFICADO: Sin filtros complejos, solo mostrar lo que tiene votos
  function generateSubdivisionLabels(polygons: any[], currentAltitude?: number): SubdivisionLabel[] {
    const labels: SubdivisionLabel[] = [];
    const currentLevel = navigationManager?.getCurrentLevel() || 'world';
    
    // Calcular áreas para determinar tamaño de etiqueta
    const polygonsWithArea = polygons.map(poly => ({
      poly,
      area: calculatePolygonArea(poly)
    }));
    
    // Ordenar por área (más grandes primero) para mejor visualización
    polygonsWithArea.sort((a, b) => b.area - a.area);
    
    for (const { poly, area } of polygonsWithArea) {
      // Determinar polyId según el nivel de navegación
      let polyId = '';
      if (currentLevel === 'world') {
        polyId = poly.properties.ISO_A3 || poly.properties.iso_a3 || 
                 poly.properties.GID_0 || poly.properties.gid_0 || '';
      } else if (currentLevel === 'country') {
        const gid1 = poly.properties.GID_1 || poly.properties.gid_1 || '';
        const id1 = poly.properties.ID_1 || poly.properties.id_1 || '';
        polyId = gid1 ? gid1.split('_')[0] : String(id1);
      } else if (currentLevel === 'subdivision') {
        const gid2 = poly.properties.GID_2 || poly.properties.gid_2 || '';
        const id2 = poly.properties.ID_2 || poly.properties.id_2 || '';
        polyId = gid2 ? gid2.split('_')[0] : String(id2);
      }
      
      // SOLO procesar polígonos con datos activos (votos)
      const hasData = Boolean(polyId && answersData?.[polyId]);
      if (!hasData) continue;
      
      // Obtener nombre del polígono
      let name = null;
      let labelType = '';
      
      if (poly?.properties?._isLevel2) {
        name = poly.properties.NAME_2 || poly.properties.name_2 || 
               poly.properties.NAME || poly.properties.name;
        labelType = 'level2';
      } else if (poly?.properties?._isChild && poly?.properties?._subdivisionName) {
        name = poly.properties._subdivisionName;
        labelType = 'subdivision';
      } else if (poly?.properties?._isParent) {
        name = poly.properties.NAME_1 || poly.properties.name_1 || 
               poly.properties.NAME || poly.properties.name;
        labelType = 'country';
      } else {
        name = poly.properties?.NAME_1 || poly.properties?.name_1 || 
               poly.properties?.NAME_2 || poly.properties?.name_2 ||
               poly.properties?.NAME || poly.properties?.name;
        labelType = 'fallback';
      }
      
      if (name) {
        try {
          const centroid = centroidOf(poly);
          
          // Calcular tamaño de fuente basado en área
          const MIN_FONT_SIZE = 10;
          const MAX_FONT_SIZE = 14;
          const fontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, 9 + Math.sqrt(area) * 0.2));
          
          const label: SubdivisionLabel = {
            id: `label_${labelType}_${polyId}`,
            name: name,
            lat: centroid.lat,
            lng: centroid.lng,
            feature: poly,
            size: fontSize,
            area: area,
            hasData: true // Siempre true porque solo generamos etiquetas con datos
          };
          labels.push(label);
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
      // SISTEMA SIMPLIFICADO: Solo mostrar la etiqueta del polígono centrado
      if (visible && isCenterPolygonActive) {
        const centerLabels = subdivisionLabels.filter(l => l._isCenterLabel);
        globe.setTextLabels?.(centerLabels);
      } else {
        // Si no hay polígono centrado o no visible, limpiar todas las etiquetas
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

  // ========================================
  // FASE 3: COLORES - Migrado a ColorManager
  // ========================================
  // Las funciones de carga de colores ahora llaman directamente a colorManager con callbacks de progreso

  /**
   * Calcular legendItems agregando TODOS los votos de un territorio incluyendo subniveles
   * @param currentLevel - Nivel actual (world, country, subdivision)
   * @param territoryId - ID del territorio (null para world, ISO para country, subdivisionId para subdivision)
   */
  function calculateAggregatedLegendItems(
    currentLevel: 'world' | 'country' | 'subdivision',
    territoryId: string | null
  ): Array<{ key: string; color: string; count: number }> {
    const totals: Record<string, number> = {};
    
    // Si no hay datos, retornar array vacío sin romper el flujo
    if (!answersData || typeof answersData !== 'object' || Object.keys(answersData).length === 0) {
      return [];
    }
    
    // Si no hay colorMap, no podemos calcular colores
    if (!colorMap || typeof colorMap !== 'object') {
      return [];
    }
    
    // Función para verificar si un ID pertenece al territorio
    const belongsToTerritory = (subdivisionId: string): boolean => {
      if (currentLevel === 'world') {
        // En world, contar TODOS los votos
        return true;
      } else if (currentLevel === 'country' && territoryId) {
        // En country, contar todos los que empiezan con el ISO del país
        // Ejemplos: ESP, ESP.1, ESP.1.1, ESP.2.3.4, etc.
        return subdivisionId === territoryId || subdivisionId.startsWith(territoryId + '.');
      } else if (currentLevel === 'subdivision' && territoryId) {
        // En subdivision, contar todos los que empiezan con el subdivisionId
        // Ejemplos: ESP.1, ESP.1.1, ESP.1.2, ESP.1.1.3, etc.
        return subdivisionId === territoryId || subdivisionId.startsWith(territoryId + '.');
      }
      return false;
    };
    
    // Sumar todos los votos de todas las opciones en todos los territorios que pertenecen
    for (const [subdivisionId, votes] of Object.entries(answersData)) {
      if (belongsToTerritory(subdivisionId)) {
        for (const [optionKey, voteCount] of Object.entries(votes)) {
          if (!totals[optionKey]) {
            totals[optionKey] = 0;
          }
          totals[optionKey] += voteCount;
        }
      }
    }
    
    // Convertir a formato legendItems
    return Object.entries(totals).map(([key, count]) => ({
      key,
      color: colorMap[key] || '#999999',
      count
    })).sort((a, b) => b.count - a.count); // Ordenar por count descendente
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

  // Token para cancelar operaciones asíncronas cuando se navega
  let currentNavigationToken = 0;
  
  function getNewNavigationToken(): number {
    return ++currentNavigationToken;
  }

  // Professional Navigation Manager Class
  class NavigationManager {
    private globe: any;
    private state: NavigationState;
    private history: Array<{level: NavigationLevel; name: string; iso?: string; id?: string;}>;
    private polygonCache: Map<string, any[]> = new Map();
    private labelCache: Map<string, SubdivisionLabel[]> = new Map();
    private trendingPollsDataCache: Record<string, {
      data: Record<string, Record<string, number>>;
      timestamp: number;
      pollIds: string;
    }> = {};

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
    async navigateToCountry(iso: string, countryName: string, skipHistoryPush = false, skipPolygonLoad = false) {
      
      // Generar nuevo token para esta navegación
      const navToken = getNewNavigationToken();
      console.log('[Navigation] 🔑 Token de navegación:', navToken, 'para país:', iso, skipPolygonLoad ? '(solo estado)' : '');
      
      try {
        // Load country data (solo si NO viene de búsqueda directa con polígonos ya cargados)
        let countryPolygons: any[] = [];
        if (!skipPolygonLoad) {
          countryPolygons = await this.loadCountryPolygons(iso);
          
          // Verificar si esta navegación sigue siendo válida
          if (navToken !== currentNavigationToken) {
            console.log('[Navigation] ❌ Navegación cancelada (token:', navToken, 'vs actual:', currentNavigationToken, ')');
            return;
          }
          
          if (!countryPolygons?.length) {
            throw new Error(`No polygons found for country ${iso}`);
          }
        } else {
          console.log('[navigateToCountry] 🔍 Saltando carga de polígonos (ya cargados desde búsqueda directa)');
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
        
        // HISTORY API: Guardar estado en el historial del navegador (solo si no viene de popstate)
        if (!skipHistoryPush && !isNavigatingFromHistory) {
          const historyState: any = {
            level: 'country',
            countryIso: iso,
            countryName: countryName,
            timestamp: Date.now()
          };
          
          // Si hay una encuesta activa, incluirla en el estado
          if (activePoll) {
            historyState.pollId = activePoll.id;
            historyState.pollMode = 'specific';
          }
          
          const url = activePoll 
            ? `/?poll=${encodeURIComponent(activePoll.id)}&country=${encodeURIComponent(iso)}`
            : `/?country=${encodeURIComponent(iso)}`;
          history.pushState(historyState, '', url);
          console.log('[History] 📍 Navegando a país:', countryName, url);
        } else {
          console.log('[History] 🔄 Restaurando país desde historial:', countryName);
        }

        // LIMPIAR answersData ANTES de renderizar para evitar que autoSelect use datos mundiales
        if (!skipPolygonLoad) {
          answersData = {};
          console.log('[Navigation] 🧹 answersData limpiado antes de renderizar país');
        }

        // Render country view PRIMERO (solo si cargamos polígonos)
        if (!skipPolygonLoad && countryPolygons.length > 0) {
          await this.renderCountryView(iso, countryPolygons);
        } else if (skipPolygonLoad) {
          console.log('[navigateToCountry] 🔍 Saltando renderizado (polígonos ya renderizados desde búsqueda directa)');
        }
        
        // REMOVIDO: No cargar subdivisiones automáticamente
        // Las subdivisiones de nivel 3 (UKR.1, UKR.2, etc.) solo se cargan cuando
        // el usuario hace click en una subdivisión específica del nivel 2
        // await this.loadSubdivisions(iso);
        
        // Cargar datos de subdivisiones y actualizar answersData DESPUÉS de renderizar
        if (activePoll && activePoll.id) {
          // MODO ENCUESTA ESPECÍFICA: Cargar datos de esa encuesta
          try {
            const response = await apiCall(`/api/polls/${activePoll.id}/votes-by-subdivisions?country=${iso}`);
            
            // Verificar si la navegación sigue siendo válida
            if (navToken !== currentNavigationToken) {
              console.log('[Navigation] ❌ Carga de datos cancelada (token:', navToken, 'vs actual:', currentNavigationToken, ')');
              return;
            }
            
            if (response.ok) {
              const { data } = await response.json();
                            
              // *** INCLUIR TODOS LOS NIVELES para conteo agregado correcto ***
              // Guardar TODOS los votos que pertenecen a este país (nivel 1, 2, 3, etc.)
              const allLevelsData: Record<string, Record<string, number>> = {};
              for (const [subdivisionId, votes] of Object.entries(data)) {
                // Verificar que pertenece a este país
                if (subdivisionId === iso || subdivisionId.startsWith(iso + '.')) {
                  allLevelsData[subdivisionId] = votes as Record<string, number>;
                }
              }
                            
              // Guardar en cache de nivel country
              countryLevelAnswers = allLevelsData;
              
              // Actualizar answersData con datos de TODOS los niveles
              answersData = allLevelsData;
              
              // USAR countryPolygons (los que se pasaron a la función) en lugar de intentar obtenerlos del globo
              const subdivisionPolygons = countryPolygons.filter((p: any) => !p.properties?._isParent);
              
              // Solo calcular si hay polígonos de subdivisión
              if (subdivisionPolygons.length > 0) {
                // Recalcular isoDominantKey y legendItems con los polígonos de subdivisión
                const geoData = { type: 'FeatureCollection', features: subdivisionPolygons };
                const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
                isoDominantKey = vm.isoDominantKey;
                // *** USAR TOTALES AGREGADOS: Sumar todos los votos de este país y subniveles ***
                const aggregatedLegend = calculateAggregatedLegendItems('country', iso);
                legendItems = aggregatedLegend.length > 0 ? aggregatedLegend : vm.legendItems;
                isoIntensity = vm.isoIntensity;
                
                // FORZAR REFRESH DE COLORES - Los polígonos ya están renderizados, actualizar sus colores
                console.log('[Navigation] 🎨 Actualizando colores de polígonos con datos recién cargados');
                this.globe?.refreshPolyColors?.();
              }
              
              // MOSTRAR ETIQUETA después de cargar datos (NIVEL 2 - Encuesta específica)
              console.log('[Navigation] 🎯 Nivel 2 (Encuesta): Mostrando etiqueta después de cargar datos');
              console.log('[Navigation] 📊 answersData tiene', Object.keys(answersData || {}).length, 'claves');
              console.log('[Navigation] 📊 Primeras claves:', Object.keys(answersData || {}).slice(0, 5));
              
              const filteredPolygons = countryPolygons.filter((p: any) => !p.properties?._isParent);
              console.log('[Navigation] 📦 Polígonos filtrados:', filteredPolygons.length);
              
              // Esperar a que el globo renderice Y a que answersData esté disponible
              await new Promise(resolve => requestAnimationFrame(resolve));
              await new Promise(resolve => requestAnimationFrame(resolve));
              
              // Intentar mostrar etiqueta
              showFirstLabelWithData(filteredPolygons);
              
              // Verificar si se mostró
              console.log('[Navigation] 🏷️ Etiquetas después de showFirstLabelWithData:', subdivisionLabels.length);
            }
          } catch (error) {
            console.warn('[Navigation] ⚠️ Error loading subdivision data:', error);
            // NO MOSTRAR ETIQUETA AÚN - esperar al fallback final
          }
        } else if (!activePoll) {
          // MODO TRENDING: Cargar datos de trending para este país
          try {
            const response = await apiCall(`/api/polls/trending-by-region?region=${encodeURIComponent(selectedCountryName || iso)}&limit=20`);
            
            // Verificar si la navegación sigue siendo válida
            if (navToken !== currentNavigationToken) {
              console.log('[Navigation] ❌ Carga de trending cancelada (token:', navToken, 'vs actual:', currentNavigationToken, ')');
              return;
            }
            
            if (response.ok) {
              const { data: trendingPolls } = await response.json();
              
              // Agregar datos de trending por subdivisión
              let aggregatedData: Record<string, Record<string, number>> = {};
              const aggregatedColors: Record<string, string> = {};
              const pollColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'];
              
              // Actualizar activePollOptions con las encuestas trending
              activePollOptions = [];
              
              // Verificar cache de trending polls para este país
              const pollIds = trendingPolls.map((p : any) => p.id).join(',');
              const cacheKey = `${iso}_${pollIds}`;
              const now = Date.now();
              const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
              
              const cachedData = this.trendingPollsDataCache[cacheKey];
              const isCacheValid = cachedData && (now - cachedData.timestamp) < CACHE_TTL;
              
              if (isCacheValid) {
                console.log('[Trending] ♻️ Usando datos cacheados para', iso);
                aggregatedData = cachedData.data;
              } else {
                console.log('[Trending] 📡 Cargando datos frescos para', iso, `(${trendingPolls.length} encuestas)`);
              }
              
              // *** CARGA PARALELA con límite de concurrencia y pintado progresivo ***
              let completedCount = 0;
              
              // Solo cargar datos si NO están en cache
              if (!isCacheValid) {
                console.log(`[Trending] 🚀 Iniciando carga con límite de 5 requests simultáneos (${trendingPolls.length} encuestas)`);
                
                await limitConcurrency(trendingPolls, async (poll: any, i: number) => {
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
                  
                  try {
                    const pollResponse = await apiCall(`/api/polls/${poll.id}/votes-by-subdivisions?country=${iso}`);
                    
                    // Verificar si la navegación sigue siendo válida después de cada poll
                    if (navToken !== currentNavigationToken) {
                      console.log('[Navigation] ❌ Carga de poll trending cancelada (token:', navToken, 'vs actual:', currentNavigationToken, ')');
                      return;
                    }
                    
                    if (pollResponse.ok) {
                      const { data: pollData } = await pollResponse.json() as { data: Record<string, Record<string, number>> };
                      
                      // *** INCLUIR TODOS LOS NIVELES: nivel 1, 2, 3, etc. para conteo correcto ***
                      // En trending, queremos sumar TODOS los votos de este país y subniveles
                      for (const [subdivisionId, votes] of Object.entries(pollData)) {
                        // Verificar que pertenece a este país
                        if (subdivisionId === iso || subdivisionId.startsWith(iso + '.')) {
                          if (!aggregatedData[subdivisionId]) {
                            aggregatedData[subdivisionId] = {};
                          }
                          
                          const totalVotes = Object.values(votes).reduce((sum, count) => sum + (count as number), 0);
                          aggregatedData[subdivisionId][pollKey] = totalVotes;
                        }
                      }
                      
                      // *** ACTUALIZACIÓN PROGRESIVA: Pintar inmediatamente después de que esta encuesta termine ***
                      completedCount++;
                      
                      // Actualizar datos globales progresivamente
                      answersData = { ...aggregatedData };
                      colorMap = { ...aggregatedColors };
                      
                      // Recalcular y refrescar colores progresivamente
                      const subdivisionPolygons = countryPolygons.filter((p: any) => !p.properties?._isParent);
                      if (subdivisionPolygons.length > 0) {
                        const geoData = { type: 'FeatureCollection', features: subdivisionPolygons };
                        const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
                        isoDominantKey = vm.isoDominantKey;
                        // *** USAR TOTALES AGREGADOS: Sumar todos los votos de este país y subniveles ***
                        const aggregatedLegend = calculateAggregatedLegendItems('country', iso);
                        legendItems = aggregatedLegend.length > 0 ? aggregatedLegend : vm.legendItems;
                        isoIntensity = vm.isoIntensity;
                        
                        // Refrescar colores inmediatamente
                        this.globe?.refreshPolyColors?.();
                      }
                      
                      console.log(`[Trending] 🎨 Pintado progresivo nivel 2: ${completedCount}/${trendingPolls.length} encuestas completadas`);
                    }
                  } catch (error) {
                    console.warn(`[Trending] ⚠️ Error loading data for poll ${poll.id}:`, error);
                  }
                }, 5); // Límite de 5 requests simultáneos
              } else {
                // Si está en caché, solo preparar activePollOptions
                trendingPolls.forEach((poll: any, i: number) => {
                  const pollKey = `poll_${poll.id}`;
                  const pollColor = pollColors[i % pollColors.length];
                  
                  aggregatedColors[pollKey] = pollColor;
                  activePollOptions.push({
                    key: pollKey,
                    label: poll.question || poll.title || `Encuesta ${poll.id}`,
                    color: pollColor,
                    votes: 0,
                    pollData: poll
                  });
                });
              }
              
              // Guardar en cache si se cargaron datos frescos
              if (!isCacheValid) {
                this.trendingPollsDataCache[cacheKey] = {
                  data: aggregatedData,
                  timestamp: now,
                  pollIds: pollIds
                };
                console.log('[Trending] 💾 Datos guardados en cache para', iso);
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
                // *** USAR TOTALES AGREGADOS: Sumar todos los votos de este país y subniveles ***
                const aggregatedLegend = calculateAggregatedLegendItems('country', iso);
                legendItems = aggregatedLegend.length > 0 ? aggregatedLegend : vm.legendItems;
                isoIntensity = vm.isoIntensity;
                
                // FORZAR REFRESH DE COLORES - Los polígonos ya están renderizados, actualizar sus colores
                console.log('[Navigation] 🎨 Actualizando colores de polígonos con datos trending recién cargados');
                this.globe?.refreshPolyColors?.();
              }
              
              // MOSTRAR ETIQUETA después de cargar datos (NIVEL 2 - Trending)
              console.log('[Navigation] 🎯 Nivel 2 (Trending): Mostrando etiqueta después de cargar datos');
              console.log('[Navigation] 📊 answersData tiene', Object.keys(answersData || {}).length, 'claves');
              console.log('[Navigation] 📊 Primeras claves:', Object.keys(answersData || {}).slice(0, 5));
              
              const filteredPolygonsTrending = countryPolygons.filter((p: any) => !p.properties?._isParent);
              console.log('[Navigation] 📦 Polígonos filtrados:', filteredPolygonsTrending.length);
              
              // Esperar a que el globo renderice Y a que answersData esté disponible
              await new Promise(resolve => requestAnimationFrame(resolve));
              await new Promise(resolve => requestAnimationFrame(resolve));
              
              // Intentar mostrar etiqueta
              showFirstLabelWithData(filteredPolygonsTrending);
              
              // Verificar si se mostró
              console.log('[Navigation] 🏷️ Etiquetas después de showFirstLabelWithData:', subdivisionLabels.length);
            }
          } catch (error) {
            console.warn('[Navigation] ⚠️ Error loading trending data:', error);
            // NO MOSTRAR ETIQUETA AÚN - esperar al fallback final
          }
        }
        
        // Forzar refresh de colores después de actualizar datos
        await new Promise<void>((resolve) => {
          this.globe?.refreshPolyColors?.();
          resolve();
        });
        
        // FALLBACK FINAL: SIEMPRE mostrar una etiqueta (NIVEL 2)
        // Verificar si ya se mostró alguna etiqueta
        console.log('[Navigation] 🔍 Verificando etiquetas antes del fallback final:', subdivisionLabels.length);
        const hasLabel = subdivisionLabels.length > 0;
        
        if (!hasLabel) {
          console.log('[Navigation] 🔄 Nivel 2 (Fallback Final): Forzando etiqueta de subdivisión');
          console.log('[Navigation] 📊 answersData disponible:', Object.keys(answersData || {}).length, 'claves');
          
          // SOLO mostrar etiquetas de polígonos con datos
          const filteredPolygonsFallback = countryPolygons.filter((p: any) => !p.properties?._isParent);
          console.log('[Navigation] 📦 Polígonos para fallback:', filteredPolygonsFallback.length);
          
          if (filteredPolygonsFallback.length > 0) {
            // Primer intento
            await new Promise(resolve => setTimeout(resolve, 400));
            showFirstLabelWithData(filteredPolygonsFallback);
            console.log('[Navigation] 🏷️ Después del 1er intento:', subdivisionLabels.length, 'etiquetas');
            
            // Si no encontró datos, esperar más (los datos pueden estar cargando)
            if (subdivisionLabels.length === 0) {
              console.log('[Navigation] ⌛ Reintentando después de esperar datos...');
              await new Promise(resolve => setTimeout(resolve, 600));
              showFirstLabelWithData(filteredPolygonsFallback);
              console.log('[Navigation] 🏷️ Después del 2do intento:', subdivisionLabels.length, 'etiquetas');
            }
          } else {
            console.log('[Navigation] ⚠️ No hay polígonos de subdivisión cargados');
          }
        } else {
          console.log('[Navigation] ✅ Nivel 2: Etiqueta ya mostrada (' + subdivisionLabels.length + ')');
        }

      } catch (error) {
        console.error('[Navigation] ❌ Error crítico navegando al país:', error);
        console.error('[Navigation] 🔙 Volviendo al mundo...');
        
        // Limpiar estado completamente antes de volver
        subdivisionLabels = [];
        updateSubdivisionLabels(false);
        selectedCountryName = null;
        selectedCountryIso = null;
        selectedSubdivisionName = null;
        selectedCityId = null;
        localPolygons = [];
        preloadedPolygons = null;
        preloadedCountryIso = null;
        
        // Volver al mundo
        await this.navigateToWorld();
        
        // Forzar actualización de colores
        await new Promise(resolve => requestAnimationFrame(resolve));
        await updateGlobeColors(false);
      }
    }

    async navigateToSubdivision(countryIso: string, subdivisionId: string, subdivisionName: string, skipHistoryPush = false, skipPolygonLoad = false) {
      try {
        // Ensure we're in country context
        if (this.state.countryIso !== countryIso) {
          throw new Error('Invalid navigation: subdivision without country context');
        }

        // Load subdivision data (solo si NO viene de búsqueda directa con polígonos ya cargados)
        let subdivisionPolygons: any[] = [];
        if (!skipPolygonLoad) {
          subdivisionPolygons = await this.loadSubdivisionPolygons(countryIso, subdivisionId);
          if (!subdivisionPolygons?.length) {
            return;
          }
        } else {
          console.log('[navigateToSubdivision] 🔍 Saltando carga de polígonos (ya cargados desde búsqueda directa)');
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
        
        // HISTORY API: Guardar estado en el historial del navegador (solo si no viene de popstate)
        if (!skipHistoryPush && !isNavigatingFromHistory) {
          const historyState: any = {
            level: 'subdivision',
            countryIso: countryIso,
            countryName: this.history[1]?.name || countryIso,
            subdivisionId: subdivisionId,
            subdivisionName: subdivisionName,
            timestamp: Date.now()
          };
          
          // Si hay una encuesta activa, incluirla en el estado
          if (activePoll) {
            historyState.pollId = activePoll.id;
            historyState.pollMode = 'specific';
          }
          
          const url = activePoll
            ? `/?poll=${encodeURIComponent(activePoll.id)}&country=${encodeURIComponent(countryIso)}&subdivision=${encodeURIComponent(subdivisionId)}`
            : `/?country=${encodeURIComponent(countryIso)}&subdivision=${encodeURIComponent(subdivisionId)}`;
          history.pushState(historyState, '', url);
          console.log('[History] 📍 Navegando a subdivisión:', subdivisionName, url);
        } else {
          console.log('[History] 🔄 Restaurando subdivisión desde historial:', subdivisionName);
        }

        // Render subdivision view PRIMERO (solo si cargamos polígonos)
        if (!skipPolygonLoad && subdivisionPolygons.length > 0) {
          await this.renderSubdivisionView(countryIso, subdivisionId, subdivisionPolygons);
        } else if (skipPolygonLoad) {
          console.log('[navigateToSubdivision] 🔍 Saltando renderizado (polígonos ya renderizados desde búsqueda directa)');
        }
        
        // Cargar datos de sub-subdivisiones y actualizar answersData DESPUÉS de renderizar
        // IMPORTANTE: Cargar datos SIEMPRE, incluso si skipPolygonLoad=true
        
        // 🗺️ Determinar qué polígonos usar (ANTES de los bloques if/else)
        const polygonsToUse = skipPolygonLoad ? localPolygons : subdivisionPolygons;
        console.log('[Navigation] 🗺️ Polígonos disponibles:', polygonsToUse.length, skipPolygonLoad ? '(desde localPolygons - búsqueda directa)' : '(desde subdivisionPolygons)');
        
        if (activePoll && activePoll.id) {
          try {
            const cleanSubdivisionId = subdivisionId.includes('.') ? subdivisionId.split('.').pop() : subdivisionId;
            const response = await apiCall(`/api/polls/${activePoll.id}/votes-by-subsubdivisions?country=${countryIso}&subdivision=${cleanSubdivisionId}`);
            if (response.ok) {
              const { data } = await response.json();
                            
              // *** INCLUIR TODOS LOS NIVELES para conteo agregado correcto ***
              // Guardar TODOS los votos que pertenecen a esta subdivisión (nivel 2, 3, 4, etc.)
              const fullSubdivisionId = subdivisionId.includes('.') ? subdivisionId : `${countryIso}.${subdivisionId}`;
              const allLevelsData: Record<string, Record<string, number>> = {};
              for (const [subdivId, votes] of Object.entries(data)) {
                // Verificar que pertenece a esta subdivisión
                if (subdivId === fullSubdivisionId || subdivId.startsWith(fullSubdivisionId + '.')) {
                  allLevelsData[subdivId] = votes as Record<string, number>;
                }
              }
              
              // Guardar en cache de nivel subdivision
              subdivisionLevelAnswers = allLevelsData;
              
              // Actualizar answersData con datos de TODOS los niveles
              answersData = allLevelsData;
              
              // 🔍 DEBUG: Mostrar qué IDs tenemos en answersData
              console.log('[Navigation] 🔍 IDs disponibles en answersData para nivel 3/4:');
              console.log(Object.keys(allLevelsData));
              
              // Solo calcular si hay polígonos
              if (polygonsToUse.length > 0) {
                // Recalcular isoDominantKey y legendItems con los polígonos de subdivisión
                const geoData = { type: 'FeatureCollection', features: polygonsToUse };
                const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
                isoDominantKey = vm.isoDominantKey;
                // *** USAR TOTALES AGREGADOS: Sumar todos los votos de esta subdivisión y subniveles ***
                // fullSubdivisionId ya está definido arriba
                const aggregatedLegend = calculateAggregatedLegendItems('subdivision', fullSubdivisionId);
                legendItems = aggregatedLegend.length > 0 ? aggregatedLegend : vm.legendItems;
                isoIntensity = vm.isoIntensity;
                
                // *** FORZAR REPINTADO: Actualizar colores después de cargar datos de la API ***
                globe?.refreshPolyColors?.();
                console.log('[Navigation] 🎨 Colores actualizados después de cargar datos de encuesta específica');
              }
              
              // MOSTRAR ETIQUETA después de cargar datos (NIVEL 3/4 - Encuesta específica)
              console.log('[Navigation] 🎯 Nivel 3/4 (Encuesta): Mostrando etiqueta después de cargar datos');
              console.log('[Navigation] 📊 answersData keys:', Object.keys(answersData || {}).length);
              console.log('[Navigation] 📦 Polígonos para mostrar:', polygonsToUse.length);
              
              // Esperar a que el globo renderice antes de mostrar etiqueta
              await new Promise(resolve => requestAnimationFrame(resolve));
              await new Promise(resolve => requestAnimationFrame(resolve));
              showFirstLabelWithData(polygonsToUse);
            }
          } catch (error) {
            // Error loading sub-subdivision data
          }
        } else if (!activePoll) {
          // MODO TRENDING: Cargar datos de trending para esta subdivisión
          try {
            const response = await apiCall(`/api/polls/trending-by-region?region=${encodeURIComponent(subdivisionName)}&limit=20`);
            if (response.ok) {
              const { data: trendingPolls } = await response.json();
              
              // Agregar datos de trending por sub-subdivisión
              const aggregatedData: Record<string, Record<string, number>> = {};
              const aggregatedColors: Record<string, string> = {};
              const pollColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'];
              
              // Actualizar activePollOptions con las encuestas trending
              activePollOptions = [];
              
              // *** CARGA PARALELA con límite de concurrencia y pintado progresivo ***
              let completedCount = 0;
              const cleanSubdivisionId = subdivisionId.includes('.') ? subdivisionId.split('.').pop() : subdivisionId;
              
              console.log(`[Trending] 🚀 Iniciando carga subdivisión con límite de 5 requests simultáneos (${trendingPolls.length} encuestas)`);
              
              await limitConcurrency(trendingPolls, async (poll: any, i: number) => {
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
                  const pollResponse = await apiCall(`/api/polls/${poll.id}/votes-by-subsubdivisions?country=${countryIso}&subdivision=${cleanSubdivisionId}`);
                  if (pollResponse.ok) {
                    const { data: pollData } = await pollResponse.json();
                    
                    // *** INCLUIR TODOS LOS NIVELES: nivel 2, 3, 4, etc. para conteo correcto ***
                    // En trending, queremos sumar TODOS los votos de esta subdivisión y subniveles
                    const fullSubdivisionId = subdivisionId.includes('.') ? subdivisionId : `${countryIso}.${subdivisionId}`;
                    
                    for (const [subdivId, votesData] of Object.entries(pollData)) {
                      // Verificar que pertenece a esta subdivisión
                      if (subdivId === fullSubdivisionId || subdivId.startsWith(fullSubdivisionId + '.')) {
                        if (!aggregatedData[subdivId]) {
                          aggregatedData[subdivId] = {};
                        }
                        
                        // Cast explícito para TypeScript
                        const votes = votesData as Record<string, number>;
                        const totalVotes = Object.values(votes).reduce((sum: number, count: number) => sum + count, 0);
                        aggregatedData[subdivId][pollKey] = totalVotes;
                      }
                    }
                    
                    // *** ACTUALIZACIÓN PROGRESIVA: Pintar inmediatamente después de que esta encuesta termine ***
                    completedCount++;
                    
                    // Actualizar answersData y colorMap progresivamente
                    answersData = { ...aggregatedData };
                    colorMap = { ...aggregatedColors };
                    
                    // Recalcular y repintar polígonos progresivamente
                    if (polygonsToUse.length > 0) {
                      const geoData = { type: 'FeatureCollection', features: polygonsToUse };
                      const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
                      isoDominantKey = vm.isoDominantKey;
                      // *** USAR TOTALES AGREGADOS: Sumar todos los votos de esta subdivisión y subniveles ***
                      const fullSubdivisionId = subdivisionId.includes('.') ? subdivisionId : `${countryIso}.${subdivisionId}`;
                      const aggregatedLegend = calculateAggregatedLegendItems('subdivision', fullSubdivisionId);
                      legendItems = aggregatedLegend.length > 0 ? aggregatedLegend : vm.legendItems;
                      isoIntensity = vm.isoIntensity;
                      
                      // Forzar repintado inmediato
                      globe?.refreshPolyColors?.();
                      console.log(`[Navigation] 🎨 Pintado progresivo nivel 3: ${completedCount}/${trendingPolls.length} encuestas completadas`);
                    }
                  }
                } catch (error) {
                  // Error loading poll data
                }
              }, 5); // Límite de 5 requests simultáneos
              
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
              
              // 🔍 DEBUG: Mostrar qué IDs tenemos en answersData (trending nivel 3/4)
              console.log('[Trending] 🔍 IDs disponibles en answersData para nivel 3/4:');
              console.log(Object.keys(aggregatedData));
              
              // Recalcular colores dominantes
              if (polygonsToUse.length > 0) {
                const geoData = { type: 'FeatureCollection', features: polygonsToUse };
                const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
                isoDominantKey = vm.isoDominantKey;
                // *** USAR TOTALES AGREGADOS: Sumar todos los votos de esta subdivisión y subniveles ***
                const fullSubdivisionId = subdivisionId.includes('.') ? subdivisionId : `${countryIso}.${subdivisionId}`;
                const aggregatedLegend = calculateAggregatedLegendItems('subdivision', fullSubdivisionId);
                legendItems = aggregatedLegend.length > 0 ? aggregatedLegend : vm.legendItems;
                isoIntensity = vm.isoIntensity;
              }
              
              // MOSTRAR ETIQUETA después de cargar datos (NIVEL 3/4 - Trending)
              console.log('[Navigation] 🎯 Nivel 3/4 (Trending): Mostrando etiqueta después de cargar datos');
              console.log('[Navigation] 📊 answersData keys:', Object.keys(answersData || {}).length);
              console.log('[Navigation] 📦 Polígonos para mostrar:', polygonsToUse.length);
              
              // Esperar a que el globo renderice antes de mostrar etiqueta
              await new Promise(resolve => requestAnimationFrame(resolve));
              await new Promise(resolve => requestAnimationFrame(resolve));
              showFirstLabelWithData(polygonsToUse);
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
        
        // FALLBACK: Si no se cargaron datos de API, mostrar etiqueta de la subdivisión (NIVEL 3/4)
        // Este código solo se ejecuta si ninguno de los bloques anteriores mostró etiqueta
        if (!activePoll && Object.keys(answersData || {}).length === 0) {
          console.log('[Navigation] 🔄 Nivel 3/4 (Fallback): Mostrando nombre de la subdivisión');
          await new Promise(resolve => setTimeout(resolve, 300));
          await generateSubdivisionNameLabel();
        }

      } catch (error) {
        // Error navigating to subdivision
      }
    }

    async navigateToWorld() {
      
      // Generar nuevo token para esta navegación
      const navToken = getNewNavigationToken();
      console.log('[Navigation] 🔑 Token de navegación:', navToken, 'para mundo');
      
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
      
      // LIMPIAR polígono centrado al volver a nivel mundial
      centerPolygon = null;
      centerPolygonId = null;
      isCenterPolygonActive = false;
      removeCenterPolygonLabel();

      this.history = [{ level: 'world', name: 'World' }];
      
      // HISTORY API: Volver al estado mundial (solo si no viene de popstate)
      // IMPORTANTE: Si hay una encuesta activa, NO sobrescribir el estado
      if (!isNavigatingFromHistory && !activePoll) {
        const historyState = {
          level: 'world',
          pollMode: 'trending',
          timestamp: Date.now()
        };
        history.pushState(historyState, '', '/');
        console.log('[History] 📍 Navegando al mundo (trending)');
      } else if (activePoll) {
        console.log('[History] 📊 Navegando al mundo pero manteniendo estado de encuesta activa');
      } else {
        console.log('[History] 🔄 Restaurando mundo desde historial');
      }

      // Restaurar datos mundiales desde cache
      if (activePoll && activePoll.id) {
        try {
          // Si ya tenemos datos en cache, usarlos
          if (Object.keys(worldLevelAnswers).length > 0) {
            answersData = worldLevelAnswers;
            console.log('[Navigation] 📦 Datos mundiales restaurados desde cache:', Object.keys(worldLevelAnswers).length);
          } else {
            // Si no hay cache, cargar desde API usando PollDataService
            console.log('[Navigation] 📡 Cargando votos por país con PollDataService...');
            const data = await pollDataService.loadVotesByCountry(activePoll.id);
            
            // Verificar si la navegación sigue siendo válida
            if (navToken !== currentNavigationToken) {
              console.log('[Navigation] ❌ Carga de datos mundiales cancelada (token:', navToken, 'vs actual:', currentNavigationToken, ')');
              return;
            }
            
            worldLevelAnswers = data;
            answersData = data;
            console.log('[Navigation] ✅ Datos mundiales cargados:', Object.keys(answersData).length, 'países');
          }
          
          // Recalcular isoDominantKey y legendItems
          const geoData = { type: 'FeatureCollection', features: worldPolygons || [] };
          const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
          isoDominantKey = vm.isoDominantKey;
          // *** USAR TOTALES AGREGADOS: Sumar todos los votos de todos los subniveles ***
          const aggregatedLegend = calculateAggregatedLegendItems('world', null);
          legendItems = aggregatedLegend.length > 0 ? aggregatedLegend : vm.legendItems;
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
          // *** USAR TOTALES AGREGADOS: Sumar todos los votos de todos los subniveles ***
          const aggregatedLegend = calculateAggregatedLegendItems('world', null);
          legendItems = aggregatedLegend.length > 0 ? aggregatedLegend : vm.legendItems;
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
      
      // NIVEL MUNDIAL: NO mostrar etiquetas automáticamente
      // Las etiquetas solo se muestran en niveles 2, 3 y 4
      console.log('[Navigation] 🌍 Nivel Mundial: Sin etiquetas automáticas');
    }

    async navigateBack() {
      
      // LIMPIAR polígono centrado antes de navegar hacia atrás
      centerPolygon = null;
      centerPolygonId = null;
      isCenterPolygonActive = false;
      removeCenterPolygonLabel();
      
      if (this.state.level === 'subdivision') {
        // From subdivision back to country
        const countryIso = this.state.countryIso;
        const countryName = this.history.find(h => h.level === 'country')?.name || countryIso;
        
        if (countryIso && countryName) {
          await this.navigateToCountry(countryIso, countryName);
          // Auto-selección se activa automáticamente en navigateToCountry
        } else {
          await this.navigateToWorld();
        }
      } else if (this.state.level === 'country') {
        // From country back to world
        await this.navigateToWorld();
        // No auto-selección en nivel mundial
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
          // Usar callback de progreso para pintar a medida que se procesan subdivisiones
          subdivisionColorById = await colorManager.loadSubdivisionColors(
            activePoll.id,
            iso,
            childMarked,
            colorMap,
            (colors, processed, total) => {
              // Actualizar colores progresivamente
              subdivisionColorById = { ...colors };
              
              // Aplicar colores a polígonos
              for (const c of childMarked) {
                const props = c?.properties || {};
                const id1 = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1;
                if (id1) {
                  const col = subdivisionColorById[String(id1)];
                  if (col) {
                    c.properties._forcedColor = col;
                  }
                }
              }
              
              // Forzar repintado inmediato
              this.globe?.refreshPolyColors?.();
              console.log(`[Navigation] 🎨 Pintado progresivo nivel 2: ${processed}/${total} subdivisiones`);
            }
          );
        } else if (answersData && Object.keys(answersData).length > 0 && colorMap && Object.keys(colorMap).length > 0) {
          // MODO TRENDING: Usar datos agregados de múltiples encuestas
          console.log('[Navigation] 🎨 Modo trending: usando datos agregados para colorear subdivisiones');
          subdivisionColorById = colorManager.computeColorsFromAggregatedData(iso, childMarked, answersData, colorMap);
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
        let subSubdivisionColorById: Record<string, string> = {};
        
        if (activePoll && activePoll.id) {
          // Usar callback de progreso para pintar a medida que se procesan sub-subdivisiones
          subSubdivisionColorById = await colorManager.loadSubSubdivisionColors(
            activePoll.id,
            countryIso, 
            subdivisionId, 
            markedPolygons,
            colorMap,
            (colors, processed, total) => {
              // Actualizar colores progresivamente
              subSubdivisionColorById = { ...colors };
              
              // Aplicar colores a polígonos
              for (const poly of markedPolygons) {
                const props = poly?.properties || {};
                const id2 = props.ID_2 || props.id_2 || props.GID_2 || props.gid_2;
                if (id2) {
                  const col = subSubdivisionColorById[String(id2)];
                  if (col) {
                    poly.properties._forcedColor = col;
                  }
                }
              }
              
              // Forzar repintado inmediato
              this.globe?.refreshPolyColors?.();
              console.log(`[Navigation] 🎨 Pintado progresivo nivel 3: ${processed}/${total} sub-subdivisiones`);
            }
          );
        } else if (answersData && Object.keys(answersData).length > 0 && colorMap && Object.keys(colorMap).length > 0) {
          // MODO TRENDING: Usar datos agregados de múltiples encuestas
          console.log('[Navigation] 🎨 Modo trending nivel 3: usando datos agregados para colorear sub-subdivisiones');
          subSubdivisionColorById = colorManager.computeColorsFromAggregatedData(
            subdivisionId, 
            markedPolygons, 
            answersData, 
            colorMap
          );
        }
        
        // Aplicar _forcedColor a cada polígono (igual que en nivel 2)
        let colorsApplied = 0;
        for (const poly of markedPolygons) {
          const props = poly?.properties || {};
          const id2 = props.ID_2 || props.id_2 || props.GID_2 || props.gid_2 || props.NAME_2 || props.name_2 || null;
          
          if (id2) {
            const col = subSubdivisionColorById[String(id2)];
            if (col) {
              poly.properties._forcedColor = col;
              colorsApplied++;
            }
          }
        }
        
        console.log(`[Navigation] ✅ ${colorsApplied} sub-subdivisiones coloreadas en nivel 3`);
        
        // Set subdivision polygons con colores ya aplicados
        this.globe?.setPolygonsData(markedPolygons);
        
        // IMPORTANTE: Hacer refresh INMEDIATO para aplicar colores de BD (igual que en nivel 2)
        this.globe?.refreshPolyColors?.();
        this.globe?.refreshPolyAltitudes?.();
        
        // REFRESH ADICIONAL: Forzar refresh completo después de un pequeño delay
        setTimeout(() => {
          globe?.refreshPolyColors?.();
          globe?.refreshPolyStrokes?.();
          globe?.refreshPolyAltitudes?.();
        }, 50);
        
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
    
    // Navigate back to previous level
    async goBack() {
      const currentLevel = this.state.level;
      const navState = this.getState();
      
      console.log('[Navigation] goBack - currentLevel:', currentLevel, 'navState:', navState);
      
      // Detectar si estamos en nivel 4 (sub-subdivisiones)
      // Nivel 4 es cuando tenemos más de 2 niveles en el history
      const isLevel4 = currentLevel === 'subdivision' && 
                       this.history.length > 3;
      
      if (isLevel4) {
        // Nivel 4 -> Volver directamente a nivel 0 (world)
        console.log('[Navigation] 🔙 Volviendo de nivel 4 directamente a mundo');
        const currentPov = globe?.pointOfView();
        const currentLat = currentPov?.lat || 0;
        const currentLng = currentPov?.lng || 0;
        await this.navigateToWorld();
        scheduleZoom(currentLat, currentLng, 2.0, 1000);
      } else if (currentLevel === 'subdivision') {
        // Nivel 3 -> Volver directamente a nivel 0 (world)
        console.log('[Navigation] 🔙 Volviendo de nivel 3 (subdivision) directamente a mundo');
        const currentPov = globe?.pointOfView();
        const currentLat = currentPov?.lat || 0;
        const currentLng = currentPov?.lng || 0;
        await this.navigateToWorld();
        scheduleZoom(currentLat, currentLng, 2.0, 1000);
      } else if (currentLevel === 'country') {
        // Nivel 2 -> Volver a nivel 1 (world)
        console.log('[Navigation] 🔙 Volviendo de nivel 2 (country) a nivel 1 (world)');
        
        // Obtener posición actual antes de navegar
        const currentPov = globe?.pointOfView();
        const currentLat = currentPov?.lat || 0;
        const currentLng = currentPov?.lng || 0;
        
        await this.navigateToWorld();
        
        // Mantener la posición actual, solo alejarse
        scheduleZoom(currentLat, currentLng, 2.0, 1000);
      }
    }
    
    // Get available options for next level
    async getAvailableOptions(): Promise<Array<{ id: string; name: string; iso?: string }>> {
      const options: Array<{ id: string; name: string; iso?: string }> = [];
      
      if (this.state.level === 'world') {
        // Return ONLY countries with active data
        if (worldPolygons?.length) {
          const countryMap = new Map<string, string>();
          // Filtrar polígonos nulos antes de iterar
          worldPolygons.filter(poly => poly !== null && poly !== undefined).forEach(poly => {
            const iso = isoOf(poly);
            const name = nameOf(poly);
            
            // FILTRO: Solo agregar si tiene datos activos
            if (iso && name && !countryMap.has(iso)) {
              const hasData = Boolean(answersData?.[iso]);
              if (hasData) {
                countryMap.set(iso, name);
              }
            }
          });
          countryMap.forEach((name, iso) => {
            options.push({ id: iso, name, iso });
          });
        }
      } else if (this.state.level === 'country' && this.state.countryIso) {
        // Return ONLY subdivisions with active data
        try {
          const subdivisionPolygons = await loadSubregionTopoAsGeoFeatures(this.state.countryIso, this.state.countryIso);
          const subdivisionMap = new Map<string, string>();
          // Filtrar polígonos nulos antes de iterar
          subdivisionPolygons.filter(poly => poly !== null && poly !== undefined).forEach(poly => {
            const props = poly?.properties || {};
            let id1 = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1;
            const name1 = props.NAME_1 || props.name_1 || props.VARNAME_1 || props.varname_1;
            
            if (id1 && name1) {
              // Convertir a string para manipulación
              id1 = String(id1);
              
              // 🔧 Si el ID ya incluye el país (ej: "ESP.1"), usarlo tal cual
              // Si no (ej: "1"), agregar el countryIso
              const fullId = id1.includes('.') ? id1 : `${this.state.countryIso}.${id1}`;
              
              // FILTRO: Solo agregar si tiene datos activos
              if (!subdivisionMap.has(fullId)) {
                const hasData = Boolean(answersData?.[fullId]);
                if (hasData) {
                  subdivisionMap.set(fullId, String(name1));
                  console.log('[getAvailableOptions] ✅ Subdivisión con datos:', name1, '=', fullId);
                }
              }
            }
          });
          subdivisionMap.forEach((name, id) => {
            options.push({ id, name });
          });
        } catch (e) {
          console.warn('[Navigation] Could not load subdivisions for dropdown:', e);
        }
      } else if (this.state.level === 'subdivision' && this.state.countryIso && this.state.subdivisionId) {
        // Return ONLY sub-subdivisions with active data
        try {
          // 🔧 FIX: Limpiar subdivisionId para evitar duplicación
          // Si subdivisionId = "ESP.1" o "ESP.1.ESP.1", extraer solo la parte numérica final
          let cleanSubdivisionId = this.state.subdivisionId;
          
          // Remover duplicados como "ESP.1.ESP.1" → "ESP.1"
          const parts = cleanSubdivisionId.split('.');
          if (parts.length > 2 && parts[0] === parts[2]) {
            // Caso "ESP.1.ESP.1" → tomar primeras 2 partes
            cleanSubdivisionId = `${parts[0]}.${parts[1]}`;
            console.log('[getAvailableOptions] 🔧 Limpiando ID duplicado:', this.state.subdivisionId, '→', cleanSubdivisionId);
          }
          
          const numericPart = cleanSubdivisionId.split('.').pop();
          console.log('[getAvailableOptions] 📊 Nivel 4 - subdivisionId:', this.state.subdivisionId, '→ numericPart:', numericPart);
          console.log('[getAvailableOptions] 📦 answersData keys disponibles:', Object.keys(answersData || {}).slice(0, 15));
          
          if (numericPart) {
            const subdivisionFile = `${this.state.countryIso}.${numericPart}`;
            const subSubPolygons = await loadSubregionTopoAsGeoFeatures(this.state.countryIso, subdivisionFile);
            const subSubMap = new Map<string, string>();
            // Filtrar polígonos nulos antes de iterar
            subSubPolygons.filter(poly => poly !== null && poly !== undefined).forEach(poly => {
              const props = poly?.properties || {};
              let id2 = props.ID_2 || props.id_2 || props.GID_2 || props.gid_2;
              const name2 = props.NAME_2 || props.name_2 || props.VARNAME_2 || props.varname_2;
              
              // Limpiar id2 si tiene puntos (ej: "ESP.1.4" → "4")
              if (id2 && String(id2).includes('.')) {
                id2 = String(id2).split('.').pop();
              }
              
              // FILTRO: Solo agregar si tiene datos activos
              if (id2 && name2 && !subSubMap.has(String(id2))) {
                // 🔧 FIX: Buscar con ID completo en answersData
                const fullId = `${this.state.countryIso}.${numericPart}.${id2}`;
                
                // Intentar con múltiples formatos de ID
                const hasData = Boolean(
                  answersData?.[fullId] ||      // "ESP.1.4"
                  answersData?.[id2] ||          // "4"
                  answersData?.[String(id2)]     // "4" como string
                );
                
                if (hasData) {
                  console.log('[getAvailableOptions]   ✅ Encontrado:', name2, fullId, '(hasData)');
                  subSubMap.set(String(id2), String(name2));
                } else {
                  console.log('[getAvailableOptions]   ❌ Sin datos:', name2, fullId);
                }
              }
            });
            
            console.log('[getAvailableOptions] 📊 Opciones con datos:', subSubMap.size, 'de', subSubPolygons.length, 'polígonos');
            
            subSubMap.forEach((name, id) => {
              const fullId = `${this.state.countryIso}.${numericPart}.${id}`;
              console.log('[getAvailableOptions]   → Agregando opción:', name, '=', fullId);
              options.push({ id: fullId, name });
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
  let navigationManager: NavigationManager | null = null;
  $: if (globe && !navigationManager) {
    navigationManager = new NavigationManager(globe);
  }
  
  // Function to toggle dropdown and load options
  async function toggleDropdown(event?: Event) {
    console.log('[toggleDropdown] INICIO - showDropdown:', showDropdown);
    if (event) {
      event.stopPropagation();
    }
        if (!navigationManager) {
            return;
    }
    
    if (showDropdown) {
            console.log('[toggleDropdown] Cerrando dropdown...');
            showDropdown = false;
      dropdownOptions = [];
      dropdownSearchQuery = '';
      
      // Restaurar estado original del sheet
      if (originalSheetState !== null && sheetCtrl) {
        try {
          sheetCtrl.setState(originalSheetState);
          SHEET_STATE = originalSheetState;
          originalSheetState = null;
          originalSheetY = null;
          console.log(`[toggleDropdown] BottomSheet restaurado a estado: ${originalSheetState}`);
        } catch (e) {
          console.warn('[toggleDropdown] Error restaurando estado del sheet:', e);
        }
      }
    } else {
            console.log('[toggleDropdown] Abriendo dropdown...');
            showDropdown = true;
      dropdownSearchQuery = '';
      const options = await navigationManager!.getAvailableOptions();
      dropdownOptions = options;
      console.log('[toggleDropdown] Opciones cargadas:', options.length);
      
      // Guardar estado actual y ocultar el BottomSheet para liberar espacio
      // Hacerlo en nextTick para que el evento del dropdown se procese primero
      setTimeout(() => {
        if (sheetCtrl && SHEET_STATE !== 'hidden') {
          try {
            originalSheetState = SHEET_STATE;
            originalSheetY = sheetY;
            sheetCtrl.setState('hidden');
            SHEET_STATE = 'hidden';
            console.log(`[toggleDropdown] BottomSheet ocultado (era: ${originalSheetState})`);
          } catch (e) {
            console.warn('[toggleDropdown] Error ocultando sheet:', e);
          }
        }
      }, 0);
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
        
        // Dispatch evento para mostrar el nav
        dispatch('dropdownStateChange', { open: false });
        
        // Restaurar estado original del sheet
        if (originalSheetState !== null && sheetCtrl) {
          try {
            sheetCtrl.setState(originalSheetState);
            SHEET_STATE = originalSheetState;
            originalSheetState = null;
            originalSheetY = null;
          } catch (e) {
            console.warn('[handleClickOutside] Error restaurando estado del sheet:', e);
          }
        }
      }
    }
  }
  
  // Helper function to get country name from ISO code
  function getCountryNameFromISO(iso: string): string {
    if (!iso) return '?';
    
    // Map of common country codes to names
    const countryNames: Record<string, string> = {
      'ESP': 'España',
      'COL': 'Colombia',
      'MEX': 'México',
      'ARG': 'Argentina',
      'USA': 'United States',
      'CAN': 'Canada',
      'FRA': 'France',
      'DEU': 'Germany',
      'ITA': 'Italy',
      'GBR': 'United Kingdom',
      'PRT': 'Portugal',
      'BRA': 'Brazil',
      'CHL': 'Chile',
      'PER': 'Peru',
      'VEN': 'Venezuela',
      'ECU': 'Ecuador',
      'BOL': 'Bolivia',
      'URY': 'Uruguay',
      'PRY': 'Paraguay',
      'CRI': 'Costa Rica',
      'PAN': 'Panama',
      'NIC': 'Nicaragua',
      'HND': 'Honduras',
      'GTM': 'Guatemala',
      'SLV': 'El Salvador',
      'CUB': 'Cuba',
      'DOM': 'Dominican Republic',
      'PRI': 'Puerto Rico',
      'PHL': 'Philippines',
      'CHN': 'China',
      'JPN': 'Japan',
      'KOR': 'South Korea',
      'IND': 'India',
      'RUS': 'Russia',
      'AUS': 'Australia',
      'NZL': 'New Zealand',
      'ZAF': 'South Africa',
      'EGY': 'Egypt',
      'MAR': 'Morocco',
      'NGA': 'Nigeria',
      'KEN': 'Kenya',
      'ETH': 'Ethiopia'
    };
    
    // Primero usar el mapa estático
    if (countryNames[iso]) {
      return countryNames[iso];
    }
    
    // Luego intentar obtener desde worldPolygons
    if (worldPolygons && worldPolygons.length > 0) {
      const countryFeature = worldPolygons.find(p => isoOf(p) === iso);
      if (countryFeature) {
        const name = countryFeature.properties?.NAME || countryFeature.properties?.ADMIN;
        if (name) {
          return name;
        }
      }
    }
    
    // Fallback: devolver el código ISO
    return iso;
  }
  
  // Function to select an option from dropdown
  async function selectDropdownOption(option: { id: string; name: string; type?: string; fromDirectSearch?: boolean; parentName?: string }) {
    const isDirectSearch = option.fromDirectSearch === true;
    console.log('[selectDropdownOption] Navegando a:', option, isDirectSearch ? '🔍 [BÚSQUEDA DIRECTA - LIMPIEZA COMPLETA]' : '');
    
    // BLOQUEAR durante animaciones de zoom
    if (isZooming) {
      console.log('[Dropdown] Selección bloqueada durante animación de zoom');
      return;
    }
    
    if (!navigationManager) return;
    
    showDropdown = false;
    dropdownOptions = [];
    dropdownSearchQuery = '';
    
    // Dispatch evento para mostrar el nav
    dispatch('dropdownStateChange', { open: false });
    
    // Restaurar estado original del sheet
    if (originalSheetState !== null && sheetCtrl) {
      try {
        sheetCtrl.setState(originalSheetState);
        SHEET_STATE = originalSheetState;
        originalSheetState = null;
        originalSheetY = null;
      } catch (e) {
        console.warn('[selectDropdownOption] Error restaurando estado del sheet:', e);
      }
    }
    
    // Show bottom sheet
    setSheetState('collapsed');
    
    // 🔍 SI ES BÚSQUEDA DIRECTA: Limpieza COMPLETA de polígonos
    if (isDirectSearch) {
      console.log('[selectDropdownOption] 🧹🔥 LIMPIEZA COMPLETA - Búsqueda directa detectada');
      
      // 1. Limpiar TODOS los polígonos del globo (incluyendo world)
      globe?.setPolygonsData?.([]);
      localPolygons = [];
      
      // 2. Limpiar TODAS las etiquetas
      subdivisionLabels = [];
      updateSubdivisionLabels(false);
      globe?.labelsData?.([]);
      
      // 3. Esperar a que se limpie visualmente
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      console.log('[selectDropdownOption] ✅ Limpieza completa realizada');
    }
    
    // ✅ NAVEGACIÓN DIRECTA: Ir directamente al destino sin buscar en localPolygons
    const isCountry = !option.id.includes('.') || option.type === 'country';
    const parts = option.id.split('.');
    const currentLevel = navigationManager.getCurrentLevel();
    
    console.log('[selectDropdownOption] 🎯 Navegación directa a:', option.id, '| Nivel actual:', currentLevel, '| Partes:', parts);
    
    if (isCountry) {
      // ===== NAVEGACIÓN DIRECTA A PAÍS =====
      const iso = option.id; // Para países, el ID es el ISO
      const featureName = option.name;
      
      console.log('[selectDropdownOption] 🎯 Navegación directa a país:', iso);
      
      // 1. Obtener feat de worldPolygons
      const feat = worldPolygons?.find(p => isoOf(p) === iso);
      if (!feat) {
        console.error('[selectDropdownOption] ❌ No se encontró el país en worldPolygons:', iso);
        return;
      }
      
      // 2. Obtener datos del país desde cache mundial (opcional)
      let countryRecord = null;
      
      // Si estamos en otro contexto, buscar en cache mundial
      if (worldLevelAnswers && worldLevelAnswers[iso]) {
        countryRecord = worldLevelAnswers[iso];
        console.log('[selectDropdownOption] ✅ Datos encontrados en cache mundial');
      } else if (answersData?.[iso]) {
        countryRecord = answersData[iso];
        console.log('[selectDropdownOption] ✅ Datos encontrados en answersData actual');
      } else {
        console.log('[selectDropdownOption] ℹ️ Sin datos, pero navegando igual:', iso);
      }
      
      // Limpiar etiquetas y polígonos (solo si NO viene de búsqueda directa, ya se limpió antes)
      if (!isDirectSearch) {
        subdivisionLabels = [];
        updateSubdivisionLabels(false);
        
        console.log('[selectDropdownOption] 🧹 Limpiando polígonos actuales...');
        globe?.setPolygonsData?.([]);
      }
      
      // 3. Actualizar datos (si existen)
      if (countryRecord) {
        const countryData = [countryRecord];
        countryChartSegments = generateCountryChartSegments(countryData);
        
        if (activePollOptions.length > 0) {
          updateVoteDataForLevel(countryRecord, 'Nivel 1 - País (dropdown directo)');
        }
      } else {
        // Sin datos, limpiar votos
        countryChartSegments = [];
        if (activePollOptions.length > 0) {
          activePollOptions.forEach((opt, index) => {
            opt.votes = 0;
          });
          voteOptions = [...activePollOptions];
        }
      }
      
      // 4. Calcular zoom y hacer transición
      const centroid = centroidOf(feat);
      const adaptiveAltitude = calculateAdaptiveZoom(feat);
      scheduleZoom(centroid.lat, centroid.lng, adaptiveAltitude, 500, 0);
      
      // 5. Cargar polígonos del país destino en paralelo
      setTimeout(async () => {
        try {
          console.log('[selectDropdownOption] 📦 Cargando polígonos de:', iso);
          const countryPolygons = await loadCountryTopoAsGeoFeatures(iso);
          console.log('[selectDropdownOption] ✅', countryPolygons.length, 'polígonos cargados');
          
          // Cargar en globo
          localPolygons = countryPolygons;
          globe?.setPolygonsData?.(countryPolygons);
          console.log('[selectDropdownOption] 🗺️ Polígonos cargados en globo');
          
          // Refresh visual
          setTimeout(() => {
            globe?.refreshPolyStrokes?.();
            globe?.refreshPolyAltitudes?.();
          }, 50);
          
          // Navegar con NavigationManager
          await navigationManager!.navigateToCountry(iso, featureName);
          
          // Actualizar colores
          await new Promise(resolve => requestAnimationFrame(resolve));
          await updateGlobeColors(true);
          
          console.log('[selectDropdownOption] ✅ Navegación directa a país completada');
        } catch (error) {
          console.error('[selectDropdownOption] ❌ Error en navegación directa:', error);
        }
      }, 100);
    } else {
      // NAVEGAR A SUBDIVISIÓN (sin importar nivel actual)
      // Detectar si es nivel 2 o nivel 3
      const countryIso = parts[0]; // "ESP"
      const isLevel3 = parts.length === 3; // "ESP.1.29" tiene 3 partes
      
      console.log('[selectDropdownOption] Navegando a subdivisión nivel', isLevel3 ? 3 : 2, 'ID:', option.id);
      
      if (isLevel3) {
        // NIVEL 3/4: Navegación DIRECTA sin pasos intermedios
        const parentSubdivisionId = `${parts[0]}.${parts[1]}`; // "ESP.1"
        const subdivisionFile = `${parts[0]}.${parts[1]}`; // Archivo "ESP.1"
        const countryIso = parts[0];
        
        console.log('[selectDropdownOption] 🎯 Navegación DIRECTA a nivel 3/4:', option.name, '(', option.id, ')');
        
        // 1. SIEMPRE limpiar polígonos actuales para evitar mezcla
        console.log('[selectDropdownOption] 🧹 Limpiando polígonos actuales...');
        localPolygons = [];
        globe?.setPolygonsData?.([]);
        subdivisionLabels = [];
        updateSubdivisionLabels(false);
        
        // Esperar un frame para que se complete la limpieza
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        try {
          // 1. Cargar polígonos de nivel 3 (provincias)
          const level3Polygons = await loadSubregionTopoAsGeoFeatures(countryIso, subdivisionFile);
          console.log('[selectDropdownOption] 📦 Nivel 3 cargados:', level3Polygons.length);
          
          // 2. Buscar el polígono objetivo (Málaga)
          let targetFeature = null;
          for (const poly of level3Polygons) {
            const props = poly?.properties || {};
            let id2 = props.ID_2 || props.id_2 || props.GID_2 || props.gid_2;
            const name2 = props.NAME_2 || props.name_2;
            
            // Limpiar IDs duplicados
            if (id2 && String(id2).includes('.')) {
              id2 = String(id2).split('.').pop();
            }
            
            const fullId = `${countryIso}.${parts[1]}.${id2}`;
            
            if (option.id === fullId || String(id2) === parts[2] || name2 === option.name) {
              targetFeature = poly;
              console.log('[selectDropdownOption] ✅ Encontrado:', name2, fullId);
              break;
            }
          }
          
          if (!targetFeature) {
            throw new Error('No se encontró el polígono de nivel 3');
          }
          
          // 3. Cargar polígonos de nivel 2 para obtener info del padre
          const level2Polygons = await loadSubregionTopoAsGeoFeatures(countryIso, countryIso);
          const parentFeature = level2Polygons.find(poly => {
            const props = poly?.properties || {};
            let id1 = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1;
            if (id1 && String(id1).includes('.')) {
              id1 = String(id1).split('.').pop();
            }
            return parentSubdivisionId === `${countryIso}.${id1}`;
          });
          
          if (!parentFeature) {
            throw new Error('No se encontró la subdivisión padre');
          }
          
          const parentName = parentFeature.properties?.NAME_1 || parentFeature.properties?.name_1 || option.name.split(',')[0] || 'Subdivision';
          const parentIdRaw = String(parentFeature.properties?.ID_1 || parentFeature.properties?.id_1 || parts[1]);
          const parentIdClean = parentIdRaw.split('.').pop() || parts[1];
          
          console.log('[selectDropdownOption] 📍 Padre:', parentName, '(', parentSubdivisionId, ')');
          
          // 4. Actualizar estado de navegación
          selectedCountryIso = countryIso;
          
          // 🔧 MEJORAR NOMBRE: Buscar el nombre completo del país desde worldPolygons
          const countryFeature = worldPolygons?.find(p => isoOf(p) === countryIso);
          if (countryFeature) {
            const props = countryFeature.properties || {};
            selectedCountryName = props.NAME_ENGL || props.CNTR_NAME || props.ADMIN || props.NAME || props.name || countryIso;
          } else {
            selectedCountryName = countryIso;
          }
          
          selectedSubdivisionId = parentSubdivisionId;
          selectedSubdivisionName = parentName;
          selectedCityName = option.name;
          selectedCityId = option.id;
          
          // 5. ✅ CARGAR DATOS DE LA API para nivel 3/4 (antes del zoom)
          console.log('[selectDropdownOption] 📡 Cargando datos de votos para nivel 3/4...');
          
          if (activePoll && activePoll.id) {
            // MODO ENCUESTA ESPECÍFICA
            try {
              const cleanSubdivisionId = parentIdClean;
              const response = await apiCall(`/api/polls/${activePoll.id}/votes-by-subsubdivisions?country=${countryIso}&subdivision=${cleanSubdivisionId}`);
              if (response.ok) {
                const { data } = await response.json();
                
                // Guardar TODOS los votos que pertenecen a esta subdivisión
                const fullSubdivisionId = `${countryIso}.${parentIdClean}`;
                const allLevelsData: Record<string, Record<string, number>> = {};
                for (const [subdivId, votes] of Object.entries(data)) {
                  if (subdivId === fullSubdivisionId || subdivId.startsWith(fullSubdivisionId + '.')) {
                    allLevelsData[subdivId] = votes as Record<string, number>;
                  }
                }
                
                answersData = allLevelsData;
                console.log('[selectDropdownOption] ✅ Datos cargados. IDs disponibles:', Object.keys(allLevelsData));
              }
            } catch (error) {
              console.error('[selectDropdownOption] ❌ Error cargando datos:', error);
            }
          } else if (!activePoll) {
            // MODO TRENDING
            console.log('[selectDropdownOption] ⚠️ Modo trending - datos deberían estar en answersData');
            console.log('[selectDropdownOption] 📊 answersData keys disponibles:', Object.keys(answersData || {}));
          }
          
          // 6. ⚡ PRIMERO: Establecer contexto de navegación (ANTES del zoom)
          console.log('[selectDropdownOption] 🧭 Estableciendo contexto de navegación...');
          
          // Si viene de búsqueda directa, necesitamos establecer contexto de país primero
          if (isDirectSearch) {
            console.log('[selectDropdownOption] 🔍 Búsqueda directa: navegando primero al país:', countryIso);
            // Solo actualizar estado interno, sin cargar polígonos (ya los tenemos)
            await navigationManager!.navigateToCountry(countryIso, selectedCountryName || countryIso, true, true);
          }
          
          console.log('[selectDropdownOption] 🧭 Navegando a subdivisión:', parentName);
          // skipHistoryPush = true para evitar doble entrada en historial
          // skipPolygonLoad = true cuando viene de búsqueda directa (ya los tenemos cargados)
          await navigationManager!.navigateToSubdivision(countryIso, parentIdClean, parentName, true, isDirectSearch);
          
          // 7. 📸 PRIMERO: Hacer zoom inmediato (mejor UX - usuario ve movimiento enseguida)
          const centroid = centroidOf(targetFeature);
          const targetAlt = Math.max(0.08, calculateAdaptiveZoomSubdivision(targetFeature));
          console.log('[selectDropdownOption] 📸 Haciendo zoom a nivel 3:', option.name);
          scheduleZoom(centroid.lat, centroid.lng, targetAlt, 500, 0);
          
          // 8. 🗺️ DURANTE EL ZOOM: Cargar polígonos con promesas (no setTimeout)
          // Esperar 100ms para que el zoom inicie
          await new Promise(resolve => setTimeout(resolve, 100));
          
          try {
            console.log('[selectDropdownOption] 🗺️ Cargando polígonos nivel 3 DURANTE el zoom...');
            console.log('[selectDropdownOption] 📦 level3Polygons a cargar:', level3Polygons.length);
            
            // Actualizar localPolygons
            localPolygons = level3Polygons;
            
            // Esperar un frame
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // Actualizar el globo con los nuevos polígonos
            if (globe && globe.setPolygonsData) {
              // Limpiar primero
              globe.setPolygonsData([]);
              await new Promise(resolve => requestAnimationFrame(resolve));
              
              // Cargar nuevos polígonos
              globe.setPolygonsData(level3Polygons);
              console.log('[selectDropdownOption] ✅ Globo actualizado con', level3Polygons.length, 'polígonos nivel 3');
              
              // CRÍTICO: Esperar 2 frames para que los polígonos se rendericen completamente
              await new Promise(resolve => requestAnimationFrame(resolve));
              await new Promise(resolve => requestAnimationFrame(resolve));
              
              // Forzar re-render
              globe?.refreshPolyStrokes?.();
              globe?.refreshPolyAltitudes?.();
              
              // DEBUG: Verificar datos antes de colorear
              console.log('[selectDropdownOption] 📊 DEBUG answersData:', Object.keys(answersData || {}).length, 'claves');
              console.log('[selectDropdownOption] 📊 ¿Tiene ESP.4.X?', Object.keys(answersData || {}).filter(k => k.startsWith('ESP.4')));
              
              // ⚡ CRÍTICO: Recalcular isoDominantKey con los nuevos polígonos
              const geoData = { type: 'FeatureCollection', features: level3Polygons };
              const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
              isoDominantKey = vm.isoDominantKey;
              console.log('[selectDropdownOption] 🔑 isoDominantKey recalculado:', Object.keys(isoDominantKey).length, 'claves');
              
              // Actualizar colores DESPUÉS de que los polígonos estén renderizados
              await updateGlobeColors(true);
              
              // Esperar otro frame antes del refresh de colores
              await new Promise(resolve => requestAnimationFrame(resolve));
              
              globe?.refreshPolyColors?.();
              console.log('[selectDropdownOption] 🎨 Colores aplicados para nivel 3');
            } else {
              console.error('[selectDropdownOption] ❌ Globe o setPolygonsData no disponible!');
            }
          } catch (error) {
            console.error('[selectDropdownOption] ❌ Error cargando polígonos:', error);
          }
          
          // 10. ✅ ACTUALIZAR VOTOS Y BARRA DE SEGMENTOS para nivel 4
          const cityId = option.id; // Usar el ID completo "ESP.1.29"
          console.log('[selectDropdownOption] 🔢 Actualizando datos para nivel 4:', option.id);
          
          // Construir posibles IDs para buscar en answersData
          let possibleIds: string[] = [cityId, option.id];
          if (!cityId.includes('.')) {
            possibleIds.push(`${parentSubdivisionId}.${cityId}`);
            possibleIds.push(`${countryIso}.${parts[1]}.${cityId}`);
          }
          
          // Buscar datos con cualquier ID posible
          let cityVoteData = null;
          let foundId = '';
          for (const id of possibleIds) {
            if (answersData?.[id]) {
              cityVoteData = answersData[id];
              foundId = id;
              break;
            }
          }
          
          if (cityVoteData) {
            console.log('[selectDropdownOption] ✅ Datos encontrados con ID:', foundId);
            
            // ✅ GENERAR BARRA DE SEGMENTOS con el ID correcto que funcionó
            cityChartSegments = [...generateCountryChartSegments([cityVoteData])];
            console.log('[selectDropdownOption] 📊 cityChartSegments generado:', cityChartSegments);
            
            // 🔧 USAR FUNCIÓN CENTRALIZADA
            updateVoteDataForLevel(cityVoteData, 'Nivel 4 - Ciudad (dropdown)');
          } else {
            console.log('[selectDropdownOption] ℹ️ Sin datos para nivel 3/4, limpiando votos');
            // Sin datos, limpiar votos
            cityChartSegments = [];
            if (activePollOptions.length > 0) {
              activePollOptions.forEach((opt, index) => {
                opt.votes = 0;
              });
              voteOptions = [...activePollOptions];
            }
          }
          
          console.log('[selectDropdownOption] ✅ Navegación nivel 3 completada:', option.name);
          
        } catch (error) {
          console.error('[selectDropdownOption] ❌ Error en navegación nivel 3:', error);
          
          // FALLBACK: Navegar al país
          const countryFeature = worldPolygons?.find(p => isoOf(p) === countryIso);
          if (countryFeature) {
            const countryName = countryFeature.properties?.NAME || countryIso;
            await navigationManager!.navigateToCountry(countryIso, countryName);
            console.log('[selectDropdownOption] 🔄 Fallback a país:', countryName);
          }
        }
        
      } else {
        // ===== NIVEL 2: Navegación DIRECTA a subdivisión =====
        const subdivisionId = option.id; // "ESP.1"
        const subdivisionName = option.name; // "Andalucía"
        
        console.log('[selectDropdownOption] 🎯 Navegación DIRECTA a nivel 2:', option.name, '(', option.id, ')');
        
        // 1. Buscar datos en cache mundial o answersData actual (opcional)
        const subdivisionKey = subdivisionId;
        let subdivisionRecord = null;
        
        if (worldLevelAnswers && worldLevelAnswers[subdivisionKey]) {
          subdivisionRecord = worldLevelAnswers[subdivisionKey];
          console.log('[selectDropdownOption] ✅ Datos encontrados en cache mundial');
        } else if (answersData?.[subdivisionKey]) {
          subdivisionRecord = answersData[subdivisionKey];
          console.log('[selectDropdownOption] ✅ Datos encontrados en answersData actual');
        } else {
          console.log('[selectDropdownOption] ℹ️ Sin datos, pero navegando igual:', subdivisionKey);
        }
        
        // 2. SIEMPRE limpiar polígonos actuales para evitar mezcla
        console.log('[selectDropdownOption] 🧹 Limpiando polígonos actuales...');
        localPolygons = [];
        globe?.setPolygonsData?.([]);
        subdivisionLabels = [];
        updateSubdivisionLabels(false);
        
        // Esperar un frame para que se complete la limpieza
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // 3. ELIMINADA toda la navegación intermedia al país
        // Ya NO navega al país primero, va directamente a la subdivisión
        
        // 4. Cargar polígonos del país directamente
        const countryIso = parts[0];
        console.log('[selectDropdownOption] 📦 Cargando polígonos de:', countryIso);
        
        const subdivisionPolygons = await loadSubregionTopoAsGeoFeatures(countryIso, countryIso);
        console.log('[selectDropdownOption] ✅', subdivisionPolygons.length, 'polígonos nivel 2 cargados');
        
        // 5. Buscar el feature de la subdivisión
        console.log('[selectDropdownOption] 🔍 Buscando subdivisión:', {
          optionId: option.id,
          parts,
          countryIso,
          searchingFor: parts[1]
        });
        
        const subdivisionFeature = subdivisionPolygons.find(poly => {
          const props = poly?.properties || {};
          let id1 = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1;
          if (id1 && String(id1).includes('.')) {
            id1 = String(id1).split('.').pop();
          }
          const fullId = `${countryIso}.${id1}`;
          const matches = option.id === fullId || String(id1) === parts[1];
          if (matches) {
            console.log('[selectDropdownOption] ✅ Match encontrado:', { id1, fullId, name: props.NAME_1 || props.name_1 });
          }
          return matches;
        });
        
        if (!subdivisionFeature) {
          console.log('[selectDropdownOption] ❌ No se encontró el feature de la subdivisión');
          console.log('[selectDropdownOption] 📊 IDs disponibles:', subdivisionPolygons.slice(0, 5).map(p => {
            const props = p?.properties || {};
            let id1 = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1;
            if (id1 && String(id1).includes('.')) {
              id1 = String(id1).split('.').pop();
            }
            return { id: id1, name: props.NAME_1 || props.name_1 };
          }));
          return;
        }
        
        // 6. Actualizar datos y votos (si existen)
        selectedCountryIso = countryIso;
        // Actualizar el nombre del país desde worldPolygons
        const countryFeature = worldPolygons?.find(p => isoOf(p) === countryIso);
        if (countryFeature) {
          const props = countryFeature.properties || {};
          selectedCountryName = props.NAME_ENGL || props.CNTR_NAME || props.ADMIN || props.NAME || props.name || countryIso;
        } else {
          selectedCountryName = countryIso;
        }
        selectedSubdivisionId = subdivisionKey;
        selectedSubdivisionName = subdivisionName;
        
        if (subdivisionRecord) {
          subdivisionChartSegments = generateCountryChartSegments([subdivisionRecord]);
          
          if (activePollOptions.length > 0) {
            updateVoteDataForLevel(subdivisionRecord, 'Nivel 2 - Subdivisión (dropdown directo)');
          }
        } else {
          // Sin datos, limpiar votos
          subdivisionChartSegments = [];
          if (activePollOptions.length > 0) {
            activePollOptions.forEach((opt, index) => {
              opt.votes = 0;
            });
            voteOptions = [...activePollOptions];
          }
        }
        
        // 7. Navegación con NavigationManager (ANTES del zoom)
        console.log('[selectDropdownOption] 🧭 Navegando con NavigationManager...');
        
        // Verificar si tiene subdivisiones (nivel 3)
        const hasSubdivisions = await (async () => {
          try {
            const resp = await fetch(getCountryPath(countryIso, subdivisionId), { method: 'HEAD' });
            return resp.ok;
          } catch {
            return false;
          }
        })();
        
        console.log('[selectDropdownOption] 📂 hasSubdivisions:', hasSubdivisions);
        
        if (hasSubdivisions) {
          // Navegar a subdivisión
          console.log('[selectDropdownOption] ➡️ Navegando a subdivisión:', subdivisionName);
          
          // SIEMPRE establecer contexto de país primero para navegación correcta
          // selectedCountryName ya fue actualizado en el paso 6
          console.log('[selectDropdownOption] 🌍 Navegando primero al país:', countryIso, selectedCountryName);
          let countryNameFallback = selectedCountryName;
          if (!countryNameFallback) {
            const cf = worldPolygons?.find(p => isoOf(p) === countryIso);
            if (cf) {
              const props = cf.properties || {};
              countryNameFallback = props.NAME_ENGL || props.CNTR_NAME || props.ADMIN || props.NAME || props.name || countryIso;
            } else {
              countryNameFallback = countryIso;
            }
          }
          await navigationManager!.navigateToCountry(countryIso, countryNameFallback, true, true);
          
          // Luego navegar a la subdivisión
          // skipPolygonLoad = true cuando viene de búsqueda directa
          await navigationManager!.navigateToSubdivision(countryIso, subdivisionId, subdivisionName, true, isDirectSearch);
        } else {
          // Solo navegar al país y activar polígono centrado
          // selectedCountryName ya fue actualizado en el paso 6
          console.log('[selectDropdownOption] ➡️ Navegando a país (sin subdivisiones):', countryIso, selectedCountryName);
          let countryNameFallback = selectedCountryName;
          if (!countryNameFallback) {
            const cf = worldPolygons?.find(p => isoOf(p) === countryIso);
            if (cf) {
              const props = cf.properties || {};
              countryNameFallback = props.NAME_ENGL || props.CNTR_NAME || props.ADMIN || props.NAME || props.name || countryIso;
            } else {
              countryNameFallback = countryIso;
            }
          }
          await navigationManager!.navigateToCountry(countryIso, countryNameFallback, true);
          centerPolygon = subdivisionFeature;
          centerPolygonId = subdivisionKey;
          isCenterPolygonActive = true;
        }
        
        // 8. 📸 PRIMERO: Hacer zoom inmediato (mejor UX)
        const centroid = centroidOf(subdivisionFeature);
        const adaptiveAltitude = calculateAdaptiveZoomSubdivision(subdivisionFeature);
        const targetAlt = Math.max(0.12, adaptiveAltitude);
        console.log('[selectDropdownOption] 📸 Haciendo zoom a:', option.name);
        scheduleZoom(centroid.lat, centroid.lng, targetAlt, 500, 0);
        
        // 9. 🗺️ DURANTE EL ZOOM: Cargar polígonos con promesas (no setTimeout)
        // Esperar 100ms para que el zoom inicie
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          // Determinar qué polígonos cargar según si tiene subdivisiones
          let polygonsToLoad = subdivisionPolygons;
          
          if (hasSubdivisions) {
            // TIENE SUBDIVISIONES (ej: Andalucía tiene provincias)
            // Cargar polígonos de nivel 3
            console.log('[selectDropdownOption] 🗺️ Cargando polígonos nivel 3 (subdivisión con subdivisiones)...');
            try {
              const level3Polygons = await loadSubregionTopoAsGeoFeatures(countryIso, subdivisionId);
              if (level3Polygons && level3Polygons.length > 0) {
                polygonsToLoad = level3Polygons;
                console.log('[selectDropdownOption] ✅', level3Polygons.length, 'polígonos nivel 3 cargados');
              } else {
                console.log('[selectDropdownOption] ⚠️ No hay polígonos nivel 3, usando nivel 2');
              }
            } catch (error) {
              console.warn('[selectDropdownOption] ⚠️ Error cargando nivel 3, usando nivel 2:', error);
            }
          } else {
            // NO TIENE SUBDIVISIONES
            // Usar solo los polígonos de nivel 2
            console.log('[selectDropdownOption] 🗺️ Cargando polígonos nivel 2 DURANTE el zoom...');
          }
          
          // Actualizar localPolygons
          localPolygons = polygonsToLoad;
          
          // Esperar un frame
          await new Promise(resolve => requestAnimationFrame(resolve));
          
          // Actualizar el globo
          if (globe && globe.setPolygonsData) {
            // Limpiar primero
            globe.setPolygonsData([]);
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // Cargar nuevos polígonos
            globe.setPolygonsData(polygonsToLoad);
            console.log('[selectDropdownOption] ✅ Globo actualizado con', polygonsToLoad.length, 'polígonos');
            
            // CRÍTICO: Esperar 2 frames para que los polígonos se rendericen completamente
            await new Promise(resolve => requestAnimationFrame(resolve));
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // Forzar re-render
            globe?.refreshPolyStrokes?.();
            globe?.refreshPolyAltitudes?.();
            
            // ⚡ CRÍTICO: Recalcular isoDominantKey con los nuevos polígonos
            const geoData = { type: 'FeatureCollection', features: polygonsToLoad };
            const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
            isoDominantKey = vm.isoDominantKey;
            console.log('[selectDropdownOption] 🔑 isoDominantKey recalculado:', Object.keys(isoDominantKey).length, 'claves');
            
            // Actualizar colores DESPUÉS de que los polígonos estén renderizados
            await updateGlobeColors(true);
            
            // Esperar otro frame antes del refresh de colores
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            globe?.refreshPolyColors?.();
            console.log('[selectDropdownOption] 🎨 Colores aplicados para nivel 2');
            
            // Activar centro si aplica
            if (centerPolygonId) {
              addCenterPolygonLabel();
            }
          } else {
            console.error('[selectDropdownOption] ❌ Globe o setPolygonsData no disponible!');
          }
        } catch (error) {
          console.error('[selectDropdownOption] ❌ Error cargando polígonos nivel 2:', error);
        }
        
        // ✅ Código simplificado - navegación DIRECTA implementada arriba
      }
    }
  }

  // Find first available subdivision for a country
  async function findFirstAvailableSubdivision(iso: string): Promise<string | null> {
    // Try common subdivision patterns
    const patterns = [`${iso}.1`, `${iso}.01`, `${iso}.001`];
    
    for (const pattern of patterns) {
      try {
        const path = getCountryPath(iso, pattern);
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
  
  // SIEMPRE mostrar solo etiquetas de polígonos con datos
  // Comportamiento fijo: no mostrar etiquetas de polígonos sin datos
  const ALWAYS_SHOW_ONLY_ACTIVE = true;
  
  // Watcher reactivo: cuando termina el zoom, actualizar etiquetas
  $: if (!isZooming && pendingLabelUpdate) {
    const pov = pendingLabelUpdate;
    pendingLabelUpdate = null;
    // Usar requestAnimationFrame para sincronizar con el navegador
    requestAnimationFrame(() => {
      updateLabelsForCurrentView(pov);
    });
  }
  
  // Watcher reactivo optimizado: actualizar etiquetas cuando answersData cambia
  let lastAnswersDataLength = 0;
  $: {
    const currentLength = Object.keys(answersData || {}).length;
    if (currentLength > 0 && currentLength !== lastAnswersDataLength && globe && !isZooming) {
      lastAnswersDataLength = currentLength;
      requestAnimationFrame(() => {
        const pov = globe?.pointOfView();
        if (pov) updateLabelsForCurrentView(pov, true);
      });
    }
  }
  
  async function updateLabelsForCurrentView(pov: { lat: number; lng: number; altitude: number }, forceImmediate: boolean = false) {
    // SISTEMA SIMPLIFICADO: Solo el sistema de polígono centrado
    // No hay etiquetas automáticas, solo la etiqueta del polígono en el centro
    // Las etiquetas se manejan completamente en autoSelectCenterPolygon
    return;
  }

  // ELIMINADO: removeOverlappingLabels ya no es necesario
  // Con el sistema LOD simplificado, solo mostramos etiquetas de polígonos con datos activos
  
  async function generateWorldCountryLabels(altitude: number) {
    // En nivel mundial NO debe haber polígono centrado activo, pero por si acaso
    console.log('[Labels] Generando etiquetas de países mundiales...');
    
    try {
      if (!worldPolygons?.length) return;
      
      // NO usar cache - necesitamos recalcular según altitud para LOD dinámico
      
      // Generate labels for world countries - MOSTRAR TODOS LOS PAÍSES
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
          size: 9,
          color: '#ffffff',
          opacity: 0.9,
          feature: feat
        };
      }).filter(label => label.text);
      
      console.log('[Labels] Total países con nombre:', allLabels.length);
      
      // MOSTRAR TODOS los países, no filtrar por datos
      subdivisionLabels = allLabels;
      
      console.log('[Labels] Etiquetas mundiales asignadas:', subdivisionLabels.length);
      updateSubdivisionLabels(true);
      console.log('[Labels] updateSubdivisionLabels(true) ejecutado');
      
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
      
      // Obtener el feature del país desde worldPolygons
      const countryFeature = worldPolygons?.find(p => isoOf(p) === state.countryIso);
      
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
        opacity: 1.0,
        _isCenterLabel: true,
        feature: countryFeature // IMPORTANTE: Incluir el feature para que el click funcione
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
      
      // Obtener el feature de la subdivisión desde el cache de polígonos
      const subdivisionPolygons = navigationManager?.['polygonCache']?.get(subdivisionKey);
      let subdivisionFeature = null;
      
      if (!centroid) {
        // Si no tenemos el centroide en cache, intentar calcularlo desde los polígonos
        if (subdivisionPolygons?.length) {
          const calculatedCentroid = centroidOf(subdivisionPolygons[0]);
          subregionCentroidCache.set(subdivisionKey, calculatedCentroid);
          subdivisionFeature = subdivisionPolygons[0];
        } else {
          return;
        }
      } else if (subdivisionPolygons?.length) {
        subdivisionFeature = subdivisionPolygons[0];
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
        opacity: 1.0,
        _isCenterLabel: true,
        feature: subdivisionFeature // IMPORTANTE: Incluir el feature para que el click funcione
      }];
      
      subdivisionLabels = labels;
      updateSubdivisionLabels(true);
      
          } catch (e) {
      console.warn('[Labels] Error generating subdivision name label:', e);
    }
  }

  async function generateCountrySubdivisionLabels(iso: string, pov: { lat: number; lng: number; altitude: number }) {
    console.log('[Labels] Generando etiquetas de subdivisiones para país:', iso);
    
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
        
        // SOLO mostrar si hay subdivisiones con datos
        if (allLabels.length > 0) {
          subdivisionLabels = allLabels;
          updateSubdivisionLabels(true);
        } else {
          console.log('[Labels] No hay subdivisiones con datos para mostrar etiquetas');
        }
      } else {
        console.log('[Labels] No hay polígonos de subdivisión cargados');
      }
    } catch (e) {
      console.warn('[Labels] Error generating country subdivision labels:', e);
    }
  }

  async function generateSubSubdivisionLabels(countryIso: string, subdivisionId: string, pov: { lat: number; lng: number; altitude: number }) {
    console.log('[Labels] Generando etiquetas de sub-subdivisiones para:', countryIso, subdivisionId);
    
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
        const path = getCountryPath(countryIso, subdivisionFile);
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
            
            // FALLBACK: Si no hay sub-subdivisiones con datos, mostrar el nombre de la subdivisión
            if (allLabels.length === 0) {
              await generateSubdivisionNameLabel();
            } else {
              subdivisionLabels = allLabels;
              updateSubdivisionLabels(true);
            }
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


  
  // ========================================
  // FASE 3: NAVEGACIÓN - Migrado a Store
  // ========================================
  // Bottom sheet (tipo Google Maps) - Ahora usa globalNavigationState
  // Mantener variables locales para compatibilidad, pero sincronizar con store
  let selectedCountryName: string | null = null;
  let selectedCountryIso: string | null = null;
  let selectedSubdivisionName: string | null = null;
  let selectedSubdivisionId: string | null = null;
  let selectedCityName: string | null = null;
  let selectedCityId: string | null = null;
  
  // Sincronizar estado local con store
  $: {
    const nav = $globalNavigationState;
    selectedCountryIso = nav.countryIso;
    selectedCountryName = nav.countryName;
    selectedSubdivisionId = nav.subdivisionId;
    selectedSubdivisionName = nav.subdivisionName;
    selectedCityName = nav.cityName;
  }
  
  // Sistema de detección de polígono centrado al arrastrar
  let centerPolygon: any | null = null; // Polígono actualmente centrado
  let centerPolygonId: string | null = null; // ID del polígono centrado para resaltado
  let isCenterPolygonActive = false; // Si el sistema de polígono centrado está activo
  
  let SHEET_STATE: SheetState = 'peek'; // Mostrar información mundial por defecto
  
  // ========================================
  // FASE 3: ENCUESTA ACTIVA - Migrado a Store
  // ========================================
  // CONTEXTO DE ENCUESTA ACTIVA
  // MODO EXCLUSIVO: El globo trabaja en modo trending O en modo encuesta específica (NUNCA ambos)
  // Usar stores centralizados pero mantener variables locales para compatibilidad gradual
  $: activePoll = $globalActivePoll;
  let activePollOptions: Array<{ key: string; label: string; color: string; votes: number; pollData?: any }> = [];
  
  // Watcher para detectar cambios inesperados en activePoll y loggear el modo actual
  let lastActivePollId: string | number | null = null;
  $: {
    const currentId: string | number | null = activePoll?.id || null;
    if (currentId !== lastActivePollId) {
      
      lastActivePollId = currentId;
    }
  }
  
  // Función para cerrar la encuesta activa y volver a modo trending
  async function closePoll() {
    // HISTORY API: Volver a modo trending (solo si no viene de popstate)
    if (!isNavigatingFromHistory) {
      const historyState = {
        level: 'world',
        pollMode: 'trending',
        timestamp: Date.now()
      };
      history.pushState(historyState, '', '/');
      console.log('[History] 🔄 Volviendo a modo trending');
    }
    
    // FASE 3: Limpiar contexto de encuesta usando store
    globalActivePoll.close();
    activePollOptions = [];
    
    // Limpiar caches de datos por nivel usando stores
    globalAnswersData.set({});
    globalColorMap.set({});
    worldLevelAnswers = {};
    countryLevelAnswers = {};
    subdivisionLevelAnswers = {};
    worldLevelColorMap = {};
    countryLevelColorMap = {};
    subdivisionLevelColorMap = {};
    
    // Limpiar datos y colores
    isoDominantKey = {};
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
      await navigationManager!.navigateToWorld();
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
    console.log('[loadTrendingData] 🚀 Iniciando carga de datos...');
    console.log('[loadTrendingData] Tab activo:', activeTopTab);
    console.log('[loadTrendingData] Usuario:', userData?.username, 'ID:', userData?.id);
    
    try {
      // Determinar qué API usar según el tab activo
      let apiUrl = '/api/polls/trending-by-region?region=Global&limit=20';
      
      if (activeTopTab === 'Para ti' && userData?.id) {
        // Si está en "Para ti" y hay usuario logueado, usar API personalizada
        apiUrl = `/api/polls/for-you?userId=${userData.id}&limit=20`;
        console.log('[loadTrendingData] 🎯 Cargando recomendaciones personalizadas para usuario:', userData.username);
      } else if (activeTopTab === 'Para ti' && !userData) {
        // Si está en "Para ti" pero no hay usuario, mostrar mensaje
        console.log('[loadTrendingData] ℹ️ "Para ti" requiere usuario autenticado. Mostrando trending...');
        // Usar trending como fallback
      } else {
        console.log('[loadTrendingData] 🌍 Cargando encuestas trending globales');
      }
      
      console.log('[loadTrendingData] 📡 Llamando a API:', apiUrl);
      
      // Cargar encuestas desde la API correspondiente usando cliente seguro
      try {
        const { data: trendingPolls } = await apiGet(apiUrl);
        console.log('[loadTrendingData] ✅ Respuesta recibida:', trendingPolls?.length, 'encuestas');
        await processTrendingPolls(trendingPolls);
        return;
      } catch (error: any) {
        console.error('[GlobeGL] ❌ Error en API:', error.message);
        
        // Si falla "Para ti", hacer fallback automático a trending
        if (activeTopTab === 'Para ti') {
          console.log('[GlobeGL] 🔄 Fallback automático: usando Tendencias');
          try {
            const fallbackData = await apiGet('/api/polls/trending-by-region?region=Global&limit=20');
            const { data: trendingPolls } = fallbackData;
            await processTrendingPolls(trendingPolls);
            return;
          } catch (fallbackError) {
            console.error('[GlobeGL] ❌ Fallback también falló:', fallbackError);
            return;
          }
        }
        return;
      }
    } catch (error) {
      console.error('[GlobeGL] ❌ Error cargando datos:', error);
    }
  }
  
  // Función auxiliar para procesar las encuestas trending
  async function processTrendingPolls(trendingPolls: any[]) {
    console.log('[processTrendingPolls] 🔄 Procesando', trendingPolls?.length, 'encuestas');
    try {
            
      // MODO TRENDING: Cada encuesta es una "opción"
      // Los países se pintan según qué encuesta tiene más votos totales
      const aggregatedData: Record<string, Record<string, number>> = {};
      const aggregatedColors: Record<string, string> = {};
      
      // Asignar un color a cada encuesta
      const pollColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'];
      
      // Crear activePollOptions con las encuestas trending como opciones
      activePollOptions = [];
      
      // *** CARGA PARALELA con pintado progresivo ***
      // Lanzar todas las llamadas API en paralelo, pero pintar a medida que cada una termina
      let completedCount = 0;
      
      const pollDataPromises = trendingPolls.map(async (poll, i) => {
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
        
        // Cargar datos de votos por país usando PollDataService
        try {
          const pollData = await pollDataService.loadVotesByCountry(poll.id);
          
          // Sumar TODOS los votos de esta encuesta por país
          for (const [countryIso, votes] of Object.entries(pollData)) {
            if (!aggregatedData[countryIso]) {
              aggregatedData[countryIso] = {};
            }
            
            const totalVotes = Object.values(votes).reduce((sum, count) => sum + (count as number), 0);
            aggregatedData[countryIso][pollKey] = totalVotes;
          }
          
          // *** ACTUALIZACIÓN PROGRESIVA: Pintar inmediatamente después de que esta encuesta termine ***
          completedCount++;
          
          // Actualizar datos globales progresivamente
          answersData = { ...aggregatedData };
          colorMap = { ...aggregatedColors };
          
          // Esperar a que worldPolygons esté disponible
          if (worldPolygons && worldPolygons.length > 0) {
            // Recalcular y repintar colores progresivamente
            const geoData = { type: 'FeatureCollection', features: worldPolygons };
            const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
            isoDominantKey = vm.isoDominantKey;
            // *** USAR TOTALES AGREGADOS: Sumar todos los votos de todos los subniveles ***
            const aggregatedLegend = calculateAggregatedLegendItems('world', null);
            legendItems = aggregatedLegend.length > 0 ? aggregatedLegend : vm.legendItems;
            isoIntensity = vm.isoIntensity;
            
            // Forzar repintado inmediato
            globe?.refreshPolyColors?.();
            console.log(`[processTrendingPolls] 🎨 Pintado progresivo nivel 1: ${completedCount}/${trendingPolls.length} encuestas completadas`);
          }
        } catch (error) {
          console.warn('[processTrendingPolls] Error loading poll data:', error);
        }
      });
      
      // Esperar a que todas las encuestas terminen
      await Promise.all(pollDataPromises);
      
      // Actualizar votos totales en activePollOptions
      activePollOptions = activePollOptions.map(option => {
        const totalVotesForPoll = Object.values(aggregatedData).reduce((sum, countryData) => {
          return sum + (countryData[option.key] || 0);
        }, 0);
        return { ...option, votes: totalVotesForPoll };
      });
      
      // Si no hay datos reales, NO generar fallback MOCK
      // El globo debe mostrar gris cuando no hay votos
      if (Object.keys(aggregatedData).length === 0) {
        console.log('[processTrendingPolls] ⚠️ No hay votos reales - mostrando globo sin datos');
        // NO generar datos MOCK - dejar aggregatedData vacío
        // activePollOptions ya tiene las encuestas pero sin votos
      }
      
      // Actualizar datos globales
      console.log('[processTrendingPolls] 📊 Actualizando datos globales...');
      console.log('[processTrendingPolls] Países con datos:', Object.keys(aggregatedData).length);
      console.log('[processTrendingPolls] Encuestas activas:', activePollOptions?.length);
      
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
      // *** USAR TOTALES AGREGADOS: Sumar todos los votos de todos los subniveles ***
      const aggregatedLegend = calculateAggregatedLegendItems('world', null);
      legendItems = aggregatedLegend.length > 0 ? aggregatedLegend : vm.legendItems;
      isoIntensity = vm.isoIntensity;
      intensityMin = vm.intensityMin;
      intensityMax = vm.intensityMax;
      
      // Refrescar colores del globo
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // IMPORTANTE: Solo actualizar polígonos mundiales si estamos en nivel mundial
      // Si estamos en país/subdivisión, NO sobrescribir con polígonos mundiales
      const currentLevel = navigationManager?.getCurrentLevel();
      if (currentLevel === 'world' && globe?.setPolygonsData) {
        console.log('[processTrendingPolls] 🗺️ Actualizando polígonos mundiales (nivel: world)');
        globe.setPolygonsData(worldPolygons);
      } else {
        console.log('[processTrendingPolls] ⏭️ Saltando actualización de polígonos (nivel:', currentLevel, ')');
      }
      
      await updateGlobeColors();
      globe?.refreshPolyColors?.();
      
      console.log('[processTrendingPolls] ✅ Colores actualizados en el globo');
      
    } catch (error) {
      // Error crítico cargando trending
      console.error('[processTrendingPolls] ❌ Error loading trending:', error);
    }
  }
  
  // SISTEMA DE CONTROL DE ZOOM CENTRALIZADO
  // Evita múltiples llamadas simultáneas a pointOfView que causan parpadeos
  let pendingZoom: { lat: number; lng: number; altitude: number; duration: number } | null = null;
  let zoomTimeout: ReturnType<typeof setTimeout> | null = null;
  let isZooming = false;
  let labelClickInProgress = false; // Bloquea globeClick después de labelClick
  let isProgrammaticZoom = false; // Flag para indicar que el zoom es programático (no manual del usuario)
  let programmaticZoomTimeout: any = null;
  
  function scheduleZoom(lat: number, lng: number, altitude: number, duration: number = 700, delay: number = 0) {
    // Cancelar cualquier zoom pendiente
    if (zoomTimeout) {
      clearTimeout(zoomTimeout);
      zoomTimeout = null;
    }
    
    // CRÍTICO: Marcar como zooming INMEDIATAMENTE para bloquear etiquetas
    isZooming = true;
    
    // Marcar como zoom programático para ignorar detección de zoom out
    isProgrammaticZoom = true;
    
    // Limpiar timeout anterior si existe
    if (programmaticZoomTimeout) {
      clearTimeout(programmaticZoomTimeout);
    }
    
    // Si ya hay un zoom en progreso, esperar a que termine
    if (delay === 0 && pendingZoom) {
      delay = 100;
    }
    
    pendingZoom = { lat, lng, altitude, duration };
    
        
    zoomTimeout = setTimeout(() => {
      if (pendingZoom && globe) {
                globe.pointOfView(pendingZoom, pendingZoom.duration);
        
        // Marcar como completado ANTES de que termine la animación para que las etiquetas aparezcan durante la transición
        // Adelantar 50% de la duración para que aparezcan a mitad de la transición
        const labelUpdateDelay = Math.max(100, Math.floor(pendingZoom.duration * 0.5));
        setTimeout(() => {
          isZooming = false;
          pendingZoom = null;
          
          // IMPORTANTE: Forzar actualización INMEDIATA de etiquetas cuando termine el zoom
          const pov = globe?.pointOfView();
          if (pov) {
            // Usar forceImmediate=true para saltarse el throttle y el bloqueo de isZooming
            requestAnimationFrame(() => {
              updateLabelsForCurrentView(pov, true);
            });
          }
        }, labelUpdateDelay); // Mostrar etiquetas a mitad de la transición
        
        // Desactivar flag de zoom programático después de que termine la animación
        // Usar la misma duración que isZooming para liberar el control al usuario más rápido
        // Añadir solo 150ms extra (suficiente para evitar falsos positivos)
        programmaticZoomTimeout = setTimeout(() => {
          isProgrammaticZoom = false;
          console.log('[Zoom] ✅ Zoom programático completado, detector de zoom out reactivado');
        }, pendingZoom.duration + 150);
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
  let voteOptionsUpdateTrigger = 0; // ⚡ Trigger para forzar actualización
  
  // Opciones de votación: SEPARAR CLARAMENTE trending vs encuesta específica
  $: {
    // Dependencia en trigger para forzar reactividad
    voteOptionsUpdateTrigger;
    
    if (activePoll && activePoll.id) {
      // MODO ENCUESTA ESPECÍFICA: Usar activePollOptions (opciones de votación de la encuesta)
      voteOptions = activePollOptions.length > 0 ? activePollOptions : [];
    } else {
      // MODO TRENDING: Usar activePollOptions (encuestas trending como opciones)
      // Si no hay activePollOptions, usar fallback
      voteOptions = activePollOptions.length > 0 ? activePollOptions : [
  
      ];
    }
  }
  
  // NOTA: Votación se maneja completamente en BottomSheet.svelte
  // No hay funciones de voto aquí - solo visualización del globo
  
  // Función pública exportable para abrir una encuesta programáticamente
  export function openPollInGlobe(poll: any, options?: Array<{ key: string; label: string; color: string; votes: number }>) {
    console.log('[GlobeGL] 🌍 openPollInGlobe llamado directamente:', { poll, options });
    const formattedOptions = options || poll.options?.map((opt: any) => ({
      key: opt.key || opt.optionKey,
      label: opt.label || opt.optionLabel,
      color: opt.color || '#10b981',
      votes: opt.votes || opt.voteCount || 0
    })) || [];
    
    handleOpenPollInGlobe({
      detail: { poll, options: formattedOptions }
    } as CustomEvent);
  }
  
  // Función para abrir una encuesta en el globo con sus opciones visualizadas
  async function handleOpenPollInGlobe(event: CustomEvent<{ poll: any; options: Array<{ id?: number; key: string; label: string; color: string; votes: number }> }>) {
    const { poll, options } = event.detail;
    
    // IMPORTANTE: Colapsar el BottomSheet inmediatamente para ver mejor el globo
    SHEET_STATE = 'collapsed';
    setSheetState('collapsed');
    
    // CRÍTICO: Esperar un tick antes de iniciar zoom para que el BottomSheet termine su transición
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // CRÍTICO: Iniciar zoom inmediatamente para que se ejecute en paralelo con la carga de datos
    scheduleZoom(20, 0, 2.5, 1000, 100);
    
    console.log('[HandleOpenPoll] 🔵 Llamada recibida:', {
      pollId: poll?.id || 'null',
      currentActivePoll: activePoll?.id || 'none',
      optionsCount: options.length,
      modoActual: activePoll ? 'ENCUESTA_ESPECÍFICA' : 'TRENDING',
      fromHistory: isNavigatingFromHistory
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
    
    // Si es la misma encuesta Y NO viene del historial, no hacer nada
    if (activePoll && activePoll.id === poll.id && !isNavigatingFromHistory) {
      console.log('[HandleOpenPoll] ⏭️ Misma encuesta ya abierta, saltando');
      return;
    }
    
    // Si viene del historial con la misma encuesta, forzar recarga
    if (activePoll && activePoll.id === poll.id && isNavigatingFromHistory) {
      console.log('[HandleOpenPoll] 🔄 Recargando encuesta desde historial:', poll.id);
      // Continuar con la recarga completa
    }
    
    // Si hay una encuesta diferente abierta, cerrarla primero
    if (activePoll && activePoll.id !== poll.id) {
      console.log('[HandleOpenPoll] 🔄 Cerrando encuesta anterior:', activePoll.id, '→ nueva:', poll.id);
      await closePoll();
    }
    
            
    // GUARDAR CONTEXTO DE ENCUESTA ACTIVA (MODO EXCLUSIVO)
    console.log('[HandleOpenPoll] 📋 MODO ENCUESTA ESPECÍFICA ACTIVADO');
    console.log('[HandleOpenPoll] Encuesta:', poll.id, '| Opciones:', options.length);
    
    // CARGAR DATOS COMPLETOS DE LA ENCUESTA DESDE LA API para obtener votos reales
    let pollDataFromApi = poll;
    try {
      const response = await apiCall(`/api/polls/${poll.id}`);
      if (response.ok) {
        const result = await response.json();
        pollDataFromApi = result.data || result;
        console.log('[HandleOpenPoll] ✅ Datos de encuesta cargados desde API:', pollDataFromApi.id);
      }
    } catch (error) {
      console.warn('[HandleOpenPoll] ⚠️ No se pudieron cargar datos de la API, usando datos iniciales');
    }
    
    // Calcular totales de votos
    const totalVotes = pollDataFromApi.options?.reduce((sum: number, opt: any) => 
      sum + (opt.votes || opt._count?.votes || 0), 0
    ) || 0;
    
    console.log('[HandleOpenPoll] 📊 Total de votos:', totalVotes);
    
    // CRÍTICO: Asegurar que poll.options también está formateado correctamente
    const formattedPoll = {
      ...pollDataFromApi,
      options: options.map((opt, idx) => {
        const apiOption = pollDataFromApi.options?.[idx];
        const votes = apiOption?.votes || apiOption?._count?.votes || opt.votes || 0;
        const pct = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
        
        return {
          ...opt,
          id: opt.id || apiOption?.id,
          key: opt.key || apiOption?.optionKey || `opt-${idx}`,
          label: opt.label || apiOption?.optionLabel || apiOption?.optionText || `Opción ${idx + 1}`,
          color: opt.color || ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'][idx % 4],
          votes: votes,
          pct: pct
        };
      })
    };
    
    console.log('[HandleOpenPoll] 📊 Opciones formateadas:', formattedPoll.options.map((o: any) => 
      ({ label: o.label, votes: o.votes, pct: Math.round(o.pct) })
    ));
    
    // FASE 3: Usar store para abrir encuesta
    globalActivePoll.open(formattedPoll);
    activePollOptions = formattedPoll.options;
    
    // HISTORY API: Guardar estado de encuesta en el historial
    if (!isNavigatingFromHistory) {
      const historyState = {
        level: 'world',
        pollId: poll.id,
        pollMode: 'specific',
        timestamp: Date.now()
      };
      const url = `/?poll=${encodeURIComponent(poll.id)}`;
      history.pushState(historyState, '', url);
      console.log('[History] 📊 Abriendo encuesta:', poll.id, url);
    }
    
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
      // Cargar votos usando PollDataService
      const data = await pollDataService.loadVotesByCountry(poll.id);
      
      // *** PROCESAMIENTO PROGRESIVO: Pintar a medida que procesamos cada país ***
      const countries = Object.entries(data);
      const batchSize = 10; // Procesar 10 países a la vez
      
      for (let i = 0; i < countries.length; i += batchSize) {
        const batch = countries.slice(i, i + batchSize);
        
        // Agregar países del batch a answersData
        for (const [countryIso, votes] of batch) {
          newAnswersData[countryIso] = votes as Record<string, number>;
        }
        
        // Actualizar datos globales progresivamente
        answersData = { ...newAnswersData };
        
        // Esperar a que worldPolygons esté disponible
        if (worldPolygons && worldPolygons.length > 0) {
          // Recalcular y repintar colores progresivamente
          const geoData = { type: 'FeatureCollection', features: worldPolygons };
          const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
          isoDominantKey = vm.isoDominantKey;
          // *** USAR TOTALES AGREGADOS: Sumar todos los votos de todos los subniveles ***
          const aggregatedLegend = calculateAggregatedLegendItems('world', null);
          legendItems = aggregatedLegend.length > 0 ? aggregatedLegend : vm.legendItems;
          isoIntensity = vm.isoIntensity;
          
          // Forzar repintado inmediato
          globe?.refreshPolyColors?.();
          console.log(`[HandleOpenPoll] 🎨 Pintado progresivo nivel 1: ${Math.min(i + batchSize, countries.length)}/${countries.length} países procesados`);
        }
      }
    } catch (error) {
      // Si falla la carga de datos, continuar
    }
    
    // Guardar en cache mundial
    worldLevelAnswers = newAnswersData;
    answersData = newAnswersData;
    
    console.log('[OpenPoll] 📊 Encuesta abierta:', poll.id, '| Países con datos:', Object.keys(newAnswersData).length);
    
    // IMPORTANTE: Navegar a vista mundial para mostrar los colores de la encuesta
    if (navigationManager) {
      await navigationManager!.navigateToWorld();
      await tick();
    }
    
    // Recalcular intensidades y colores dominantes basados en los datos de la encuesta activa
    const geoData = { type: 'FeatureCollection', features: worldPolygons || [] };
    const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
    isoDominantKey = vm.isoDominantKey;
    // *** USAR TOTALES AGREGADOS: Sumar todos los votos de todos los subniveles ***
    const aggregatedLegend = calculateAggregatedLegendItems('world', null);
    legendItems = aggregatedLegend.length > 0 ? aggregatedLegend : vm.legendItems;
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
    
    // Si viene del historial, forzar refresh completo del globo
    if (isNavigatingFromHistory) {
      console.log('[OpenPoll] 🔄 Forzando refresh del globo desde historial');
      await tick();
      
      // Asegurar que los polígonos mundiales están cargados
      if (worldPolygons && worldPolygons.length > 0) {
        globe?.setPolygonsData?.(worldPolygons);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      
      // Forzar actualización de colores
      globe?.refreshPolyColors?.();
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    
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
    
    // CRÍTICO: Asegurar que el controlador del BottomSheet está listo después de todas las animaciones
    setTimeout(() => {
      if (sheetCtrl) {
        console.log('[HandleOpenPoll] ✅ Reset del estado del BottomSheet controller');
        // Limpiar cualquier estado de drag que pueda haber quedado activo
        sheetCtrl.resetDragState();
      }
    }, 1200); // Después de que termine el zoom (1000ms) + margen
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
  
  // Función auxiliar para cargar tema guardado o usar Carbon por defecto
  function getInitialThemeColors() {
    // Check if we're in the browser (not SSR)
    if (typeof window === 'undefined') {
      return { bg: '#0a0a0a', sphere: '#1a1a1a', stroke: '#2e2e2e', noData: '#141414', atmosphere: '#1a1a1a', isDark: true };
    }
    
    try {
      const saved = localStorage.getItem('votetok-theme');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('[GlobeGL] Inicializando con tema guardado:', parsed);
        
        // Todas las paletas oscuras (deben coincidir con UnifiedThemeToggle)
        const darkPalettes = [
          { name: 'Carbon', bg: '#0a0a0a', sphere: '#1a1a1a', stroke: '#2e2e2e', noData: '#141414', atmosphere: '#1a1a1a' },
          { name: 'Dark', bg: '#000000', sphere: '#161b22', stroke: '#30363d', noData: '#181a20', atmosphere: '#161b22' },
          { name: 'Slate', bg: '#0e1012', sphere: '#1a1e24', stroke: '#2e3640', noData: '#14181c', atmosphere: '#1a1e24' },
          { name: 'Steel', bg: '#0f1113', sphere: '#1c2026', stroke: '#303840', noData: '#151a1e', atmosphere: '#1c2026' },
          { name: 'Graphite', bg: '#0d0f10', sphere: '#191d20', stroke: '#2d3338', noData: '#13161a', atmosphere: '#191d20' },
          { name: 'Deep Purple', bg: '#0a0015', sphere: '#1a0b2e', stroke: '#3d1e6d', noData: '#16003e', atmosphere: '#1a0b2e' },
          { name: 'Midnight Purple', bg: '#0f0a1e', sphere: '#1a1234', stroke: '#2e2052', noData: '#150f28', atmosphere: '#1a1234' },
          { name: 'Violet Night', bg: '#100920', sphere: '#1e1238', stroke: '#3a2561', noData: '#180e2d', atmosphere: '#1e1238' },
          { name: 'Indigo Night', bg: '#08091a', sphere: '#0f1233', stroke: '#1e245c', noData: '#0c0e26', atmosphere: '#0f1233' },
          { name: 'Magenta Night', bg: '#1a001a', sphere: '#2e002e', stroke: '#4d004d', noData: '#240024', atmosphere: '#2e002e' },
          { name: 'Ocean Night', bg: '#001a2e', sphere: '#002642', stroke: '#284b63', noData: '#003049', atmosphere: '#002642' },
          { name: 'Cyber Blue', bg: '#000d1a', sphere: '#001a33', stroke: '#00334d', noData: '#00152b', atmosphere: '#001a33' },
          { name: 'Navy Deep', bg: '#00101c', sphere: '#001e36', stroke: '#003d5c', noData: '#001829', atmosphere: '#001e36' },
          { name: 'Arctic Night', bg: '#0a1420', sphere: '#14263d', stroke: '#284a66', noData: '#101d2e', atmosphere: '#14263d' },
          { name: 'Aqua Deep', bg: '#001a1a', sphere: '#002e2e', stroke: '#004d4d', noData: '#002424', atmosphere: '#002e2e' },
          { name: 'Teal Deep', bg: '#081615', sphere: '#0f2928', stroke: '#1a4d4a', noData: '#0c1f1e', atmosphere: '#0f2928' },
          { name: 'Turquoise Night', bg: '#001a15', sphere: '#002e26', stroke: '#004d42', noData: '#002219', atmosphere: '#002e26' },
          { name: 'Forest Dark', bg: '#0d1b0f', sphere: '#1b2e1f', stroke: '#2d4a33', noData: '#19291c', atmosphere: '#1b2e1f' },
          { name: 'Emerald Night', bg: '#081512', sphere: '#102822', stroke: '#1d4a3d', noData: '#0d1e19', atmosphere: '#102822' },
          { name: 'Jade Dark', bg: '#091713', sphere: '#112924', stroke: '#1f4a40', noData: '#0e201c', atmosphere: '#112924' },
          { name: 'Lime Dark', bg: '#0f1a00', sphere: '#1c2e00', stroke: '#304d00', noData: '#162200', atmosphere: '#1c2e00' },
          { name: 'Gold Dark', bg: '#1a1500', sphere: '#2e2600', stroke: '#4d4200', noData: '#221c00', atmosphere: '#2e2600' },
          { name: 'Amber Dark', bg: '#1a1200', sphere: '#2e2200', stroke: '#524000', noData: '#221a00', atmosphere: '#2e2200' },
          { name: 'Orange Night', bg: '#1a0800', sphere: '#2e1400', stroke: '#4d2400', noData: '#220e00', atmosphere: '#2e1400' },
          { name: 'Copper Night', bg: '#1a0d00', sphere: '#2e1800', stroke: '#4d2800', noData: '#221100', atmosphere: '#2e1800' },
          { name: 'Bronze Night', bg: '#1a0f00', sphere: '#2e1c00', stroke: '#523600', noData: '#221400', atmosphere: '#2e1c00' },
          { name: 'Crimson Dark', bg: '#1a0000', sphere: '#2b0808', stroke: '#4a1414', noData: '#1f0303', atmosphere: '#2b0808' },
          { name: 'Ruby Night', bg: '#180005', sphere: '#2a0a10', stroke: '#4d1a25', noData: '#1e0408', atmosphere: '#2a0a10' },
          { name: 'Burgundy', bg: '#150008', sphere: '#26000f', stroke: '#45001f', noData: '#1b000c', atmosphere: '#26000f' },
          { name: 'Pink Dark', bg: '#1a0010', sphere: '#2e001e', stroke: '#4d0033', noData: '#220016', atmosphere: '#2e001e' },
        ];
        
        // Todas las paletas claras
        const lightPalettes = [
          { name: 'Cloud', bg: '#d0d2d4', sphere: '#bcc0c4', stroke: '#a8adb2', noData: '#c4c7ca', atmosphere: '#bcc0c4' },
          { name: 'Pearl', bg: '#d3d3d3', sphere: '#c0c0c0', stroke: '#adadad', noData: '#c8c8c8', atmosphere: '#c0c0c0' },
          { name: 'Silver', bg: '#c8cacc', sphere: '#b5b8bb', stroke: '#a1a5a9', noData: '#bdc0c3', atmosphere: '#b5b8bb' },
          { name: 'Cream', bg: '#d7d7d7', sphere: '#c7c7c7', stroke: '#b7b7b7', noData: '#cfcfcf', atmosphere: '#c7c7c7' },
          { name: 'Ivory', bg: '#d8d8d6', sphere: '#c8c8c4', stroke: '#b8b8b2', noData: '#d0d0cd', atmosphere: '#c8c8c4' },
          { name: 'Lavender Mist', bg: '#d0cfe0', sphere: '#bdbccf', stroke: '#aaa8be', noData: '#c6c5d8', atmosphere: '#bdbccf' },
          { name: 'Lilac Dream', bg: '#d2d0e1', sphere: '#bfbdd1', stroke: '#aca9c0', noData: '#c8c6d9', atmosphere: '#bfbdd1' },
          { name: 'Purple Haze', bg: '#c5c3d8', sphere: '#b2b0c5', stroke: '#9e9bb2', noData: '#bbb9ce', atmosphere: '#b2b0c5' },
          { name: 'Violet Soft', bg: '#d8d0e0', sphere: '#c5bdd1', stroke: '#b0a8be', noData: '#cec6d8', atmosphere: '#c5bdd1' },
          { name: 'Sky Whisper', bg: '#c8d7e1', sphere: '#b5c7d1', stroke: '#a0b6c0', noData: '#becfd9', atmosphere: '#b5c7d1' },
          { name: 'Ice Blue', bg: '#c9d8e2', sphere: '#b6c8d2', stroke: '#a1b7c1', noData: '#bfd0da', atmosphere: '#b6c8d2' },
          { name: 'Ocean Mist', bg: '#c0d0d8', sphere: '#adc0c8', stroke: '#98afb7', noData: '#b6c8d0', atmosphere: '#adc0c8' },
          { name: 'Steel Blue', bg: '#b8c8d0', sphere: '#a5b8c0', stroke: '#90a7af', noData: '#aec0c8', atmosphere: '#a5b8c0' },
          { name: 'Aqua Light', bg: '#c0d8d8', sphere: '#adc8c8', stroke: '#98b7b7', noData: '#b6d0d0', atmosphere: '#adc8c8' },
          { name: 'Turquoise Soft', bg: '#b8e0d8', sphere: '#a5d0c8', stroke: '#90bfb6', noData: '#add8d0', atmosphere: '#a5d0c8' },
          { name: 'Mint Breeze', bg: '#c9d8d0', sphere: '#b6c8be', stroke: '#a1b7ab', noData: '#bfd0c6', atmosphere: '#b6c8be' },
          { name: 'Sage Whisper', bg: '#cad9d0', sphere: '#b7c9be', stroke: '#a2b8ab', noData: '#c0d1c6', atmosphere: '#b7c9be' },
          { name: 'Forest Mist', bg: '#c0d0c8', sphere: '#adc0b5', stroke: '#98afa0', noData: '#b6c8be', atmosphere: '#adc0b5' },
          { name: 'Emerald Light', bg: '#b8d0c8', sphere: '#a5c0b5', stroke: '#90afa0', noData: '#aec8be', atmosphere: '#a5c0b5' },
          { name: 'Lime Light', bg: '#d0e0b8', sphere: '#c0d0a5', stroke: '#afbf90', noData: '#c8d8ad', atmosphere: '#c0d0a5' },
          { name: 'Gold Light', bg: '#e0d8b0', sphere: '#d0c89d', stroke: '#bfb688', noData: '#d8d0a6', atmosphere: '#d0c89d' },
          { name: 'Sand', bg: '#d8d0c8', sphere: '#c5bdb5', stroke: '#b0a89f', noData: '#cec6be', atmosphere: '#c5bdb5' },
          { name: 'Beige', bg: '#d8d0c0', sphere: '#c5bdad', stroke: '#b0a898', noData: '#cec6b6', atmosphere: '#c5bdad' },
          { name: 'Orange Light', bg: '#e0c8b8', sphere: '#d0b8a5', stroke: '#bfa690', noData: '#d8c0ad', atmosphere: '#d0b8a5' },
          { name: 'Copper Soft', bg: '#e0c8b0', sphere: '#d0b89d', stroke: '#bfa688', noData: '#d8c0a6', atmosphere: '#d0b89d' },
          { name: 'Peach Silk', bg: '#dcd2ce', sphere: '#c9bfb9', stroke: '#b6aba4', noData: '#d6c8c3', atmosphere: '#c9bfb9' },
          { name: 'Terracotta', bg: '#d0c0b8', sphere: '#bdada5', stroke: '#a89890', noData: '#c6b6ae', atmosphere: '#bdada5' },
          { name: 'Rose Blush', bg: '#dcd0d3', sphere: '#c9bdc0', stroke: '#b6a9ad', noData: '#d6c6c9', atmosphere: '#c9bdc0' },
          { name: 'Coral Soft', bg: '#d8c8c8', sphere: '#c5b5b5', stroke: '#b0a0a0', noData: '#cebebe', atmosphere: '#c5b5b5' },
          { name: 'Pink Soft', bg: '#e0c0d0', sphere: '#d0adc0', stroke: '#bf98af', noData: '#d8b6c8', atmosphere: '#d0adc0' },
        ];
        
        const palettes = parsed.isDark ? darkPalettes : lightPalettes;
        const palette = palettes[parsed.paletteIndex] || darkPalettes[0];
        console.log('[GlobeGL] Paleta inicial seleccionada:', palette.name);
        console.log('[GlobeGL] isDark del tema guardado:', parsed.isDark);
        return { ...palette, isDark: parsed.isDark };
      }
    } catch (e) {
      console.warn('[GlobeGL] Error al cargar tema inicial:', e);
    }
    // Default: Carbon oscuro
    return { bg: '#0a0a0a', sphere: '#1a1a1a', stroke: '#2e2e2e', noData: '#141414', atmosphere: '#1a1a1a', isDark: true };
  }
  
  const initialColors = getInitialThemeColors();

  // Controles de color (color pickers) y opacidad (sliders) - Inicializados con tema guardado o Carbon
  let capColor = themeConfig.theme.colors.accent.blue;
  let capOpacityPct = 100;
  let sphereColor = initialColors.sphere;
  let sphereOpacityPct = 100;
  let strokeColor = initialColors.stroke;
  let bgColor = initialColors.bg;
  let polygonNoDataColor = initialColors.noData;
  let atmosphereColor = initialColors.atmosphere;
  let atmosphereAltitude = 0.12; // Altura sutil para atmósfera
  let isDarkTheme = initialColors.isDark; // Estado del tema desde localStorage o true por defecto

  // Colores derivados (conveniencia)
  $: capBaseColor = capColor;
  $: sphereBaseColor = sphereColor;
  $: strokeBaseColor = strokeColor;
  
  // Flag para evitar sobrescribir tema guardado de localStorage
  let hasLoadedSavedTheme = false;
  
  // Observar cambios de tema - TODO unificado desde theme.json
  function updateColorsForTheme() {
    // No sobrescribir si hay un tema guardado que aún no se ha aplicado
    if (hasLoadedSavedTheme) {
      console.log('[GlobeGL] Ignorando updateColorsForTheme - tema guardado ya cargado');
      return;
    }
    
    const isDark = document.documentElement.classList.contains('dark');
    isDarkTheme = isDark; // Actualizar estado del tema
    
    console.log('[GlobeGL] updateColorsForTheme ejecutado - cargando desde theme.json');
    
    // Cargar colores desde theme.json
    const theme = themeConfig.theme.colors;
    const globeConfig = isDark ? theme.globe : theme.globeLight;
    
    // Aplicar configuración del tema seleccionado
    bgColor = globeConfig.background;
    sphereColor = globeConfig.sphere;
    strokeColor = globeConfig.stroke;
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
  type SubdivisionLabel = { id?: string; name: string; lat: number; lng: number; feature?: any; size?: number; area?: number; text?: string; color?: string; opacity?: number; hasData?: boolean; _isCenterLabel?: boolean };
  let subdivisionLabels: SubdivisionLabel[] = [];
  
  // Guardar etiquetas originales antes de mostrar solo la centrada
  let originalSubdivisionLabels: SubdivisionLabel[] = [];
  
  // Agregar etiqueta destacada para el polígono centrado (SOLO esta etiqueta)
  function addCenterPolygonLabel() {
    if (!centerPolygon || !globe) return;
    
    try {
      // LIMPIAR TODAS las etiquetas existentes primero
      subdivisionLabels = [];
      originalSubdivisionLabels = [];
      updateSubdivisionLabels(false);
      
      // Obtener el centroide del polígono
      const centroid = centroidOf(centerPolygon);
      
      // Obtener nombre usando la misma lógica simple: del más específico al más general
      const props = centerPolygon.properties;
      let name = 'Región';
      
      // Primero intentar NAME_2 (nivel 3 y 4)
      if (props?.NAME_2 || props?.name_2) {
        name = props.NAME_2 || props.name_2;
      }
      // Luego NAME_1 (nivel 2)
      else if (props?.NAME_1 || props?.name_1) {
        name = props.NAME_1 || props.name_1;
      }
      // Finalmente NAME/ADMIN (nivel 1 - mundial)
      else if (props?.NAME || props?.name || props?.ADMIN || props?.admin) {
        name = props.NAME || props.name || props.ADMIN || props.admin;
      }
      
      console.log('[CenterLabel] Nombre obtenido:', name, '| ID:', centerPolygonId);
      
      // Crear etiqueta destacada con estilo profesional
      const centerLabel: SubdivisionLabel = {
        lat: centroid.lat,
        lng: centroid.lng,
        name: name,
        size: 16, // Tamaño destacado pero no excesivo
        color: '#ffffff', // Blanco puro para mejor legibilidad
        opacity: 1,
        _isCenterLabel: true, // Marcador especial para estilos avanzados
        feature: centerPolygon // IMPORTANTE: Incluir el feature para que el click funcione
      };
      
      // Reemplazar TODAS las etiquetas con solo la centrada
      subdivisionLabels = [centerLabel];
      
      // Actualizar en el globo
      updateSubdivisionLabels(true);
    } catch (error) {
      console.warn('[CenterLabel] Error agregando etiqueta:', error);
    }
  }
  
  // Remover etiqueta del polígono centrado (sin restaurar las originales)
  function removeCenterPolygonLabel() {
    if (!globe) return;
    
    try {
      // Limpiar TODAS las etiquetas
      subdivisionLabels = [];
      originalSubdivisionLabels = [];
      
      // Actualizar en el globo (ocultar todas)
      updateSubdivisionLabels(false);
    } catch (error) {
      console.warn('[CenterLabel] Error removiendo etiqueta:', error);
    }
  }
  // Función SIMPLE: mostrar UNA etiqueta del primer polígono con datos
  function showFirstLabelWithData(polygons: any[]) {
    try {
      console.log('[FirstLabel] 🔍 Buscando primer polígono con datos entre', polygons.length, 'polígonos');
      console.log('[FirstLabel] 📊 answersData tiene', Object.keys(answersData || {}).length, 'claves');
      console.log('[FirstLabel] 📊 Primeras 10 claves de answersData:', Object.keys(answersData || {}).slice(0, 10));
      
      let checkedCount = 0;
      
      for (const poly of polygons) {
        const props = poly.properties;
        if (!props) continue;
        
        checkedCount++;
        
        // Usar la MISMA función que usa el sistema de coloreado
        const polyId = getFeatureId(poly);
        
        if (checkedCount <= 5) {
          const name1 = props.NAME_1 || props.name_1 || props.VARNAME_1 || props.varname_1;
          const name2 = props.NAME_2 || props.name_2 || props.VARNAME_2 || props.varname_2;
          const name = props.NAME || props.name || props.ADMIN || props.admin;
          console.log(`[FirstLabel] Polígono #${checkedCount}: ID="${polyId}", tiene datos=${!!answersData?.[polyId]}, nombre="${name1 || name2 || name || 'Sin nombre'}"`);
        }
        
        // Verificar si tiene datos
        if (!polyId || !answersData?.[polyId]) continue;
        
        // Obtener nombre
        let name = '';
        if (props.NAME_2 || props.name_2) name = props.NAME_2 || props.name_2;
        else if (props.NAME_1 || props.name_1) name = props.NAME_1 || props.name_1;
        else if (props.NAME || props.name) name = props.NAME || props.name;
        
        if (!name) continue;
        
        // Calcular centroide
        const centroid = centroidOf(poly);
        if (!centroid) continue;
        
        // ENCONTRADO - Mostrar solo esta etiqueta
        console.log('[FirstLabel] ✅ Encontrado:', name, '(ID:', polyId + ')');
        
        subdivisionLabels = [{
          lat: centroid.lat,
          lng: centroid.lng,
          name: name,
          size: 14,
          color: '#ffffff',
          opacity: 1.0,
          _isCenterLabel: true,
          feature: poly // IMPORTANTE: Incluir el feature para que el click funcione
        }];
        
        updateSubdivisionLabels(true);
        return; // Ya terminamos
      }
      
      console.log('[FirstLabel] ❌ No se encontró ningún polígono con datos');
      
    } catch (e) {
      console.warn('[FirstLabel] ❌ Error:', e);
    }
  }
  
  // Función para auto-seleccionar polígono más cercano al centro
  function autoSelectCenterPolygon(forceActivate: boolean = false) {
    // Activar SOLO en niveles 2, 3 y 4 (country, subdivision)
    const currentLevel = navigationManager?.getCurrentLevel();
    if (!currentLevel) return;
    
    // En nivel mundial: NO activar NUNCA (sin etiquetas automáticas)
    if (currentLevel === 'world') {
      console.log('[AutoSelect] Nivel mundial: auto-selección desactivada');
      return;
    }
    
    // Esperar un frame para que el globo haya renderizado
    requestAnimationFrame(() => {
      try {
        const detected = globe?.getCenterPolygon?.();
        
        // Si no detecta polígono (polígono pequeño o no hay en centro exacto)
        // buscar directamente el más cercano, especialmente si forceActivate=true
        if (!detected || !detected.properties) {
          console.log('[AutoSelect] No se detectó polígono centrado, buscando el más cercano');
          findClosestPolygonWithData(currentLevel, true); // Forzar búsqueda inmediata
          return;
        }
        
        if (detected && detected.properties) {
          const props = detected.properties;
          let detectedId = '';
          
          // Usar la misma lógica que globeDataProc.ts: del más específico al más general
          if (props.ID_2 || props.id_2 || props.GID_2 || props.gid_2) {
            // Nivel 3 o 4: tiene ID_2
            detectedId = String(props.ID_2 || props.id_2 || props.GID_2 || props.gid_2);
          } else if (props.ID_1 || props.id_1 || props.GID_1 || props.gid_1) {
            // Nivel 2: tiene ID_1
            detectedId = String(props.ID_1 || props.id_1 || props.GID_1 || props.gid_1);
          } else if (props.ISO_A3 || props.iso_a3) {
            // Nivel 1: país
            detectedId = String(props.ISO_A3 || props.iso_a3 || '').toUpperCase();
          }
          
          // Verificar si tiene datos (EN TODOS LOS NIVELES)
          const hasData = detectedId && answersData?.[detectedId];
          
          if (hasData) {
            // Solo activar si tiene datos
            centerPolygon = detected;
            centerPolygonId = detectedId;
            isCenterPolygonActive = true;
            globe?.refreshPolyAltitudes?.();
            addCenterPolygonLabel();
            console.log('[AutoSelect] Polígono centrado activado:', detectedId, 'en nivel:', currentLevel);
          } else {
            console.log('[AutoSelect] Polígono sin datos, buscando el más cercano:', detectedId, 'nivel:', currentLevel);
            // Si el centrado no tiene datos, buscar el más cercano que sí tenga (forzado)
            findClosestPolygonWithData(currentLevel, true);
          }
        }
        // Nota: El caso "no hay polígono detectado" ya se maneja arriba con return
      } catch (e) {
        console.warn('[AutoSelect] Error auto-seleccionando polígono:', e);
      }
    });
  }
  
  // Throttle para búsqueda de polígono más cercano
  let lastClosestSearch = 0;
  const CLOSEST_SEARCH_THROTTLE = 300; // ms - reducido para mejor detección de polígonos pequeños
  
  // Función para encontrar el polígono más cercano al centro que tenga datos
  function findClosestPolygonWithData(currentLevel: string, forceSearch: boolean = false) {
    // Throttle: evitar búsquedas muy frecuentes (excepto si es forzado)
    if (!forceSearch) {
      const now = performance.now();
      const timeSinceLastSearch = now - lastClosestSearch;
      if (timeSinceLastSearch < CLOSEST_SEARCH_THROTTLE) {
        console.log('[FindClosest] ⏱️ Throttle activo, esperando:', (CLOSEST_SEARCH_THROTTLE - timeSinceLastSearch).toFixed(0), 'ms');
        return;
      }
      lastClosestSearch = now;
    } else {
      console.log('[FindClosest] 🚀 Búsqueda forzada (sin throttle)');
    }
    
    try {
      const pov = globe?.pointOfView();
      if (!pov) return;
      
      let polygonsToCheck: any[] = [];
      const state = navigationManager?.getState();
      
      // Detectar si es nivel 4
      const isLevel4 = currentLevel === 'subdivision' && !!state?.subdivisionId;
      
      // Obtener los polígonos según el nivel
      if (currentLevel === 'world') {
        polygonsToCheck = worldPolygons || [];
        console.log('[FindClosest] Nivel mundial, polígonos disponibles:', polygonsToCheck.length);
      } else if (currentLevel === 'country') {
        if (state?.countryIso) {
          polygonsToCheck = navigationManager?.['polygonCache']?.get(state.countryIso) || [];
          console.log('[FindClosest] Nivel país, polígonos disponibles:', polygonsToCheck.length);
        }
      } else if (currentLevel === 'subdivision') {
        if (isLevel4) {
          // Nivel 4: subdivisiones de una subdivisión
          const cacheKey = `${state.countryIso}.${state.subdivisionId}`;
          polygonsToCheck = navigationManager?.['polygonCache']?.get(cacheKey) || [];
          console.log('[FindClosest] Nivel 4 (sub-subdivisión)', {
            cacheKey: cacheKey,
            countryIso: state.countryIso,
            subdivisionId: state.subdivisionId,
            polígonos: polygonsToCheck.length,
            cacheKeys: Array.from(navigationManager?.['polygonCache']?.keys() || [])
          });
        } else if (state?.countryIso) {
          // Nivel 3: subdivisiones de un país
          polygonsToCheck = navigationManager?.['polygonCache']?.get(state.countryIso) || [];
          console.log('[FindClosest] Nivel 3 (subdivisión)', {
            countryIso: state.countryIso,
            polígonos: polygonsToCheck.length
          });
        }
      }
      
      if (!polygonsToCheck.length) {
        console.log('[FindClosest] No hay polígonos disponibles para buscar en nivel:', currentLevel, 'isLevel4:', isLevel4);
        return;
      }
      
      // Calcular distancias y encontrar el más cercano con datos
      let closestPolygon = null;
      let closestId = '';
      let minDistance = Infinity;
      
      // Contadores para logging
      let polygonsWithId = 0;
      let polygonsWithData = 0;
      const foundIds: string[] = [];
      const idsWithData: string[] = [];
      
      for (const poly of polygonsToCheck) {
        const props = poly.properties;
        if (!props) continue;
        
        // Usar la misma lógica que globeDataProc.ts: del más específico al más general
        let polyId = '';
        if (props.ID_2 || props.id_2 || props.GID_2 || props.gid_2) {
          // Nivel 3 o 4: tiene ID_2
          polyId = String(props.ID_2 || props.id_2 || props.GID_2 || props.gid_2);
        } else if (props.ID_1 || props.id_1 || props.GID_1 || props.gid_1) {
          // Nivel 2: tiene ID_1
          polyId = String(props.ID_1 || props.id_1 || props.GID_1 || props.gid_1);
        } else if (props.ISO_A3 || props.iso_a3) {
          // Nivel 1: país
          polyId = String(props.ISO_A3 || props.iso_a3 || '').toUpperCase();
        }
        
        if (polyId) {
          polygonsWithId++;
          foundIds.push(polyId);
        }
        
        // Verificar si tiene datos
        if (!polyId || !answersData?.[polyId]) continue;
        
        polygonsWithData++;
        idsWithData.push(polyId);
        
        // Calcular centroide del polígono
        const centroid = centroidOf(poly);
        if (!centroid) continue;
        
        // Calcular distancia al punto de vista actual
        const distance = Math.sqrt(
          Math.pow(centroid.lat - pov.lat, 2) + 
          Math.pow(centroid.lng - pov.lng, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestPolygon = poly;
          closestId = polyId;
        }
      }
      
      // Logging de estadísticas detallado
      const answersDataKeys = Object.keys(answersData || {});
      console.log('[FindClosest] Estadísticas:', {
        nivel: currentLevel,
        isLevel4: isLevel4,
        totalPolígonos: polygonsToCheck.length,
        conID: polygonsWithId,
        conDatos: polygonsWithData,
        encontrado: !!closestId
      });
      console.log('[FindClosest] IDs encontrados (muestra):', foundIds.slice(0, 10));
      console.log('[FindClosest] IDs con datos:', idsWithData);
      console.log('[FindClosest] answersData keys (muestra):', answersDataKeys.slice(0, 20));
      
      // Activar el polígono más cercano si se encontró
      if (closestPolygon && closestId) {
        centerPolygon = closestPolygon;
        centerPolygonId = closestId;
        isCenterPolygonActive = true;
        globe?.refreshPolyAltitudes?.();
        addCenterPolygonLabel();
        console.log('[FindClosest] ✅ Polígono más cercano activado:', closestId, 'distancia:', minDistance.toFixed(3), 'nivel:', isLevel4 ? '4' : currentLevel);
      } else {
        console.log('[FindClosest] ❌ No se encontró ningún polígono con datos');
        // FALLBACK: Si no encontramos ninguno pero hay polígonos con datos, mostrar UNA etiqueta
        if (polygonsWithData > 0 && idsWithData.length > 0) {
          console.log('[FindClosest] 🔄 FALLBACK: Mostrando etiqueta del primer polígono con datos');
          showFirstLabelWithData(polygonsToCheck);
        }
      }
      
    } catch (e) {
      console.warn('[FindClosest] Error buscando polígono más cercano:', e);
    }
  }
  
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

  
  // FUNCIÓN LEGACY: Usar marcadores (datos simulados) - Migrado a ColorManager
  function computeSubdivisionColorsFromVotes(countryIso: string, polygons: any[]): Record<string, string> {
    return colorManager.computeColorsFromVotes(countryIso, polygons, regionVotes, colorMap);
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
  
  // Variables para modal de perfil (controlled desde +page.svelte)
  let isProfileModalOpen = false;
  let selectedProfileUserId: number | null = null;
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

  // Handler para cambio de tab "Para ti" / "Tendencias"
  async function handleTopTabChange(event: CustomEvent<string>) {
    console.log('[handleTopTabChange] 📥 Evento recibido:', event.detail);
    const newTab = event.detail as 'Para ti' | 'Tendencias' | 'Live';
    
    console.log('[handleTopTabChange] Tab actual (antes de binding):', activeTopTab);
    console.log('[handleTopTabChange] Tab nuevo:', newTab);
    
    // IMPORTANTE: No comparar con activeTopTab porque bind:active ya lo actualizó
    // Solo verificar que el tab sea válido
    
    console.log('[handleTopTabChange] 🔄 Tab cambiado a:', newTab);
    // activeTopTab ya está actualizado por bind:active, no hace falta setearlo aquí
    
    // En modo trending (nivel mundial), SIEMPRE recargar al cambiar tab
    // Esto permite cambiar entre "Para ti" y "Tendencias" dinámicamente
    if (navigationState.level === 'world') {
      console.log('[GlobeGL] 🔃 Recargando encuestas para nuevo tab...');
      
      // FASE 3: Limpiar la encuesta activa usando store para forzar modo trending
      globalActivePoll.close();
      
      // Recargar datos según el nuevo tab
      await loadTrendingData();
      await updateGlobeColors(true); // Con fade
    } else {
      // Si estás en nivel regional (país o subdivisión), mantener la vista actual
      console.log('[GlobeGL] ℹ️ En nivel regional - el cambio de tab se aplicará al volver a nivel mundial');
    }
  }

  // Activar/desactivar teselas OSM según visibilidad de polígonos
  function setTilesEnabled(enabled: boolean) {
    try {
      if (globe && typeof globe.setTilesEnabled === 'function') {
        globe.setTilesEnabled(enabled);
      }
    } catch {}
  }




  // Volar a mi ubicación
  // FASE 3: Refactorizado para usar GeocodeService
  async function locateMe() {
    try {
      console.log('[GlobeGL] 📍 Obteniendo ubicación con GeocodeService...');
      
      // Usar el servicio de geolocalización con fallbacks automáticos
      const { location, geocode } = await geocodeService.getLocationAndGeocode();
      
      console.log('[GlobeGL] ✅ Ubicación obtenida:', {
        source: location.source,
        lat: location.latitude,
        lon: location.longitude,
        accuracy: location.accuracy,
        subdivision: geocode.subdivisionName
      });
      
      const lat = location.latitude;
      const lng = location.longitude;
      
      // Detener cualquier rotación automática antes de mover la cámara
      const targetAltitude = MIN_ZOOM_ALTITUDE; // límite mínimo permitido
      
      if (polygonsVisible && targetAltitude < ALT_THRESHOLD) {
        globe?.setPolygonsData([]);
        polygonsVisible = false;
        setTilesEnabled(true);
      }
      
      scheduleZoom(lat, lng, targetAltitude, 1000);
      
      // Mostrar mensaje amigable según la fuente
      if (location.source === 'default') {
        alert('No se pudo obtener tu ubicación exacta. Mostrando ubicación por defecto (Madrid).');
      }
    } catch (e) {
      console.error('[GlobeGL] ❌ Error en locateMe:', e);
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
    const path = getCountryPath(iso);
    console.log(`[LoadTopo] Cargando ${iso}...`);
    
    const resp = await fetch(path);
    if (!resp.ok) {
      console.error(`[LoadTopo] ❌ HTTP ${resp.status} al cargar ${path}`);
      throw new Error('HTTP ' + resp.status + ' al cargar ' + path);
    }
    
    console.log(`[LoadTopo] Parseando JSON...`);
    const topo = await resp.json();
    
    console.log(`[LoadTopo] Convirtiendo a GeoJSON...`);
    // Carga dinámica de topojson-client para convertir a GeoJSON
    const mod = await import(/* @vite-ignore */ 'topojson-client');
    const objects = topo.objects || {};
    const firstKey = Object.keys(objects)[0];
    
    if (!firstKey) {
      console.warn(`[LoadTopo] ⚠️ No hay objetos en ${path}`);
      return [];
    }
    
    const fc = (mod as any).feature(topo, objects[firstKey]);
    const feats: any[] = Array.isArray(fc?.features) ? fc.features : [];
    
    // FILTRAR features nulos o mal formados ANTES de procesarlos
    const validFeats = feats.filter(f => 
      f !== null && 
      f !== undefined && 
      f.type === 'Feature' &&
      f.geometry !== null && 
      f.geometry !== undefined &&
      f.geometry.type !== null
    );
    
    console.log(`[LoadTopo] ✅ ${validFeats.length} features válidas de ${feats.length} totales para ${iso}`);
    
    // Añadir propiedades necesarias
    for (const f of validFeats) {
      if (!f.properties) f.properties = {};
      if (!f.properties.ISO_A3) f.properties.ISO_A3 = iso;
    }
    
    return validFeats;
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
    // ============================================
    // HISTORY API - Navegación SPA con botón atrás
    // ============================================
    popstateHandler = async (event: PopStateEvent) => {
      console.log('[History] 🔙 Botón atrás presionado, state:', event.state);
      
      if (!navigationManager) return;
      
      const state = event.state;
      
      // PRIORIDAD 1: Detectar si hay encuesta específica en el estado
      if (state?.pollId && state?.pollMode === 'specific') {
        // Restaurar encuesta específica
        console.log('[History] 🔄 Restaurando encuesta:', state.pollId);
        
        // CRÍTICO: Establecer el flag ANTES de cualquier verificación
        isNavigatingFromHistory = true;
        
        try {
          // Cargar datos de la encuesta
          const response = await apiCall(`/api/polls/${state.pollId}`);
          if (response.ok) {
            const pollData = await response.json();
            const poll = pollData.data || pollData;
            
            // Recrear formato de opciones
            const options = poll.options?.map((opt: any, idx: number) => ({
              key: opt.optionKey || opt.key,
              label: opt.optionText || opt.label,
              color: opt.color || ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'][idx % 4],
              votes: 0
            })) || [];
            
            // Crear evento sintético para handleOpenPollInGlobe
            const syntheticEvent = new CustomEvent('openpoll', {
              detail: { poll, options }
            }) as CustomEvent<{ poll: any; options: Array<{ key: string; label: string; color: string; votes: number }> }>;
            
            // handleOpenPollInGlobe ya maneja el caso de misma encuesta con flag isNavigatingFromHistory
            await handleOpenPollInGlobe(syntheticEvent);
          }
        } catch (error) {
          console.error('[History] Error restaurando encuesta:', error);
        } finally {
          isNavigatingFromHistory = false;
        }
        return;
      }
      
      // PRIORIDAD 2: Detectar si volvemos a modo trending
      if (state?.pollMode === 'trending') {
        // Volver a modo trending
        if (activePoll) {
          console.log('[History] 🔄 Volviendo a modo trending desde encuesta');
          isNavigatingFromHistory = true;
          await closePoll();
          isNavigatingFromHistory = false;
        }
        return;
      }
      
      // PRIORIDAD 3: Navegación geográfica
      // Puede tener pollMode + navegación geográfica simultáneas
      if (state.level === 'country' && state.countryIso) {
        // Volver al país (con o sin encuesta)
        selectedCountryIso = state.countryIso;
        selectedCountryName = state.countryName || state.countryIso;
        await navigateToView('country', true); // true = fromHistory
      } else if (state.level === 'subdivision' && state.countryIso && state.subdivisionId) {
        // Volver a la subdivisión (con o sin encuesta)
        selectedCountryIso = state.countryIso;
        selectedCountryName = state.countryName || state.countryIso;
        selectedSubdivisionId = state.subdivisionId;
        selectedSubdivisionName = state.subdivisionName || state.subdivisionId;
        await navigateToView('subdivision', true); // true = fromHistory
      } else if (!state || state.level === 'world') {
        // Volver al mundo (solo si no tiene navegación geográfica)
        if (!state?.countryIso && !state?.subdivisionId) {
          await navigateToView('world', true); // true = fromHistory
        }
      }
    };
    
    window.addEventListener('popstate', popstateHandler as any);
    
    // Establecer estado inicial en el historial si no existe
    if (!history.state) {
      const initialState = {
        level: 'world',
        pollMode: 'trending',
        timestamp: Date.now()
      };
      history.replaceState(initialState, '', '/');
    }
    
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
    
    // Sistema de doble click deshabilitado - solo zoom out para navegar
    
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
      } 
    };
        window.addEventListener('searchSelect', searchSelectHandler);
    
    // Verificar si hay tema guardado antes de inicializar colores
    const hasSavedTheme = localStorage.getItem('votetok-theme');
    if (!hasSavedTheme) {
      // Solo inicializar desde theme.json si NO hay tema guardado
      console.log('[GlobeGL] No hay tema guardado, inicializando desde theme.json');
      updateColorsForTheme();
    }
    
    // SIEMPRE observar cambios de clase .dark para actualizar isDarkTheme
    // Esto es necesario para que funcione el cambio día/noche en tiempo real
    const themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark');
          console.log('[GlobeGL] MutationObserver: cambio de clase .dark ->', isDark);
          isDarkTheme = isDark; // SIEMPRE actualizar isDarkTheme
          
          // Solo actualizar colores completos si NO hay tema guardado
          if (!hasSavedTheme) {
            updateColorsForTheme();
          }
        }
      });
    });
    
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    if (hasSavedTheme) {
      console.log('[GlobeGL] Tema guardado detectado, esperando evento palettechange');
      hasLoadedSavedTheme = true;
    }
    
    // Escuchar cambios de paleta random
    paletteChangeHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const palette = customEvent.detail;
      
      console.log('[GlobeGL] Evento palettechange recibido:', palette);
      
      // Marcar que se ha cargado un tema desde localStorage para evitar sobrescritura
      hasLoadedSavedTheme = true;
      
      // Aplicar nueva paleta con transición suave
      bgColor = palette.bg;
      sphereColor = palette.sphere;
      strokeColor = palette.stroke;
      polygonNoDataColor = palette.noData;
      
      // Si la paleta incluye atmosphere, aplicarlo
      if (palette.atmosphere) {
        atmosphereColor = palette.atmosphere;
      }
      
      console.log('[GlobeGL] Colores aplicados - bg:', bgColor, 'sphere:', sphereColor, 'stroke:', strokeColor);
      
      // Actualizar colores del globo y polígonos
      // La transición suave del globo (esfera y fondo) se maneja automáticamente en GlobeCanvas
      if (globe) {
        globe.refreshPolyStrokes?.();
        globe.refreshPolyColors?.();
        console.log('[GlobeGL] Globe refresh ejecutado');
      } else {
        console.warn('[GlobeGL] Globe aún no está inicializado');
      }
    };
    
    window.addEventListener('palettechange', paletteChangeHandler);
  });

  function resize() { /* GlobeCanvas maneja su propio tamaño vía CSS */ }

  // Store handler reference for cleanup
  let searchSelectHandler: ((event: Event) => Promise<void>) | null = null;
  let paletteChangeHandler: ((event: Event) => void) | null = null;
  
  // CRÍTICO: Forzar actualización de polígonos cuando cambia isDarkTheme
  $: if (globe && isDarkTheme !== undefined) {
    try {
      // Usar el método existente refreshPolyColors para forzar re-render
      console.log('[GlobeGL] isDarkTheme cambió a:', isDarkTheme, '- forzando actualización de polígonos');
      globe.refreshPolyColors();
    } catch (e) {
      console.error('[GlobeGL] Error al actualizar polígonos:', e);
    }
  }

  // Store popstate handler reference for cleanup
  let popstateHandler: ((event: PopStateEvent) => Promise<void>) | null = null;
  
  onDestroy(() => {
    console.log('[GlobeGL] 🧹 Cleanup iniciado...');
    
    // FASE 3: Cleanup automático de event listeners
    console.log('[GlobeGL] 📌 Event listeners activos:', eventListeners.count);
    eventListeners.cleanup();
    
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
    // Remove popstate listener
    if (popstateHandler) {
      window.removeEventListener('popstate', popstateHandler as any);
    }
  });

</script>

<!-- Fondo dinámico que cubre toda la pantalla con el color actual del tema -->
<div class="dynamic-background" style="background-color: {bgColor};"></div>

<GlobeCanvas
  bind:this={globe}
  {bgColor}
  sphereBaseColor={sphereBaseColor}
  strokeBaseColor={strokeBaseColor}
  {atmosphereColor}
  {atmosphereAltitude}
  {selectedCityId}
  {centerPolygonId}
  {isDarkTheme}
  bottomSheetState={SHEET_STATE}
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
        // Sin datos: gris claro con más transparencia en modo oscuro, gris oscuro con más transparencia en modo claro
        return isDarkTheme ? 'rgba(180, 180, 180, 0.25)' : 'rgba(60, 60, 60, 0.25)';
      }
    }
    
    // PRIORIDAD 1: Si el polígono tiene color forzado (subdivisiones), usarlo SOLO en niveles 2 y 3 Y SOLO SI HAY ENCUESTA ACTIVA
    // En modo trending, NO usar _forcedColor para evitar colores de encuestas cerradas
    if (props._forcedColor && currentLevel !== 'world' && activePoll) {
      // Debug ARG.1
      if (featureId === 'ARG.1') {
        console.log('[DEBUG ARG.1] Usando _forcedColor:', props._forcedColor);
      }
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
      // Sin datos: gris claro con más transparencia en modo oscuro, gris oscuro con más transparencia en modo claro
      return mapColor ?? (isDarkTheme ? 'rgba(180, 180, 180, 0.25)' : 'rgba(60, 60, 60, 0.25)');
    }
    
    // VERIFICACIÓN CRÍTICA: Si el polígono NO tiene datos reales, usar color según tema
    // Esto evita que polígonos sin votos se coloreen por isoDominantKey con "No data"
    if (!answersData?.[featureId]) {
      return isDarkTheme ? 'rgba(180, 180, 180, 0.25)' : 'rgba(60, 60, 60, 0.25)';
    }
    
    // PRIORIDAD 3: Usar isoDominantKey con el featureId correcto
    const key = isoDominantKey[featureId] ?? '';
    const color = colorMap?.[key];
    
    // Si no hay color: gris claro con más transparencia en modo oscuro, gris oscuro con más transparencia en modo claro
    if (!color) {
      return isDarkTheme ? 'rgba(180, 180, 180, 0.25)' : 'rgba(60, 60, 60, 0.25)';
    }
    
    // Aplicar fade opacity si hay animación en curso
    if (isFading && fadeOpacity < 1.0) {
      // Transición desde gris claro (modo oscuro) o gris oscuro (modo claro) al color final
      const baseColor = isDarkTheme ? [180, 180, 180] : [60, 60, 60];
      let targetR = baseColor[0], targetG = baseColor[1], targetB = baseColor[2];
      
      // Extraer RGB del color target
      const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
      if (rgbaMatch) {
        targetR = parseInt(rgbaMatch[1]);
        targetG = parseInt(rgbaMatch[2]);
        targetB = parseInt(rgbaMatch[3]);
      } else if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        targetR = parseInt(hex.substr(0, 2), 16);
        targetG = parseInt(hex.substr(2, 2), 16);
        targetB = parseInt(hex.substr(4, 2), 16);
      }
      
      // Interpolar entre color base (gris con opacidad) y color final
      const r = Math.round(baseColor[0] + (targetR - baseColor[0]) * fadeOpacity);
      const g = Math.round(baseColor[1] + (targetG - baseColor[1]) * fadeOpacity);
      const b = Math.round(baseColor[2] + (targetB - baseColor[2]) * fadeOpacity);
      
      // Interpolar opacidad: de 0.25 (gris base muy transparente) a 1.0 (color final opaco)
      const alpha = 0.25 + (0.75 * fadeOpacity);
      
      return `rgba(${r},${g},${b},${alpha})`;
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
                navigationManager!.navigateToWorld();
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
      
      // DETECTAR ZOOM OUT EXTREMO PARA VOLVER ATRÁS AUTOMÁTICAMENTE
      const navLevel = navigationManager?.getCurrentLevel();
      if (navLevel && navLevel !== 'world' && navigationManager && !isZooming) {
        const navState = navigationManager.getState();
        
        // Detectar si estamos en nivel 4 (sub-subdivisiones)
        // Nivel 4 es cuando tenemos más de 3 niveles en el history (world, country, subdivision, sub-subdivision)
        const history = navigationManager.getHistory();
        const isLevel4 = navLevel === 'subdivision' && history.length > 3;
        
        // Umbrales para volver atrás según el nivel
        let zoomOutThreshold = 2.5;
        let levelName = 'unknown';
        
        if (isLevel4) {
          // Nivel 4 (sub-subdivisiones) -> volver a nivel 3 (subdivision)
          zoomOutThreshold = 0.6;
          levelName = 'level4';
        } else if (navLevel === 'subdivision') {
          // Nivel 3 (subdivision) -> volver a nivel 2 (country)
          zoomOutThreshold = 1.2;
          levelName = 'subdivision';
        } else if (navLevel === 'country') {
          // Nivel 2 (country) -> volver a nivel 1 (world)
          // AUMENTADO de 2.2 a 3.0 para dar margen a países muy grandes (Rusia, Canadá)
          zoomOutThreshold = 3.0;
          levelName = 'country';
        }
        
        // IGNORAR si el zoom es programático (transición automática)
        if (isProgrammaticZoom) {
          // Zoom programático en curso, no detectar zoom out
          return;
        }
        
        if (pov.altitude > zoomOutThreshold) {
          console.log(`[Navigation] 🔙 Zoom out detectado en nivel ${levelName} (altitude: ${pov.altitude.toFixed(2)}, threshold: ${zoomOutThreshold}) - Volviendo atrás`);
          setTimeout(async () => {
            if (navigationManager && !isZooming) {
              await navigationManager.goBack();
            }
          }, 150);
          return;
        }
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
      
      // Sistema simplificado: las etiquetas se manejan solo por autoSelectCenterPolygon
      // No hay sistema LOD de etiquetas múltiples
      
      // SISTEMA DE DETECCIÓN DE POLÍGONO CENTRADO
      const currentLevel = navigationManager?.getCurrentLevel();
      if (currentLevel) {
        // En nivel mundial: solo activar si altitude < 1.8 (zoom in)
        // EN OTROS NIVELES: SIEMPRE activar sin restricciones de altitude
        if (currentLevel === 'world' && pov.altitude >= 1.8) {
          // Muy alejado en vista mundial, no mostrar etiquetas
          if (isCenterPolygonActive) {
            // Limpiar etiqueta si había una activa
            centerPolygon = null;
            centerPolygonId = null;
            isCenterPolygonActive = false;
            removeCenterPolygonLabel();
          }
          return; // No continuar con detección
        }
        
        console.log('[CenterPolygon] Detección activa en nivel:', currentLevel, 'altitude:', pov.altitude.toFixed(2), 'pov:', {lat: pov.lat.toFixed(2), lng: pov.lng.toFixed(2)});
        
        // Detectar polígono en el centro de la pantalla
        const detected = globe?.getCenterPolygon?.();
        
        console.log('[CenterPolygon] getCenterPolygon resultado:', detected ? 'SÍ detectado' : 'NO detectado');
        
        // Si no detecta polígono en centro (polígono pequeño), buscar el más cercano
        if (!detected || !detected.properties) {
          console.log('[CenterPolygon] ⚠️ No detectado en centro, buscando más cercano');
          findClosestPolygonWithData(currentLevel);
          return; // Terminar aquí
        }
        
        if (detected && detected.properties) {
          const props = detected.properties;
          let detectedId = '';
          
          // Usar la misma lógica que globeDataProc.ts: del más específico al más general
          // Esto funciona automáticamente para TODOS los niveles
          if (props.ID_2 || props.id_2 || props.GID_2 || props.gid_2) {
            // Nivel 3 o 4: tiene ID_2
            detectedId = String(props.ID_2 || props.id_2 || props.GID_2 || props.gid_2);
          } else if (props.ID_1 || props.id_1 || props.GID_1 || props.gid_1) {
            // Nivel 2: tiene ID_1
            detectedId = String(props.ID_1 || props.id_1 || props.GID_1 || props.gid_1);
          } else if (props.ISO_A3 || props.iso_a3) {
            // Nivel 1: país
            detectedId = String(props.ISO_A3 || props.iso_a3 || '').toUpperCase();
          }
          
          console.log('[CenterPolygon] Nivel:', currentLevel, '| detectedId:', detectedId);
          console.log('[CenterPolygon] Props del polígono:', {
            NAME_1: props.NAME_1,
            NAME_2: props.NAME_2,
            ID_1: props.ID_1,
            ID_2: props.ID_2,
            GID_1: props.GID_1,
            GID_2: props.GID_2
          });
          
          // Verificar si tiene datos antes de activar (EN TODOS LOS NIVELES)
          const hasData = detectedId && answersData?.[detectedId];
          
          console.log('[CenterPolygon] hasData:', hasData, '| buscando ID:', detectedId);
          console.log('[CenterPolygon] answersData keys (primeros 20):', Object.keys(answersData || {}).slice(0, 20));
          
          if (hasData) {
            // Solo activar si tiene datos
            // Solo actualizar si cambió el polígono
            if (detectedId !== centerPolygonId) {
              centerPolygon = detected;
              centerPolygonId = detectedId;
              isCenterPolygonActive = true;
              // Refrescar elevación para destacar el polígono
              globe?.refreshPolyAltitudes?.();
              
              // Agregar etiqueta destacada para el polígono centrado
              addCenterPolygonLabel();
              console.log('[CenterPolygon] Activado:', detectedId, 'nivel:', currentLevel);
            }
          } else {
            // No tiene datos, buscar el más cercano
            console.log('[CenterPolygon] ❌ Sin datos para ID:', detectedId);
            console.log('[CenterPolygon] Nombre del polígono:', props.NAME_1 || props.NAME_2 || 'Sin nombre');
            console.log('[CenterPolygon] Buscando polígono más cercano con datos...');
            findClosestPolygonWithData(currentLevel);
          }
        }
        // Nota: El caso "no hay polígono detectado" ya se maneja arriba con return
      }
    } catch {}
  }}
  on:polygonClick={async (e) => {
    // BLOQUEAR clics durante animaciones de zoom
    if (isZooming) return;
    
    if (!navigationManager) return;
    try {
      const feat = e.detail?.feat;
      if (!feat) return;
      
      // Show bottom sheet with polygon data when clicking on polygons
      setSheetState('collapsed');
      
      const currentLevel = navigationManager!.getCurrentLevel();
      const iso = isoOf(feat);
      let name = nameOf(feat);
      
      if (currentLevel === 'world' && iso) {
        // Click on country from world view
        
        // PASO 1: Verificar si hay datos ANTES de permitir la navegación
        // IMPORTANTE: answersData ya está filtrado por la encuesta activa (si existe)
        const countryRecord = answersData?.[iso];
        if (!countryRecord) {
          console.log('[PolygonClick] País sin datos, tratando como click fuera');
          // NO HAY DATOS: Tratar como click fuera (no hace nada en nivel mundial)
          return;
        }
        
        // 🔧 MEJORAR NOMBRE: Buscar el nombre completo desde worldPolygons si name es un ISO
        if (name === iso || name.length <= 3 || !name || name === 'Country') {
          const countryFeature = worldPolygons?.find(p => isoOf(p) === iso);
          if (countryFeature) {
            const props = countryFeature.properties || {};
            name = props.NAME_ENGL || props.CNTR_NAME || props.ADMIN || props.NAME || props.name || iso;
            console.log('[PolygonClick] 🔧 Nombre mejorado:', { iso, name });
          }
        }
        
        // PASO 2: LIMPIAR ETIQUETAS INMEDIATAMENTE antes de cualquier cambio
        subdivisionLabels = [];
        updateSubdivisionLabels(false);
        
        // PASO 3: Calcular zoom INMEDIATAMENTE para respuesta instantánea
        const centroid = centroidOf(feat);
        const adaptiveAltitude = calculateAdaptiveZoom(feat);
        scheduleZoom(centroid.lat, centroid.lng, adaptiveAltitude, 500, 0);
        
        // PASO 4: Actualizar datos del país
        const countryData = [countryRecord];
        countryChartSegments = generateCountryChartSegments(countryData);
        
        // ✅ ACTUALIZAR VOTOS EN ACTIVEPOLLPTIONS (nivel 2)
        if (countryRecord && activePollOptions.length > 0) {
          console.log('[Click] ✅ Actualizando votos para nivel 2 (país):', iso);
          
          const updatedOptions = activePollOptions.map(option => {
            const votesForOption = countryRecord[option.key] || 0;
            console.log(`[Click]   ${option.label}: ${votesForOption} votos`);
            return { ...option, votes: votesForOption };
          });
          
          activePollOptions = [...updatedOptions];
          voteOptions = [...updatedOptions];
          voteOptionsUpdateTrigger++;
          
          tick().then(() => {
            console.log('[Click] ✅ Votos actualizados en nivel 2 - UI debería actualizarse');
          });
        }
        
        // PASO 5: PRE-CARGAR subdivisiones en paralelo durante el zoom (sin bloquear)
        const preloadPromise = (async () => {
          try {
            if (preloadedCountryIso !== iso) {
              console.log(`[PreLoad] Cargando polígonos para ${iso}...`);
              const polys = await loadCountryTopoAsGeoFeatures(iso);
              console.log(`[PreLoad] ✅ ${polys.length} polígonos cargados para ${iso}`);
              preloadedPolygons = polys;
              preloadedCountryIso = iso;
            }
          } catch (e) {
            console.error(`[PreLoad] ❌ Error cargando ${iso}:`, e);
            // Reset en caso de error
            preloadedPolygons = null;
            preloadedCountryIso = null;
          }
        })();
        
        // PASO 5: Navegar más temprano (200ms) para que aparezcan antes
        setTimeout(async () => {
          try {
            await tick();
            
            // Esperar pre-carga (probablemente ya terminó)
            await preloadPromise;
            
            // Usar polígonos pre-cargados si están disponibles
            if (preloadedPolygons && preloadedCountryIso === iso) {
              console.log(`[Navigate] Usando polígonos pre-cargados para ${iso}`);
              localPolygons = preloadedPolygons;
              await navigationManager!.navigateToCountry(iso, name);
            } else {
              console.log(`[Navigate] Navegando a ${iso} sin pre-carga`);
              await navigationManager!.navigateToCountry(iso, name);
            }
            
            // NO LIMPIAR ETIQUETAS - navigateToCountry ya las mostró
            // Las etiquetas se gestionan dentro de navigateToCountry
            
            await new Promise(resolve => requestAnimationFrame(resolve));
            await updateGlobeColors(true); // true = con fade-in
          } catch (navError) {
            console.error(`[Navigate] ❌ Error navegando a ${iso}:`, navError);
            // En caso de error, intentar recuperar el estado
            subdivisionLabels = [];
            updateSubdivisionLabels(false);
          }
        }, 200);
        
      } else if (currentLevel === 'country' && feat.properties?.ID_1) {
        // Click on subdivision from country view
        const subdivisionId = feat.properties.ID_1;
        const subdivisionName = feat.properties.NAME_1 || feat.properties.name_1 || name;
        
        // PASO 1: Verificar si hay datos ANTES de permitir la interacción
        const subdivisionKey = subdivisionId; // subdivisionId ya es "ESP.1"
        const subdivisionRecord = answersData?.[subdivisionKey];
        
        if (!subdivisionRecord) {
          console.log('[PolygonClick] Subdivisión sin datos, volviendo atrás');
          // NO HAY DATOS: Volver a nivel mundial
          subdivisionLabels = [];
          updateSubdivisionLabels(false);
          centerPolygon = null;
          centerPolygonId = null;
          isCenterPolygonActive = false;
          
          const currentPov = globe?.pointOfView();
          scheduleZoom(
            currentPov?.lat || 20, 
            currentPov?.lng || 0, 
            MAX_ZOOM_ALTITUDE,
            1000
          );
          
          await navigationManager!.navigateBack();
          
          selectedCountryName = null;
          selectedCountryIso = null;
          selectedSubdivisionName = null;
          selectedCityId = null;
          
          await new Promise(resolve => requestAnimationFrame(resolve));
          await updateGlobeColors();
          
          return;
        }
        
        // PASO 2: Actualizar datos en el bottom sheet
        subdivisionChartSegments = generateCountryChartSegments([subdivisionRecord]);
        selectedCountryIso = iso;
        
        // ✅ ACTUALIZAR VOTOS EN ACTIVEPOLLPTIONS (nivel 3)
        if (subdivisionRecord && activePollOptions.length > 0) {
          console.log('[Click] ✅ Actualizando votos para nivel 3 (subdivisión):', subdivisionKey);
          
          const updatedOptions = activePollOptions.map(option => {
            const votesForOption = subdivisionRecord[option.key] || 0;
            console.log(`[Click]   ${option.label}: ${votesForOption} votos`);
            return { ...option, votes: votesForOption };
          });
          
          activePollOptions = [...updatedOptions];
          voteOptions = [...updatedOptions];
          voteOptionsUpdateTrigger++;
          
          tick().then(() => {
            console.log('[Click] ✅ Votos actualizados en nivel 3 - UI debería actualizarse');
          });
        }
        
        // PASO 3: Verificar si tiene subdivisiones (nivel 3)
        // Intentar cargar el archivo de subdivisión para ver si existe
        const hasSubdivisions = await (async () => {
          try {
            const resp = await fetch(getCountryPath(iso, subdivisionId), { method: 'HEAD' });
            return resp.ok;
          } catch {
            return false;
          }
        })();
        
        // PASO 4: Calcular zoom y centrar
        const centroid = centroidOf(feat);
        const adaptiveAltitude = calculateAdaptiveZoomSubdivision(feat);
        const targetAlt = Math.max(0.12, adaptiveAltitude);
        
        if (hasSubdivisions) {
          // TIENE subdivisiones: navegar al siguiente nivel
          subdivisionLabels = [];
          updateSubdivisionLabels(false);
          
          scheduleZoom(centroid.lat, centroid.lng, targetAlt, 500, 0);
          
          setTimeout(async () => {
            subdivisionLabels = [];
            updateSubdivisionLabels(false);
            
            await navigationManager!.navigateToSubdivision(iso, subdivisionId, subdivisionName);
            
            await new Promise(resolve => requestAnimationFrame(resolve));
            await updateGlobeColors(true);
          }, 200);
        } else {
          // NO tiene subdivisiones: solo centrar cámara, mostrar info y activar etiqueta
          console.log(`[Click] ${subdivisionName} no tiene subdivisiones, solo centrando...`);
          scheduleZoom(centroid.lat, centroid.lng, targetAlt, 500, 0);
          
          // ACTIVAR polígono centrado con etiqueta
          setTimeout(() => {
            centerPolygon = feat;
            centerPolygonId = subdivisionKey;
            isCenterPolygonActive = true;
            globe?.refreshPolyAltitudes?.();
            addCenterPolygonLabel();
            console.log('[Click] Polígono activado con etiqueta:', subdivisionKey);
          }, 250); // Esperar que el zoom haya avanzado
        }
        
      } else if (currentLevel === 'subdivision' && feat.properties?.ID_2) {
        // NIVEL 3 o 4: Activar selección con etiqueta
        const cityName = feat.properties.NAME_2 || feat.properties.name_2 || name;
        const subdivisionName = feat.properties.NAME_1 || feat.properties.name_1;
        const cityId = feat.properties.ID_2;
        
        console.log('[Click] 🎯 Click en nivel 4:', {
          cityName,
          cityId,
          'feat.properties': feat.properties
        });
        
        // Verificar si tiene datos
        const cityRecord = answersData?.[cityId];
        if (!cityRecord) {
          console.log('[PolygonClick] Ciudad sin datos, volviendo a nivel país');
          // NO HAY DATOS: Volver a nivel país
          subdivisionLabels = [];
          updateSubdivisionLabels(false);
          centerPolygon = null;
          centerPolygonId = null;
          isCenterPolygonActive = false;
          
          const currentPov = globe?.pointOfView();
          scheduleZoom(currentPov?.lat || 0, currentPov?.lng || 0, 0.8, 700);
          
          await navigationManager!.navigateBack();
          
          selectedSubdivisionName = null;
          selectedCityId = null;
          
          // Mostrar etiqueta al volver
          if (selectedCountryIso && activePoll?.id) {
            const countryIso = selectedCountryIso;
            setTimeout(async () => {
              const subdivisionColorById = activePoll?.id ? await colorManager.loadSubdivisionColors(activePoll.id, countryIso, localPolygons || [], colorMap) : {};
              
              for (const poly of (localPolygons || [])) {
                const id1 = poly.properties?.ID_1;
                if (id1 && subdivisionColorById[String(id1)]) {
                  poly.properties._forcedColor = subdivisionColorById[String(id1)];
                }
              }
              
              await updateGlobeColors();
              
              const filteredPolygons = (localPolygons || []).filter((p: any) => !p.properties?._isParent);
              if (filteredPolygons.length > 0) {
                await new Promise(resolve => requestAnimationFrame(resolve));
                showFirstLabelWithData(filteredPolygons);
              } else {
                // FALLBACK: Mostrar nombre del país
                await generateCountryNameLabel();
              }
            }, 200);
          } else {
            setTimeout(async () => {
              const filteredPolygons = (localPolygons || []).filter((p: any) => !p.properties?._isParent);
              if (filteredPolygons.length > 0) {
                showFirstLabelWithData(filteredPolygons);
              } else {
                // FALLBACK: Mostrar nombre del país
                await generateCountryNameLabel();
              }
            }, 400);
          }
          
          return;
        }
        
        // Activar nivel 3/4
        selectedCityName = cityName;
        selectedSubdivisionName = subdivisionName;
        selectedCityId = cityId;
        
        // ACTIVAR polígono centrado con etiqueta
        centerPolygon = feat;
        centerPolygonId = cityId;
        isCenterPolygonActive = true;
        
        // Refresh visual
        setTimeout(() => {
          globe?.refreshPolyStrokes?.();
          globe?.refreshPolyAltitudes?.();
          addCenterPolygonLabel();
          console.log('[Click] Polígono nivel 3/4 activado con etiqueta:', cityId);
        }, 100);
        
        // Generate city data - PASAR cityId para usar datos reales
        generateCityChartSegments(cityName, cityId);
        console.log('[Click] 📊 cityChartSegments después de generar:', cityChartSegments);
        
        // ✅ ACTUALIZAR VOTOS EN ACTIVEPOLLPTIONS (nivel 4)
        // Buscar el ID completo de esta sub-subdivisión en answersData
        const state = navigationManager?.getState();
        const countryIso = state?.countryIso || selectedCountryIso || '';
        const parentSubdivisionId = state?.subdivisionId || selectedSubdivisionId || '';
        
        // Construir posibles IDs para buscar en answersData
        // El cityId puede ser el ID_2 completo o solo la parte final
        let possibleIds: string[] = [cityId];
        
        // Si cityId no incluye puntos, construir IDs con diferentes formatos
        if (!cityId.includes('.')) {
          // Si parentSubdivisionId ya incluye el país (ej: "ESP.1")
          if (parentSubdivisionId.includes('.')) {
            possibleIds.push(`${parentSubdivisionId}.${cityId}`);
          }
          // Si parentSubdivisionId es solo el número (ej: "1")
          else if (parentSubdivisionId) {
            possibleIds.push(`${countryIso}.${parentSubdivisionId}.${cityId}`);
          }
        }
        
        console.log('[Click] 🔢 Buscando votos para nivel 4 con IDs:', possibleIds);
        
        // Intentar encontrar datos con cualquiera de los IDs posibles
        let cityVoteData = null;
        let foundId = '';
        for (const id of possibleIds) {
          if (answersData?.[id]) {
            cityVoteData = answersData[id];
            foundId = id;
            break;
          }
        }
        
        if (cityVoteData && activePollOptions.length > 0) {
          console.log('[Click] ✅ Datos encontrados con ID:', foundId);
          
          // 🔧 USAR FUNCIÓN CENTRALIZADA
          updateVoteDataForLevel(cityVoteData, 'Nivel 4 - Ciudad (click directo)');
        } else {
          console.log('[Click] ⚠️ No se encontraron datos de votos. Intentado:', possibleIds);
          console.log('[Click] 📊 answersData keys disponibles:', Object.keys(answersData || {}).slice(0, 10));
        }
      }
    } catch (e) {
      console.error('[Click] Error handling polygon click:', e);
    }
  }}
  on:globeClick={async (e) => {
    console.log('[GlobeClick] 🔵 Evento disparado - isZooming:', isZooming, 'labelClickInProgress:', labelClickInProgress);
    
    // BLOQUEAR clics durante animaciones de zoom
    if (isZooming) {
      console.log('[GlobeClick] ⛔ Bloqueado por isZooming');
      return;
    }
    
    // BLOQUEAR si acabamos de hacer click en una etiqueta
    if (labelClickInProgress) {
      console.log('[GlobeClick] ⛔ Bloqueado por labelClick en progreso');
      return;
    }
    
    if (!navigationManager) return;
    
    try {
      const currentLevel = navigationManager!.getCurrentLevel();
      console.log('[GlobeClick] ✅ Procesando click en nivel:', currentLevel);
      
      // ELIMINADO: código que navegaba al polígono centrado
      // Ahora SIEMPRE vuelve atrás al hacer click fuera
      
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
        
        // PASO 1: LIMPIAR TODO - etiquetas y estado de polígono centrado
        subdivisionLabels = [];
        updateSubdivisionLabels(false);
        centerPolygon = null;
        centerPolygonId = null;
        isCenterPolygonActive = false;
        
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
        await navigationManager!.navigateBack();
        
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
          
          // Recargar colores y MOSTRAR ETIQUETA
          if (selectedCountryIso && activePoll?.id) {
            const countryIso = selectedCountryIso;
                        setTimeout(async () => {
              const subdivisionColorById = activePoll?.id ? await colorManager.loadSubdivisionColors(activePoll.id, countryIso, localPolygons || [], colorMap) : {};
              
              for (const poly of (localPolygons || [])) {
                const id1 = poly.properties?.ID_1;
                if (id1 && subdivisionColorById[String(id1)]) {
                  poly.properties._forcedColor = subdivisionColorById[String(id1)];
                }
              }
              
              await updateGlobeColors();
              
              // MOSTRAR ETIQUETA después de volver a nivel 2
              const filteredPolygons = (localPolygons || []).filter((p: any) => !p.properties?._isParent);
              if (filteredPolygons.length > 0) {
                await new Promise(resolve => requestAnimationFrame(resolve));
                showFirstLabelWithData(filteredPolygons);
              } else {
                // FALLBACK: Si no hay polígonos, mostrar nombre del país
                await generateCountryNameLabel();
              }
            }, 200);
          } else {
            // Sin encuesta activa, mostrar etiqueta de todos modos
            setTimeout(async () => {
              const filteredPolygons = (localPolygons || []).filter((p: any) => !p.properties?._isParent);
              if (filteredPolygons.length > 0) {
                showFirstLabelWithData(filteredPolygons);
              } else {
                // FALLBACK: Si no hay polígonos, mostrar nombre del país
                await generateCountryNameLabel();
              }
            }, 400);
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
  on:labelClick={async (e) => {
    // Manejar click en etiqueta: navegar al polígono de la etiqueta
    if (isZooming) return;
    if (!navigationManager) return;
    
    // ACTIVAR BANDERA para bloquear globeClick
    labelClickInProgress = true;
    console.log('[LabelClick] 🚫 Bloqueando globeClick temporalmente');
    
    // Desactivar después de 1000ms (tiempo suficiente para que complete la navegación)
    setTimeout(() => {
      labelClickInProgress = false;
      console.log('[LabelClick] ✅ Desbloqueando globeClick');
    }, 1000);
    
    try {
      const feat = e.detail?.feat;
      if (!feat) {
        console.warn('[LabelClick] No hay feature en la etiqueta');
        labelClickInProgress = false; // Desbloquear inmediatamente si hay error
        return;
      }
      
      console.log('[LabelClick] ✨ Click en etiqueta, navegando a polígono:', feat.properties);
      
      const currentLevel = navigationManager!.getCurrentLevel();
      const iso = isoOf(feat);
      const name = nameOf(feat);
      
      // NO VERIFICAR DATOS - La etiqueta solo existe si el polígono tiene datos
      // showFirstLabelWithData ya verificó esto antes de crear la etiqueta
      console.log('[LabelClick] Nivel actual:', currentLevel);
      console.log('[LabelClick] ISO:', iso, 'Nombre:', name);
      
      // Mostrar bottom sheet con datos del polígono
      setSheetState('collapsed');
      
      // Navegar según el nivel actual y las propiedades del feature
      if (currentLevel === 'world' && iso) {
        // Nivel mundial: navegar a país
        const countryRecord = answersData?.[iso];
        if (!countryRecord) return;
        
        subdivisionLabels = [];
        updateSubdivisionLabels(false);
        
        const centroid = centroidOf(feat);
        const adaptiveAltitude = calculateAdaptiveZoom(feat);
        scheduleZoom(centroid.lat, centroid.lng, adaptiveAltitude, 500, 0);
        
        const countryData = [countryRecord];
        countryChartSegments = generateCountryChartSegments(countryData);
        
        setTimeout(async () => {
          await tick();
          await navigationManager!.navigateToCountry(iso, name);
          // NO LIMPIAR ETIQUETAS - navigateToCountry ya las mostró
          await new Promise(resolve => requestAnimationFrame(resolve));
          await updateGlobeColors(true);
        }, 200);
        
      } else if (currentLevel === 'country' && feat.properties?.ID_1) {
        // Nivel país: navegar a subdivisión
        const subdivisionId = feat.properties.ID_1;
        const subdivisionName = feat.properties.NAME_1 || feat.properties.name_1 || name;
        
        console.log('[LabelClick] 🗺️ Nivel país → Navegando a subdivisión');
        console.log('[LabelClick] subdivisionId:', subdivisionId);
        console.log('[LabelClick] subdivisionName:', subdivisionName);
        console.log('[LabelClick] iso:', iso);
        
        const subdivisionKey = subdivisionId;
        const subdivisionRecord = answersData?.[subdivisionKey];
        
        console.log('[LabelClick] subdivisionRecord existe:', !!subdivisionRecord);
        console.log('[LabelClick] answersData tiene', Object.keys(answersData || {}).length, 'claves');
        
        // NO VERIFICAR DATOS - La etiqueta solo existe si el feature tiene datos
        // Continuar con la navegación aunque subdivisionRecord sea undefined
        if (subdivisionRecord) {
          subdivisionChartSegments = generateCountryChartSegments([subdivisionRecord]);
        }
        selectedCountryIso = iso;
        
        const hasSubdivisions = await (async () => {
          try {
            const resp = await fetch(getCountryPath(iso, subdivisionId), { method: 'HEAD' });
            return resp.ok;
          } catch { return false; }
        })();
        
        const centroid = centroidOf(feat);
        const adaptiveAltitude = calculateAdaptiveZoomSubdivision(feat);
        const targetAlt = Math.max(0.12, adaptiveAltitude);
        
        if (hasSubdivisions) {
          subdivisionLabels = [];
          updateSubdivisionLabels(false);
          scheduleZoom(centroid.lat, centroid.lng, targetAlt, 500, 0);
          
          setTimeout(async () => {
            // NO LIMPIAR ETIQUETAS - navigateToSubdivision ya las mostrará
            await navigationManager!.navigateToSubdivision(iso, subdivisionId, subdivisionName);
            await new Promise(resolve => requestAnimationFrame(resolve));
            await updateGlobeColors(true);
          }, 200);
        } else {
          scheduleZoom(centroid.lat, centroid.lng, targetAlt, 500, 0);
          setTimeout(() => {
            centerPolygon = feat;
            centerPolygonId = subdivisionKey;
            isCenterPolygonActive = true;
            globe?.refreshPolyAltitudes?.();
            addCenterPolygonLabel();
          }, 250);
        }
        
      } else if (currentLevel === 'subdivision' && feat.properties?.ID_2) {
        // Nivel subdivisión: zoom a nivel 4
        const cityName = feat.properties.NAME_2 || feat.properties.name_2 || name;
        const cityId = feat.properties.ID_2;
        
        console.log('[LabelClick] 🏙️ Nivel subdivisión → Zoom a nivel 4');
        console.log('[LabelClick] cityId:', cityId);
        console.log('[LabelClick] cityName:', cityName);
        
        const cityRecord = answersData?.[cityId];
        console.log('[LabelClick] cityRecord existe:', !!cityRecord);
        
        // NO VERIFICAR DATOS - La etiqueta solo existe si el feature tiene datos
        selectedCityName = cityName;
        selectedCityId = cityId;
        
        const centroid = centroidOf(feat);
        scheduleZoom(centroid.lat, centroid.lng, 0.08, 500);
        
        setTimeout(() => {
          globe?.refreshPolyStrokes?.();
          globe?.refreshPolyAltitudes?.();
          addCenterPolygonLabel();
        }, 100);
      }
      
    } catch (error) {
      console.error('[LabelClick] Error handling label click:', error);
      labelClickInProgress = false; // Desbloquear en caso de error
    }
  }}
/>
<!-- Degradado superior usando el color de fondo actual -->
<div
  class="globe-top-fade"
  style={`background: linear-gradient(to bottom, ${bgColor} 0%, ${hexToRgba(bgColor, 1)} 25%, ${hexToRgba(bgColor, 0.3)} 70%, transparent 100%)`}
></div>

<!-- Zoom out para volver - sin indicador visual -->

<svelte:window
  on:keydown={async (e) => {
    if (e.key === "Escape") {
      // Close dropdown if open
      if (showDropdown) {
        showDropdown = false;
        dropdownOptions = [];
        dropdownSearchQuery = '';
        
        // Dispatch evento para mostrar el nav
        dispatch('dropdownStateChange', { open: false });
        
        // Restaurar estado original del sheet
        if (originalSheetState !== null && sheetCtrl) {
          try {
            sheetCtrl.setState(originalSheetState);
            SHEET_STATE = originalSheetState;
            originalSheetState = null;
            originalSheetY = null;
          } catch (e) {
            console.warn('[Escape] Error restaurando estado del sheet:', e);
          }
        }
        return;
      }
      
      if (navigationManager && navigationManager!.getCurrentLevel() !== 'world') {
        await navigationManager!.navigateBack();
        
        // Adjust zoom based on new level
        const newLevel = navigationManager!.getCurrentLevel();
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
        } else if (newLevel === 'subdivision') {
          // Volver a subdivisión
        }
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
    bind:active={activeTopTab}
    options={["Para ti", "Tendencias", "Live"]}
    on:change={handleTopTabChange}
  />
</div>

<!-- SearchBar movido al BottomSheet -->

<div class:blocked-during-animation={isZooming}>
  <TagBar
    bind:activeTag
    activeTopTab={activeTopTab}
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

<BottomSheet
  state={SHEET_STATE}
  y={sheetY}
  isTransitioning={sheetIsTransitioning}
  isCameraAnimating={isZooming}
  {selectedCountryName}
  {selectedCountryIso}
  {selectedSubdivisionName}
  {selectedSubdivisionId}
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
  bind:isProfileModalOpen={isProfileModalOpen}
  bind:selectedProfileUserId={selectedProfileUserId}
  onToggleDropdown={toggleDropdown}
  bind:showSearch
  bind:tagQuery
  onToggleSearch={() => showSearch = !showSearch}
  onPointerDown={onSheetPointerDown}
  onScroll={onSheetScroll}
  onNavigateToView={navigateToView}
  onLoadMorePolls={loadMorePolls}
  onLocateMe={locateMe}
  on:requestExpand={() => {
    SHEET_STATE = 'expanded';
    try { sheetCtrl?.setState('expanded'); } catch {}
  }}
  on:close={() => {
    SHEET_STATE = 'hidden';
  }}
  on:vote={(e) => {
      }}
  on:polldropdownstatechange={(e) => {
    console.log('[GlobeGL] Poll dropdown state change:', e.detail);
    // Establecer variable global
    if (typeof window !== 'undefined') {
      (window as any).globalNavDropdownOpen = e.detail.open;
      console.log(`[GlobeGL] 🔵 window.globalNavDropdownOpen = ${e.detail.open}`);
    }
    // También dispatch al padre
    dispatch('dropdownstatechange', { open: e.detail.open });
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
      
      
      // Restaurar estado original del sheet
      if (originalSheetState !== null && sheetCtrl) {
        try {
          sheetCtrl.setState(originalSheetState);
          SHEET_STATE = originalSheetState;
          originalSheetState = null;
          originalSheetY = null;
        } catch (e) {
          console.warn('[Overlay click] Error restaurando estado del sheet:', e);
        }
      }
    }}
    on:keydown={(e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        showDropdown = false;
        dropdownOptions = [];
        dropdownSearchQuery = '';
        
        // Dispatch evento para mostrar el nav
        dispatch('dropdownStateChange', { open: false });
        
        // Restaurar estado original del sheet
        if (originalSheetState !== null && sheetCtrl) {
          try {
            sheetCtrl.setState(originalSheetState);
            SHEET_STATE = originalSheetState;
            originalSheetState = null;
            originalSheetY = null;
          } catch (e) {
            console.warn('[Overlay keydown] Error restaurando estado del sheet:', e);
          }
        }
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
                <span class="option-name">{option.name}</span>
                {#if option.id.includes('.')}
                  <span class="option-country">{getCountryNameFromISO(option.id.split('.')[0])}</span>
                {/if}
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

<!-- Indicador visual del polígono centrado eliminado - ahora se usa etiqueta y elevación -->

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

  /* Estilos para el dropdown con código de país */
  :global(.dropdown-option) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 12px 16px !important;
  }

  :global(.option-name) {
    flex: 1;
    text-align: left;
    font-size: 15px;
  }

  :global(.option-country) {
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 600;
    opacity: 0.9;
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    padding: 4px 8px;
    border-radius: 6px;
    letter-spacing: 0.3px;
    border: 1px solid rgba(59, 130, 246, 0.3);
    white-space: nowrap;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

</style>
