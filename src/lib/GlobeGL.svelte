<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import TopTabs from './TopTabs.svelte';
  import './GlobeGL.css';
  import { worldMap$, worldData$, loadGlobeData } from './stores/globeData';
  import { get as getStore } from 'svelte/store';
  import { clamp, hexToRgba } from './utils/colors';
  import { centroidOf, isoOf } from './utils/geo';
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
  // Detección de doble clic
  let lastClickAt = 0;
  let lastClickIso: string | null = null;
  // Visibilidad de polígonos (capa coroplética)
  let polygonsVisible = true;
  // Polígonos del dataset global (choropleth): se preservan siempre
  let worldPolygons: any[] = [];
  const ALT_THRESHOLD = 0.6; // si la altitud es menor, ocultamos polígonos
  const VERY_CLOSE_ALT = 0.15; // por debajo de este valor, sin clustering: puntos exactos

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
    try {
      globe && globe.setPolygonsData && globe.setPolygonsData(vm.polygons);
      polygonsVisible = true;
      setTilesEnabled(false);
      globe?.refreshPolyColors?.();
    } catch {}
    // Solo establecer POV inicial la primera vez
    if (_initVersion === 0) {
      try { globe?.pointOfView({ lat: 20, lng: 0, altitude: 3.5 }); } catch {}
    }
    _initVersion++;
    // Ajustar visibilidad según POV actual (evitar reactivar polígonos si estamos cerca)
    try { updatePolygonsVisibilityExt(); } catch {}
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

  function updateMarkers(visible: boolean) {
    if (!globe) return;
    ensureMarkerSetup();
    try {
      if (visible && regionVotes?.length) {
        const pov = globe?.pointOfView?.();
        const cam = globe?.getCameraParams?.();
        // Si estamos MUY cerca, pintar puntos exactos (sin clustering)
        const filtered = regionVotes.filter((v) => {
          const t = (v.tag ?? '').toString();
          return !!t && !!colorMap?.[t];
        });
        if (pov && pov.altitude <= VERY_CLOSE_ALT) {
          // Modo puntos exactos: sin clustering, sin animación y altitud fija mínima
          try {
            globe.htmlTransitionDuration(0);
            globe.htmlAltitude(() => 0.000002);
          } catch {}
          globe.htmlElementsData(filtered);
        } else {
          // Modo clusters: restaurar una transición suave y altitud dinámica estable
          const markerAlt = Math.max(0.000002, Math.min(0.002, (pov?.altitude ?? 1) * 0.6));
          try {
            globe.htmlTransitionDuration(200);
            globe.htmlAltitude(() => markerAlt);
          } catch {}
          // Recalcular SOLO si cambia significativamente la altitud o cambian los votos
          const shouldRecluster = (() => {
            if (!pov) return false;
            if (!clusteredVotes || clusteredVotes.length === 0) return true;
            if (lastClusterAlt < 0) return true;
            const delta = Math.abs(pov.altitude - lastClusterAlt);
            return delta > 0.05; // umbral de cambio de altitud
          })();
          if (shouldRecluster) {
            clusteredVotes = clusterRegionalVotes(filtered as any, pov, cam);
            lastClusterAlt = pov?.altitude ?? lastClusterAlt;
          }
          // En vista más alejada (clúster), mostrar números
          const withLabels = (clusteredVotes as any[]).map((c) => ({ ...c, showLabel: true }));
          globe.htmlElementsData(withLabels);
        }
      } else {
        globe.htmlElementsData([]);
      }
    } catch {}
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
  let mode: 'intensity' | 'trend' = 'intensity';
  let isoDominantKey: Record<string, string> = {}; // ISO -> categoría dominante
  let legendItems: Array<{ key: string; color: string; count: number }> = [];
  // Fondo del lienzo (color de background del globo)
  let bgColor = '#111827';
  // Filtros/Trending
  let activeTag: string | null = null; // etiqueta seleccionada para resaltar
  let trendingTags: Array<{ key: string; count: number }> = [];
  // Totales por hashtag para normalizar intensidad visual de avatares
  let tagTotals: Record<string, number> = {};
  let tagMin = 0;
  let tagMax = 1;
  // Votos regionales (para renderizar marcadores cuando estamos cerca)
  type VotePoint = { id: string; iso3: string; lat: number; lng: number; tag?: string };
  type ClusterPoint = { lat: number; lng: number; tag: string; count: number };
  let regionVotes: VotePoint[] = [];
  // Cache de clústeres para evitar "bailes" al rotar
  let clusteredVotes: ClusterPoint[] = [];
  let lastClusterAlt = -1;
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
     
      const targetAltitude = 0.001; // límite mínimo permitido
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
    const factor = clamp(capOpacityPct / 100, 0, 1);
    return hexToRgba(capBaseColor, intensityAlpha * factor);
  }

  // Actualiza visibilidad de polígonos según altitud (para usar fuera de onMount)
  function updatePolygonsVisibilityExt() {
    try {
      const pov = globe?.pointOfView();
      if (!pov) return;
      if (pov.altitude > 4.05) {
        globe?.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: 4.0 }, 0);
        return;
      }
      if (pov.altitude < 0.001) {
        globe?.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: 0.001 }, 0);
        return;
      }
      if (pov.altitude < ALT_THRESHOLD) {
        if (polygonsVisible) {
          globe?.setPolygonsData([]);
          polygonsVisible = false;
          setTilesEnabled(true);
          // Al entrar en modo cercano, solicitar datos regionales
          try { if (_fetchTimer) clearTimeout(_fetchTimer as any); _fetchTimer = window.setTimeout(() => { maybeFetchRegion(); }, 150) as any; } catch {}
        }
        // Mostrar/actualizar marcadores en cada cambio mientras estamos cerca
        try { updateMarkers(true); } catch {}
      } else {
        if (!polygonsVisible) {
          globe?.setPolygonsData(worldPolygons);
          polygonsVisible = true;
          setTilesEnabled(false);
        }
        // Ocultar marcadores al alejar
        try { updateMarkers(false); } catch {}
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

  // Handler de clic/doble clic en país (desde GlobeCanvas)
  function handlePolygonClick(e: CustomEvent<{ feat: any; event: MouseEvent }>) {
    const feat = e.detail?.feat;
    if (!feat) return;
    const now = Date.now();
    const iso = isoOf(feat);
    const isDouble = lastClickIso === iso && (now - lastClickAt) < 350;
    lastClickIso = iso;
    lastClickAt = now;

    if (!isDouble) {
      try {
        const c = centroidOf(feat);
        globe?.pointOfView({ lat: c.lat, lng: c.lng, altitude: 0.9 }, 700);
        selectedCountryName = nameOf(feat);
        selectedCountryIso = isoOf(feat);
        setSheetState('collapsed');
      } catch {}
      return;
    }
    try {
      const c = centroidOf(feat);
      if (polygonsVisible) {
        globe?.setPolygonsData([]);
        polygonsVisible = false;
        setTilesEnabled(true);
      }
      globe?.pointOfView({ lat: c.lat, lng: c.lng, altitude: 0.22 }, 1000);
    } catch (err) {
      console.warn('No se pudo aplicar doble clic OSM/POV:', err);
    }
  }

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
        if (pov.altitude > 4.05) {
          globe?.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: 4.0 }, 0);
          return; // evitamos evaluar el resto en este tick
        }
        // Limitar el zoom de acercamiento a una altitud mínima
        if (pov.altitude < 0.001) {
          globe?.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: 0.001 }, 0);
          return;
        }
        if (pov.altitude < ALT_THRESHOLD) {
          if (polygonsVisible) {
            globe?.setPolygonsData([]);
            polygonsVisible = false;
            setTilesEnabled(true); // al acercar, mostrar OSM
          }
        } else {
          if (!polygonsVisible) {
            globe?.setPolygonsData(worldPolygons);
            polygonsVisible = true;
            setTilesEnabled(false); // al alejar, volver a esfera de color sólido
          }
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
  {sphereBaseColor}
  {capBaseColor}
  {strokeBaseColor}
  {strokeOpacityPct}
  {sphereOpacityPct}
  {mode}
  {activeTag}
  onPolyCapColor={polyCapColor}
  on:polygonClick={handlePolygonClick}
  on:controlsChange={() => {
    updatePolygonsVisibilityExt();
  }}
  on:ready={() => {
    try {
      if (worldPolygons?.length) {
        globe?.setPolygonsData(worldPolygons);
        polygonsVisible = true;
      }
      setTilesEnabled(false);
      globe?.refreshPolyColors?.();
      updatePolygonsVisibilityExt();
      // Inicializar marcadores según altitud actual
      const pov = globe?.pointOfView?.();
      if (pov && pov.altitude < ALT_THRESHOLD) {
        updateMarkers(true);
      } else {
        updateMarkers(false);
      }
    } catch {}
  }}
/>
<!-- Degradado superior usando el color de fondo actual -->
<div
  class="globe-top-fade"
  style={`background: linear-gradient(to bottom, ${bgColor} 0%, ${hexToRgba(bgColor, 1)} 25%, ${hexToRgba(bgColor, 0.3)} 70%, transparent 100%)`}
></div>
<svelte:window
  on:keydown={(e) => {
    if (e.key === "Escape") showSettings = false;
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

<LegendPanel
  {mode}
  {capBaseColor}
  {sphereBaseColor}
  {sphereOpacityPct}
  on:toggleMode={() => { mode = mode === 'intensity' ? 'trend' : 'intensity'; }}
  on:openSettings={async (e) => {
    const r = e.detail?.rect;
    showSettings = true;
    await tick();
    if (r && panelEl) {
      const gap = 10;
      const top = Math.max(10, Math.round(r.top - panelEl.offsetHeight - gap));
      panelTop = top;
    }
  }}
/>

<!-- Botón para ir a mi ubicación (abajo derecha) -->
<button
  class="locate-btn"
  type="button"
  aria-label="Ir a mi ubicación"
  title="Ir a mi ubicación"
  on:click={locateMe}
  on:touchend|preventDefault={locateMe}
>
  <!-- Icono de localización (target) -->
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    <circle cx="12" cy="12" r="9" />
  </svg>
  <span class="sr-only">Ir a mi ubicación</span>
</button>

<BottomSheet
  state={SHEET_STATE}
  y={sheetY}
  {selectedCountryName}
  {countryChartSegments}
  onPointerDown={onSheetPointerDown}
  onScroll={onSheetScroll}
  on:close={() => setSheetState('hidden')}
/>
