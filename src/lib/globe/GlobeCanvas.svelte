<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { clamp, hexToRgba } from '$lib/utils/colors';

  export let bgColor = '#111827';
  export let sphereBaseColor = '#441220';
  export let capBaseColor = '#ff0000';
  export let strokeBaseColor = '#961A50';
  export let strokeOpacityPct = 75;
  export let sphereOpacityPct = 100;
  export let mode: 'intensity' | 'trend' = 'intensity';
  export let activeTag: string | null = null;
  export let onPolyCapColor: (feat: any) => string;

  const POLY_ALT = 0.005;

  let rootEl: HTMLDivElement | null = null;
  let world: any = null;
  let controls: any = null;
  let ro: ResizeObserver | null = null;
  let windowResizeHandler: (() => void) | null = null;

  // Public API for parent via bind:this
  export function setPolygonsData(data: any[]) {
    if (!world) return;
    try {
      world.polygonsData(data);
    } catch {}
  }
  export function setTilesEnabled(enabled: boolean) {
    world.globeTileEngineUrl(null);
        world.globeImageUrl(`//cdn.jsdelivr.net/npm/three-globe/example/img/earth-dark.jpg`);
        world.globeMaterial().color.set(sphereBaseColor);
  }
  export function pointOfView(arg?: any, duration?: number) {
    if (!world) return;
    try {
      if (arg) {
        return world.pointOfView(arg, duration ?? 0);
      }
      return world.pointOfView();
    } catch {}
  }

  // HTML overlay proxies (markers)
  export function htmlElementsData(d: any[]) {
    try { world && world.htmlElementsData && world.htmlElementsData(d); } catch {}
  }
  export function htmlLat(fn: (d: any) => number) {
    try { world && world.htmlLat && world.htmlLat(fn); } catch {}
  }
  export function htmlLng(fn: (d: any) => number) {
    try { world && world.htmlLng && world.htmlLng(fn); } catch {}
  }
  export function htmlAltitude(fn: (d: any) => number) {
    try { world && world.htmlAltitude && world.htmlAltitude(fn); } catch {}
  }
  export function htmlTransitionDuration(ms: number) {
    try { world && world.htmlTransitionDuration && world.htmlTransitionDuration(ms); } catch {}
  }
  export function htmlElement(fn: (d: any) => HTMLElement) {
    try { world && world.htmlElement && world.htmlElement(fn); } catch {}
  }

  // Camera params for better bbox estimation
  export function getCameraParams(): { fov: number; aspect: number } | undefined {
    try {
      if (!world) return undefined;
      const cam = world.camera && world.camera();
      const fov = (cam && typeof cam.fov === 'number') ? cam.fov : 50;
      const aspect = (cam && typeof cam.aspect === 'number') ? cam.aspect : (() => {
        const w = rootEl?.clientWidth || 1;
        const h = rootEl?.clientHeight || 1;
        return h > 0 ? w / h : 1.6;
      })();
      return { fov, aspect };
    } catch {
      return undefined;
    }
  }

  // Force re-apply cap color mapping from parent
  export function refreshPolyColors() {
    try {
      if (!world) return;
      world.polygonCapColor((feat: any) => (onPolyCapColor ? onPolyCapColor(feat) : hexToRgba(capBaseColor, 0.8)));
    } catch {}
  }

  // Force re-apply altitude mapping for polygons
  export function refreshPolyAltitudes() {
    try {
      if (!world) return;
      world.polygonAltitude((feat: any) => {
        const customElevation = feat?.properties?._elevation;
        return typeof customElevation === 'number' ? customElevation : POLY_ALT;
      });
    } catch {}
  }

  // Force re-apply label mapping for polygons (disable hover labels)
  export function refreshPolyLabels() {
    try {
      if (!world) return;
      console.log('[RefreshLabels] Disabling polygon hover labels');
      world.polygonLabel(() => ''); // Disable hover labels completely
    } catch {}
  }

  // Set permanent text labels as separate layer using HTML elements
  export function setTextLabels(labels: any[]) {
    try {
      if (!world) return;
      console.log('[TextLabels] Setting', labels.length, 'permanent text labels as HTML elements');
      
      // Use HTML elements for fixed geographic positioning
      if (labels.length > 0) {
        // Configure HTML elements for labels
        world.htmlElementsData(labels);
        world.htmlLat && world.htmlLat((d: any) => d.lat);
        world.htmlLng && world.htmlLng((d: any) => d.lng);
        world.htmlAltitude && world.htmlAltitude(() => 0.008); // Fixed altitude above polygons
        world.htmlTransitionDuration && world.htmlTransitionDuration(200); // Smooth transitions for LOD
        
        world.htmlElement && world.htmlElement((d: any) => {
          const el = document.createElement('div');
          el.className = 'subdivision-label-fixed';
          el.textContent = d.name || d.text;
          el.style.color = d.color || '#ffffff';
          
          // Use size from label data if available, otherwise default
          const fontSize = d.size || 11;
          el.style.fontSize = `${fontSize}px`;
          
          el.style.fontWeight = 'bold';
          el.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
          el.style.pointerEvents = 'none';
          el.style.textAlign = 'center';
          el.style.whiteSpace = 'nowrap';
          el.style.transform = 'translate(-50%, -50%)';
          el.style.fontFamily = 'Arial, sans-serif';
          el.style.userSelect = 'none';
          
          // Apply opacity if specified
          if (d.opacity !== undefined) {
            el.style.opacity = String(d.opacity);
          }
          
          return el;
        });
        
        console.log('[TextLabels] Using HTML elements for fixed positioning with LOD styling');
      } else {
        // Clear labels
        world.htmlElementsData([]);
      }
    } catch (e) {
      console.warn('[TextLabels] Error setting labels:', e);
    }
  }

  // Dispatch events
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  onMount(async () => {
    const { default: Globe } = await import('globe.gl');
    world = new Globe(rootEl!)
      .backgroundColor(bgColor);

    // Esfera: color + opacidad
    world.globeImageUrl(null);
    const mat = world.globeMaterial();
    mat.color.set(sphereBaseColor);
    mat.transparent = true;
    mat.opacity = clamp(sphereOpacityPct / 100, 0, 1);

    // Polígonos base
    world
      .polygonAltitude((feat: any) => {
        // Usar elevación personalizada si está disponible, sino usar la elevación por defecto
        const customElevation = feat?.properties?._elevation;
        return typeof customElevation === 'number' ? customElevation : POLY_ALT;
      })
      .polygonSideColor(() => hexToRgba(strokeBaseColor, clamp(strokeOpacityPct / 100, 0, 1) * 0.35))
      .polygonStrokeColor(() => hexToRgba(strokeBaseColor, clamp(strokeOpacityPct / 100, 0, 1)))
      .polygonLabel((feat: any) => {
        // Debug: mostrar etiquetas para cualquier polígono que tenga nombre
        if (feat?.properties?._subdivisionName) {
          console.log('[Label] Showing label:', feat.properties._subdivisionName, 'isChild:', feat.properties._isChild);
          return feat.properties._subdivisionName;
        }
        // Fallback: mostrar ISO para países
        if (feat?.properties?.ISO_A3) {
          return feat.properties.ISO_A3;
        }
        return '';
      })
      .polygonCapColor((feat: any) => (onPolyCapColor ? onPolyCapColor(feat) : hexToRgba(capBaseColor, 0.8)));
    
    // Configuración de etiquetas
    try {
      world.polygonLabelSize && world.polygonLabelSize(0.8);
      world.polygonLabelColor && world.polygonLabelColor(() => '#ffffff');
      world.polygonLabelAltitude && world.polygonLabelAltitude(0.01);
      world.polygonLabelResolution && world.polygonLabelResolution(2);
    } catch {}
    
    // Sin transición de levantamiento de polígonos (países): aparecer a altura mínima inmediatamente
    try { 
      world.polygonsTransitionDuration && world.polygonsTransitionDuration(0);
      // También sin transición para las etiquetas
      world.labelsTransitionDuration && world.labelsTransitionDuration(0);
    } catch {}

    // Eventos
    world.onPolygonHover(() => {});
    world.onPolygonClick((feat: any, event: MouseEvent) => {
      dispatch('polygonClick', { feat, event });
    });
    
    // Globe click (empty space, not on polygons)
    world.onGlobeClick && world.onGlobeClick((coords: any, event: MouseEvent) => {
      dispatch('globeClick', { coords, event });
    });

    // Ajuste de tamaño inicial y reactivo
    const setSize = () => {
      try {
        if (!world || !rootEl) return;
        const w = rootEl.clientWidth || 0;
        const h = rootEl.clientHeight || 0;
        if (w > 0 && h > 0) {
          world.width(w).height(h);
        }
      } catch {}
    };
    setSize();
    try {
      ro = new ResizeObserver(() => setSize());
      if (rootEl) ro.observe(rootEl);
    } catch {}
    try {
      windowResizeHandler = () => setSize();
      window.addEventListener('resize', windowResizeHandler);
    } catch {}

    // Controles
    controls = world.controls && world.controls();
    try {
      if (controls && typeof controls === 'object') {
        if ('enableDamping' in controls) controls.enableDamping = false;
        if ('dampingFactor' in controls) controls.dampingFactor = 0;
        if ('rotateSpeed' in controls) controls.rotateSpeed = 1.0;
        if ('zoomSpeed' in controls) controls.zoomSpeed = 1.0;
        // Limitar zoom mínimo y máximo
        if ('minDistance' in controls) controls.minDistance = 100; // Limitar zoom mínimo más restrictivo
        if ('maxDistance' in controls) controls.maxDistance = 500; // Limitar zoom máximo para altitude 4.0
        if (typeof controls.update === 'function') controls.update();
        if (typeof controls.addEventListener === 'function') {
          controls.addEventListener('change', () => dispatch('controlsChange'));
          controls.addEventListener('start', () => {
            dispatch('controlsStart');
            dispatch('movementStart');
          });
          controls.addEventListener('end', () => {
            dispatch('movementEnd');
          });
        }
      }
    } catch {}

    // Notificar al padre que el canvas está listo
    dispatch('ready');

    // Activar tiles por defecto
    try { setTilesEnabled(true); } catch {}
  });

  onDestroy(() => {
    try {
      if (rootEl) while (rootEl.firstChild) rootEl.removeChild(rootEl.firstChild);
    } catch {}
    try { if (ro) ro.disconnect(); } catch {}
    try { if (windowResizeHandler) window.removeEventListener('resize', windowResizeHandler); } catch {}
    world = null;
    controls = null;
  });

  // Reactive updates
  $: if (world) {
    try {
      // Fondo y esfera
      world.backgroundColor(bgColor);
      const mat = world.globeMaterial();
      mat.color.set(sphereBaseColor);
      mat.opacity = clamp(sphereOpacityPct / 100, 0, 1);
      // Bordes
      const sAlpha = clamp(strokeOpacityPct / 100, 0, 1);
      world.polygonStrokeColor(() => hexToRgba(strokeBaseColor, sAlpha));
      world.polygonSideColor(() => hexToRgba(strokeBaseColor, sAlpha * 0.35));
      // Caps
      world.polygonCapColor((feat: any) => (onPolyCapColor ? onPolyCapColor(feat) : hexToRgba(capBaseColor, 0.8)));
    } catch {}
  }

  // Trigger recolor when mode/activeTag change so props are used and no lints
  $: if (world && (mode !== undefined || activeTag !== undefined)) {
    try {
      world.polygonCapColor((feat: any) => (onPolyCapColor ? onPolyCapColor(feat) : hexToRgba(capBaseColor, 0.8)));
    } catch {}
  }
</script>

<div bind:this={rootEl} class="globe-wrap"></div>
