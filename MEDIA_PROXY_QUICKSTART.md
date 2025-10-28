# 🚀 Quick Start: Sistema de Proxy de Medios

## ✅ ¿Qué se implementó?

### 1. **Backend (Node.js/SvelteKit)**

#### Archivos Creados:
- ✅ `src/lib/server/media-proxy-config.ts` - Configuración y whitelist
- ✅ `src/routes/api/media-proxy/+server.ts` - Endpoint del proxy
- ✅ `src/lib/server/iframe-validator.ts` - Validación de iframes
- ✅ `src/routes/api/validate-iframe/+server.ts` - API de validación

#### Archivos Modificados:
- ✅ `src/lib/components/MediaEmbed.svelte` - Uso del proxy

### 2. **Documentación**
- ✅ `MEDIA_PROXY_GUIDE.md` - Guía completa con ejemplos Python/FastAPI
- ✅ `MEDIA_PROXY_QUICKSTART.md` - Este archivo

---

## 🎯 Uso Inmediato

### Opción 1: Imágenes Externas en Frontend

```typescript
// Función helper automática
function getProxiedImageUrl(imageUrl: string): string {
  if (!imageUrl) return imageUrl;
  
  const noProxyDomains = ['picsum.photos', 'placehold.co', 'ui-avatars.com'];
  const hostname = new URL(imageUrl).hostname;
  const needsProxy = !noProxyDomains.some(d => hostname.endsWith(d));
  
  return needsProxy 
    ? `/api/media-proxy?url=${encodeURIComponent(imageUrl)}`
    : imageUrl;
}

// Uso en HTML
<img src={getProxiedImageUrl('https://i.imgur.com/abc123.jpg')} alt="Imagen" />
```

### Opción 2: API REST

```bash
# Proxear una imagen
curl "http://localhost:5173/api/media-proxy?url=https://i.imgur.com/abc123.jpg"

# Validar un iframe
curl -X POST http://localhost:5173/api/validate-iframe \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

### Opción 3: JavaScript Fetch

```javascript
// Proxear imagen
const response = await fetch(`/api/media-proxy?url=${encodeURIComponent(imageUrl)}`);
const blob = await response.blob();
const objectUrl = URL.createObjectURL(blob);

// Validar iframe
const response = await fetch('/api/validate-iframe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=...' })
});
const { data } = await response.json();
console.log('Iframe seguro:', data.sanitizedUrl);
```

---

## 🔧 Configuración Rápida

### Agregar Dominio a la Whitelist

Edita `src/lib/server/media-proxy-config.ts`:

```typescript
export const MEDIA_PROXY_CONFIG = {
  allowedDomains: [
    'i.imgur.com',
    'imgur.com',
    // Agrega tu dominio aquí:
    'tu-dominio.com',
    '*.cdn-provider.com'  // Wildcards soportados
  ],
  // ...resto de configuración
};
```

### Cambiar Tamaño Máximo de Archivo

```typescript
maxFileSize: 20 * 1024 * 1024,  // 20MB en lugar de 10MB
```

### Cambiar Duración del Caché

```typescript
cacheMaxAge: 30 * 24 * 60 * 60,  // 30 días en lugar de 7
```

---

## 🧪 Testing

### Test 1: Imagen de Imgur
```bash
curl -I "http://localhost:5173/api/media-proxy?url=https://i.imgur.com/sample.jpg"
# Esperado: 200 OK, Content-Type: image/jpeg
```

### Test 2: Dominio No Permitido
```bash
curl -I "http://localhost:5173/api/media-proxy?url=https://malicious-site.com/img.jpg"
# Esperado: 403 Forbidden
```

### Test 3: Validar iframe de YouTube
```bash
curl -X POST http://localhost:5173/api/validate-iframe \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}' | jq
```

### Test 4: Caché Hit
```bash
# Primera llamada (MISS)
curl -I "http://localhost:5173/api/media-proxy?url=https://picsum.photos/200"
# X-Cache: MISS

# Segunda llamada (HIT)
curl -I "http://localhost:5173/api/media-proxy?url=https://picsum.photos/200"
# X-Cache: HIT
```

---

## 🔒 Seguridad por Defecto

### ✅ Lo que ESTÁ protegido:

1. **Whitelist estricta** - Solo dominios aprobados
2. **Solo HTTPS** - HTTP rechazado
3. **Validación de Content-Type** - Solo image/*, video/*, audio/*
4. **Límite de tamaño** - Máximo 10MB por archivo
5. **Timeout** - 8 segundos máximo
6. **Sanitización de iframes** - Parámetros peligrosos eliminados
7. **Headers de seguridad** - X-Content-Type-Options, CORS, etc.

### ⚠️ Lo que DEBES revisar:

1. **Rate Limiting** - Implementar límite por IP (no incluido por defecto)
2. **Monitoreo** - Logs y métricas de uso
3. **Redis para caché** - Reemplazar caché en memoria en producción

---

## 📊 Dominios Soportados (Whitelist Actual)

### Imágenes
- ✅ `i.imgur.com`, `imgur.com`
- ✅ `live.staticflickr.com`, `staticflickr.com`
- ✅ `upload.wikimedia.org`
- ✅ `images.unsplash.com`, `unsplash.com`
- ✅ `cdn.pixabay.com`, `pixabay.com`
- ✅ `picsum.photos`

### CDNs de Video/Audio
- ✅ `i.vimeocdn.com`, `vimeocdn.com`
- ✅ `i.ytimg.com`, `ytimg.com`, `img.youtube.com`

### Redes Sociales (CDN)
- ✅ `pbs.twimg.com` (Twitter/X)
- ✅ `scontent.cdninstagram.com`, `cdninstagram.com`
- ✅ `*.fbcdn.net` (Facebook)

### Servicios de UI
- ✅ `ui-avatars.com`
- ✅ `placehold.co`
- ✅ `via.placeholder.com`
- ✅ `dummyimage.com`

### Otros
- ✅ `gravatar.com`
- ✅ `githubusercontent.com`
- ✅ `cloudinary.com`
- ✅ `cloudfront.net`

---

## 🎨 Integración con Tu App

### React

```jsx
import { useState } from 'react';

