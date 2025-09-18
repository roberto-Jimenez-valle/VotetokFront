<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import TopTabs from './TopTabs.svelte';
  import './GlobeGL.css';
  import { goto } from '$app/navigation';
  import { worldMap$, worldData$, votes$, loadGlobeData, world3$, loadWorld3, clusters$, loadClusters } from './stores/globeData';
  import { get as getStore } from 'svelte/store';
  import { clamp, hexToRgba } from './utils/colors';
  import { centroidOf, isoOf, distKm } from './utils/geo';
  import LegendPanel from './globe/LegendPanel.svelte';
  import SettingsPanel from './globe/SettingsPanel.svelte';
  import SearchBar from './globe/SearchBar.svelte';
  import TagBar from './globe/TagBar.svelte';
  import BottomSheet from './globe/BottomSheet.svelte';
  import GlobeCanvas from './globe/GlobeCanvas.svelte';

  let rootEl: HTMLDivElement | null = null; // legacy (no longer used)
  let world: any = null; // legacy (reemplazado por globe)
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
  let allPolygons: any[] = [];
  let allFeatures: any[] = [];
  let orbitControls: any = null;
  const ALT_THRESHOLD = 0.6; // si la altitud es menor, ocultamos polígonos
  let stopOnInteract: ((e?: any) => void) | null = null;

  // Estado de las pestañas superiores y dataset
  let activeTopTab: 'Para ti' | 'Tendencias' | 'Amigos' | 'Live' = 'Para ti';
  let currentDataset: 'world' | 'world3' = 'world';
  const CLUSTER_MAP: Record<'world'|'world3', Record<'Para ti'|'Tendencias', number>> = {
    world: { 'Para ti': 3, 'Tendencias': 6 },
    world3: { 'Para ti': 1, 'Tendencias': 12 }
  };

  // Bottom sheet (tipo Google Maps)
  let selectedCountryName: string | null = null;
  let selectedCountryIso: string | null = null;
  let SHEET_STATE: 'hidden' | 'peek' | 'collapsed' | 'expanded' = 'hidden';
  const BOTTOM_BAR_PX = 0; // altura del menú inferior
  const EXPAND_SNAP_PX = 10; // umbral de arrastre hacia arriba para expandir totalmente (más sensible)
  const HIDE_SNAP_PX = 140;  // gesto claro hacia abajo para ocultar; si es poco, solo colapsa
  const COLLAPSED_VISIBLE_RATIO = 0.27; // en estado colapsado, se ve el 30% superior de la sheet
  const PEEK_VISIBLE_RATIO = 0.10;      // tercer stop: 10% visible
  // Inicializa fuera de pantalla para evitar parpadeo visible al cargar
  let sheetY = 10000; // translateY actual en px (0 = expandido, >0 hacia abajo)
  let isDraggingSheet = false;
  let dragStartY = 0;
  let dragStartSheetY = 0;
  let sheetStartState: 'hidden' | 'peek' | 'collapsed' | 'expanded' = 'hidden';
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

  // Recalcular vistas derivadas (leyenda, intensidades, trending) cuando cambian answersData/colorMap
  function recomputeDataViews() {
    try {
      const data = allPolygons || [];
      // Calcular claves dominantes por ISO y la leyenda (conteo por categoría)
      isoDominantKey = {};
      const counts: Record<string, number> = {};
      for (const f of data) {
        const iso = isoOf(f);
        const key = getDominantKey(iso);
        isoDominantKey[iso] = key;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      legendItems = Object.keys(colorMap || {})
        .filter((k) => k in counts)
        .map((k) => ({ key: k, color: colorMap[k], count: counts[k] }))
        .sort((a, b) => b.count - a.count);

      // Calcular trending por volumen total (suma de respuestas por clave)
      const totals: Record<string, number> = {};
      for (const rec of Object.values(answersData)) {
        for (const [k, v] of Object.entries(rec)) {
          const n = typeof v === 'number' ? v : Number(v) || 0;
          totals[k] = (totals[k] ?? 0) + n;
        }
      }
      tagTotals = totals;
      const totVals = Object.values(tagTotals);
      tagMin = totVals.length ? Math.min(...totVals) : 0;
      tagMax = totVals.length ? Math.max(...totVals) : 1;
      trendingTags = Object.entries(totals)
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      // Calcular intensidad por país (suma de respuestas) y normalizar
      isoIntensity = {};
      const vals: number[] = [];
      for (const f of data) {
        const iso = isoOf(f);
        const rec = answersData?.[iso];
        if (rec) {
          const sum = Object.values(rec).reduce(
            (acc, v) => acc + (typeof v === 'number' ? v : Number(v) || 0),
            0
          );
          isoIntensity[iso] = sum;
          vals.push(sum);
        }
      }
      intensityMin = vals.length ? Math.min(...vals) : 0;
      intensityMax = vals.length ? Math.max(...vals) : 1;

      // Forzar recoloreado
      if (world) {
        try {
          world.polygonCapColor((feat: any) => polyCapColor(feat));
        } catch {}
      }
      refreshMapMarkers();
    } catch {}
  }

  async function switchDataset(ds: 'world' | 'world3') {
    try {
      if (ds === 'world3') {
        await loadWorld3();
        const dj: any = getStore(world3$);
        if (dj) {
          answersData = dj?.ANSWERS ?? {};
          colorMap = dj?.colors ?? {};
          recomputeDataViews();
        }
      } else {
        const dj: any = getStore(worldData$);
        if (dj) {
          answersData = dj?.ANSWERS ?? {};
          colorMap = dj?.colors ?? {};
          recomputeDataViews();
        }
      }
    } catch {}
  }

  // Cargar clusters según pestaña/dataset
  $: if ((activeTopTab === 'Para ti' || activeTopTab === 'Tendencias') && currentDataset) {
    const tabKey = activeTopTab as 'Para ti' | 'Tendencias';
    const id = CLUSTER_MAP[currentDataset][tabKey];
    loadClusters(id).then(() => { try { refreshMapMarkers(); } catch {} });
  }

  // Cambiar dataset y recalcular cuando cambie el selector
  $: if (currentDataset && world) {
    switchDataset(currentDataset);
  }

  function clampPx(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }
  function setSheetState(state: 'hidden' | 'peek' | 'collapsed' | 'expanded') {
    SHEET_STATE = state;
    const containerH = Math.max(0, (window.innerHeight || 0) - BOTTOM_BAR_PX);
    if (state === 'hidden') sheetY = containerH+150;            // oculto (fuera de vista)
    else if (state === 'peek') sheetY = containerH * (1 - PEEK_VISIBLE_RATIO);           // 10% visible
    else if (state === 'collapsed') sheetY = containerH * (1 - COLLAPSED_VISIBLE_RATIO); // 30% visible
    else sheetY = 55;                                        // expandido arriba
  }
  function onWindowResizeForSheet() {
    // Recalcular posición según estado actual
    setSheetState(SHEET_STATE);
  }
  function onSheetPointerDown(e: PointerEvent | TouchEvent) {
    // No iniciar drag si el target está dentro del botón de cierre
    try {
      const t = (e as any).target as Element | null;
      if (t && t.closest && t.closest('.sheet-close')) return;
    } catch {}
    isDraggingSheet = true;
    sheetStartState = SHEET_STATE;
    const y = (e as TouchEvent).touches?.[0]?.clientY ?? (e as PointerEvent).clientY ?? 0;
    dragStartY = y;
    dragStartSheetY = sheetY;
    window.addEventListener('pointermove', onSheetPointerMove as any, { passive: false } as any);
    window.addEventListener('pointerup', onSheetPointerUp as any, { passive: true } as any);
    window.addEventListener('touchmove', onSheetPointerMove as any, { passive: false } as any);
    window.addEventListener('touchend', onSheetPointerUp as any, { passive: true } as any);
  }
  function onSheetPointerMove(e: PointerEvent | TouchEvent) {
    if (!isDraggingSheet) return;
    const y = (e as TouchEvent).touches?.[0]?.clientY ?? (e as PointerEvent).clientY ?? 0;
    const dy = y - dragStartY;
    const containerH = Math.max(0, (window.innerHeight || 0) - BOTTOM_BAR_PX);
    sheetY = clampPx(dragStartSheetY + dy, 0, containerH);
    // Evitar scroll de fondo en móvil durante el drag
    if ('preventDefault' in e && (e as any).cancelable) { try { (e as any).preventDefault(); } catch {} }
  }
  function onSheetPointerUp() {
    if (!isDraggingSheet) return;
    isDraggingSheet = false;
    const containerH = Math.max(0, (window.innerHeight || 0) - BOTTOM_BAR_PX);
    const dyTotal = sheetY - dragStartSheetY; // + hacia abajo, - hacia arriba
    // 1) Ocultar solo si está MUY cerca del fondo (soltada casi abajo)
    if (sheetY >= containerH * 0.95) {
      setSheetState('hidden');
    } else if (dyTotal <= -EXPAND_SNAP_PX) {
      // 2) Gesto hacia arriba: subir una parada
      if (sheetStartState === 'peek') setSheetState('collapsed');
      else /* collapsed or expanded */ setSheetState('expanded');
    } else if (dyTotal >= EXPAND_SNAP_PX) {
      // 3) Gesto hacia abajo: bajar una parada
      if (sheetStartState === 'expanded') setSheetState('collapsed');
      else if (sheetStartState === 'collapsed') setSheetState('peek');
      else /* peek */ setSheetState('hidden');
    } else {
      // 4) Gesto corto: si estaba en 'peek' y el gesto fue hacia abajo (aunque sea poco) -> ocultar
      if (sheetStartState === 'peek' && dyTotal > 0) {
        setSheetState('hidden');
        window.removeEventListener('pointermove', onSheetPointerMove as any);
        window.removeEventListener('pointerup', onSheetPointerUp as any);
        window.removeEventListener('touchmove', onSheetPointerMove as any);
        window.removeEventListener('touchend', onSheetPointerUp as any);
        return;
      }
      // En otro caso, enganchar a la ancla más cercana (expanded, collapsed, peek)
      const expandedY = 0;
      const collapsedY = containerH * (1 - COLLAPSED_VISIBLE_RATIO);
      const peekY = containerH * (1 - PEEK_VISIBLE_RATIO);
      const anchors = [
        { y: expandedY, state: 'expanded' as const },
        { y: collapsedY, state: 'collapsed' as const },
        { y: peekY, state: 'peek' as const }
      ];
      const nearest = anchors.reduce((a, b) => Math.abs(b.y - sheetY) < Math.abs(a.y - sheetY) ? b : a, anchors[0]);
      setSheetState(nearest.state);
    }
    window.removeEventListener('pointermove', onSheetPointerMove as any);
    window.removeEventListener('pointerup', onSheetPointerUp as any);
    window.removeEventListener('touchmove', onSheetPointerMove as any);
    window.removeEventListener('touchend', onSheetPointerUp as any);
  }

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
  let legendBarEl: HTMLDivElement | null = null;
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
  let tagQuery = '';
  let showSearch = false;
  let searchInputEl: HTMLInputElement | null = null;
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

  // Datos placeholder para tabs
  let userInterests: string[] = [
    'travel','food','music','sports','tech','fashion','gaming','art','news','finance','health','movies'
  ];
  // Votos geolocalizados (uno por punto)
  let votes: Array<{ id: string; iso3?: string; lat: number; lng: number; tag?: string; city?: string }> = [];
  let trendingAccounts: Array<{ handle: string; avatar: string }> = [
    { handle: 'dancepro', avatar: 'https://i.pravatar.cc/48?img=6' },
    { handle: 'cookwithme', avatar: 'https://i.pravatar.cc/48?img=7' },
    { handle: 'travelnow', avatar: 'https://i.pravatar.cc/48?img=8' },
    { handle: 'techgeek', avatar: 'https://i.pravatar.cc/48?img=9' },
    { handle: 'musiclover', avatar: 'https://i.pravatar.cc/48?img=10' },
    { handle: 'fitlife', avatar: 'https://i.pravatar.cc/48?img=11' },
    { handle: 'gamerzone', avatar: 'https://i.pravatar.cc/48?img=12' },
    { handle: 'artdaily', avatar: 'https://i.pravatar.cc/48?img=13' },
    { handle: 'newsflash', avatar: 'https://i.pravatar.cc/48?img=14' },
    { handle: 'streetfood', avatar: 'https://i.pravatar.cc/48?img=15' },
  ];

  // Estado: elementos vistos (para ring del avatar)
  let seenSet: Set<string> = new Set();
  const seenKeyForTag = (k: string) => `#${k}`;
  const seenKeyForAccount = (h: string) => `@${h}`;
  const seenKeyForLocation = (n: string) => `loc:${n}`;
  const seenKeyForFriend = (n: string) => `friend:${n}`;
  const isSeen = (key: string) => seenSet.has(key);
  function markSeen(key: string) {
    if (!seenSet.has(key)) {
      const next = new Set(seenSet);
      next.add(key);
      seenSet = next;
    }
  }
  let trendingLocations: Array<{ name: string; lat: number; lng: number }> = [
    { name: 'Madrid', lat: 40.4168, lng: -3.7038 },
    { name: 'Ciudad de México', lat: 19.4326, lng: -99.1332 },
    { name: 'Buenos Aires', lat: -34.6037, lng: -58.3816 },
    { name: 'Miami', lat: 25.7617, lng: -80.1918 },
    { name: 'Barcelona', lat: 41.3874, lng: 2.1686 },
    { name: 'Santiago', lat: -33.4489, lng: -70.6693 },
    { name: 'Lima', lat: -12.0464, lng: -77.0428 },
    { name: 'Bogotá', lat: 4.7110, lng: -74.0721 },
    { name: 'New York', lat: 40.7128, lng: -74.0060 },
    { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  ];
  let friends: Array<{ name: string; avatar: string }>= [
    { name: 'Ana', avatar: 'https://i.pravatar.cc/64?img=1' },
    { name: 'Luis', avatar: 'https://i.pravatar.cc/64?img=2' },
    { name: 'Marta', avatar: 'https://i.pravatar.cc/64?img=3' },
    { name: 'Pedro', avatar: 'https://i.pravatar.cc/64?img=4' },
    { name: 'Sofía', avatar: 'https://i.pravatar.cc/64?img=5' },
    { name: 'Carlos', avatar: 'https://i.pravatar.cc/64?img=6' },
    { name: 'Elena', avatar: 'https://i.pravatar.cc/64?img=7' },
    { name: 'Diego', avatar: 'https://i.pravatar.cc/64?img=8' },
    { name: 'Lucía', avatar: 'https://i.pravatar.cc/64?img=9' },
    { name: 'Pablo', avatar: 'https://i.pravatar.cc/64?img=10' },
    { name: 'Sara', avatar: 'https://i.pravatar.cc/64?img=11' },
    { name: 'Jorge', avatar: 'https://i.pravatar.cc/64?img=12' },
  ];

  // Construir mezcla para "Para ti": intercalar intereses, amigos, ubicaciones y cuentas
  type ParaTiItem =
    | { type: 'tag'; key: string }
    | { type: 'friend'; name: string; avatar: string }
    | { type: 'location'; name: string; lat: number; lng: number }
    | { type: 'account'; handle: string; avatar: string };

  function buildParaTiMixed(): ParaTiItem[] {
    const tags = (userInterests.length ? userInterests : Object.keys(colorMap || {}).slice(0, 12)).map((k) => ({ type: 'tag' as const, key: k }));
    const fr = friends.map((f) => ({ type: 'friend' as const, name: f.name, avatar: f.avatar }));
    const locs = trendingLocations.map((l) => ({ type: 'location' as const, name: l.name, lat: l.lat, lng: l.lng }));
    const accs = trendingAccounts.map((a) => ({ type: 'account' as const, handle: a.handle, avatar: a.avatar }));
    const res: ParaTiItem[] = [];
    let iT = 0, iF = 0, iL = 0, iA = 0;
    let rotate = 0;
    while (iT < tags.length || iF < fr.length || iL < locs.length || iA < accs.length) {
      const remaining = [tags.length - iT, fr.length - iF, locs.length - iL, accs.length - iA];
      const indices = [0,1,2,3];
      // ordenar por mayor restante, y en empate usar rotación para alternar prioridades
      indices.sort((a,b) => {
        const da = remaining[a], db = remaining[b];
        if (da !== db) return db - da;
        // desempate estable por rotación
        const ra = (a - rotate + 4) % 4;
        const rb = (b - rotate + 4) % 4;
        return ra - rb;
      });
      let placed = false;
      for (const idx of indices) {
        if (idx === 0 && iT < tags.length) { res.push(tags[iT++]); placed = true; break; }
        if (idx === 1 && iF < fr.length) { res.push(fr[iF++]); placed = true; break; }
        if (idx === 2 && iL < locs.length) { res.push(locs[iL++]); placed = true; break; }
        if (idx === 3 && iA < accs.length) { res.push(accs[iA++]); placed = true; break; }
      }
      if (!placed) break;
      rotate = (rotate + 1) % 4;
    }
    return res;
  }
  let paraTiMixed: ParaTiItem[] = [];
  $: paraTiMixed = buildParaTiMixed();
  // Listas separadas para mostrar por línea
  // Declaraciones para variables reactivas derivadas de Para ti
  let paraTiTags: Array<{ type: 'tag'; key: string }> = [];
  let paraTiAccounts: Array<{ type: 'account'; handle: string; avatar: string }> = [];
  // Declaraciones para listas derivadas de Tendencias
  let trendingTagsOnly: Array<{ type: 'tag'; key: string }> = [];
  let trendingAccountsOnly: Array<{ type: 'account'; handle: string; avatar: string }> = [];
  $: paraTiTags = paraTiMixed.filter((i) => i.type === 'tag');
  $: paraTiAccounts = paraTiMixed.filter((i) => i.type === 'account');
  

  // Ajustes visuales
  const GLOBE_IMAGE = null;
  const SKY_IMAGE = '';

  // Altitud constante para todos los polígonos (sin extrusión variable)
  const POLY_ALT = 0.04;
  const POLY_ALT_HOVER = 0.08;

  // Colores base
  const CAP_COLOR = '#ff0000';               // color base inicial (se ajusta por slider)
  const SIDE_COLOR = 'rgba(200, 10, 80, 0.75)'; // tenue para laterales
  const STROKE_COLOR = 'rgba(150, 10, 80, 0.75)';                // borde (se sobreescribe por slider)
  const HOVER_COLOR = 'steelblue';            // azul al hover
  let tilesSwitched = false; // para no reconfigurar OSM en cada doble clic

  // Activar/desactivar teselas OSM según visibilidad de polígonos
  function setTilesEnabled(enabled: boolean) {
    try {
      if (globe && typeof globe.setTilesEnabled === 'function') {
        globe.setTilesEnabled(enabled);
        tilesSwitched = !!enabled;
      }
      refreshMapMarkers();
    } catch {}
  }

  // Centrar cámara en una lat/lng concreta (usado por ubicaciones en Tendencias)
  function focusLocation(lat: number, lng: number, altitude = 0.9, duration = 800) {
    try {
      stopAutoRotate();
      // Respetar límite máximo de alejamiento
      const alt = clamp(altitude, 0.001, 4);
      globe?.pointOfView({ lat, lng, altitude: alt }, duration);
    } catch {}
  }

  // Marcadores HTML en modo OSM (si capa coroplética oculta) para 'Tendencias'
  function refreshMapMarkers() {
    if (!globe || typeof globe.htmlElementsData !== 'function') return;
    try {
      let alt = 1;
      try { const pov = globe.pointOfView(); alt = pov?.altitude ?? 1; } catch {}
      const inAltRange = alt <= 0.6 && alt >= 0.001;
      const shouldShow = activeTopTab === 'Tendencias' && inAltRange;
      if (!shouldShow) {
        globe.htmlElementsData([]);
        return;
      }
      const clustersData = getStore(clusters$) as any[] | null;
      const useClusters = Array.isArray(clustersData) && clustersData.length > 0;
      const data = useClusters ? clustersData : (votes || []);
      // Determinar umbral de clustering según altitud de la cámara
      let clusterKm = 80; // por defecto
      // Si alt <= 0.1 no hay clustering: puntos individuales
      const noCluster = alt <= 0.1;
      // Rango de altitudes soportado: (0.6, 0.001]. Más cerca => menor clusterKm.
      if (!noCluster) {
        if (alt > 0.5) clusterKm = 160;      // ~0.6 -> clusters amplios
        else if (alt > 0.4) clusterKm = 120; // 0.5-0.4
        else if (alt > 0.3) clusterKm = 90;  // 0.4-0.3
        else if (alt > 0.2) clusterKm = 60;  // 0.3-0.2
        else /* alt > 0.1 */ clusterKm = 40; // 0.2-0.1
      }

      // distancia aproximada movida a utils/geo.ts (distKm)

      type Cluster = { lat: number; lng: number; count: number };
      let elements: Array<{ lat: number; lng: number; count: number }> = [];
      if (noCluster) {
        // Pasar puntos individuales tal cual (count=1)
        elements = data
          .map((v: any) => ({ lat: Number(v.lat), lng: Number(v.lng), count: 1 }))
          .filter((d) => isFinite(d.lat) && isFinite(d.lng));
      } else {
        const clusters: Cluster[] = [];
        for (const v of data) {
          const lat = Number(v.lat), lng = Number(v.lng);
          if (!isFinite(lat) || !isFinite(lng)) continue;
          // encontrar cluster cercano
          let bestIdx = -1;
          let bestDist = Infinity;
          for (let i = 0; i < clusters.length; i++) {
            const c = clusters[i];
            const d = distKm(lat, lng, c.lat, c.lng);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
          }
          if (bestIdx >= 0 && bestDist <= clusterKm) {
            // actualizar centroide simple
            const c = clusters[bestIdx];
            const n = c.count + 1;
            c.lat = (c.lat * c.count + lat) / n;
            c.lng = (c.lng * c.count + lng) / n;
            c.count = n;
          } else {
            clusters.push({ lat, lng, count: 1 });
          }
        }
        elements = clusters;
      }
      globe.htmlElementsData(elements);
      globe.htmlLat((d: any) => Number(d.lat));
      globe.htmlLng((d: any) => Number(d.lng));
      globe.htmlAltitude(() => (useClusters ? 0.001 : (noCluster ? 0 : 0.002)));
      globe.htmlTransitionDuration(0);
      globe.htmlElement((d: any) => {
          const el = document.createElement('div');
          if (useClusters) {
            el.className = 'cluster-avatar';
            const img = document.createElement('img');
            img.src = d.src || 'https://i.pravatar.cc/32';
            img.alt = 'avatar';
            img.width = 24;
            img.height = 24;
            img.style.borderRadius = '999px';
            img.style.border = '1px solid rgba(0,0,0,0.35)';
            el.appendChild(img);
          } else if (!noCluster && d.count > 1) {
            el.className = 'vote-cluster';
            el.textContent = String(d.count);
          } else {
            el.className = 'vote-dot';
          }
          el.title = useClusters ? 'Hotspot' : (d.count > 1 ? `${d.count} votos` : '1 voto');
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            focusLocation(Number(d.lat), Number(d.lng), 0.12, 450);
          });
          return el;
        });
    } catch {}
  }

  // ¿Está el globo rotando automáticamente ahora?
  function isGlobeRotating(): boolean { return false; }

  // Detener la rotación automática del globo (si está activa)
  function stopAutoRotate() { /* manejado por GlobeCanvas (sin autorotate) */ }

  // Volar a mi ubicación
  async function locateMe() {
    try {
      stopAutoRotate();
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
        world.polygonsData([]);
        polygonsVisible = false;
        setTilesEnabled(true);
      }
      world.pointOfView({ lat, lng, altitude: targetAltitude }, 1000);
    } catch (e) {
      console.warn('No se pudo obtener la ubicación:', e);
      alert('No se pudo obtener tu ubicación. Revisa permisos de ubicación del navegador.');
    }
  }

  // Util para rotular desde diversas propiedades
  function nameOf(d: any): string {
    const p = d?.properties ?? {};
    return (
      p.ADMIN ??
      p.NAME ??
      p.name ??
      p.SOVEREIGNT ??
      p.ISO3_CODE ??
      p.ISO_A3 ??
      p.ISO_A2 ??
      'Country'
    );
  }

  // (el conversor HSL ya no es necesario)

  // geo helpers moved to $lib/utils/geo

  

  function opacityForIso(iso: string): number {
    const v = isoIntensity[iso];
    if (v == null) return 0.2; // sin datos, opacidad baja
    if (intensityMax === intensityMin) return 0.6; // todos iguales
    const t = (v - intensityMin) / (intensityMax - intensityMin);
    // mapear a rango [0.25, 1]
    return 0.25 + t * 0.75;
  }

  // Opacidad para hashtag según totales normalizados
  function alphaForTag(key: string): number {
    const v = tagTotals?.[key];
    if (v == null) return 0.45;
    if (tagMax === tagMin) return 0.8;
    const t = (v - tagMin) / (tagMax - tagMin);
    // Rango suave para visibilidad: [0.45, 1]
    return 0.45 + t * 0.55;
  }

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
        }
      } else {
        if (!polygonsVisible) {
          globe?.setPolygonsData(allPolygons);
          polygonsVisible = true;
          setTilesEnabled(false);
        }
      }
      refreshMapMarkers();
    } catch {}
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
        stopAutoRotate();
        const c = centroidOf(feat);
        globe?.pointOfView({ lat: c.lat, lng: c.lng, altitude: 0.9 }, 700);
        selectedCountryName = nameOf(feat);
        selectedCountryIso = isoOf(feat);
        setSheetState('collapsed');
      } catch {}
      return;
    }
    try {
      stopAutoRotate();
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

  function getDominantKey(iso: string): string {
    const rec = answersData?.[iso];
    if (!rec) return 'No data';
    let kBest = '';
    let vBest = -Infinity;
    for (const [k, v] of Object.entries(rec)) {
      const n = typeof v === 'number' ? v : Number(v);
      if (n > vBest) { vBest = n; kBest = k; }
    }
    return kBest || 'No data';
  }

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
  // Al cambiar de pestaña, limpiar filtros activos de etiqueta
  $: if (activeTopTab) { activeTag = null; }
  // Refrescar marcadores si algo cambia
  $: if (globe) { refreshMapMarkers(); }

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

  function buildTrendingMixed(): TrendItem[] {
    const tagItems: TrendItem[] = (trendingTags || [])
      .filter(t => !tagQuery || t.key.toLowerCase().includes(tagQuery.toLowerCase()))
      .map(t => ({ type: 'tag', key: t.key }));
    const accItems: TrendItem[] = (trendingAccounts || []).map(a => ({ type: 'account', handle: a.handle, avatar: a.avatar }));
    const locItems: TrendItem[] = (trendingLocations || []).map(l => ({ type: 'location', name: l.name, lat: l.lat, lng: l.lng }));
    const maxLen = Math.max(tagItems.length, accItems.length, locItems.length);
    const mixed: TrendItem[] = [];
    for (let i = 0; i < maxLen; i++) {
      if (i < tagItems.length) mixed.push(tagItems[i]);
      if (i < accItems.length) mixed.push(accItems[i]);
      if (i < locItems.length) mixed.push(locItems[i]);
    }
    return mixed;
  }
  let trendingMixed: TrendItem[] = [];
  $: trendingMixed = activeTopTab === 'Tendencias' ? buildTrendingMixed() : [];
  // Derivados de trendingMixed (declarados más arriba)
  $: trendingTagsOnly = trendingMixed.filter((i) => i.type === 'tag');
  $: trendingAccountsOnly = trendingMixed.filter((i) => i.type === 'account');
  $: if (world) {
    try {
      // Esfera: color + opacidad
      const mat = world.globeMaterial();
      mat.color.set(sphereBaseColor);
      mat.transparent = true;
      mat.opacity = clamp(sphereOpacityPct / 100, 0, 1);
      // Fondo del lienzo
      world.backgroundColor(bgColor);
      // Forzar re-render para aplicar nuevos colores de polígonos
      world.polygonCapColor((feat: any) => polyCapColor(feat));
      const sAlpha = clamp(strokeOpacityPct / 100, 0, 1);
      world.polygonStrokeColor(() => hexToRgba(strokeBaseColor, sAlpha));
      world.polygonSideColor(() => hexToRgba(strokeBaseColor, sAlpha * 0.35));
    } catch {}
  }

  // Si cambia el modo, recolorear y (opcional) recalcular leyenda
  $: if (mode && world) {
    try {
      world.polygonCapColor((feat: any) => polyCapColor(feat));
    } catch {}
  }
  // Si cambia la etiqueta activa, GlobeCanvas actualiza via onPolyCapColor

  onMount(async () => {
    // Cargar GeoJSON y datos (usa store)
    await loadGlobeData();
    // Asegurar que el hijo GlobeCanvas está montado
    try { await tick(); } catch {}
    const geo = getStore(worldMap$);
    const dataJson = getStore(worldData$);
    const vjson = getStore(votes$);
    if (!geo) {
      console.error('No se pudo cargar el mapa mundial');
      return;
    }
    if (!dataJson) {
      console.error('No se pudo cargar los datos del mundo');
      return;
    }
    votes = Array.isArray(vjson?.votes) ? vjson.votes : [];
    answersData = dataJson?.ANSWERS ?? {};
    colorMap = dataJson?.colors ?? {};
    const features: any[] = Array.isArray(geo?.features) ? geo.features : [];

    // Filtra Antártida si aparece como ISO3 ATA o nombre
    const data = features.filter(f => {
      const p = f?.properties ?? {};
      const iso3 = (p.ISO_A3 ?? '').toString().toUpperCase();
      const name = (p.ADMIN ?? p.NAME ?? p.name ?? '').toString().toUpperCase();
      return iso3 !== 'ATA' && name !== 'ANTARCTICA';
    });

    // Calcular claves dominantes por ISO y la leyenda (conteo por categoría)
    isoDominantKey = {};
    const counts: Record<string, number> = {};
    for (const f of data) {
      const iso = isoOf(f);
      const key = getDominantKey(iso);
      isoDominantKey[iso] = key;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    legendItems = Object.keys(colorMap || {})
      .filter(k => k in counts)
      .map(k => ({ key: k, color: colorMap[k], count: counts[k] }))
      .sort((a, b) => b.count - a.count);

    // Calcular trending por volumen total (suma de respuestas por clave)
    const totals: Record<string, number> = {};
    for (const rec of Object.values(answersData)) {
      for (const [k, v] of Object.entries(rec)) {
        const n = typeof v === 'number' ? v : Number(v) || 0;
        totals[k] = (totals[k] ?? 0) + n;
      }
    }
    // Guardar para normalización de avatares y calcular min/max
    tagTotals = totals;
    const totVals = Object.values(tagTotals);
    tagMin = totVals.length ? Math.min(...totVals) : 0;
    tagMax = totVals.length ? Math.max(...totVals) : 1;
    trendingTags = Object.entries(totals)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Calcular intensidad por país (suma de respuestas) y normalizar
    isoIntensity = {};
    const vals: number[] = [];
    for (const f of data) {
      const iso = isoOf(f);
      const rec = answersData?.[iso];
      if (rec) {
        const sum = Object.values(rec).reduce((acc, v) => acc + (typeof v === 'number' ? v : Number(v) || 0), 0);
        isoIntensity[iso] = sum;
        vals.push(sum);
      }
    }
    intensityMin = vals.length ? Math.min(...vals) : 0;
    intensityMax = vals.length ? Math.max(...vals) : 1;

    // Configurar polígonos con altura constante y colores según datos (via GlobeCanvas)
    allPolygons = data;
    try {
      globe && globe.setPolygonsData && globe.setPolygonsData(data);
      polygonsVisible = true;
      setTilesEnabled(false); // aseguramos vista coroplética inicial
      // Fuerza recalcular color de caps y marcadores tras cargar
      try { globe && globe.refreshPolyColors && globe.refreshPolyColors(); } catch {}
      try { refreshMapMarkers(); } catch {}
    } catch {}

    // Punto de vista inicial más alejado
    try { globe?.pointOfView({ lat: 20, lng: 0, altitude: 3.5 }); } catch {}

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
            globe?.setPolygonsData(allPolygons);
            polygonsVisible = true;
            setTilesEnabled(false); // al alejar, volver a esfera de color sólido
          }
        }
        // Recalcular marcadores tras cualquier cambio de visibilidad o POV
        refreshMapMarkers();
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
    world = null;
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
    try { refreshMapMarkers(); } catch {}
  }}
  on:ready={() => {
    try {
      if (allPolygons?.length) {
        globe?.setPolygonsData(allPolygons);
        polygonsVisible = true;
      }
      setTilesEnabled(false);
      globe?.refreshPolyColors?.();
      refreshMapMarkers();
      updatePolygonsVisibilityExt();
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
    bind:active={activeTopTab}
    bind:symbolMode
    options={["Para ti", "Tendencias", "Live"]}
    on:change={(e) => (activeTopTab = e.detail as any)}
    on:symbolChange={(e) => {
      const m = e.detail as "#" | "@";
      showAccountsLine = m === "@";
    }}
  />
</div>

<SearchBar bind:show={showSearch} bind:query={tagQuery} />

<TagBar
  bind:activeTag
  {activeTopTab}
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
      bind:currentDataset
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
  on:mousedown|preventDefault={stopAutoRotate}
  on:touchstart|preventDefault={stopAutoRotate}
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
