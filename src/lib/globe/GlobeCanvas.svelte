<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { clamp, hexToRgba } from '$lib/utils/colors';

  export let bgColor = '#000000';
  export let sphereBaseColor = '#441220';
  export let capBaseColor = '#ff0000';
  export let strokeBaseColor = '#961A50';
  export let strokeOpacityPct = 75;
  export let sphereOpacityPct = 100;
  export let mode: 'intensity' | 'trend' = 'intensity';
  export let activeTag: string | null = null;
  export let onPolyCapColor: (feat: any) => string;
  export let selectedCityId: string | null = null; // ID de la ciudad/provincia seleccionada (nivel 4)

  const POLY_ALT = 0.017; // Elevación aumentada para mejor visibilidad del mapa coroplético
  const POLY_ALT_SELECTED = 0.000170000000001; // Elevación MÁS BAJA para el polígono seleccionado - no debe bloquear clics
  const POLY_ALT_UNSELECTED = 0.00017; // Elevación normal para polígonos NO seleccionados
  
  // Función para calcular elevación dinámica según altitud de cámara
  function calculateDynamicElevation(baseElevation: number, cameraAltitude: number, isSelected: boolean = false): number {
    // NIVEL 4: Si hay ciudad seleccionada, todos los polígonos al ras del globo
    if (selectedCityId) {
      if (isSelected) {
        return 0.000170000000001; // Ligeramente más alto que los demás
      }
      return 0.00017; // Al ras del globo
    }
    
    // Si es el polígono seleccionado (sin nivel 4 activo), mantener ligeramente más alto
    if (isSelected) {
      // En zoom extremo (< 0.06), usar elevación muy baja
      if (cameraAltitude < 0.06) {
        return 0.000170000000001; // Ligeramente más alto que los demás
      }
      return baseElevation;
    }
    
    // Para polígonos NO seleccionados: ajustar según zoom
    // En zoom MUY extremo (< 0.06), usar elevación base muy baja
    if (cameraAltitude < 0.06) {
      return 0.00017; // Elevación muy baja para zoom extremo
    }
    // En zoom muy cercano (0.06 - 0.15), reducir gradualmente
    if (cameraAltitude < 0.15) {
      const factor = (cameraAltitude - 0.06) / (0.15 - 0.06); // 0 a 1
      return baseElevation * (0.01 + factor * 0.49); // 1% a 50%
    }
    // En zoom cercano (0.15 - 0.3), elevación moderada
    if (cameraAltitude < 0.3) {
      const factor = (cameraAltitude - 0.15) / (0.3 - 0.15);
      return baseElevation * (0.5 + factor * 0.5); // 50% a 100%
    }
    // En zoom normal o lejano, elevación completa
    return baseElevation;
  }

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

  // Force re-apply stroke color (for highlighting)
  export function refreshPolyStrokes() {
    try {
      if (!world) return;
      world.polygonStrokeColor((feat: any) => {
        // Nivel 4: ciudades/provincias (ID_2)
        const cityId = feat?.properties?._cityId || feat?.properties?.ID_2;
        if (selectedCityId && cityId === selectedCityId) {
          return '#ffffff';
        }
        return hexToRgba(strokeBaseColor, clamp(strokeOpacityPct / 100, 0, 1));
      });
    } catch {}
  }

  // Force re-apply altitude mapping for polygons
  export function refreshPolyAltitudes() {
    try {
      if (!world) return;
      const currentPov = world.pointOfView();
      const cameraAlt = currentPov?.altitude || 1.0;
      
      world.polygonAltitude((feat: any) => {
        const cityId = feat?.properties?._cityId || feat?.properties?.ID_2;
        const isSelected = selectedCityId && cityId === selectedCityId;
        
        if (isSelected) {
          // Polígono seleccionado: ELEVAR significativamente
          return calculateDynamicElevation(POLY_ALT_SELECTED, cameraAlt, true);
        }
        
        // Polígonos no seleccionados
        if (selectedCityId) {
          // Si hay un polígono seleccionado, bajar los demás
          return calculateDynamicElevation(POLY_ALT_UNSELECTED, cameraAlt, false);
        }
        
        // Sin selección: usar elevación normal
        const customElevation = feat?.properties?._elevation;
        const baseElevation = typeof customElevation === 'number' ? customElevation : POLY_ALT;
        return calculateDynamicElevation(baseElevation, cameraAlt, false);
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
        // Altitud dinámica: más baja cuando estás más cerca para mejor centrado
        world.htmlAltitude && world.htmlAltitude(() => {
          const pov = world.pointOfView();
          const altitude = pov?.altitude || 1.0;
          // Cuando más cerca (altitude baja), usar altitud de etiqueta más baja
          if (altitude < 0.15) return 0.002; // Muy cerca
          if (altitude < 0.3) return 0.004;  // Cerca
          if (altitude < 0.6) return 0.006;  // Medio
          return 0.008; // Lejos
        });
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
          el.style.textAlign = 'center';
          el.style.whiteSpace = 'nowrap';
          el.style.transform = 'translate(-50%, -50%)';
          el.style.fontFamily = 'Arial, sans-serif';
          el.style.userSelect = 'none';
          
          // Apply opacity if specified
          if (d.opacity !== undefined) {
            el.style.opacity = String(d.opacity);
          }
          
          // Las etiquetas NUNCA bloquean eventos - siempre pointer-events: none
          // La selección se hace por sistema de proximidad en on:globeClick
          el.style.pointerEvents = 'none';
          
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
    
    // Detectar Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    // Verificar soporte WebGL antes de inicializar
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      console.error('[Globe] WebGL not supported');
      if (rootEl) {
        rootEl.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: white; text-align: center; font-family: sans-serif;">
            <div>
              <h3>WebGL Not Supported</h3>
              <p>Your browser doesn't support WebGL, which is required for the 3D globe.</p>
              <p>Please update your browser or enable WebGL in your browser settings.</p>
            </div>
          </div>
        `;
      }
      return;
    }
    console.log('[Globe] WebGL support confirmed');
    
    try {
      console.log('[Globe] Initializing globe, Safari detected:', isSafari);
      console.log('[Globe] Container element:', rootEl);
      
      // Para Safari, usar inicialización más simple
      if (isSafari) {
        console.log('[Globe] Using Safari compatibility mode');
        // Esperar un frame antes de inicializar
        await new Promise(resolve => requestAnimationFrame(resolve));
        world = new Globe(rootEl!);
      } else {
        world = new Globe(rootEl!);
      }
      
      if (!world) {
        throw new Error('Globe instance is null');
      }
      
      console.log('[Globe] Globe instance created successfully');
      world.backgroundColor(bgColor);
      
      // Verificar que el renderer se creó correctamente
      const renderer = world.renderer();
      console.log('[Globe] Renderer:', renderer);
      
      if (renderer && renderer.domElement) {
        console.log('[Globe] Canvas element created:', renderer.domElement);
        // Forzar un resize inicial en Safari
        if (isSafari) {
          setTimeout(() => {
            const w = rootEl!.clientWidth || window.innerWidth;
            const h = rootEl!.clientHeight || window.innerHeight;
            world.width(w).height(h);
            console.log('[Globe] Safari resize applied:', w, 'x', h);
          }, 50);
        }
      }
      
    } catch (error) {
      console.error('[Globe] Error initializing globe:', error);
      const err = error as Error;
      console.error('[Globe] Error details:', err.message, err.stack);
      
      // Fallback más agresivo para Safari
      try {
        console.log('[Globe] Attempting fallback initialization');
        await new Promise(resolve => setTimeout(resolve, 100));
        world = new Globe(rootEl!);
        world.backgroundColor(bgColor);
        console.log('[Globe] Fallback successful');
      } catch (fallbackError) {
        console.error('[Globe] Fallback also failed:', fallbackError);
        // Mostrar error visible al usuario
        if (rootEl) {
          rootEl.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: white; text-align: center; font-family: sans-serif;">
              <div>
                <h3>Error loading 3D Globe</h3>
                <p>Your browser may not support WebGL or there's a compatibility issue.</p>
                <p>Try refreshing the page or using a different browser.</p>
                <small>Error: ${(fallbackError as Error).message}</small>
              </div>
            </div>
          `;
        }
        return;
      }
    }

    // Esfera: color + opacidad
    world.globeImageUrl(null);
    const mat = world.globeMaterial();
    mat.color.set(sphereBaseColor);
    mat.transparent = true;
    mat.opacity = clamp(sphereOpacityPct / 100, 0, 1);

    // Polígonos base con elevación dinámica
    world
      .polygonAltitude((feat: any) => {
        const currentPov = world.pointOfView();
        const cameraAlt = currentPov?.altitude || 1.0;
        
        const cityId = feat?.properties?._cityId || feat?.properties?.ID_2;
        const isSelected = selectedCityId && cityId === selectedCityId;
        
        if (isSelected) {
          // Polígono seleccionado: ELEVAR significativamente
          return calculateDynamicElevation(POLY_ALT_SELECTED, cameraAlt, true);
        }
        
        // Polígonos no seleccionados
        if (selectedCityId) {
          // Si hay un polígono seleccionado, bajar los demás
          return calculateDynamicElevation(POLY_ALT_UNSELECTED, cameraAlt, false);
        }
        
        // Sin selección: usar elevación normal
        const customElevation = feat?.properties?._elevation;
        const baseElevation = typeof customElevation === 'number' ? customElevation : POLY_ALT;
        return calculateDynamicElevation(baseElevation, cameraAlt, false);
      })
      .polygonSideColor(() => hexToRgba(strokeBaseColor, clamp(strokeOpacityPct / 100, 0, 1) * 0.35))
      .polygonStrokeColor((feat: any) => {
        // Resaltar el polígono seleccionado con un borde más brillante
        // Nivel 4: ciudades/provincias (ID_2)
        const cityId = feat?.properties?._cityId || feat?.properties?.ID_2;
        if (selectedCityId && cityId === selectedCityId) {
          return '#ffffff'; // Borde blanco brillante para el seleccionado
        }
        return hexToRgba(strokeBaseColor, clamp(strokeOpacityPct / 100, 0, 1));
      })
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

    // Mejorar precisión del raycaster para detección de clics
    try {
      const renderer = world.renderer && world.renderer();
      
      if (renderer) {
        // Aumentar precisión del renderer para pantallas de alta resolución
        renderer.setPixelRatio(window.devicePixelRatio);
      }
      
      // Acceder al raycaster interno de three-globe
      const scene = world.scene && world.scene();
      const camera = world.camera && world.camera();
      
      // Configurar el raycaster con mayor precisión
      if (scene && camera) {
        // Intentar acceder al raycaster interno
        const raycaster = (world as any)._raycaster;
        if (raycaster) {
          // Aumentar precisión para todos los tipos de objetos
          raycaster.params.Mesh = { threshold: 0 };
          raycaster.params.Line = { threshold: 0.05 };
          raycaster.params.Points = { threshold: 0.05 };
          // Configurar precisión de intersección
          raycaster.near = 0;
          raycaster.far = Infinity;
        }
      }
    } catch (e) {
      console.warn('[Globe] Could not configure raycaster precision:', e);
    }

    // Eventos
    world.onPolygonHover(() => {});
    world.onPolygonClick((feat: any, event: MouseEvent) => {
      dispatch('polygonClick', { feat, event });
    });
    
    // Hacer que las etiquetas de polígonos sean clicables
    world.onPolygonLabelClick && world.onPolygonLabelClick((feat: any, event: MouseEvent) => {
      // Al hacer clic en una etiqueta, disparar el mismo evento que al hacer clic en el polígono
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
    // En Safari, esperar un poco antes de notificar
    if (isSafari) {
      setTimeout(() => {
        dispatch('ready');
        try { setTilesEnabled(true); } catch {}
      }, 100);
    } else {
      dispatch('ready');
      try { setTilesEnabled(true); } catch {}
    }
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
