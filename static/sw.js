self.addEventListener('install', (event) => {
  // Skip waiting so the SW takes control immediately on first load
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim clients so the SW controls pages immediately after activation
  event.waitUntil(self.clients.claim());
});

// Basic passthrough fetch; customize to cache assets if desired
self.addEventListener('fetch', (event) => {
  // You can add caching strategy here if needed
});
