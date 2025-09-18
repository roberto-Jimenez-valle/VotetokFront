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

  const POLY_ALT = 0.04;

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
    if (!world || typeof world.globeTileEngineUrl !== 'function') return;
    try {
      if (enabled) {
        world.globeTileEngineUrl((x: number, y: number, l: number) => `https://tile.openstreetmap.org/${l}/${x}/${y}.png`);
      } else {
        world.globeTileEngineUrl(null);
        world.globeImageUrl(null);
        world.globeMaterial().color.set(sphereBaseColor);
      }
    } catch {}
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

  // Force re-apply cap color mapping from parent
  export function refreshPolyColors() {
    try {
      if (!world) return;
      world.polygonCapColor((feat: any) => (onPolyCapColor ? onPolyCapColor(feat) : hexToRgba(capBaseColor, 0.8)));
    } catch {}
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
      .polygonAltitude(() => POLY_ALT)
      .polygonSideColor(() => hexToRgba(strokeBaseColor, clamp(strokeOpacityPct / 100, 0, 1) * 0.35))
      .polygonStrokeColor(() => hexToRgba(strokeBaseColor, clamp(strokeOpacityPct / 100, 0, 1)))
      .polygonLabel(() => '')
      .polygonCapColor((feat: any) => (onPolyCapColor ? onPolyCapColor(feat) : hexToRgba(capBaseColor, 0.8)));

    // Eventos
    world.onPolygonHover(() => {});
    world.onPolygonClick((feat: any, event: MouseEvent) => {
      dispatch('polygonClick', { feat, event });
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
        if ('enableDamping' in controls) controls.enableDamping = true;
        if ('dampingFactor' in controls) controls.dampingFactor = 0.1;
        if ('rotateSpeed' in controls) controls.rotateSpeed = 0.7;
        if ('zoomSpeed' in controls) controls.zoomSpeed = 0.7;
        if (typeof controls.update === 'function') controls.update();
        if (typeof controls.addEventListener === 'function') {
          controls.addEventListener('change', () => dispatch('controlsChange'));
          controls.addEventListener('start', () => dispatch('controlsStart'));
        }
      }
    } catch {}

    // Notificar al padre que el canvas está listo
    dispatch('ready');
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
