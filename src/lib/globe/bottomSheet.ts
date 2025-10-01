export type SheetState = 'hidden' | 'peek' | 'collapsed' | 'expanded';

interface BottomSheetOptions {
  bottomBarPx: number;
  collapsedVisibleRatio: number;
  peekVisibleRatio: number;
  expandSnapPx: number;
  onChange: (state: SheetState, y: number, isTransitioning: boolean) => void;
}

export class BottomSheetController {
  private bottomBarPx: number;
  private collapsedVisibleRatio: number;
  private peekVisibleRatio: number;
  private expandSnapPx: number;
  private onChange: (state: SheetState, y: number, isTransitioning: boolean) => void;

  private isDragging = false;
  private dragStartY = 0;
  private dragStartX = 0;
  private dragStartSheetY = 0;
  private sheetStartState: SheetState = 'hidden';
  private lastMoveY = 0;
  private lastMoveTime = 0;
  private velocityY = 0;
  private gestureDirectionLocked = false;
  private isVerticalGesture = false;
  private hasMoved = false; // Para distinguir click de arrastre

  state: SheetState = 'hidden';
  y = 10000; // offscreen initial

  constructor(opts: BottomSheetOptions) {
    this.bottomBarPx = opts.bottomBarPx;
    this.collapsedVisibleRatio = opts.collapsedVisibleRatio;
    this.peekVisibleRatio = opts.peekVisibleRatio;
    this.expandSnapPx = opts.expandSnapPx;
    this.onChange = opts.onChange;
  }

