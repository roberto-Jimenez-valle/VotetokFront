/// <reference types="@sveltejs/kit" />
// Temporalmente simplificado para diagnóstico
const build = [];
const files = [];
const version = '1.0.0';

// Nombre único del cache
const CACHE_NAME = `voutop-v${version}`;

// Assets a cachear
const ASSETS = [
  // Temporalmente vacío para diagnóstico
];

// Patrones de URLs a cachear dinámicamente
const CACHE_PATTERNS = {
  api: /^\/api\/(polls\/trending|users\/suggestions|data\/world)/,
  images: /\.(png|jpg|jpeg|svg|webp|avif)$/i,
  fonts: /\.(woff2?|ttf|otf)$/i,
  geojson: /\/geojson\/.+\.(topojson|json)$/i
};

// URLs a nunca cachear
const NEVER_CACHE = [
  /^\/api\/auth/,
  /^\/api\/votes/,
  /^\/api\/polls\/\d+\/vote/,
  /^\/api\/users\/\d+\/follow/,
  /^\/api\/notifications/
];

// Estrategias de cache
const CACHE_STRATEGIES = {
  cacheFirst: ['images', 'fonts', 'geojson'],
  networkFirst: ['api'],
  staleWhileRevalidate: ['documents']
};

// Tiempo de expiración por tipo
const CACHE_EXPIRATION = {
  api: 5 * 60 * 1000,        // 5 minutos
  images: 7 * 24 * 60 * 60 * 1000, // 7 días
  fonts: 30 * 24 * 60 * 60 * 1000, // 30 días
  geojson: 24 * 60 * 60 * 1000     // 1 día
};

// ===============================================
// INSTALACIÓN
// ===============================================

self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing version:', version);
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      
      // Cachear assets esenciales
      const essentialAssets = ASSETS.filter(asset => 
        !asset.includes('chunk') && 
        !asset.includes('legacy')
      );
      
      // Cachear en lotes para evitar sobrecarga
      const batchSize = 10;
      for (let i = 0; i < essentialAssets.length; i += batchSize) {
        const batch = essentialAssets.slice(i, i + batchSize);
        try {
          await cache.addAll(batch);
        } catch (error) {
          console.error('[ServiceWorker] Error caching batch:', error);
        }
      }
      
      console.log('[ServiceWorker] Cached', essentialAssets.length, 'essential assets');
    })()
  );
  
  // Activar inmediatamente
  self.skipWaiting();
});

// ===============================================
// ACTIVACIÓN
// ===============================================

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating version:', version);
  
  event.waitUntil(
    (async () => {
      // Limpiar caches antiguos
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(name => 
        name.startsWith('voutop-') && name !== CACHE_NAME
      );
      
      await Promise.all(
        oldCaches.map(name => {
          console.log('[ServiceWorker] Deleting old cache:', name);
          return caches.delete(name);
        })
      );
      
      // Tomar control de todas las páginas
      await self.clients.claim();
    })()
  );
});

// ===============================================
// FETCH - INTERCEPTACIÓN DE REQUESTS
// ===============================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar requests no-GET
  if (request.method !== 'GET') return;
  
  // Ignorar extensiones del navegador
  if (url.protocol === 'chrome-extension:') return;
  
  // Verificar si nunca se debe cachear
  if (NEVER_CACHE.some(pattern => pattern.test(url.pathname))) {
    return;
  }
  
  // Determinar estrategia de cache
  const strategy = getStrategy(url);
  
  event.respondWith(
    handleRequest(request, strategy)
  );
});

// ===============================================
// ESTRATEGIAS DE CACHE
// ===============================================

async function handleRequest(request, strategy) {
  switch (strategy) {
    case 'cacheFirst':
      return cacheFirst(request);
    case 'networkFirst':
      return networkFirst(request);
    case 'staleWhileRevalidate':
      return staleWhileRevalidate(request);
    default:
      return fetch(request);
  }
}

// Cache First - Para assets estáticos
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Verificar expiración
    const cacheTime = await getCacheTime(request);
    if (cacheTime && !isExpired(cacheTime, 'images')) {
      return cached;
    }
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      await setCacheTime(request, Date.now());
    }
    return response;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

