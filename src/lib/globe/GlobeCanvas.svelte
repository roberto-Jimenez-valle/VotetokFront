<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { clamp, hexToRgba } from '$lib/utils/colors';

  export let bgColor = '#0a0a0a';        // Fondo: Casi negro
  export let sphereBaseColor = '#0a0a0a'; // Esfera: Negro #0a0a0a
  export let capBaseColor = '#ccc';    // Polígonos: Negro #0a0a0a
  export let strokeBaseColor = '#1d1d1d'; // Bordes: Gris para que se vean
  export let strokeOpacityPct = 60;       // Opacidad moderada para visibilidad
  export let sphereOpacityPct = 100;
  export let atmosphereColor = '#1a1a1a'; // Color de atmósfera muy sutil
  export let atmosphereAltitude = 0.12;   // Altura de la atmósfera reducida
  export let isDarkTheme = true;          // Para controlar la textura del globo
  
  // Textura del globo (centralizada)
  const globeTextureUrl = null;
  export let mode: 'intensity' | 'trend' = 'intensity';
  export let activeTag: string | null = null;
  export let onPolyCapColor: (feat: any) => string;
  export let selectedCityId: string | null = null; // ID de la ciudad/provincia seleccionada (nivel 4)

  // ALTITUDES FIJAS para mejor rendimiento (sin cálculos dinámicos)
  const POLY_ALT = 0.015; // Elevación fija para todos los polígonos
  const POLY_ALT_SELECTED = 0.016; // Elevación ligeramente mayor para seleccionados
  const POLY_ALT_CITY_MODE = 0.001; // Elevación muy baja en nivel ciudad (nivel 4)

  let rootEl: HTMLDivElement | null = null;
  let world: any = null;
  let controls: any = null;
  let ro: ResizeObserver | null = null;
  let windowResizeHandler: (() => void) | null = null;
  
  // Cache para evitar recalcular geometrías cada frame
  let geometryCache = new Map<string, any>();
  let lastPolygonData: any[] = [];
  let lastPolygonDataHash = '';

  // Helper para calcular hash de datos
  function hashData(data: any[]): string {
    return data.length + '_' + (data[0]?.properties?.ISO_A3 || '') + '_' + (data[data.length - 1]?.properties?.ISO_A3 || '');
  }
  
  // Función para aplicar LOD filtering - DESACTIVADA para carga uniforme
  function applyLODFiltering(data: any[]): any[] {
    // Devolver siempre todos los datos sin filtrar
    // Esto evita la carga en fases pero puede afectar rendimiento con muchos polígonos
    return data;
  }
  
  // Función simple de hash para generar variación aleatoria pero consistente
  function getPolygonHash(feat: any): number {
    const id = feat?.properties?.ISO_A3 || 
               feat?.properties?.ID_1 || 
               feat?.properties?.ID_2 || 
               feat?.properties?.NAME || 
               '';
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    // Devolver valor entre 0 y 1
    return Math.abs(hash % 100) / 100;
  }
  
  // Public API for parent via bind:this (OPTIMIZADO)
  export function setPolygonsData(data: any[]) {
    if (!world) return;
    try {
      // Evitar recalcular si los datos no cambiaron
      const newHash = hashData(data);
      if (newHash === lastPolygonDataHash && data.length === lastPolygonData.length) {
        return; // Datos no cambiaron, no hacer nada
      }
      
      lastPolygonDataHash = newHash;
      lastPolygonData = data;
      
      // Aplicar datos en requestAnimationFrame para no bloquear
      requestAnimationFrame(() => {
        const filteredData = applyLODFiltering(data);
        world.polygonsData(filteredData);
      });
    } catch {}
  }
  export function setTilesEnabled(enabled: boolean) {
    world.globeTileEngineUrl(null);
        world.globeImageUrl(globeTextureUrl);
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

  // Sistema de throttle para evitar refreshes excesivos
  let lastRefreshTime = 0;
  const MIN_REFRESH_INTERVAL = 16; // ~60fps máximo
  
  // Force re-apply cap color mapping from parent (OPTIMIZADO)
  export function refreshPolyColors() {
    try {
      if (!world) return;
      
      // Throttle: evitar refreshes más rápidos que 60fps
      const now = performance.now();
      if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
        return;
      }
      lastRefreshTime = now;
      
      world.polygonCapColor((feat: any) => (onPolyCapColor ? onPolyCapColor(feat) : hexToRgba(capBaseColor, 0.8)));
    } catch {}
  }

  // Force re-apply stroke color (for highlighting)
  export function refreshPolyStrokes() {
    try {
      if (!world) return;
      world.polygonStrokeColor((feat: any) => {
        const cityId = feat?.properties?._cityId || feat?.properties?.ID_2;
        if (selectedCityId && cityId === selectedCityId) {
          return '#ffffff';
        }
        return 'rgba(5,5,5,0.5)'; // Seminegro con opacidad 50%
      });
    } catch {}
  }

  // Force re-apply altitude mapping for polygons
  export function refreshPolyAltitudes() {
    try {
      if (!world) return;
      
      world.polygonAltitude((feat: any) => {
        const cityId = feat?.properties?._cityId || feat?.properties?.ID_2;
        const isSelected = selectedCityId && cityId === selectedCityId;
        
        // NIVEL 4: Si hay ciudad seleccionada, elevación muy baja
        if (selectedCityId) {
          return isSelected ? POLY_ALT_SELECTED : POLY_ALT_CITY_MODE;
        }
        
        // Variación aleatoria muy sutil: ±0.0025
        const randomVariation = (getPolygonHash(feat) - 0.5) * 0.005;
        const altitude = POLY_ALT + randomVariation;
        
        // Sin selección: elevación con variación random
        return isSelected ? POLY_ALT_SELECTED : altitude;
      });
    } catch {}
  }

  // Force re-apply label mapping for polygons (disable hover labels)
  export function refreshPolyLabels() {
    try {
      if (!world) return;
            world.polygonLabel(() => ''); // Disable hover labels completely
    } catch {}
  }

  // Reset globe to clean state - mantiene polígonos en cache pero limpia colores
  export function resetGlobe() {
    try {
      if (!world) return;
      
      // Limpiar solo elementos HTML (marcadores, etiquetas)
      world.htmlElementsData([]);
      
      // NO limpiar geometryCache ni lastPolygonData - mantener polígonos en cache
      
      // Forzar todos los polígonos a gris (sin datos)
      world.polygonCapColor(() => '#9ca3af');
      
      console.log('[GlobeCanvas] 🔄 Globe reset completado - polígonos en gris, cache mantenido');
    } catch (error) {
      console.error('[GlobeCanvas] Error en resetGlobe:', error);
    }
  }

  // Set permanent text labels as separate layer using HTML elements
  export function setTextLabels(labels: any[]) {
    try {
      if (!world) return;
            
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
        
              } else {
        // Clear labels
        world.htmlElementsData([]);
      }
    } catch (e) {
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
        
    try {
                  
      // Para Safari, usar inicialización más simple
      if (isSafari) {
                // Esperar un frame antes de inicializar
        await new Promise(resolve => requestAnimationFrame(resolve));
        world = new Globe(rootEl!);
      } else {
        world = new Globe(rootEl!);
      }
      
      if (!world) {
        throw new Error('Globe instance is null');
      }
      
            world.backgroundColor(bgColor);
      
      // Verificar que el renderer se creó correctamente
      const renderer = world.renderer();
            
      if (renderer && renderer.domElement) {
                // Forzar un resize inicial en Safari
        if (isSafari) {
          setTimeout(() => {
            const w = rootEl!.clientWidth || window.innerWidth;
            const h = rootEl!.clientHeight || window.innerHeight;
            world.width(w).height(h);
                      }, 50);
        }
      }
      
    } catch (error) {
      const err = error as Error;
      
      // Fallback más agresivo para Safari
      try {
                await new Promise(resolve => setTimeout(resolve, 100));
        world = new Globe(rootEl!);
        world.backgroundColor(bgColor);
              } catch (fallbackError) {
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

    // Esfera: aplicar textura configurada
    world.globeImageUrl(globeTextureUrl);
    
    const mat = world.globeMaterial();
    // Mantener un tinte oscuro sobre la textura
    mat.color.set(sphereBaseColor);
    mat.transparent = true;
    mat.opacity = clamp(sphereOpacityPct / 100, 0, 1);
    
    // Activar atmósfera con configuración sutil
    if (world.showAtmosphere) {
      world.showAtmosphere(true);
    }
    if (world.atmosphereColor) {
      world.atmosphereColor(atmosphereColor);
    }
    if (world.atmosphereAltitude) {
      world.atmosphereAltitude(atmosphereAltitude);
    }
    
    let lastAltitudeUpdate = 0;
    
    // Polígonos con elevación con variación aleatoria muy sutil
    world
      .polygonAltitude((feat: any) => {
        const cityId = feat?.properties?._cityId || feat?.properties?.ID_2;
        const isSelected = selectedCityId && cityId === selectedCityId;
        
        // NIVEL 4: Si hay ciudad seleccionada, elevación muy baja
        if (selectedCityId) {
          return isSelected ? POLY_ALT_SELECTED : POLY_ALT_CITY_MODE;
        }
        
        // Variación aleatoria muy sutil: ±0.0025 (entre 0.0125 y 0.0175)
        const randomVariation = (getPolygonHash(feat) - 0.5) * 0.005;
        const altitude = POLY_ALT + randomVariation;
        
        // Sin selección: elevación con variación random
        return isSelected ? POLY_ALT_SELECTED : altitude;
      })
      .polygonSideColor(() => 'rgba(5,5,5,0.3)') // Seminegro para lados
      .polygonStrokeColor((feat: any) => {
        // Solo mostrar borde para el polígono seleccionado
        const cityId = feat?.properties?._cityId || feat?.properties?.ID_2;
        if (selectedCityId && cityId === selectedCityId) {
          return '#ffffff';
        }
        return 'rgba(5,5,5,0.5)'; // Seminegro con opacidad 50%
      })
      .polygonLabel((feat: any) => {
        // Debug: mostrar etiquetas para cualquier polígono que tenga nombre
        if (feat?.properties?._subdivisionName) {
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

    // Optimizar renderer para mejor rendimiento
    try {
      const renderer = world.renderer && world.renderer();
      const scene = world.scene && world.scene();
      
      if (renderer) {
        // Limitar pixel ratio para mejor rendimiento (máximo 2)
        const pixelRatio = Math.min(window.devicePixelRatio, 2);
        renderer.setPixelRatio(pixelRatio);
        
        // Optimizaciones de rendimiento de Three.js
        renderer.powerPreference = 'high-performance';
        
        // Reducir precisión para mejor rendimiento
        if (renderer.capabilities) {
          renderer.capabilities.precision = 'mediump';
        }
        
        // Configurar sombras y antialiasing para mejor rendimiento
        renderer.shadowMap.enabled = false;
        renderer.antialias = false;
        
        // Optimizar garbage collection
        renderer.info.autoReset = true;
        
        // Habilitar frustum culling automático
        if (scene) {
          scene.autoUpdate = false; // Desactivar auto-update para control manual
          scene.matrixAutoUpdate = false; // Desactivar actualización automática de matrices
          
          // Optimizar traversal de la escena
          scene.traverse((object: any) => {
            if (object.isMesh) {
              // Habilitar frustum culling por objeto
              object.frustumCulled = true;
              
              // Optimizar geometría
              if (object.geometry) {
                object.geometry.computeBoundingSphere();
                object.geometry.computeBoundingBox();
              }
              
              // Optimizar material
              if (object.material) {
                object.material.precision = 'mediump';
                object.material.needsUpdate = false;
              }
            }
          });
        }
      }
      
      // Acceder al raycaster interno de three-globe
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
      
      // Usar iluminación por defecto de globe.gl (óptima para rendimiento)
      
    } catch (e) {
    }

    // Eventos
    world.onPolygonHover((polygon: any) => {
      // Cambiar cursor solo si el polígono tiene datos (no es negro/sin datos)
      if (polygon) {
        // Obtener el color del polígono usando la función onPolyCapColor
        const polygonColor = onPolyCapColor ? onPolyCapColor(polygon) : null;
        // Si el polígono tiene un color diferente al negro/gris oscuro, mostrar pointer
        const hasData = polygonColor && 
                        polygonColor !== '#000000' && 
                        polygonColor !== '#1a1a1a' && 
                        polygonColor !== 'rgba(26,26,26,1)' &&
                        polygonColor !== '#9ca3af';
        world.controls().domElement.style.cursor = hasData ? 'pointer' : 'default';
      } else {
        // Sin hover, restaurar cursor
        world.controls().domElement.style.cursor = 'default';
      }
    });
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

    // Controles con throttling para reducir eventos
    controls = world.controls && world.controls();
    try {
      if (controls && typeof controls === 'object') {
        if ('enableDamping' in controls) controls.enableDamping = false;
        if ('dampingFactor' in controls) controls.dampingFactor = 0;
        if ('rotateSpeed' in controls) controls.rotateSpeed = 1.0;
        if ('zoomSpeed' in controls) controls.zoomSpeed = 1.0;
        // Limitar zoom mínimo y máximo
        if ('minDistance' in controls) controls.minDistance = 100;
        if ('maxDistance' in controls) controls.maxDistance = 500;
        if (typeof controls.update === 'function') controls.update();
        
        // Throttle de eventos para reducir carga
        let changeTimeout: ReturnType<typeof setTimeout> | null = null;
        let isMoving = false;
        
        if (typeof controls.addEventListener === 'function') {
          // Throttle del evento 'change' a 16ms (60fps)
          controls.addEventListener('change', () => {
            if (changeTimeout) return;
            changeTimeout = setTimeout(() => {
              dispatch('controlsChange');
              changeTimeout = null;
            }, 16);
          });
          
          controls.addEventListener('start', () => {
            if (!isMoving) {
              isMoving = true;
              dispatch('controlsStart');
              dispatch('movementStart');
            }
          });
          
          controls.addEventListener('end', () => {
            isMoving = false;
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
      // Atmósfera
      if (world.showAtmosphere) {
        world.showAtmosphere(true);
      }
      if (world.atmosphereColor) {
        world.atmosphereColor(atmosphereColor);
      }
      if (world.atmosphereAltitude) {
        world.atmosphereAltitude(atmosphereAltitude);
      }
      // Bordes seminegros
      world.polygonStrokeColor(() => 'rgba(5,5,5,0.5)');
      world.polygonSideColor(() => 'rgba(5,5,5,0.3)');
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
  
  // Actualizar color del globo cuando cambie el tema
  $: if (world && isDarkTheme !== undefined) {
    try {
      // Aplicar textura configurada
      world.globeImageUrl(globeTextureUrl);
      const mat = world.globeMaterial();
      mat.color.set(sphereBaseColor);
    } catch {}
  }
</script>

<div bind:this={rootEl} class="globe-wrap"></div>