  private clampPx(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

  setState(state: SheetState, isTransitioning: boolean = true) {
    this.state = state;
    const containerH = Math.max(0, (window.innerHeight || 0)); // Ahora usa altura completa
    if (state === 'hidden') {
      // En hidden, quedarse a la misma altura que el nav mostrando solo la barra de arrastre
      this.y = containerH - this.bottomBarPx - 40; // 40px arriba del nav para mostrar la barra
    }
    else if (state === 'peek') {
      // En peek, el sheet se muestra un poco arriba del nav
      this.y = containerH - this.bottomBarPx - 100; // 100px arriba del nav
    }
    else if (state === 'collapsed') this.y = containerH * (1 - this.collapsedVisibleRatio);
    else this.y = 55; // expanded top offset
    this.onChange(this.state, this.y, isTransitioning);
  }

  onWindowResize() {
    this.setState(this.state);
  }

  pointerDown(e: PointerEvent | TouchEvent) {
    // Ignore if target is inside an interactive element
    try {
      const t = (e as any).target as Element | null;
      if (t && (t as any).closest) {
        // Caso especial: .nav-minimal y .nav-chip permiten arrastre
        // La detección de dirección decidirá si es click o arrastre
        const navMinimal = (t as any).closest('.nav-minimal');
        const isNavButton = (t as any).closest('.nav-chip');
        if (navMinimal || isNavButton) {
          // Permitir que el arrastre continúe, la detección de dirección decidirá
          console.log('[BottomSheet] Starting from nav area - direction detection will decide');
        }
        
        // Lista de selectores de elementos interactivos que NO deben iniciar arrastre
        const interactiveSelectors = [
          '.sheet-close',
          'button:not(.vote-card button):not(.nav-chip)', // Botones excepto vote-card y nav-chip
          'a',
          'input',
          'textarea',
          'select',
          '[role="button"]:not(.nav-chip)',
          '[tabindex]:not(.nav-chip)'
        ];
        
        for (const selector of interactiveSelectors) {
          if ((t as any).closest(selector)) {
            console.log('[BottomSheet] Drag ignored - interactive element:', selector);
            return;
          }
        }
        
        // IMPORTANTE: Las vote-card ahora SÍ permiten arrastre
        // La detección de dirección decidirá si es click o arrastre
        
        // Caso especial: permitir arrastre desde .sheet-content solo si tiene scroll
        // y el usuario no está intentando hacer scroll
        const sheetContent = (t as any).closest('.sheet-content');
        if (sheetContent) {
          const hasScroll = sheetContent.scrollHeight > sheetContent.clientHeight;
          if (hasScroll) {
            // Si tiene scroll, solo permitir arrastre si está en el tope o fondo
            const atTop = sheetContent.scrollTop <= 0;
            const atBottom = sheetContent.scrollTop + sheetContent.clientHeight >= sheetContent.scrollHeight - 1;
            
            if (!atTop && !atBottom) {
              console.log('[BottomSheet] Drag ignored - scrollable content in middle');
              return;
            }
          }
        }
        
        // Caso especial: .vote-cards-grid y .vote-cards-section
        // Permitir arrastre, pero la detección de dirección decidirá si procesar
        const voteCardsArea = (t as any).closest('.vote-cards-grid, .vote-cards-section');
        if (voteCardsArea) {
          console.log('[BottomSheet] Starting drag from vote cards area - direction detection will decide');
          // No retornar aquí, permitir que continúe y la detección de dirección decida
        }
      }
    } catch {}
    
    this.isDragging = true;
    this.sheetStartState = this.state;
    const y = (e as TouchEvent).touches?.[0]?.clientY ?? (e as PointerEvent).clientY ?? 0;
    const x = (e as TouchEvent).touches?.[0]?.clientX ?? (e as PointerEvent).clientX ?? 0;
    this.dragStartY = y;
    this.dragStartX = x;
    this.dragStartSheetY = this.y;
    
    // Inicializar tracking de velocidad y dirección
    this.lastMoveY = y;
    this.lastMoveTime = Date.now();
    this.velocityY = 0;
    this.gestureDirectionLocked = false;
    this.isVerticalGesture = false;
    this.hasMoved = false;
    
    window.addEventListener('pointermove', this._onMove as any, { passive: false } as any);
    window.addEventListener('pointerup', this._onUp as any, { passive: true } as any);
    window.addEventListener('touchmove', this._onMove as any, { passive: false } as any);
    window.addEventListener('touchend', this._onUp as any, { passive: true } as any);
  }

  private _onMove = (e: PointerEvent | TouchEvent) => {
    if (!this.isDragging) return;
    const y = (e as TouchEvent).touches?.[0]?.clientY ?? (e as PointerEvent).clientY ?? 0;
    const x = (e as TouchEvent).touches?.[0]?.clientX ?? (e as PointerEvent).clientX ?? 0;
    const now = Date.now();
    
    // Detectar dirección del gesto en los primeros movimientos
    if (!this.gestureDirectionLocked) {
      const dx = Math.abs(x - this.dragStartX);
      const dy = Math.abs(y - this.dragStartY);
      
      // Umbral mínimo de movimiento para detectar dirección (3px para móvil)
      if (dx > 3 || dy > 3) {
        this.hasMoved = true; // Marcar que hubo movimiento significativo
        this.gestureDirectionLocked = true;
        // Si el movimiento vertical es mayor que el horizontal, es un gesto vertical
        // Usar un ratio más estricto para móvil: dy debe ser al menos 1.2x mayor que dx
        this.isVerticalGesture = dy > dx * 1.2;
        
        console.log('[BottomSheet] Gesture direction locked:', 
          this.isVerticalGesture ? 'VERTICAL' : 'HORIZONTAL',
          `(dx: ${dx.toFixed(1)}, dy: ${dy.toFixed(1)}, ratio: ${(dy/dx).toFixed(2)})`
        );
      }
    }
    
    // Si el gesto es horizontal, no procesar el arrastre vertical
    if (this.gestureDirectionLocked && !this.isVerticalGesture) {
      return;
    }
    
    // Calcular velocidad para fling gesture
    if (this.lastMoveTime > 0) {
      const dt = now - this.lastMoveTime;
      if (dt > 0) {
        this.velocityY = (y - this.lastMoveY) / dt; // px/ms
      }
    }
    this.lastMoveY = y;
    this.lastMoveTime = now;
    
    const dy = y - this.dragStartY;
    const containerH = Math.max(0, (window.innerHeight || 0)); // Altura completa
    this.y = this.clampPx(this.dragStartSheetY + dy, 0, containerH);
    
    // IMPORTANTE: Siempre prevenir default en gestos verticales para móvil
    if (this.gestureDirectionLocked && this.isVerticalGesture) {
      if ('preventDefault' in e && (e as any).cancelable) {
        try { (e as any).preventDefault(); } catch {}
      }
      // También prevenir el comportamiento de scroll del navegador
      if ('stopPropagation' in e) {
        try { (e as any).stopPropagation(); } catch {}
      }
    }
    
    // Durante el arrastre, NO usar transición
    this.onChange(this.state, this.y, false);
  };

  private _onUp = (e?: Event) => {
    if (!this.isDragging) return;
    this.isDragging = false;
    
    // Si hubo movimiento vertical, prevenir el click en elementos clickeables
    if (this.hasMoved && this.isVerticalGesture && e) {
      if ('preventDefault' in e && (e as any).cancelable) {
        try { (e as any).preventDefault(); } catch {}
      }
      if ('stopPropagation' in e) {
        try { (e as any).stopPropagation(); } catch {}
      }
      console.log('[BottomSheet] Click prevented - was a drag gesture');
    }
    
    // Si fue un gesto horizontal, no hacer nada
    if (this.gestureDirectionLocked && !this.isVerticalGesture) {
      this.gestureDirectionLocked = false;
      this.isVerticalGesture = false;
      this.hasMoved = false;
      window.removeEventListener('pointermove', this._onMove as any);
      window.removeEventListener('pointerup', this._onUp as any);
      window.removeEventListener('touchmove', this._onMove as any);
      window.removeEventListener('touchend', this._onUp as any);
      return;
    }
    
    const containerH = Math.max(0, (window.innerHeight || 0)); // Altura completa
    const dyTotal = this.y - this.dragStartSheetY; // + down, - up
    
    // Detectar fling gesture (deslizamiento rápido) - similar a Google Maps
    const FLING_THRESHOLD = 0.5; // px/ms (ajustable)
    const isFlingUp = this.velocityY < -FLING_THRESHOLD;
    const isFlingDown = this.velocityY > FLING_THRESHOLD;
    
    // Reset velocity y dirección
    this.velocityY = 0;
    this.lastMoveTime = 0;
    this.gestureDirectionLocked = false;
    this.isVerticalGesture = false;
    this.hasMoved = false;

    // Todos los setState después del arrastre deben usar transición suave
    if (this.y >= containerH * 0.95) {
      this.setState('hidden', true); // Detrás del nav
    } else if (isFlingUp) {
      // Fling hacia arriba: expandir al siguiente nivel
      if (this.sheetStartState === 'peek') this.setState('collapsed', true);
      else if (this.sheetStartState === 'collapsed') this.setState('expanded', true);
      else this.setState('expanded', true);
    } else if (isFlingDown) {
      // Fling hacia abajo: colapsar al siguiente nivel
      if (this.sheetStartState === 'expanded') this.setState('collapsed', true);
      else if (this.sheetStartState === 'collapsed') this.setState('peek', true);
      else this.setState('hidden', true); // Desde peek baja a hidden (detrás del nav)
    } else if (dyTotal <= -this.expandSnapPx) {
      // Arrastre lento hacia arriba
      if (this.sheetStartState === 'peek') this.setState('collapsed', true);
      else this.setState('expanded', true);
    } else if (dyTotal >= this.expandSnapPx) {
      // Arrastre lento hacia abajo
      if (this.sheetStartState === 'expanded') this.setState('collapsed', true);
      else if (this.sheetStartState === 'collapsed') this.setState('peek', true);
      else this.setState('hidden', true); // Desde peek baja a hidden (detrás del nav)
    } else {
      // Snap al ancla más cercana
      const expandedY = 0;
      const collapsedY = containerH * (1 - this.collapsedVisibleRatio);
      const peekY = containerH * (1 - this.peekVisibleRatio);
      const anchors = [
        { y: expandedY, state: 'expanded' as const },
        { y: collapsedY, state: 'collapsed' as const },
        { y: peekY, state: 'peek' as const }
      ];
      const nearest = anchors.reduce((a, b) => Math.abs(b.y - this.y) < Math.abs(a.y - this.y) ? b : a, anchors[0]);
      this.setState(nearest.state, true);
    }

    window.removeEventListener('pointermove', this._onMove as any);
    window.removeEventListener('pointerup', this._onUp as any);
    window.removeEventListener('touchmove', this._onMove as any);
    window.removeEventListener('touchend', this._onUp as any);
  };

  wasLastGestureDrag(): boolean {
    // Retorna true si el último gesto fue un arrastre (no un simple click)
    return this.hasMoved && this.isVerticalGesture;
  }

  destroy() {
    window.removeEventListener('pointermove', this._onMove as any);
    window.removeEventListener('pointerup', this._onUp as any);
    window.removeEventListener('touchmove', this._onMove as any);
    window.removeEventListener('touchend', this._onUp as any);
  }
}
