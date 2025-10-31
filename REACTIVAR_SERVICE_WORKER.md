# Cómo Reactivar el Service Worker (Opcional)

## ⚠️ IMPORTANTE: Solo hazlo si funciona en producción sin el SW

El Service Worker está desactivado porque causaba errores. Si todo funciona bien en Railway/producción, puedes intentar reactivarlo más adelante.

## Pasos para Reactivar

### 1. Restaurar service-worker.js

Elimina la versión simplificada y usa una versión básica:

```javascript
// src/service-worker.js
self.addEventListener('install', () => {
  console.log('[ServiceWorker] Instalado');
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.log('[ServiceWorker] Activado');
  self.clients.claim();
});

// Solo cachear lo esencial, sin usar $service-worker
const CACHE_NAME = 'voutop-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  // Solo cachear GET requests
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
```

### 2. Descomentar en app.html

```html
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(reg => console.log('SW registered:', reg))
        .catch(err => console.log('SW error:', err));
    });
  }
</script>
```

### 3. Rebuild y Deploy

```bash
npm run build
git add .
git commit -m "Reactivar service worker"
git push
```

### 4. Verificar en Producción

1. Abre las DevTools (F12)
2. Ve a la pestaña "Application" → "Service Workers"
3. Verifica que esté registrado y funcionando

## Ventajas del Service Worker

✅ **Cache de assets**: Carga más rápida
✅ **Funcionamiento offline**: La app funciona sin internet (limitado)
✅ **Push notifications**: Puedes enviar notificaciones

## Desventajas Actuales

❌ **Causaba error** de hidratación con imports de SvelteKit
❌ **Complejidad adicional** de debugging
❌ **No esencial** para una app de votación (necesitas conexión)

## Recomendación

**Déjalo desactivado** hasta que:
1. Todo funcione perfectamente en producción
2. Necesites específicamente funcionalidad offline
3. Quieras implementar push notifications

Para la mayoría de casos, Railway/Netlify ya hacen suficiente caché.