function ProxiedImage({ src, alt }) {
  const proxiedSrc = `/api/media-proxy?url=${encodeURIComponent(src)}`;
  const [imgSrc, setImgSrc] = useState(proxiedSrc);
  
  return (
    <img 
      src={imgSrc}
      alt={alt}
      onError={() => setImgSrc('https://placehold.co/400x300?text=Error')}
    />
  );
}
```

### Svelte

```svelte
<script>
  export let src;
  export let alt;
  
  const proxiedSrc = `/api/media-proxy?url=${encodeURIComponent(src)}`;
  let imgSrc = $state(proxiedSrc);
</script>

<img 
  src={imgSrc}
  {alt}
  onerror={() => imgSrc = 'https://placehold.co/400x300?text=Error'}
/>
```

### Vue

```vue
<template>
  <img 
    :src="proxiedSrc"
    :alt="alt"
    @error="handleError"
  />
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps(['src', 'alt']);
const proxiedSrc = computed(() => 
  `/api/media-proxy?url=${encodeURIComponent(props.src)}`
);

function handleError(e) {
  e.target.src = 'https://placehold.co/400x300?text=Error';
}
</script>
```

---

## 🐛 Troubleshooting

### Problema: "Dominio no permitido"

```bash
# Error
{"message":"Dominio no permitido: example.com","code":"DOMAIN_NOT_ALLOWED"}

# Solución
# Agregar 'example.com' a allowedDomains en media-proxy-config.ts
```

### Problema: Timeout

```bash
# Error
{"message":"Timeout al obtener el recurso","code":"TIMEOUT"}

# Solución
# 1. Aumentar timeout en config (8000 -> 15000ms)
# 2. Verificar conectividad del servidor
# 3. Considerar usar CDN para imágenes lentas
```

### Problema: Archivo muy grande

```bash
# Error
{"message":"Archivo muy grande","code":"FILE_TOO_LARGE"}

# Solución
# Aumentar maxFileSize en config o implementar compresión
maxFileSize: 20 * 1024 * 1024  // 20MB
```

### Problema: Caché no funciona

```bash
# Síntoma: Siempre X-Cache: MISS

# Solución
# Verificar que la URL sea exactamente igual (incluyendo parámetros)
# El cache usa la URL completa como key
```

---

## 📈 Próximos Pasos (Opcional)

### 1. Implementar Redis para Caché

```bash
npm install redis
```

```typescript
import { createClient } from 'redis';

const redis = createClient();
await redis.connect();

// Guardar en caché
await redis.setEx(cacheKey, 604800, JSON.stringify(data));

// Obtener de caché
const cached = await redis.get(cacheKey);
```

### 2. Agregar Rate Limiting

```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60 // 60 requests por minuto
});
```

### 3. Implementar Compresión de Imágenes

```bash
npm install sharp
```

```typescript
import sharp from 'sharp';

const optimized = await sharp(buffer)
  .resize(1200, null, { withoutEnlargement: true })
  .jpeg({ quality: 85 })
  .toBuffer();
```

### 4. Agregar Monitoreo

```typescript
// Prometheus metrics
import prometheus from 'prom-client';

const requestCounter = new prometheus.Counter({
  name: 'media_proxy_requests_total',
  help: 'Total requests to media proxy'
});
```

---

## 📚 Más Información

- **Guía Completa**: Ver `MEDIA_PROXY_GUIDE.md`
- **Configuración**: Ver `src/lib/server/media-proxy-config.ts`
- **Validación de iframes**: Ver `src/lib/server/iframe-validator.ts`

---

## ✨ Características Actuales

| Característica | Estado | Notas |
|---------------|--------|-------|
| Proxy de imágenes | ✅ | Con whitelist |
| Caché en memoria | ✅ | 7 días por defecto |
| Validación Content-Type | ✅ | Solo image/video/audio |
| Sanitización de iframes | ✅ | Elimina parámetros peligrosos |
| CORS habilitado | ✅ | Access-Control-Allow-Origin: * |
| Timeout configurable | ✅ | 8 segundos por defecto |
| Límite de tamaño | ✅ | 10MB por defecto |
| Seguir redirects | ✅ | 301/302 automático |
| Caché headers | ✅ | Cache-Control, ETag |
| Rate limiting | ⚠️ | Implementar manualmente |
| Redis cache | ⚠️ | Implementar manualmente |
| Compresión de imágenes | ⚠️ | Implementar manualmente |

---

**¿Dudas?** Ver documentación completa en `MEDIA_PROXY_GUIDE.md`

**Creado para**: VouTop  
**Versión**: 1.0.0
