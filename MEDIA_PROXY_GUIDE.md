# 🖼️ Guía Completa: Sistema de Proxy de Medios para VouTop

## 📋 Índice
1. [Descripción General](#descripción-general)
2. [Arquitectura](#arquitectura)
3. [Implementación Node.js (SvelteKit)](#implementación-nodejs-sveltekit)
4. [Implementación Python (FastAPI)](#implementación-python-fastapi)
5. [Integración Frontend](#integración-frontend)
6. [Seguridad](#seguridad)
7. [Optimización y Caché](#optimización-y-caché)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Descripción General

El sistema de proxy de medios de VouTop permite mostrar imágenes, videos y audios externos de manera segura, resolviendo:

- ❌ **Problemas de CORS** - Cross-Origin Resource Sharing
- ❌ **X-Frame-Options** - Bloqueo de iframes
- ❌ **Content-Security-Policy** - Restricciones CSP
- ❌ **Mixed Content** - HTTP en páginas HTTPS
- ✅ **Solución**: Proxy interno que descarga y sirve el contenido

### Dominios Soportados

**Imágenes:**
- `i.imgur.com`, `imgur.com`
- `live.staticflickr.com`
- `upload.wikimedia.org`
- `images.unsplash.com`
- `cdn.pixabay.com`
- `i.vimeocdn.com`, `i.ytimg.com`
- Y más... (ver configuración)

**Videos/Audio embebidos:**
- YouTube (`youtube.com/embed/`)
- Vimeo (`player.vimeo.com/video/`)
- Spotify (`open.spotify.com/embed/`)
- SoundCloud (`soundcloud.com/player/`)

---

## 🏗️ Arquitectura

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   Cliente   │─────▶│ VouTop Proxy │─────▶│ Servidor     │
│  (Browser)  │      │  /api/media- │      │  Externo     │
│             │◀─────│     proxy    │◀─────│ (imgur, etc) │
└─────────────┘      └──────────────┘      └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │    Cache     │
                     │  (7 días)    │
                     └──────────────┘
```

### Flujo de Datos

1. **Cliente solicita**: `/api/media-proxy?url=https://i.imgur.com/abc.jpg`
2. **Proxy valida**: Whitelist, formato, protocolo HTTPS
3. **Fetch externo**: Con User-Agent, timeout, seguir redirects
4. **Validación**: Content-Type, tamaño máximo (10MB)
5. **Cache**: Almacena en memoria por 7 días
6. **Respuesta**: Headers optimizados (Cache-Control, CORS, etc.)

---

## 🟢 Implementación Node.js (SvelteKit)

### Estructura de Archivos

```
src/
├── lib/
│   └── server/
│       └── media-proxy-config.ts    # Configuración y whitelist
└── routes/
    └── api/
        └── media-proxy/
            └── +server.ts            # Endpoint del proxy
```

### 1. Configuración (`media-proxy-config.ts`)

```typescript
export interface MediaProxyConfig {
  allowedDomains: string[];
  allowedMimeTypes: {
    images: string[];
    videos: string[];
    audios: string[];
  };
  maxFileSize: number;      // 10MB
  cacheMaxAge: number;      // 7 días en segundos
  timeout: number;          // 8000ms
  allowedIframeHosts: string[];
}

export function isDomainAllowed(url: string): boolean {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname.toLowerCase();
  
  return MEDIA_PROXY_CONFIG.allowedDomains.some(domain => {
    // Soporte wildcards: *.fbcdn.net
    if (domain.startsWith('*.')) {
      const baseDomain = domain.substring(2);
      return hostname.endsWith('.' + baseDomain);
    }
    return hostname === domain || hostname.endsWith('.' + domain);
  });
}
```

### 2. Endpoint del Proxy (`+server.ts`)

```typescript
import { error, type RequestHandler } from '@sveltejs/kit';
import { isDomainAllowed, isMimeTypeAllowed } from '$lib/server/media-proxy-config';

const cache = new Map<string, {
  data: ArrayBuffer;
  contentType: string;
  timestamp: number;
}>();

export const GET: RequestHandler = async ({ url, setHeaders }) => {
  const targetUrl = url.searchParams.get('url');
  
  // 1. Validación básica
  if (!targetUrl) throw error(400, 'URL requerida');
  
  // 2. Validar formato
  let validUrl: URL;
  try {
    validUrl = new URL(targetUrl);
  } catch {
    throw error(400, 'URL inválida');
  }
  
  // 3. Verificar whitelist
  if (!isDomainAllowed(targetUrl)) {
    throw error(403, `Dominio no permitido: ${validUrl.hostname}`);
  }
  
  // 4. Solo HTTPS
  if (validUrl.protocol !== 'https:') {
    throw error(400, 'Solo HTTPS permitido');
  }
  
  // 5. Verificar caché
  const cached = cache.get(targetUrl);
  if (cached && Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000) {
    return new Response(cached.data, {
      headers: { 'Content-Type': cached.contentType }
    });
  }
  
  // 6. Fetch con timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  
  const response = await fetch(targetUrl, {
    signal: controller.signal,
    headers: {
      'User-Agent': 'VouTop-MediaProxy/1.0',
      'Accept': 'image/*,video/*,audio/*'
    },
    redirect: 'follow'
  });
  
  clearTimeout(timeoutId);
  
  if (!response.ok) {
    throw error(response.status, 'Error upstream');
  }
  
  // 7. Validar Content-Type
  const contentType = response.headers.get('Content-Type') || '';
  if (!isMimeTypeAllowed(contentType)) {
    throw error(415, 'Tipo de contenido no permitido');
  }
  
  // 8. Leer y validar tamaño
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
    throw error(413, 'Archivo muy grande');
  }
  
  // 9. Guardar en caché
  cache.set(targetUrl, {
    data: arrayBuffer,
    contentType,
    timestamp: Date.now()
  });
  
  // 10. Responder
  return new Response(arrayBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800',
      'Access-Control-Allow-Origin': '*'
    }
  });
};
```

---

## 🐍 Implementación Python (FastAPI)

### Instalación de Dependencias

```bash
pip install fastapi uvicorn httpx pillow python-multipart
```

### Estructura de Archivos

```
app/
├── main.py              # Aplicación FastAPI
├── config.py            # Configuración del proxy
└── proxy.py             # Lógica del proxy
```

### 1. Configuración (`config.py`)

```python
from typing import List, Dict
from pydantic import BaseModel

class MediaProxyConfig(BaseModel):
    allowed_domains: List[str] = [
        'i.imgur.com',
        'imgur.com',
        'live.staticflickr.com',
        'upload.wikimedia.org',
        'images.unsplash.com',
        'cdn.pixabay.com',
        'i.vimeocdn.com',
        'i.ytimg.com',
        'pbs.twimg.com',
        'cdninstagram.com',
        'picsum.photos',
        'placehold.co',
        'ui-avatars.com'
    ]
    
    allowed_mime_types: Dict[str, List[str]] = {
        'images': [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml'
        ],
        'videos': ['video/mp4', 'video/webm', 'video/ogg'],
        'audios': ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav']
    }
    
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    cache_max_age: int = 7 * 24 * 60 * 60  # 7 días
    timeout: int = 8  # segundos

CONFIG = MediaProxyConfig()

def is_domain_allowed(url: str) -> bool:
    """Verifica si el dominio está en la whitelist"""
    from urllib.parse import urlparse
    
    hostname = urlparse(url).hostname.lower() if urlparse(url).hostname else ''
    
    for domain in CONFIG.allowed_domains:
        if domain.startswith('*.'):
            base_domain = domain[2:]
            if hostname == base_domain or hostname.endswith(f'.{base_domain}'):
                return True
        else:
            if hostname == domain or hostname.endswith(f'.{domain}'):
                return True
    
    return False

def is_mime_allowed(content_type: str) -> bool:
    """Verifica si el tipo MIME está permitido"""
    mime = content_type.lower().split(';')[0].strip()
    
    all_types = (
        CONFIG.allowed_mime_types['images'] +
        CONFIG.allowed_mime_types['videos'] +
        CONFIG.allowed_mime_types['audios']
    )
    
    return mime in all_types
```

### 2. Lógica del Proxy (`proxy.py`)

```python
import httpx
from fastapi import HTTPException
from fastapi.responses import Response
from datetime import datetime, timedelta
from typing import Dict, Tuple
import hashlib
from .config import CONFIG, is_domain_allowed, is_mime_allowed

# Cache en memoria
_cache: Dict[str, Tuple[bytes, str, datetime]] = {}

async def fetch_media(url: str) -> Response:
    """
    Descarga y sirve un recurso de medios externo
    
    Args:
        url: URL del recurso a descargar
        
    Returns:
        Response con el contenido del recurso
        
    Raises:
        HTTPException: Si hay algún error en el proceso
    """
    
    # 1. Validar URL
    if not url:
        raise HTTPException(status_code=400, detail="Parámetro 'url' requerido")
    
    # 2. Validar formato
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            raise ValueError("URL malformada")
    except Exception:
        raise HTTPException(status_code=400, detail="URL inválida")
    
    # 3. Verificar whitelist
    if not is_domain_allowed(url):
        raise HTTPException(
            status_code=403,
            detail=f"Dominio no permitido: {parsed.netloc}"
        )
    
    # 4. Solo HTTPS
    if parsed.scheme != 'https':
        raise HTTPException(
            status_code=400,
            detail="Solo se permiten URLs con protocolo HTTPS"
        )
    
    # 5. Verificar caché
    cache_key = hashlib.md5(url.encode()).hexdigest()
    if cache_key in _cache:
        content, content_type, timestamp = _cache[cache_key]
        if datetime.now() - timestamp < timedelta(seconds=CONFIG.cache_max_age):
            return Response(
                content=content,
                media_type=content_type,
                headers={
                    'Cache-Control': f'public, max-age={CONFIG.cache_max_age}',
                    'X-Cache': 'HIT'
                }
            )
    
    # 6. Fetch del recurso
    async with httpx.AsyncClient(
        timeout=CONFIG.timeout,
        follow_redirects=True
    ) as client:
        try:
            response = await client.get(
                url,
                headers={
                    'User-Agent': 'VouTop-MediaProxy/1.0 (https://voutop.app)',
                    'Accept': 'image/*,video/*,audio/*'
                }
            )
            response.raise_for_status()
            
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Timeout al obtener recurso")
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Error upstream: {str(e)}")
    
    # 7. Validar Content-Type
    content_type = response.headers.get('content-type', '')
    if not is_mime_allowed(content_type):
        raise HTTPException(
            status_code=415,
            detail=f"Tipo de contenido no permitido: {content_type}"
        )
    
    # 8. Validar tamaño
    content = response.content
    if len(content) > CONFIG.max_file_size:
        raise HTTPException(
            status_code=413,
            detail=f"Archivo muy grande (máx {CONFIG.max_file_size / 1024 / 1024}MB)"
        )
    
    # 9. Guardar en caché
    _cache[cache_key] = (content, content_type, datetime.now())
    
    # 10. Limpiar caché si es muy grande
    if len(_cache) > 100:
        oldest_key = min(_cache.keys(), key=lambda k: _cache[k][2])
        del _cache[oldest_key]
    
    # 11. Responder
    return Response(
        content=content,
        media_type=content_type,
        headers={
            'Cache-Control': f'public, max-age={CONFIG.cache_max_age}',
            'X-Cache': 'MISS',
            'Access-Control-Allow-Origin': '*',
            'X-Content-Type-Options': 'nosniff'
        }
    )
```

### 3. Aplicación Principal (`main.py`)

```python
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .proxy import fetch_media

app = FastAPI(
    title="VouTop Media Proxy",
    description="Proxy seguro para medios externos",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

@app.get("/api/media-proxy")
async def media_proxy(url: str = Query(..., description="URL del recurso a proxear")):
    """
    Endpoint del proxy de medios
    
    Ejemplo:
        /api/media-proxy?url=https://i.imgur.com/abc123.jpg
    """
    return await fetch_media(url)

@app.get("/health")
async def health():
    """Health check"""
    return {"status": "ok", "service": "media-proxy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 4. Ejecutar el Servidor

```bash
# Desarrollo
uvicorn app.main:app --reload --port 8000

# Producción
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 🎨 Integración Frontend

### JavaScript/TypeScript

```typescript
// Función helper para usar el proxy
function getProxiedImageUrl(imageUrl: string): string {
  if (!imageUrl) return imageUrl;
  
  // Dominios que NO necesitan proxy
  const noProxyDomains = [
    'picsum.photos',
    'placehold.co',
    'ui-avatars.com'
  ];
  
  try {
    const hostname = new URL(imageUrl).hostname;
    const needsProxy = !noProxyDomains.some(d => 
      hostname === d || hostname.endsWith('.' + d)
    );
    
    if (needsProxy) {
      return `/api/media-proxy?url=${encodeURIComponent(imageUrl)}`;
    }
    
    return imageUrl;
  } catch {
    return imageUrl;
  }
}

// Uso en componentes
const imageUrl = "https://i.imgur.com/abc123.jpg";
const proxiedUrl = getProxiedImageUrl(imageUrl);

// En HTML
<img src={proxiedUrl} alt="Imagen" loading="lazy" />
```

### React Component

```jsx
function MediaImage({ src, alt }) {
  const [imgSrc, setImgSrc] = useState(getProxiedImageUrl(src));
  
  const handleError = () => {
    setImgSrc('https://placehold.co/400x300/333/FFF?text=Error');
  };
  
  return (
    <img 
      src={imgSrc} 
      alt={alt}
      onError={handleError}
      loading="lazy"
    />
  );
}
```

### Svelte Component

```svelte
<script lang="ts">
  let { src, alt } = $props();
  
  function getProxiedUrl(url: string) {
    // ... lógica del proxy
    return `/api/media-proxy?url=${encodeURIComponent(url)}`;
  }
  
  let imgSrc = $state(getProxiedUrl(src));
</script>

<img 
  src={imgSrc} 
  {alt}
  loading="lazy"
  onerror={(e) => {
    e.target.src = 'https://placehold.co/400x300?text=Error';
  }}
/>
```

---

## 🔒 Seguridad

### 1. Whitelist de Dominios

✅ **Siempre usar whitelist**, nunca blacklist
✅ Agregar dominios manualmente después de verificar
✅ Usar wildcards con cuidado: `*.fbcdn.net`

### 2. Validación de Contenido

```typescript
// Verificar Content-Type
const contentType = response.headers.get('Content-Type');
if (!contentType.startsWith('image/')) {
  throw new Error('No es una imagen');
}

// Verificar tamaño
const size = parseInt(response.headers.get('Content-Length'));
if (size > 10 * 1024 * 1024) {
  throw new Error('Archivo muy grande');
}
```

### 3. Prevenir SSRF (Server-Side Request Forgery)

```typescript
// Bloquear IPs privadas
const hostname = new URL(url).hostname;
const blockedHosts = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254' // AWS metadata
];

if (blockedHosts.includes(hostname)) {
  throw new Error('Host bloqueado');
}

// Bloquear rangos privados
if (hostname.match(/^(10|172\.(1[6-9]|2[0-9]|3[01])|192\.168)\./)) {
  throw new Error('IP privada bloqueada');
}
```

### 4. Rate Limiting

```typescript
// Implementar límite de requests por IP
const rateLimits = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimits.get(ip) || [];
  
  // Limpiar requests antiguos (últimos 60 segundos)
  const recent = requests.filter(t => now - t < 60000);
  
  // Máximo 60 requests por minuto
  if (recent.length >= 60) {
    return false;
  }
  
  recent.push(now);
  rateLimits.set(ip, recent);
  return true;
}
```

### 5. Sanitización de iframes

```typescript
function sanitizeIframeUrl(url: string): string {
  const urlObj = new URL(url);
  
  // Solo HTTPS
  if (urlObj.protocol !== 'https:') {
    urlObj.protocol = 'https:';
  }
  
  // Remover parámetros peligrosos
  const dangerous = ['javascript', 'data', 'vbscript', 'onclick'];
  dangerous.forEach(param => urlObj.searchParams.delete(param));
  
  return urlObj.href;
}

// Atributos seguros para iframes
<iframe 
  src={sanitizeIframeUrl(url)}
  sandbox="allow-scripts allow-same-origin"
  allow="autoplay; encrypted-media"
  referrerpolicy="no-referrer"
/>
```

---

## ⚡ Optimización y Caché

### 1. Caché en Memoria (Node.js)

```typescript
interface CacheEntry {
  data: ArrayBuffer;
  contentType: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

// Limpiar caché periódicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > 7 * 24 * 60 * 60 * 1000) {
      cache.delete(key);
    }
  }
}, 60 * 60 * 1000); // Cada hora
```

### 2. Caché con Redis

```python
import redis
import pickle

redis_client = redis.Redis(host='localhost', port=6379, db=0)

async def fetch_with_redis_cache(url: str):
    # Intentar obtener de caché
    cache_key = f"media:{hashlib.md5(url.encode()).hexdigest()}"
    cached = redis_client.get(cache_key)
    
    if cached:
        return pickle.loads(cached)
    
    # Fetch del recurso
    content = await fetch_media(url)
    
    # Guardar en Redis (7 días)
    redis_client.setex(
        cache_key,
        7 * 24 * 60 * 60,
        pickle.dumps(content)
    )
    
    return content
```

### 3. CDN (Cloudflare, CloudFront)

```nginx
# nginx.conf
location /api/media-proxy {
    proxy_pass http://localhost:3000;
    proxy_cache media_cache;
    proxy_cache_valid 200 7d;
    proxy_cache_key $scheme$proxy_host$uri$is_args$args;
    add_header X-Cache-Status $upstream_cache_status;
}
```

### 4. Headers de Caché Optimizados

```typescript
return new Response(data, {
  headers: {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=604800, immutable',
    'ETag': generateETag(data),
    'Last-Modified': new Date().toUTCString(),
    'Vary': 'Accept-Encoding',
    'X-Content-Type-Options': 'nosniff'
  }
});
```

---

## 🔧 Troubleshooting

### Problema: Imágenes no cargan

**Síntomas**: Error 403 o 404

**Solución**:
1. Verificar que el dominio está en la whitelist
2. Verificar que la URL es HTTPS
3. Revisar logs del servidor para ver el error exacto

```bash
# Ver logs
tail -f /var/log/voutop/media-proxy.log

# Probar manualmente
curl "http://localhost:3000/api/media-proxy?url=https://i.imgur.com/abc.jpg"
```

### Problema: Timeout

**Síntomas**: Error 504

**Solución**:
1. Aumentar timeout en configuración
2. Verificar conectividad del servidor
3. Usar CDN/caché para imágenes lentas

```typescript
// Aumentar timeout
const controller = new AbortController();
setTimeout(() => controller.abort(), 15000); // 15 segundos
```

### Problema: Archivo muy grande

**Síntomas**: Error 413

**Solución**:
1. Aumentar `maxFileSize` en configuración
2. Implementar streaming en lugar de buffer completo
3. Usar compresión de imágenes

```typescript
// Streaming para archivos grandes
const stream = response.body;
return new Response(stream, {
  headers: { 'Content-Type': contentType }
});
```

### Problema: Caché llena

**Síntomas**: Alto uso de memoria

**Solución**:
1. Implementar LRU cache con límite
2. Usar Redis o Memcached
3. Limpiar caché periódicamente

```typescript
// LRU simple
if (cache.size > 100) {
  const oldestKey = cache.keys().next().value;
  cache.delete(oldestKey);
}
```

---

## 📊 Monitoreo

### Métricas Importantes

```typescript
const metrics = {
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  errors: 0,
  avgResponseTime: 0
};

// Endpoint de métricas
app.get('/api/media-proxy/metrics', () => {
  return {
    ...metrics,
    cacheHitRate: metrics.cacheHits / metrics.totalRequests,
    uptime: process.uptime()
  };
});
```

### Logging Estructurado

```typescript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  service: 'media-proxy',
  url: targetUrl,
  cached: isCached,
  duration: Date.now() - startTime,
  size: buffer.byteLength
}));
```

---

## 🚀 Deploy en Producción

### Docker

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "build/index.js"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  voutop:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PROXY_CACHE_SIZE=500
    restart: unless-stopped
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

### Nginx Reverse Proxy

```nginx
upstream voutop {
    server localhost:3000;
}

server {
    listen 80;
    server_name voutop.app;
    
    location /api/media-proxy {
        proxy_pass http://voutop;
        proxy_cache media_cache;
        proxy_cache_valid 200 7d;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 📝 Checklist de Implementación

- [✅] Crear configuración con whitelist de dominios
- [✅] Implementar endpoint `/api/media-proxy`
- [✅] Validar URL, dominio, protocolo, Content-Type
- [✅] Implementar caché (memoria o Redis)
- [✅] Agregar headers de seguridad y caché
- [✅] Implementar timeout y manejo de errores
- [✅] Actualizar frontend para usar proxy
- [✅] Sanitizar iframes embebidos
- [✅] Implementar rate limiting
- [ ] Agregar monitoreo y métricas
- [ ] Configurar CDN si es necesario
- [ ] Deploy en producción
- [ ] Pruebas de carga

---

## 🎓 Recursos Adicionales

- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [MDN: Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP: SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)

---

**Creado por**: VouTop Team  
**Versión**: 1.0.0  
**Última actualización**: 2024
