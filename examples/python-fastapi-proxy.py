"""
VouTop Media Proxy - FastAPI Implementation

Sistema completo de proxy de medios con validación, caché y seguridad

Instalación:
    pip install fastapi uvicorn httpx redis pillow python-multipart

Ejecución:
    uvicorn python-fastapi-proxy:app --reload --port 8000
    
Uso:
    GET /api/media-proxy?url=https://i.imgur.com/abc123.jpg
    POST /api/validate-iframe (body: {"url": "https://youtube.com/..."})
"""

from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse
import httpx
import hashlib
from datetime import datetime, timedelta
import asyncio

# ============================================================================
# CONFIGURACIÓN
# ============================================================================

class MediaProxyConfig:
    """Configuración del proxy de medios"""
    
    # Whitelist de dominios permitidos
    ALLOWED_DOMAINS = [
        'i.imgur.com',
        'imgur.com',
        'live.staticflickr.com',
        'staticflickr.com',
        'upload.wikimedia.org',
        'images.unsplash.com',
        'unsplash.com',
        'cdn.pixabay.com',
        'pixabay.com',
        'i.vimeocdn.com',
        'vimeocdn.com',
        'i.ytimg.com',
        'ytimg.com',
        'img.youtube.com',
        'pbs.twimg.com',
        'scontent.cdninstagram.com',
        'cdninstagram.com',
        '*.fbcdn.net',  # Wildcard
        'picsum.photos',
        'placehold.co',
        'ui-avatars.com',
        'cloudinary.com',
        'cloudfront.net',
        'gravatar.com',
        'githubusercontent.com'
    ]
    
    # Tipos MIME permitidos
    ALLOWED_MIME_TYPES = {
        'images': [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',
            'image/bmp'
        ],
        'videos': ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
        'audios': ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm']
    }
    
    # Hosts permitidos para iframes
    ALLOWED_IFRAME_HOSTS = [
        'www.youtube.com',
        'youtube.com',
        'player.vimeo.com',
        'vimeo.com',
        'open.spotify.com',
        'w.soundcloud.com',
        'soundcloud.com',
        'player.twitch.tv',
        'twitch.tv',
        'player.megaphone.fm',
        'megaphone.fm',
        'omny.fm'
    ]
    
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    CACHE_MAX_AGE = 7 * 24 * 60 * 60  # 7 días
    TIMEOUT = 8  # segundos
    USER_AGENT = 'VouTop-MediaProxy/1.0 (https://votetok.app)'


config = MediaProxyConfig()


# ============================================================================
# CACHÉ EN MEMORIA
# ============================================================================

class MemoryCache:
    """Caché simple en memoria con expiración"""
    
    def __init__(self):
        self._cache: Dict[str, Tuple[bytes, str, datetime]] = {}
        self._max_size = 100
    
    def get(self, key: str) -> Optional[Tuple[bytes, str]]:
        """Obtiene un item del caché si no ha expirado"""
        if key not in self._cache:
            return None
        
        content, content_type, timestamp = self._cache[key]
        
        # Verificar expiración
        if datetime.now() - timestamp > timedelta(seconds=config.CACHE_MAX_AGE):
            del self._cache[key]
            return None
        
        return (content, content_type)
    
    def set(self, key: str, content: bytes, content_type: str):
        """Guarda un item en el caché"""
        # Limpiar si el caché está lleno
        if len(self._cache) >= self._max_size:
            oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k][2])
            del self._cache[oldest_key]
        
        self._cache[key] = (content, content_type, datetime.now())
    
    def size(self) -> int:
        """Retorna el tamaño actual del caché"""
        return len(self._cache)
    
    def clear_expired(self):
        """Limpia items expirados"""
        now = datetime.now()
        expired = [
            k for k, (_, _, timestamp) in self._cache.items()
            if now - timestamp > timedelta(seconds=config.CACHE_MAX_AGE)
        ]
        for key in expired:
            del self._cache[key]


cache = MemoryCache()


# ============================================================================
# VALIDADORES
# ============================================================================

def is_domain_allowed(url: str) -> bool:
    """Verifica si el dominio está en la whitelist"""
    try:
        hostname = urlparse(url).hostname
        if not hostname:
            return False
        
        hostname = hostname.lower()
        
        for domain in config.ALLOWED_DOMAINS:
            # Soporte para wildcards: *.fbcdn.net
            if domain.startswith('*.'):
                base_domain = domain[2:]
                if hostname == base_domain or hostname.endswith(f'.{base_domain}'):
                    return True
            else:
                # Match exacto o subdominio
                if hostname == domain or hostname.endswith(f'.{domain}'):
                    return True
        
        return False
    except Exception:
        return False


