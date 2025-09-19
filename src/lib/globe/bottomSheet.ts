export type SheetState = 'hidden' | 'peek' | 'collapsed' | 'expanded';

interface BottomSheetOptions {
  bottomBarPx: number;
  collapsedVisibleRatio: number;
  peekVisibleRatio: number;
  expandSnapPx: number;
  onChange: (state: SheetState, y: number) => void;
}

export class BottomSheetController {
  private bottomBarPx: number;
  private collapsedVisibleRatio: number;
  private peekVisibleRatio: number;
  private expandSnapPx: number;
  private onChange: (state: SheetState, y: number) => void;

  private isDragging = false;
  private dragStartY = 0;
  private dragStartSheetY = 0;
  private sheetStartState: SheetState = 'hidden';

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

  setState(state: SheetState) {
    this.state = state;
    const containerH = Math.max(0, (window.innerHeight || 0) - this.bottomBarPx);
    if (state === 'hidden') this.y = containerH + 150;
    else if (state === 'peek') this.y = containerH * (1 - this.peekVisibleRatio);
    else if (state === 'collapsed') this.y = containerH * (1 - this.collapsedVisibleRatio);
    else this.y = 55; // expanded top offset
    this.onChange(this.state, this.y);
  }

  onWindowResize() {
    this.setState(this.state);
  }

  pointerDown(e: PointerEvent | TouchEvent) {
    // ignore if target is inside a close button
    try {
      const t = (e as any).target as Element | null;
      if (t && (t as any).closest && (t as any).closest('.sheet-close')) return;
    } catch {}
    this.isDragging = true;
    this.sheetStartState = this.state;
    const y = (e as TouchEvent).touches?.[0]?.clientY ?? (e as PointerEvent).clientY ?? 0;
    this.dragStartY = y;
    this.dragStartSheetY = this.y;
    window.addEventListener('pointermove', this._onMove as any, { passive: false } as any);
    window.addEventListener('pointerup', this._onUp as any, { passive: true } as any);
    window.addEventListener('touchmove', this._onMove as any, { passive: false } as any);
    window.addEventListener('touchend', this._onUp as any, { passive: true } as any);
  }

  private _onMove = (e: PointerEvent | TouchEvent) => {
    if (!this.isDragging) return;
    const y = (e as TouchEvent).touches?.[0]?.clientY ?? (e as PointerEvent).clientY ?? 0;
    const dy = y - this.dragStartY;
    const containerH = Math.max(0, (window.innerHeight || 0) - this.bottomBarPx);
    this.y = this.clampPx(this.dragStartSheetY + dy, 0, containerH);
    if ('preventDefault' in e && (e as any).cancelable) { try { (e as any).preventDefault(); } catch {} }
    this.onChange(this.state, this.y);
  };

  private _onUp = () => {
    if (!this.isDragging) return;
    this.isDragging = false;
    const containerH = Math.max(0, (window.innerHeight || 0) - this.bottomBarPx);
    const dyTotal = this.y - this.dragStartSheetY; // + down, - up

    if (this.y >= containerH * 0.95) {
      this.setState('hidden');
    } else if (dyTotal <= -this.expandSnapPx) {
      if (this.sheetStartState === 'peek') this.setState('collapsed');
      else this.setState('expanded');
    } else if (dyTotal >= this.expandSnapPx) {
      if (this.sheetStartState === 'expanded') this.setState('collapsed');
      else if (this.sheetStartState === 'collapsed') this.setState('peek');
      else this.setState('hidden');
    } else {
      const expandedY = 0;
      const collapsedY = containerH * (1 - this.collapsedVisibleRatio);
      const peekY = containerH * (1 - this.peekVisibleRatio);
      const anchors = [
        { y: expandedY, state: 'expanded' as const },
        { y: collapsedY, state: 'collapsed' as const },
        { y: peekY, state: 'peek' as const }
      ];
      const nearest = anchors.reduce((a, b) => Math.abs(b.y - this.y) < Math.abs(a.y - this.y) ? b : a, anchors[0]);
      this.setState(nearest.state);
    }

    window.removeEventListener('pointermove', this._onMove as any);
    window.removeEventListener('pointerup', this._onUp as any);
    window.removeEventListener('touchmove', this._onMove as any);
    window.removeEventListener('touchend', this._onUp as any);
  };

  destroy() {
    window.removeEventListener('pointermove', this._onMove as any);
    window.removeEventListener('pointerup', this._onUp as any);
    window.removeEventListener('touchmove', this._onMove as any);
    window.removeEventListener('touchend', this._onUp as any);
  }
}