// Network First - Para APIs
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      await setCacheTime(request, Date.now());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      console.log('[ServiceWorker] Network failed, using cache for:', request.url);
      return cached;
    }
    throw error;
  }
}

// Stale While Revalidate - Para documentos HTML
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      const cache = caches.open(CACHE_NAME).then(cache => {
        cache.put(request, response.clone());
        setCacheTime(request, Date.now());
      });
    }
    return response;
  });
  
  return cached || fetchPromise;
}

// ===============================================
// UTILIDADES
// ===============================================

// Determinar estrategia según URL
function getStrategy(url) {
  const pathname = url.pathname;
  
  // Verificar patrones específicos
  if (CACHE_PATTERNS.images.test(pathname)) return 'cacheFirst';
  if (CACHE_PATTERNS.fonts.test(pathname)) return 'cacheFirst';
  if (CACHE_PATTERNS.geojson.test(pathname)) return 'cacheFirst';
  if (CACHE_PATTERNS.api.test(pathname)) return 'networkFirst';
  
  // Por defecto para documentos HTML
  if (pathname === '/' || pathname.endsWith('.html')) {
    return 'staleWhileRevalidate';
  }
  
  // Por defecto para otros assets
  return 'cacheFirst';
}

// Verificar si el cache expiró
function isExpired(cacheTime, type) {
  const expiration = CACHE_EXPIRATION[type] || CACHE_EXPIRATION.api;
  return Date.now() - cacheTime > expiration;
}

// Obtener tiempo de cache
async function getCacheTime(request) {
  const db = await openDB();
  return db.get('cache-times', request.url);
}

// Establecer tiempo de cache
async function setCacheTime(request, time) {
  const db = await openDB();
  return db.put('cache-times', time, request.url);
}

// Abrir IndexedDB para metadata
let dbPromise;
function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('voutop-sw', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('cache-times')) {
          db.createObjectStore('cache-times');
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        resolve({
          get: (store, key) => {
            return new Promise((resolve) => {
              const tx = db.transaction(store, 'readonly');
              const req = tx.objectStore(store).get(key);
              req.onsuccess = () => resolve(req.result);
            });
          },
          put: (store, value, key) => {
            return new Promise((resolve) => {
              const tx = db.transaction(store, 'readwrite');
              const req = tx.objectStore(store).put(value, key);
              req.onsuccess = () => resolve();
            });
          }
        });
      };
      
      request.onerror = reject;
    });
  }
  return dbPromise;
}

// ===============================================
// SINCRONIZACIÓN EN BACKGROUND
// ===============================================

self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag);
  
  if (event.tag === 'sync-votes') {
    event.waitUntil(syncPendingVotes());
  }
});

async function syncPendingVotes() {
  const db = await openDB();
  const votes = await db.get('pending-votes', 'all') || [];
  
  for (const vote of votes) {
    try {
      const response = await fetch('/api/polls/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vote)
      });
      
      if (response.ok) {
        // Eliminar voto pendiente
        votes.splice(votes.indexOf(vote), 1);
      }
    } catch (error) {
      console.error('[ServiceWorker] Error syncing vote:', error);
    }
  }
  
  // Guardar votos pendientes actualizados
  await db.put('pending-votes', votes, 'all');
}

// ===============================================
// PUSH NOTIFICATIONS
// ===============================================

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'Nueva actividad en VouTop',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      pollId: data.pollId
    },
    actions: [
      { action: 'view', title: 'Ver' },
      { action: 'dismiss', title: 'Descartar' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(
      data.title || 'VouTop',
      options
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view' || !event.action) {
    const url = event.notification.data.url;
    event.waitUntil(
      clients.openWindow(url)
    );
  }
});

// ===============================================
// MENSAJE DESDE CLIENTE
// ===============================================

self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(names => 
        Promise.all(names.map(name => caches.delete(name)))
      )
    );
  }
  
  if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      cacheUrls(event.data.urls)
    );
  }
});

async function cacheUrls(urls) {
  const cache = await caches.open(CACHE_NAME);
  return cache.addAll(urls);
}

// ===============================================
// ANALYTICS OFFLINE
// ===============================================

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('analytics') || 
      event.request.url.includes('gtag')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Guardar para enviar después
        return new Response(null, { status: 204 });
      })
    );
  }
});

console.log('[ServiceWorker] Loaded version:', version);
