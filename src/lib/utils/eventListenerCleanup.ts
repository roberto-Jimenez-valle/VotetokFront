/**
 * Utilidad para gestionar event listeners con cleanup automático
 * Previene memory leaks al asegurar que todos los listeners se remueven
 */

type EventTarget = Window | Document | HTMLElement | null | undefined;
type EventListener = (event: any) => void;

interface ListenerRegistration {
  target: EventTarget;
  event: string;
  listener: EventListener;
  options?: AddEventListenerOptions | boolean;
}

/**
 * EventListenerManager - Clase para gestionar listeners con cleanup garantizado
 * 
 * @example
 * const manager = new EventListenerManager();
 * 
 * onMount(() => {
 *   manager.add(window, 'resize', handleResize);
 *   manager.add(document, 'click', handleClick, { capture: true });
 *   
 *   return () => manager.cleanup(); // Cleanup automático
 * });
 */
export class EventListenerManager {
  private listeners: ListenerRegistration[] = [];
  private isCleanedUp = false;

  /**
   * Añadir un event listener con cleanup automático
   */
  add(
    target: EventTarget,
    event: string,
    listener: EventListener,
    options?: AddEventListenerOptions | boolean
  ): void {
    if (!target || this.isCleanedUp) {
      console.warn('[EventListenerManager] Cannot add listener - target invalid or already cleaned up');
      return;
    }

    // Registrar listener
    this.listeners.push({ target, event, listener, options });

    // Añadir al DOM
    (target as any).addEventListener(event, listener, options);
  }

  /**
   * Remover un listener específico
   */
  remove(target: EventTarget, event: string, listener: EventListener): void {
    const index = this.listeners.findIndex(
      l => l.target === target && l.event === event && l.listener === listener
    );

    if (index !== -1) {
      const registration = this.listeners[index];
      (registration.target as any).removeEventListener(
        registration.event,
        registration.listener,
        registration.options
      );
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Limpiar TODOS los listeners registrados
   * Debe ser llamado en onDestroy
   */
  cleanup(): void {
    if (this.isCleanedUp) return;

    this.listeners.forEach(({ target, event, listener, options }) => {
      try {
        (target as any)?.removeEventListener?.(event, listener, options);
      } catch (error) {
        console.error('[EventListenerManager] Error removing listener:', error);
      }
    });

    this.listeners = [];
    this.isCleanedUp = true;
  }

  /**
   * Obtener cantidad de listeners activos (útil para debugging)
   */
  get count(): number {
    return this.listeners.length;
  }

  /**
   * Listar todos los listeners activos (debugging)
   */
  list(): Array<{ event: string; target: string }> {
    return this.listeners.map(l => ({
      event: l.event,
      target: l.target === window ? 'window' : 
              l.target === document ? 'document' : 
              'element'
    }));
  }
}

/**
 * Hook estilo React para Svelte 5
 * Crea un manager y retorna función de cleanup
 * 
 * @example
 * const listeners = createEventListenerManager();
 * 
 * onMount(() => {
 *   listeners.add(window, 'resize', handleResize);
 *   return listeners.cleanup;
 * });
 */
export function createEventListenerManager(): EventListenerManager {
  return new EventListenerManager();
}

/**
 * Función helper para throttle (limitar frecuencia de ejecución)
 * Útil para eventos que se disparan muchas veces (scroll, resize, mousemove)
 * 
 * @example
 * const handleScroll = throttle(() => {
 *   console.log('Scrolling...');
 * }, 100);
 * 
 * manager.add(window, 'scroll', handleScroll);
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastExecTime = 0;

  return function (this: any, ...args: Parameters<T>) {
    const currentTime = Date.now();
    const timeSinceLastExec = currentTime - lastExecTime;

    if (timeSinceLastExec >= delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - timeSinceLastExec);
    }
  };
}

/**
 * Función helper para debounce (ejecutar solo después de que pare la actividad)
 * Útil para búsquedas, validaciones, etc.
 * 
 * @example
 * const handleInput = debounce((value: string) => {
 *   performSearch(value);
 * }, 300);
 * 
 * manager.add(input, 'input', (e) => handleInput(e.target.value));
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * Helper para añadir listener con cleanup automático en onDestroy
 * Uso simplificado para casos simples
 * 
 * @example
 * onMount(() => addListener(window, 'resize', handleResize));
 */
export function addListener(
  target: EventTarget,
  event: string,
  listener: EventListener,
  options?: AddEventListenerOptions | boolean
): () => void {
  if (!target) {
    console.warn('[addListener] Invalid target');
    return () => {};
  }

  (target as any).addEventListener(event, listener, options);

  return () => {
    (target as any).removeEventListener(event, listener, options);
  };
}

/**
 * Detectar y reportar listeners huérfanos (debugging en desarrollo)
 * Ejecutar en desarrollo para detectar memory leaks
 */
export function detectOrphanListeners(): void {
  if (typeof window === 'undefined') return;

  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
  const activeListeners = new Map<EventTarget, Map<string, number>>();

  EventTarget.prototype.addEventListener = function(
    this: EventTarget,
    type: string,
    listener: any,
    options?: any
  ) {
    if (!activeListeners.has(this)) {
      activeListeners.set(this, new Map());
    }
    const listenerMap = activeListeners.get(this)!;
    listenerMap.set(type, (listenerMap.get(type) || 0) + 1);

    return originalAddEventListener.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function(
    this: EventTarget,
    type: string,
    listener: any,
    options?: any
  ) {
    const listenerMap = activeListeners.get(this);
    if (listenerMap) {
      const count = listenerMap.get(type) || 0;
      if (count > 0) {
        listenerMap.set(type, count - 1);
      }
    }

    return originalRemoveEventListener.call(this, type, listener, options);
  };

  // Reportar cada 10 segundos
  setInterval(() => {
    console.group('[Orphan Listeners Detection]');
    activeListeners.forEach((listenerMap, target) => {
      listenerMap.forEach((count, event) => {
        if (count > 0) {
          console.warn(`${count} listener(s) for "${event}" on`, target);
        }
      });
    });
    console.groupEnd();
  }, 10000);
}