def is_mime_allowed(content_type: str) -> bool:
    """Verifica si el tipo MIME está permitido"""
    mime = content_type.lower().split(';')[0].strip()
    
    all_types = (
        config.ALLOWED_MIME_TYPES['images'] +
        config.ALLOWED_MIME_TYPES['videos'] +
        config.ALLOWED_MIME_TYPES['audios']
    )
    
    return mime in all_types


def is_private_ip(hostname: str) -> bool:
    """Verifica si es una IP privada (prevención SSRF)"""
    import socket
    
    try:
        ip = socket.gethostbyname(hostname)
        
        # IPs privadas y localhost
        private_ranges = [
            '127.',
            '10.',
            '172.16.', '172.17.', '172.18.', '172.19.',
            '172.20.', '172.21.', '172.22.', '172.23.',
            '172.24.', '172.25.', '172.26.', '172.27.',
            '172.28.', '172.29.', '172.30.', '172.31.',
            '192.168.',
            '169.254.',  # AWS metadata
            '0.0.0.0'
        ]
        
        return any(ip.startswith(prefix) for prefix in private_ranges)
    except Exception:
        return False


def is_iframe_host_allowed(url: str) -> bool:
    """Verifica si el host del iframe está permitido"""
    try:
        hostname = urlparse(url).hostname
        if not hostname:
            return False
        
        hostname = hostname.lower()
        
        return any(
            hostname == host or hostname.endswith(f'.{host}')
            for host in config.ALLOWED_IFRAME_HOSTS
        )
    except Exception:
        return False


def sanitize_iframe_url(url: str) -> str:
    """Sanitiza una URL de iframe eliminando parámetros peligrosos"""
    from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
    
    parsed = urlparse(url)
    
    # Forzar HTTPS
    if parsed.scheme != 'https':
        parsed = parsed._replace(scheme='https')
    
    # Parámetros peligrosos a eliminar
    dangerous_params = [
        'javascript', 'data', 'vbscript', 'onclick', 
        'onerror', 'onload', 'eval', 'script'
    ]
    
    # Parsear query params
    query_params = parse_qs(parsed.query)
    
    # Filtrar parámetros peligrosos
    safe_params = {
        k: v for k, v in query_params.items()
        if k.lower() not in dangerous_params
    }
    
    # Reconstruir URL
    safe_query = urlencode(safe_params, doseq=True)
    safe_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        safe_query,
        ''  # Eliminar fragment si contiene javascript:
    ))
    
    return safe_url


# ============================================================================
# APLICACIÓN FASTAPI
# ============================================================================

app = FastAPI(
    title="VouTop Media Proxy",
    description="Proxy seguro para medios externos con validación y caché",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/api/media-proxy")
async def media_proxy(
    url: str = Query(..., description="URL del recurso a proxear"),
    request: Request = None
):
    """
    Proxy de medios externos
    
    Ejemplo:
        /api/media-proxy?url=https://i.imgur.com/abc123.jpg
    """
    
    # 1. Validar URL
    if not url:
        raise HTTPException(status_code=400, detail="Parámetro 'url' requerido")
    
    # 2. Validar formato
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
    
    # 5. Prevenir SSRF
    if is_private_ip(parsed.netloc):
        raise HTTPException(
            status_code=403,
            detail="IP privada bloqueada"
        )
    
    # 6. Verificar caché
    cache_key = hashlib.md5(url.encode()).hexdigest()
    cached = cache.get(cache_key)
    
    if cached:
        content, content_type = cached
        return Response(
            content=content,
            media_type=content_type,
            headers={
                'Cache-Control': f'public, max-age={config.CACHE_MAX_AGE}',
                'X-Cache': 'HIT',
                'Access-Control-Allow-Origin': '*'
            }
        )
    
    # 7. Fetch del recurso externo
    async with httpx.AsyncClient(
        timeout=config.TIMEOUT,
        follow_redirects=True
    ) as client:
        try:
            response = await client.get(
                url,
                headers={
                    'User-Agent': config.USER_AGENT,
                    'Accept': 'image/*,video/*,audio/*'
                }
            )
            response.raise_for_status()
            
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Timeout al obtener recurso")
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Error upstream: {str(e)}")
    
    # 8. Validar Content-Type
    content_type = response.headers.get('content-type', '')
    if not is_mime_allowed(content_type):
        raise HTTPException(
            status_code=415,
            detail=f"Tipo de contenido no permitido: {content_type}"
        )
    
    # 9. Validar tamaño
    content = response.content
    if len(content) > config.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Archivo muy grande (máx {config.MAX_FILE_SIZE / 1024 / 1024}MB)"
        )
    
    # 10. Guardar en caché
    cache.set(cache_key, content, content_type)
    
    # 11. Responder
    return Response(
        content=content,
        media_type=content_type,
        headers={
            'Cache-Control': f'public, max-age={config.CACHE_MAX_AGE}',
            'X-Cache': 'MISS',
            'Access-Control-Allow-Origin': '*',
            'X-Content-Type-Options': 'nosniff'
        }
    )


