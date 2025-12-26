/**
 * API Endpoint: Media Proxy
 * 
 * Proxy seguro para imágenes, videos y audios externos
 * Resuelve problemas de CORS, X-Frame-Options y CSP
 * 
 * Uso: /api/media-proxy?url=https://i.imgur.com/abc123.jpg
 */

import { error, type RequestHandler } from '@sveltejs/kit';
import {
  isDomainAllowed,
  isMimeTypeAllowed,
  getSecureFetchHeaders,
  MEDIA_PROXY_CONFIG
} from '$lib/server/media-proxy-config';
import { quickVerify } from '$lib/server/domain-verification';

// Cache en memoria simple (en producción usar Redis o similar)
const cache = new Map<string, {
  data: ArrayBuffer;
  contentType: string;
  timestamp: number;
}>();

// Cache de URLs que han fallado (para evitar reintentos infinitos)
const failedUrlsCache = new Map<string, {
  timestamp: number;
  errorCode: number;
}>();
const FAILED_CACHE_TTL = 30 * 1000; // 30 segundos (reducido para permitir retry rápido)

// Cache de dominios rechazados (para evitar logs repetitivos)
const rejectedDomainsCache = new Map<string, number>(); // hostname -> timestamp
const REJECTED_LOG_COOLDOWN = 60 * 1000; // Solo loguear cada 60 segundos por dominio

