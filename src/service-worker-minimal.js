// Service Worker mínimo sin dependencias de SvelteKit

self.addEventListener('install', () => {
  console.log('[ServiceWorker] Instalado (versión mínima)');
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.log('[ServiceWorker] Activado (versión mínima)');
  self.clients.claim();
});

// Solo cachear recursos críticos
self.addEventListener('fetch', (event) => {
  // Por ahora, solo pasar las peticiones sin cachear
  return;
});
