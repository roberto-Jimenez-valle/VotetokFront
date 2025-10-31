import { vi, afterEach, beforeAll, afterAll } from 'vitest';
import { readable, writable, get as svelteGet } from 'svelte/store';
import * as environment from '$app/environment';
import * as navigation from '$app/navigation';
import * as stores from '$app/stores';

// Mock de variables de entorno
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Mock de $app/environment
vi.mock('$app/environment', () => ({
  browser: false,
  dev: true,
  building: false,
  version: 'test'
}));

// Mock de $app/navigation
vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
  replaceState: vi.fn(),
  pushState: vi.fn(),
  invalidate: vi.fn(),
  invalidateAll: vi.fn(),
  afterNavigate: vi.fn(),
  beforeNavigate: vi.fn(),
  onNavigate: vi.fn()
}));

// Mock de $app/stores
vi.mock('$app/stores', () => ({
  page: readable({
    url: new URL('http://localhost:3000'),
    params: {},
    route: {
      id: '/'
    },
    status: 200,
    error: null,
    data: {},
    form: null
  }),
  navigating: readable(null),
  updated: {
    subscribe: vi.fn(),
    check: vi.fn()
  },
  getStores: vi.fn()
}));

// Mock de localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};
global.localStorage = localStorageMock as Storage;

// Mock de sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};
global.sessionStorage = sessionStorageMock as Storage;

// Mock de fetch global
global.fetch = vi.fn();

// Mock de IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: []
}));

// Mock de ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock de MutationObserver
global.MutationObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn()
}));

// Mock de requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  setTimeout(callback, 0);
  return 0;
});

global.cancelAnimationFrame = vi.fn();

// Mock de matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

// Mock de navigator.geolocation
Object.defineProperty(navigator, 'geolocation', {
  writable: true,
  value: {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn()
  }
});

// Mock de WebGL context
HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextType) => {
  if (contextType === 'webgl' || contextType === 'webgl2') {
    return {
      canvas: {},
      drawingBufferWidth: 800,
      drawingBufferHeight: 600,
      getExtension: vi.fn(),
      getParameter: vi.fn(),
      createBuffer: vi.fn(),
      createProgram: vi.fn(),
      createShader: vi.fn(),
      createTexture: vi.fn(),
      bindBuffer: vi.fn(),
      bindTexture: vi.fn(),
      bufferData: vi.fn(),
      texImage2D: vi.fn(),
      texParameteri: vi.fn(),
      clear: vi.fn(),
      clearColor: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      viewport: vi.fn(),
      drawArrays: vi.fn(),
      drawElements: vi.fn()
    };
  }
  return null;
});

// Mock de IndexedDB
const indexedDBMock = {
  open: vi.fn().mockReturnValue({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: {
      objectStoreNames: {
        contains: vi.fn().mockReturnValue(false)
      },
      createObjectStore: vi.fn(),
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          add: vi.fn(),
          get: vi.fn(),
          put: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn(),
          count: vi.fn(),
          getAll: vi.fn(),
          getAllKeys: vi.fn(),
          index: vi.fn(),
          openCursor: vi.fn()
        })
      })
    }
  }),
  deleteDatabase: vi.fn()
};
global.indexedDB = indexedDBMock as any;

// Helper para crear stores de test
export function createTestStore<T>(initialValue: T) {
  const store = writable(initialValue);
  return {
    ...store,
    get: () => svelteGet(store)
  };
}

// Helper para mockear respuestas de fetch
export function mockFetchResponse(data: any, options: ResponseInit = {}) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })
  );
}

// Helper para esperar a que se resuelvan las promesas
export function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// Helper para crear un evento sintético
export function createEvent(type: string, detail: any = {}) {
  return new CustomEvent(type, { detail });
}

// Limpiar mocks después de cada test
afterEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});

// Configuración global de timeouts
beforeAll(() => {
  vi.setConfig({ testTimeout: 10000 });
});

// Suprimir warnings de consola en tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = vi.fn((message, ...args) => {
    // Solo mostrar errores que no sean de React/Svelte internos
    if (
      typeof message === 'string' &&
      !message.includes('Warning:') &&
      !message.includes('act()')
    ) {
      originalError(message, ...args);
    }
  });
  
  console.warn = vi.fn((message, ...args) => {
    // Filtrar warnings conocidos
    if (
      typeof message === 'string' &&
      !message.includes('Svelte:') &&
      !message.includes('deprecated')
    ) {
      originalWarn(message, ...args);
    }
  });
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

export {
  vi,
  localStorageMock,
  sessionStorageMock
};