export const GET: RequestHandler = async ({ url, setHeaders }) => {
  const targetUrl = url.searchParams.get('url');

  // 1. Validar que se proporcionó una URL
  if (!targetUrl) {
    throw error(400, {
      message: 'Parámetro "url" es requerido',
      code: 'MISSING_URL'
    });
  }

  // 2. Validar formato de URL
  let validUrl: URL;
  try {
    validUrl = new URL(targetUrl);
  } catch {
    throw error(400, {
      message: 'URL inválida',
      code: 'INVALID_URL'
    });
  }

  // 3. Verificar que el dominio está en la whitelist o Tranco
  // Si viene con trusted=1, permite cualquier dominio (viene de fuente confiable)
  const isTrusted = url.searchParams.get('trusted') === '1';

  let isAllowed = isTrusted || isDomainAllowed(targetUrl);

  // Si no está en whitelist ni es trusted, verificar con sistema Tranco/fallback
  if (!isAllowed) {
    try {
      const verification = await quickVerify(validUrl.hostname);
      if (verification.isSafe) {
        isAllowed = true;
        if (verification.trancoRank) {
          console.log(`[Media Proxy] ✅ Tranco #${verification.trancoRank}: ${validUrl.hostname}`);
        } else {
          console.log(`[Media Proxy] ✅ Fallback permitido: ${validUrl.hostname}`);
        }
      }
    } catch (err) {
      // Si falla verificación, NO permitir (seguridad)
      console.warn(`[Media Proxy] ❌ Verificación falló para: ${validUrl.hostname}`);
    }
  }

  if (!isAllowed) {
    const hostname = validUrl.hostname;
    const now = Date.now();
    const lastLog = rejectedDomainsCache.get(hostname) || 0;

    // Solo loguear si pasó el cooldown (evita spam en logs)
    if (now - lastLog > REJECTED_LOG_COOLDOWN) {
      console.warn(`[Media Proxy] ❌ Dominio rechazado: ${hostname}`);
      rejectedDomainsCache.set(hostname, now);
    }

    throw error(403, {
      message: `Dominio no permitido: ${hostname}`,
      code: 'DOMAIN_NOT_ALLOWED'
    });
  }

  // 4. Verificar protocolo (solo HTTPS)
  if (validUrl.protocol !== 'https:') {
    throw error(400, {
      message: 'Solo se permiten URLs con protocolo HTTPS',
      code: 'INSECURE_PROTOCOL'
    });
  }

  // 5. Verificar si la URL falló recientemente
  // NOTA: Si el dominio ahora está permitido, ignorar el caché de fallidas
  const cacheKey = targetUrl;
  const now = Date.now();

  const failedEntry = failedUrlsCache.get(cacheKey);
  if (failedEntry && (now - failedEntry.timestamp) < FAILED_CACHE_TTL) {
    // Si el dominio ahora está permitido (whitelist actualizado), limpiar caché y continuar
    if (isAllowed) {
      failedUrlsCache.delete(cacheKey);
      console.log('[Media Proxy] 🔄 Dominio ahora permitido, limpiando caché:', validUrl.hostname);
    } else {
      console.log('[Media Proxy] 🚫 URL en cache de fallidas, rechazando:', targetUrl.substring(0, 80));
      throw error(failedEntry.errorCode, {
        message: 'URL previamente fallida (cache)',
        code: 'CACHED_FAILURE'
      });
    }
  }

  // 6. Verificar caché de éxitos
  const cached = cache.get(cacheKey);

  if (cached && (now - cached.timestamp) < MEDIA_PROXY_CONFIG.cacheMaxAge * 1000) {
    console.log('[Media Proxy] Cache hit:', targetUrl);

    setHeaders({
      'Content-Type': cached.contentType,
      'Cache-Control': `public, max-age=${MEDIA_PROXY_CONFIG.cacheMaxAge}`,
      'X-Cache': 'HIT',
      'Access-Control-Allow-Origin': '*'
    });

    return new Response(cached.data, {
      status: 200,
      headers: {
        'Content-Type': cached.contentType
      }
    });
  }

  try {
    console.log('[Media Proxy] Fetching:', targetUrl);

    // 6. Crear timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MEDIA_PROXY_CONFIG.timeout);

    // 7. Fetch del recurso externo con headers específicos por plataforma
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: getSecureFetchHeaders(targetUrl),
      redirect: 'follow' // Seguir redirects 301/302
    });

    clearTimeout(timeoutId);

    // 8. Verificar que la respuesta es exitosa
    if (!response.ok) {
      // Guardar en cache de fallidas para evitar reintentos
      failedUrlsCache.set(cacheKey, {
        timestamp: now,
        errorCode: response.status
      });
      console.log('[Media Proxy] 💾 Guardando URL fallida en cache:', response.status);

      throw error(response.status, {
        message: `Error al obtener el recurso: ${response.statusText}`,
        code: 'UPSTREAM_ERROR'
      });
    }

    // 9. Verificar Content-Type
    const contentType = response.headers.get('Content-Type') || '';

    if (!isMimeTypeAllowed(contentType)) {
      throw error(415, {
        message: `Tipo de contenido no permitido: ${contentType}`,
        code: 'UNSUPPORTED_MEDIA_TYPE'
      });
    }

    // 10. Verificar tamaño del archivo
    const contentLength = response.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength) > MEDIA_PROXY_CONFIG.maxFileSize) {
      throw error(413, {
        message: 'Archivo demasiado grande',
        code: 'FILE_TOO_LARGE'
      });
    }

    // 11. Leer el contenido
    const arrayBuffer = await response.arrayBuffer();

    // 12. Verificar tamaño real
    if (arrayBuffer.byteLength > MEDIA_PROXY_CONFIG.maxFileSize) {
      throw error(413, {
        message: 'Archivo demasiado grande',
        code: 'FILE_TOO_LARGE'
      });
    }

    // 13. Guardar en caché
    cache.set(cacheKey, {
      data: arrayBuffer,
      contentType: contentType,
      timestamp: now
    });

    // 14. Limpiar caché antigua (simple LRU)
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }

    console.log('[Media Proxy] Success:', targetUrl, `(${arrayBuffer.byteLength} bytes)`);

    // 15. Retornar el recurso con headers apropiados
    setHeaders({
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${MEDIA_PROXY_CONFIG.cacheMaxAge}`,
      'X-Cache': 'MISS',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN'
    });

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType
      }
    });
  } catch (err: any) {
    console.error('[Media Proxy] Error:', err);

    if (err.name === 'AbortError') {
      throw error(504, {
        message: 'Timeout al obtener el recurso',
        code: 'TIMEOUT'
      });
    }

    // Check if it is already a SvelteKit error (has status)
    // SvelteKit throws { status: number, body: ... }
    if (err.status) {
      throw err;
    }

    throw error(500, {
      message: err.message || 'Error al procesar el recurso',
      code: 'PROXY_ERROR'
    });
  }
};

// Limpiar caché periódicamente (cada hora)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > MEDIA_PROXY_CONFIG.cacheMaxAge * 1000) {
        cache.delete(key);
      }
    }
    console.log('[Media Proxy] Cache cleaned. Size:', cache.size);
  }, 60 * 60 * 1000);
}
