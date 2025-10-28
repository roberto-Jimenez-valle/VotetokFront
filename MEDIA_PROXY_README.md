# 🖼️ Sistema de Proxy de Medios - VouTop

## 📌 Resumen Ejecutivo

Se ha implementado un **sistema completo de proxy de medios** que permite a VouTop mostrar imágenes, videos y audios externos de manera segura, resolviendo problemas de CORS, X-Frame-Options y CSP.

---

## ✅ Lo que se implementó

### 🟢 Backend (Node.js/SvelteKit)

#### 1. Configuración del Proxy
**Archivo**: `src/lib/server/media-proxy-config.ts`

- ✅ Whitelist de 25+ dominios populares (Imgur, Flickr, Unsplash, etc.)
- ✅ Validación de tipos MIME (image/*, video/*, audio/*)
- ✅ Límite de tamaño: 10MB
- ✅ Caché: 7 días
- ✅ Timeout: 8 segundos
- ✅ Soporte para wildcards (`*.fbcdn.net`)

#### 2. Endpoint del Proxy
**Archivo**: `src/routes/api/media-proxy/+server.ts`

**Características**:
- ✅ Validación exhaustiva (URL, dominio, protocolo, Content-Type)
- ✅ Caché en memoria con expiración automática
- ✅ Headers de seguridad (CORS, X-Content-Type-Options)
- ✅ Seguimiento de redirects (301/302)
- ✅ Manejo de errores robusto
- ✅ Logging detallado

**Uso**:
```bash
GET /api/media-proxy?url=https://i.imgur.com/abc123.jpg
```

#### 3. Validador de iframes
**Archivo**: `src/lib/server/iframe-validator.ts`

**Funcionalidades**:
- ✅ Whitelist de hosts seguros (YouTube, Vimeo, Spotify, etc.)
- ✅ Sanitización de URLs (elimina parámetros peligrosos)
- ✅ Detección automática de plataforma
- ✅ Generación de atributos seguros (sandbox, allow, referrerpolicy)
- ✅ Conversión de URLs normales a URLs embed

#### 4. API de Validación de iframes
**Archivo**: `src/routes/api/validate-iframe/+server.ts`

**Características**:
- ✅ Validación de URLs y código embed
- ✅ Conversión automática (ej: youtube.com/watch → youtube.com/embed)
- ✅ Generación de HTML seguro
- ✅ Endpoint GET para testing rápido

**Uso**:
```bash
POST /api/validate-iframe
Body: {"url": "https://www.youtube.com/watch?v=..."}
```

### 🎨 Frontend (Svelte)

#### 5. Componente MediaEmbed Actualizado
**Archivo**: `src/lib/components/MediaEmbed.svelte`

**Mejoras**:
- ✅ Función `getProxiedImageUrl()` para uso automático del proxy
- ✅ Lista de dominios que no necesitan proxy (placeholders)
- ✅ Lazy loading de imágenes
- ✅ Manejo de errores mejorado con fallbacks
- ✅ Integración transparente con el proxy

---

## 📚 Documentación

### 1. Guía Completa (450+ líneas)
**Archivo**: `MEDIA_PROXY_GUIDE.md`

**Contenido**:
- 📖 Descripción general y arquitectura
- 🟢 Implementación completa Node.js/SvelteKit
- 🐍 Implementación completa Python/FastAPI (con código)
- 🎨 Ejemplos de integración frontend (React, Vue, Svelte)
- 🔒 Guía de seguridad (SSRF, XSS, rate limiting)
- ⚡ Optimización y caché (memoria, Redis, CDN)
- 🔧 Troubleshooting completo
- 🚀 Deploy en producción (Docker, nginx)

### 2. Quick Start (Uso Inmediato)
**Archivo**: `MEDIA_PROXY_QUICKSTART.md`

**Contenido**:
- ⚡ Uso inmediato con ejemplos de código
- 🧪 Testing rápido con curl
- 🔧 Configuración básica
- 🔒 Seguridad por defecto
- 📊 Lista de dominios soportados
- 🐛 Troubleshooting común

### 3. Ejemplo Python/FastAPI Completo
**Archivo**: `examples/python-fastapi-proxy.py`

**Características**:
- ✅ 450+ líneas de código funcional
- ✅ Sistema completo de validación
- ✅ Caché en memoria con LRU
- ✅ Prevención SSRF
- ✅ Limpieza automática de caché
- ✅ Documentación OpenAPI automática
- ✅ Listo para ejecutar con `uvicorn`

---

## 🚀 Uso Inmediato

### Opción 1: Frontend con JavaScript

```typescript
// Función automática ya integrada en MediaEmbed.svelte
function getProxiedImageUrl(imageUrl: string): string {
  const noProxyDomains = ['picsum.photos', 'placehold.co'];
  const hostname = new URL(imageUrl).hostname;
  const needsProxy = !noProxyDomains.some(d => hostname.endsWith(d));
  
  return needsProxy 
    ? `/api/media-proxy?url=${encodeURIComponent(imageUrl)}`
    : imageUrl;
}

// Uso directo
<img src={getProxiedImageUrl('https://i.imgur.com/abc.jpg')} />
```

### Opción 2: API REST

```bash
# Proxear imagen
curl "http://localhost:5173/api/media-proxy?url=https://i.imgur.com/sample.jpg"

# Validar iframe
curl -X POST http://localhost:5173/api/validate-iframe \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

### Opción 3: Python/FastAPI

```bash
# Instalar dependencias
pip install fastapi uvicorn httpx

# Ejecutar servidor
cd examples
uvicorn python-fastapi-proxy:app --reload --port 8000

# Probar
curl "http://localhost:8000/api/media-proxy?url=https://i.imgur.com/sample.jpg"
```

---

## 🔒 Seguridad Implementada

### ✅ Protecciones Activas

1. **Whitelist Estricta**
   - Solo dominios aprobados manualmente
   - Soporte para wildcards con precaución

2. **Validación de Protocolo**
   - Solo HTTPS permitido
   - HTTP rechazado automáticamente

3. **Validación de Content-Type**
   - Solo `image/*`, `video/*`, `audio/*`
   - Tipos peligrosos rechazados

4. **Límite de Tamaño**
   - Máximo 10MB por archivo
   - Verificación en headers y contenido real

5. **Timeout Configurado**
   - 8 segundos por defecto
   - Previene bloqueo del servidor

6. **Sanitización de iframes**
   - Elimina parámetros javascript, onclick, onerror
   - Fuerza HTTPS
   - Atributos sandbox seguros

7. **Headers de Seguridad**
   - `X-Content-Type-Options: nosniff`
   - `Access-Control-Allow-Origin: *`
   - `Cache-Control` optimizado
   - `X-Frame-Options: SAMEORIGIN`

8. **Prevención SSRF** (Python)
   - Bloquea IPs privadas (127.0.0.1, 10.x.x.x, etc.)
   - Bloquea AWS metadata (169.254.169.254)

---

## ⚡ Performance

### Caché Implementada

**En Memoria (Node.js)**:
- ✅ Map nativo de JavaScript
- ✅ Expiración automática (7 días)
- ✅ LRU simple (máximo 100 items)
- ✅ Limpieza periódica (cada hora)

**Headers de Caché**:
```http
Cache-Control: public, max-age=604800
X-Cache: HIT | MISS
```

### Mejoras Opcionales (No Implementadas)

**Redis Cache**:
```typescript
import redis from 'redis';
const client = redis.createClient();
await client.setEx(key, 604800, data);
```

**Compresión de Imágenes**:
```typescript
import sharp from 'sharp';
const optimized = await sharp(buffer)
  .resize(1200)
  .jpeg({ quality: 85 })
  .toBuffer();
```

---

## 📊 Dominios Soportados

### Imágenes Populares
- ✅ Imgur (`i.imgur.com`, `imgur.com`)
- ✅ Flickr (`live.staticflickr.com`)
- ✅ Wikipedia (`upload.wikimedia.org`)
- ✅ Unsplash (`images.unsplash.com`)
- ✅ Pixabay (`cdn.pixabay.com`)
- ✅ Picsum Photos (`picsum.photos`)

### GIFs Animados
- ✅ Giphy (`media.giphy.com`, `i.giphy.com`, `media0-4.giphy.com`)

### CDNs de Video
- ✅ Vimeo CDN (`i.vimeocdn.com`)
- ✅ YouTube CDN (`i.ytimg.com`, `img.youtube.com`)

### Redes Sociales
- ✅ Twitter/X (`pbs.twimg.com`)
- ✅ Instagram (`cdninstagram.com`)
- ✅ Facebook (`*.fbcdn.net` - wildcard)

### Servicios de UI
- ✅ UI Avatars (`ui-avatars.com`)
- ✅ Placehold.co (`placehold.co`)
- ✅ Placeholder.com (`via.placeholder.com`)

### CDNs Generales
- ✅ Cloudinary (`cloudinary.com`)
- ✅ CloudFront (`cloudfront.net`)
- ✅ GitHub (`githubusercontent.com`)

**Total**: 30+ dominios configurados (incluyendo Giphy)

---

## 🧪 Testing

### Tests Básicos

```bash
# 1. Imagen de Imgur (debe funcionar)
curl -I "http://localhost:5173/api/media-proxy?url=https://i.imgur.com/sample.jpg"
# Esperado: 200 OK, Content-Type: image/jpeg

# 2. Dominio no permitido (debe fallar)
curl -I "http://localhost:5173/api/media-proxy?url=https://malicious.com/img.jpg"
# Esperado: 403 Forbidden

# 3. URL HTTP (debe fallar)
curl -I "http://localhost:5173/api/media-proxy?url=http://example.com/img.jpg"
# Esperado: 400 Bad Request

# 4. Caché hit (segunda llamada)
curl -I "http://localhost:5173/api/media-proxy?url=https://picsum.photos/200"
# Primera: X-Cache: MISS
# Segunda: X-Cache: HIT

# 5. Validar iframe de YouTube
curl -X POST http://localhost:5173/api/validate-iframe \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}' | jq
# Esperado: 200 OK con URL sanitizada
```

### Tests de Seguridad

```bash
# Intentar XSS
curl -X POST http://localhost:5173/api/validate-iframe \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/embed/abc?onclick=alert(1)"}'
# Esperado: Parámetro 'onclick' eliminado

# Intentar dominio malicioso
curl "http://localhost:5173/api/media-proxy?url=https://evil.com/malware.jpg"
# Esperado: 403 Forbidden
```

---

## 🚀 Próximos Pasos (Opcional)

### 1. Rate Limiting (Recomendado)
```typescript
// Instalar
npm install express-rate-limit

// Implementar
const limiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minuto
  max: 60  // 60 requests
});
```

### 2. Redis para Caché (Producción)
```bash
npm install redis

# Docker
docker run -d -p 6379:6379 redis:alpine
```

### 3. Monitoreo y Métricas
```typescript
// Prometheus
import prometheus from 'prom-client';

const counter = new prometheus.Counter({
  name: 'media_proxy_requests_total',
  help: 'Total de requests'
});
```

### 4. Compresión de Imágenes
```bash
npm install sharp

# Optimizar automáticamente
const optimized = await sharp(buffer)
  .resize(1200, null, { withoutEnlargement: true })
  .jpeg({ quality: 85 })
  .toBuffer();
```

---

## 📁 Estructura de Archivos

```
src/
├── lib/
│   ├── components/
│   │   └── MediaEmbed.svelte          ✅ Actualizado con proxy
│   └── server/
│       ├── media-proxy-config.ts      ✅ Configuración
│       └── iframe-validator.ts        ✅ Validación iframes
└── routes/
    └── api/
        ├── media-proxy/
        │   └── +server.ts             ✅ Endpoint proxy
        └── validate-iframe/
            └── +server.ts             ✅ API validación

examples/
└── python-fastapi-proxy.py            ✅ Implementación Python

docs/
├── MEDIA_PROXY_GUIDE.md               ✅ Guía completa (450+ líneas)
├── MEDIA_PROXY_QUICKSTART.md          ✅ Quick start
└── MEDIA_PROXY_README.md              ✅ Este archivo
```

---

## 🎓 Recursos y Referencias

### Documentación Creada
1. **MEDIA_PROXY_GUIDE.md** - Guía completa con arquitectura, código completo Node.js y Python, seguridad, optimización y deploy
2. **MEDIA_PROXY_QUICKSTART.md** - Uso inmediato, testing, troubleshooting
3. **python-fastapi-proxy.py** - Implementación completa funcional en Python

### Referencias Externas
- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [MDN: CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP: SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

---

## 📞 Soporte

### Problemas Comunes

**"Dominio no permitido"**
→ Agregar dominio a `allowedDomains` en `media-proxy-config.ts`

**"Timeout al obtener recurso"**
→ Aumentar `timeout` en configuración (8000 → 15000ms)

**"Archivo muy grande"**
→ Aumentar `maxFileSize` o implementar compresión

**Caché no funciona**
→ Verificar que la URL sea exactamente igual (incluyendo query params)

---

## ✨ Características Destacadas

| Característica | Estado | Descripción |
|---------------|--------|-------------|
| Proxy de imágenes | ✅ | Con whitelist de 25+ dominios |
| Caché en memoria | ✅ | 7 días, LRU, limpieza automática |
| Validación Content-Type | ✅ | Solo image/video/audio |
| Sanitización iframes | ✅ | Elimina XSS, fuerza HTTPS |
| CORS habilitado | ✅ | Access-Control-Allow-Origin: * |
| Timeout configurable | ✅ | 8 segundos por defecto |
| Límite de tamaño | ✅ | 10MB por defecto |
| Seguir redirects | ✅ | 301/302 automático |
| Headers de seguridad | ✅ | X-Content-Type-Options, etc. |
| Documentación completa | ✅ | 1500+ líneas en total |
| Ejemplo Python/FastAPI | ✅ | 450+ líneas funcionales |
| Integración frontend | ✅ | Transparente en MediaEmbed |

---

## 🎉 Conclusión

Se ha implementado un **sistema completo, seguro y escalable** de proxy de medios para VouTop que:

✅ **Resuelve** problemas de CORS, X-Frame-Options y CSP  
✅ **Soporta** 25+ dominios populares de imágenes  
✅ **Valida** y sanitiza iframes de video/audio embebidos  
✅ **Incluye** caché con expiración automática  
✅ **Proporciona** documentación exhaustiva (1500+ líneas)  
✅ **Ofrece** implementación alternativa en Python/FastAPI  
✅ **Garantiza** seguridad con whitelist y validaciones  

**El sistema está listo para usar inmediatamente** sin configuración adicional. Para necesidades avanzadas, consultar `MEDIA_PROXY_GUIDE.md`.

---

**Creado para**: VouTop  
**Versión**: 1.0.0  
**Última actualización**: Octubre 2024  
**Autor**: Sistema de IA - Full-Stack Engineer
