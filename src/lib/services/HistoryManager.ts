import { get } from 'svelte/store';
import { globeState, navigateToWorld, navigateToCountry, navigateToSubdivision } from '$lib/stores/globeStore';
import { pollsState, loadPoll } from '$lib/stores/pollStore';

interface HistoryState {
  level: 'world' | 'country' | 'subdivision' | 'city';
  countryIso?: string;
  countryName?: string;
  subdivisionId?: string;
  subdivisionName?: string;
  pollId?: number;
  pollMode?: 'trending' | 'specific';
  timestamp: number;
}

/**
 * Gestor del History API
 * Maneja la navegación del navegador y URLs
 */
export class HistoryManager {
  private static instance: HistoryManager;
  private isNavigatingFromHistory = false;
  private popstateHandler: ((event: PopStateEvent) => void) | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): HistoryManager {
    if (!HistoryManager.instance) {
      HistoryManager.instance = new HistoryManager();
    }
    return HistoryManager.instance;
  }

  /**
   * Inicializar el gestor de historial
   */
  init() {
    if (this.initialized) return;

    this.setupPopstateHandler();
    this.parseInitialUrl();
    this.initialized = true;

    console.log('[HistoryManager] Initialized');
  }

  /**
   * Configurar manejador de eventos popstate
   */
  private setupPopstateHandler() {
    this.popstateHandler = async (event: PopStateEvent) => {
      const state = event.state as HistoryState;
      
      console.log('[HistoryManager] Popstate:', state);

      // Manejar encuesta específica
      if (state?.pollId && state?.pollMode === 'specific') {
        await this.restorePoll(state.pollId);
        return;
      }

      // Volver a modo trending
      if (state?.pollMode === 'trending' || (!state && get(pollsState).activePoll)) {
        pollsState.update(s => ({ ...s, activePoll: null }));
        return;
      }

      // Navegación geográfica
      if (!state || state.level === 'world') {
        navigateToWorld();
      } else if (state.level === 'country' && state.countryIso) {
        navigateToCountry(state.countryIso, state.countryName || state.countryIso);
      } else if (state.level === 'subdivision' && state.countryIso && state.subdivisionId) {
        navigateToSubdivision(
          state.countryIso,
          state.countryName || state.countryIso,
          state.subdivisionId,
          state.subdivisionName || state.subdivisionId
        );
      }
    };

    window.addEventListener('popstate', this.popstateHandler);
  }

  /**
   * Parsear URL inicial
   */
  private parseInitialUrl() {
    const params = new URLSearchParams(window.location.search);
    
    // Verificar si hay una encuesta en la URL
    const pollId = params.get('poll');
    if (pollId) {
      this.restorePoll(parseInt(pollId));
      return;
    }

    // Verificar navegación geográfica
    const country = params.get('country');
    const subdivision = params.get('subdivision');

    if (subdivision && country) {
      // TODO: Cargar datos y navegar a subdivisión
    } else if (country) {
      // TODO: Cargar datos y navegar a país
    }
  }

  /**
   * Restaurar encuesta desde el historial
   */
  private async restorePoll(pollId: number) {
    this.isNavigatingFromHistory = true;
    
    try {
      await loadPoll(pollId);
      
      // Disparar evento para que el globo se actualice
      const event = new CustomEvent('restorepoll', {
        detail: { pollId }
      });
      window.dispatchEvent(event);
    } finally {
      this.isNavigatingFromHistory = false;
    }
  }

  /**
   * Actualizar URL para navegación mundial
   */
  pushWorldState() {
    if (this.isNavigatingFromHistory) return;

    const state: HistoryState = {
      level: 'world',
      timestamp: Date.now()
    };

    history.pushState(state, '', '/');
    console.log('[HistoryManager] Push world state');
  }

  /**
   * Actualizar URL para navegación de país
   */
  pushCountryState(iso: string, name: string) {
    if (this.isNavigatingFromHistory) return;

    const state: HistoryState = {
      level: 'country',
      countryIso: iso,
      countryName: name,
      timestamp: Date.now()
    };

    const url = `/?country=${encodeURIComponent(iso)}`;
    history.pushState(state, '', url);
    console.log('[HistoryManager] Push country state:', iso);
  }

  /**
   * Actualizar URL para navegación de subdivisión
   */
  pushSubdivisionState(
    countryIso: string, 
    countryName: string,
    subdivisionId: string, 
    subdivisionName: string
  ) {
    if (this.isNavigatingFromHistory) return;

    const state: HistoryState = {
      level: 'subdivision',
      countryIso,
      countryName,
      subdivisionId,
      subdivisionName,
      timestamp: Date.now()
    };

    const url = `/?country=${encodeURIComponent(countryIso)}&subdivision=${encodeURIComponent(subdivisionId)}`;
    history.pushState(state, '', url);
    console.log('[HistoryManager] Push subdivision state:', subdivisionId);
  }

  /**
   * Actualizar URL para encuesta
   */
  pushPollState(pollId: number) {
    if (this.isNavigatingFromHistory) return;

    const state: HistoryState = {
      level: 'world',
      pollId,
      pollMode: 'specific',
      timestamp: Date.now()
    };

    const url = `/?poll=${pollId}`;
    history.pushState(state, '', url);
    console.log('[HistoryManager] Push poll state:', pollId);
  }

  /**
   * Actualizar URL para modo trending
   */
  pushTrendingState() {
    if (this.isNavigatingFromHistory) return;

    const state: HistoryState = {
      level: 'world',
      pollMode: 'trending',
      timestamp: Date.now()
    };

    history.pushState(state, '', '/');
    console.log('[HistoryManager] Push trending state');
  }

  /**
   * Reemplazar estado actual (sin agregar al historial)
   */
  replaceState(state: Partial<HistoryState>) {
    const currentState = history.state || {};
    const newState = {
      ...currentState,
      ...state,
      timestamp: Date.now()
    };

    const url = this.buildUrl(newState);
    history.replaceState(newState, '', url);
  }

  /**
   * Construir URL desde estado
   */
  private buildUrl(state: HistoryState): string {
    const params = new URLSearchParams();

    if (state.pollId) {
      params.set('poll', state.pollId.toString());
    } else if (state.subdivisionId && state.countryIso) {
      params.set('country', state.countryIso);
      params.set('subdivision', state.subdivisionId);
    } else if (state.countryIso) {
      params.set('country', state.countryIso);
    }

    const queryString = params.toString();
    return queryString ? `/?${queryString}` : '/';
  }

  /**
   * Navegar hacia atrás
   */
  back() {
    history.back();
  }

  /**
   * Navegar hacia adelante
   */
  forward() {
    history.forward();
  }

  /**
   * Obtener estado actual
   */
  getCurrentState(): HistoryState | null {
    return history.state as HistoryState;
  }

  /**
   * Verificar si estamos navegando desde el historial
   */
  isFromHistory(): boolean {
    return this.isNavigatingFromHistory;
  }

  /**
   * Limpiar y destruir el gestor
   */
  destroy() {
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
      this.popstateHandler = null;
    }
    this.initialized = false;
  }

  /**
   * Obtener parámetros de URL actuales
   */
  getUrlParams(): URLSearchParams {
    return new URLSearchParams(window.location.search);
  }

  /**
   * Verificar si una URL es de la aplicación
   */
  isInternalUrl(url: string): boolean {
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  /**
   * Manejar navegación con transición
   */
  async navigateWithTransition(
    url: string, 
    state?: HistoryState
  ): Promise<void> {
    if (!this.isInternalUrl(url)) {
      window.location.href = url;
      return;
    }

    // Agregar clase de transición
    document.body.classList.add('transitioning');

    // Actualizar historial
    if (state) {
      history.pushState(state, '', url);
    } else {
      history.pushState(null, '', url);
    }

    // Esperar animación
    await new Promise(resolve => setTimeout(resolve, 300));

    // Remover clase de transición
    document.body.classList.remove('transitioning');
  }

  /**
   * Debug: imprimir historial
   */
  debugHistory() {
    console.group('[HistoryManager] Debug');
    console.log('Current URL:', window.location.href);
    console.log('Current State:', history.state);
    console.log('History Length:', history.length);
    console.log('Is From History:', this.isNavigatingFromHistory);
    console.groupEnd();
  }
}

// Exportar instancia única
export const historyManager = HistoryManager.getInstance();

// Auto-inicializar si estamos en el navegador
if (typeof window !== 'undefined') {
  historyManager.init();
}

export default historyManager;