@app.post("/api/validate-iframe")
async def validate_iframe(body: dict):
    """
    Valida y sanitiza URLs de iframes
    
    Body:
        {"url": "https://www.youtube.com/watch?v=..."}
    
    Ejemplo:
        curl -X POST http://localhost:8000/api/validate-iframe \
          -H "Content-Type: application/json" \
          -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
    """
    
    url = body.get('url')
    
    if not url:
        raise HTTPException(status_code=400, detail="Campo 'url' requerido")
    
    # Validar formato
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            raise ValueError("URL malformada")
    except Exception:
        raise HTTPException(status_code=400, detail="URL inválida")
    
    # Verificar host permitido
    if not is_iframe_host_allowed(url):
        raise HTTPException(
            status_code=403,
            detail=f"Host de iframe no permitido: {parsed.netloc}"
        )
    
    # Sanitizar
    try:
        sanitized = sanitize_iframe_url(url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al sanitizar: {str(e)}")
    
    # Detectar plataforma
    hostname = parsed.netloc.lower()
    platform = 'generic'
    if 'youtube.com' in hostname or 'youtu.be' in hostname:
        platform = 'youtube'
    elif 'vimeo.com' in hostname:
        platform = 'vimeo'
    elif 'spotify.com' in hostname:
        platform = 'spotify'
    elif 'soundcloud.com' in hostname:
        platform = 'soundcloud'
    elif 'twitch.tv' in hostname:
        platform = 'twitch'
    
    # Atributos seguros
    attributes = {
        'src': sanitized,
        'sandbox': 'allow-scripts allow-same-origin allow-presentation allow-fullscreen',
        'allow': 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
        'referrerpolicy': 'no-referrer',
        'loading': 'lazy'
    }
    
    # HTML del iframe
    iframe_html = f'''<iframe 
  src="{attributes['src']}"
  sandbox="{attributes['sandbox']}"
  allow="{attributes['allow']}"
  referrerpolicy="{attributes['referrerpolicy']}"
  loading="{attributes['loading']}"
  style="width: 100%; height: 100%; border: none; border-radius: 12px;"
></iframe>'''
    
    return JSONResponse({
        'success': True,
        'data': {
            'isValid': True,
            'originalUrl': url,
            'sanitizedUrl': sanitized,
            'platform': platform,
            'attributes': attributes,
            'embedHtml': iframe_html
        }
    })


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "media-proxy",
        "cache_size": cache.size(),
        "version": "1.0.0"
    }


@app.get("/api/media-proxy/stats")
async def stats():
    """Estadísticas del proxy"""
    return {
        "cache_size": cache.size(),
        "max_cache_size": 100,
        "allowed_domains_count": len(config.ALLOWED_DOMAINS),
        "max_file_size_mb": config.MAX_FILE_SIZE / 1024 / 1024,
        "cache_max_age_days": config.CACHE_MAX_AGE / 86400,
        "timeout_seconds": config.TIMEOUT
    }


# ============================================================================
# TAREA DE LIMPIEZA DE CACHÉ
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Inicia tarea de limpieza de caché"""
    
    async def cleanup_cache():
        while True:
            await asyncio.sleep(3600)  # Cada hora
            cache.clear_expired()
            print(f"[Cache] Limpieza completada. Tamaño: {cache.size()}")
    
    asyncio.create_task(cleanup_cache())


# ============================================================================
# EJECUCIÓN
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    print("""
    ╔═══════════════════════════════════════════════════════════════╗
    ║           VouTop Media Proxy - FastAPI Edition                ║
    ║                                                               ║
    ║  Servidor iniciado en: http://localhost:8000                  ║
    ║  Documentación API: http://localhost:8000/docs                ║
    ║  Health check: http://localhost:8000/health                   ║
    ║                                                               ║
    ║  Endpoints:                                                   ║
    ║  - GET  /api/media-proxy?url=<URL>                           ║
    ║  - POST /api/validate-iframe (body: {"url": "..."})          ║
    ║  - GET  /api/media-proxy/stats                               ║
    ╚═══════════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
