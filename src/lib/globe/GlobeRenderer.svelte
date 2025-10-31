<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import Globe from 'globe.gl';
  import * as THREE from 'three';
  import { globeState, colorState, labelsState, type GlobeState, type ColorMapState } from '$lib/stores/globeStore';
  import type { Unsubscriber } from 'svelte/store';

  // Props
  export let worldData: any = null;
  export let width = '100%';
  export let height = '100vh';
  export let enableZoom = true;
  export let enableRotation = true;
  export let showAtmosphere = true;
  export let showGraticules = false;

  const dispatch = createEventDispatcher();

  // Referencias DOM
  let container: HTMLElement;
  let globeInstance: any = null;
  let animationFrame: number;

  // Suscripciones a stores
  let unsubscribers: Unsubscriber[] = [];

  // Estado interno
  let isInitialized = false;
  let currentPolygons: any[] = [];
  let currentLabels: any[] = [];

  // Configuración del globo
  const GLOBE_CONFIG = {
    minAltitude: 0.05,
    maxAltitude: 5,
    rotationSpeed: 0.002,
    atmosphereAltitude: 0.15,
    polygonStrokeColor: () => 'rgba(255, 255, 255, 0.2)',
    polygonSideColor: () => 'rgba(0, 100, 0, 0.05)',
    polygonCapColor: (d: any) => getPolygonColor(d),
    polygonAltitude: (d: any) => getPolygonAltitude(d),
    onPolygonClick: handlePolygonClick,
    onPolygonHover: handlePolygonHover,
    onPolygonRightClick: handlePolygonRightClick
  };

  /**
   * Inicializar el globo 3D
   */
  function initGlobe() {
    if (!container || isInitialized) return;

    try {
      // Crear instancia del globo
      globeInstance = new (Globe as any)()(container)
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
        .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
        .showAtmosphere(showAtmosphere)
        .showGraticules(showGraticules)
        .polygonStrokeColor(GLOBE_CONFIG.polygonStrokeColor)
        .polygonSideColor(GLOBE_CONFIG.polygonSideColor)
        .polygonCapColor(GLOBE_CONFIG.polygonCapColor)
        .polygonAltitude(GLOBE_CONFIG.polygonAltitude)
        .onPolygonClick(GLOBE_CONFIG.onPolygonClick)
        .onPolygonHover(GLOBE_CONFIG.onPolygonHover)
        .onPolygonRightClick(GLOBE_CONFIG.onPolygonRightClick);

      // Configurar controles
      const controls = globeInstance.controls();
      controls.enableZoom = enableZoom;
      controls.enableRotate = enableRotation;
      controls.minDistance = 101;
      controls.maxDistance = 500;
      controls.rotateSpeed = 0.5;
      controls.zoomSpeed = 0.8;

      // Agregar listeners de control
      controls.addEventListener('change', handleControlsChange);
      controls.addEventListener('start', handleControlsStart);
      controls.addEventListener('end', handleControlsEnd);

      // Configurar iluminación
      setupLighting();

      // Cargar datos si están disponibles
      if (worldData) {
        loadWorldData(worldData);
      }

      isInitialized = true;
      
      dispatch('ready', { globe: globeInstance });
      
      // Iniciar animación
      startAnimation();
      
      console.log('[GlobeRenderer] Initialized');
    } catch (error) {
      console.error('[GlobeRenderer] Initialization error:', error);
      dispatch('error', { error });
    }
  }

  /**
   * Configurar iluminación
   */
  function setupLighting() {
    if (!globeInstance) return;

    const scene = globeInstance.scene();

    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Luz direccional
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Luz puntual
    const pointLight = new THREE.PointLight(0xffffff, 0.3);
    pointLight.position.set(5, 3, 5);
    scene.add(pointLight);
  }

  /**
   * Cargar datos del mundo
   */
  function loadWorldData(data: any) {
    if (!globeInstance || !data) return;

    try {
      currentPolygons = data.features || data;
      globeInstance.polygonsData(currentPolygons);
      
      console.log('[GlobeRenderer] Loaded', currentPolygons.length, 'polygons');
    } catch (error) {
      console.error('[GlobeRenderer] Error loading world data:', error);
    }
  }

  /**
   * Obtener color del polígono basado en datos
   */
  function getPolygonColor(polygon: any): string {
    const state = $colorState;
    const iso = getPolygonIso(polygon);
    
    if (!iso) return 'rgba(128, 128, 128, 0.3)';
    
    // Si hay colorMap, usar el color correspondiente
    if (iso && state.colorMap && state.colorMap[iso]) {
      const baseColor = state.colorMap[iso];
      return applyOpacity(baseColor, state.fadeOpacity);
    }
    
    // Color por defecto según tema
    return state.isDarkTheme 
      ? 'rgba(180, 180, 180, 0.25)' 
      : 'rgba(60, 60, 60, 0.25)';
  }

  /**
   * Obtener altitud del polígono (para efectos 3D)
   */
  function getPolygonAltitude(polygon: any): number {
    const state = $colorState;
    const iso = getPolygonIso(polygon);
    
    // Si tiene datos, elevar ligeramente
    if (iso && state.colorMap && state.colorMap[iso]) {
      return 0.01;
    }
    
    return 0.005;
  }

  /**
   * Obtener ISO del polígono
   */
  function getPolygonIso(polygon: any): string | null {
    return polygon?.properties?.ISO_A3 || 
           polygon?.properties?.ISO3 ||
           polygon?.properties?.iso || 
           null;
  }

  /**
   * Aplicar opacidad a un color
   */
  function applyOpacity(color: string, opacity: number): string {
    if (color.startsWith('rgba')) {
      return color.replace(/[\d.]+\)$/, `${opacity})`);
    }
    
    if (color.startsWith('rgb')) {
      return color.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
    }
    
    if (color.startsWith('#')) {
      const rgb = hexToRgb(color);
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
    }
    
    return color;
  }

  /**
   * Convertir hex a RGB
   */
  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 128, g: 128, b: 128 };
  }

  /**
   * Manejar click en polígono
   */
  function handlePolygonClick(polygon: any, event: MouseEvent) {
    const iso = getPolygonIso(polygon);
    if (!iso) return;

    dispatch('polygonClick', {
      polygon,
      iso,
      event,
      properties: polygon.properties
    });
  }

  /**
   * Manejar hover en polígono
   */
  function handlePolygonHover(polygon: any, prevPolygon: any) {
    dispatch('polygonHover', {
      polygon,
      prevPolygon,
      iso: polygon ? getPolygonIso(polygon) : null
    });
  }

  /**
   * Manejar click derecho en polígono
   */
  function handlePolygonRightClick(polygon: any, event: MouseEvent) {
    event.preventDefault();
    
    const iso = getPolygonIso(polygon);
    if (!iso) return;

    dispatch('polygonRightClick', {
      polygon,
      iso,
      event,
      properties: polygon.properties
    });
  }

  /**
   * Manejar cambios en controles
   */
  function handleControlsChange() {
    if (!globeInstance) return;

    const controls = globeInstance.controls();
    const camera = globeInstance.camera();
    const altitude = controls.object.position.length() / 100 - 1;

    // Actualizar store con nueva altitud
    globeState.update(s => ({
      ...s,
      altitude,
      isMapMoving: true
    }));

    dispatch('controlsChange', { altitude, camera });
  }

  /**
   * Manejar inicio de movimiento
   */
  function handleControlsStart() {
    globeState.update(s => ({ ...s, isMapMoving: true }));
    dispatch('controlsStart');
  }

  /**
   * Manejar fin de movimiento
   */
  function handleControlsEnd() {
    globeState.update(s => ({ ...s, isMapMoving: false }));
    dispatch('controlsEnd');
  }

  /**
   * Animar el globo
   */
  function startAnimation() {
    if (!globeInstance || !enableRotation) return;

    const animate = () => {
      if (!globeInstance) return;

      // Auto-rotación si no se está moviendo
      const state = $globeState;
      if (!state.isMapMoving && enableRotation) {
        const controls = globeInstance.controls();
        controls.autoRotate = true;
        controls.autoRotateSpeed = GLOBE_CONFIG.rotationSpeed;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Actualizar colores del globo
   */
  function updateColors() {
    if (!globeInstance) return;

    // Forzar re-renderizado de colores
    globeInstance.polygonCapColor(GLOBE_CONFIG.polygonCapColor);
    
    // Actualizar atmósfera si está habilitada
    if (showAtmosphere) {
      const state = $colorState;
      updateAtmosphere(state.atmosphereColor, state.isDarkTheme);
    }
  }

  /**
   * Actualizar atmósfera
   */
  function updateAtmosphere(color: string, isDark: boolean) {
    if (!globeInstance || !showAtmosphere) return;

    const rgb = hexToRgb(color);
    
    // Ajustar color según tema
    if (isDark) {
      rgb.r = Math.min(255, Math.round(rgb.r * 5.0 + 120));
      rgb.g = Math.min(255, Math.round(rgb.g * 5.0 + 120));
      rgb.b = Math.min(255, Math.round(rgb.b * 5.0 + 120));
    } else {
      rgb.r = Math.max(0, Math.round(rgb.r * 0.5 - 20));
      rgb.g = Math.max(0, Math.round(rgb.g * 0.5 - 20));
      rgb.b = Math.max(0, Math.round(rgb.b * 0.5 - 20));
    }

    const atmosphereColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    globeInstance.atmosphereColor(atmosphereColor);
  }

  /**
   * Actualizar etiquetas
   */
  function updateLabels() {
    if (!globeInstance) return;

    const state = $labelsState;
    
    // TODO: Implementar sistema de etiquetas HTML
    // globeInstance.htmlElementsData(state.activeLabels);
  }

  /**
   * Navegar a punto específico
   */
  export function navigateToPoint(lat: number, lng: number, altitude = 0.5) {
    if (!globeInstance) return;

    globeInstance.pointOfView({
      lat,
      lng,
      altitude
    }, 1000); // 1 segundo de transición
  }

  /**
   * Obtener punto de vista actual
   */
  export function getPointOfView(): { lat: number; lng: number; altitude: number } | null {
    if (!globeInstance) return null;
    return globeInstance.pointOfView();
  }

  /**
   * Tomar screenshot
   */
  export function takeScreenshot(): string | null {
    if (!globeInstance) return null;
    
    const renderer = globeInstance.renderer();
    return renderer.domElement.toDataURL('image/png');
  }

  /**
   * Redimensionar globo
   */
  function handleResize() {
    if (!globeInstance || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    globeInstance.width(width);
    globeInstance.height(height);
  }

  // Lifecycle
  onMount(() => {
    // Inicializar globo
    initGlobe();

    // Suscribirse a cambios de stores
    unsubscribers.push(
      colorState.subscribe(() => updateColors()),
      labelsState.subscribe(() => updateLabels())
    );

    // Agregar listener de resize
    window.addEventListener('resize', handleResize);
  });

  onDestroy(() => {
    // Cancelar animación
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }

    // Limpiar suscripciones
    unsubscribers.forEach(unsub => unsub());

    // Remover listeners
    window.removeEventListener('resize', handleResize);

    // Destruir globo
    if (globeInstance) {
      const controls = globeInstance.controls();
      controls.removeEventListener('change', handleControlsChange);
      controls.removeEventListener('start', handleControlsStart);
      controls.removeEventListener('end', handleControlsEnd);
      
      // TODO: Verificar método de destrucción correcto
      // globeInstance.destroy();
    }

    console.log('[GlobeRenderer] Destroyed');
  });

  // Reactive statements
  $: if (worldData && isInitialized) {
    loadWorldData(worldData);
  }

  $: if (isInitialized) {
    globeInstance.showAtmosphere(showAtmosphere);
  }

  $: if (isInitialized) {
    globeInstance.showGraticules(showGraticules);
  }
</script>

<div 
  bind:this={container}
  class="globe-renderer-container"
  style="width: {width}; height: {height};"
>
  {#if !isInitialized}
    <div class="globe-loading">
      <div class="spinner"></div>
      <p>Cargando globo 3D...</p>
    </div>
  {/if}
</div>

<style>
  .globe-renderer-container {
    position: relative;
    overflow: hidden;
    background: transparent;
  }

  .globe-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: white;
  }

  .spinner {
    width: 40px;
    height: 40px;
    margin: 0 auto 20px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
