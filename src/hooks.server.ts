/**
 * Middleware global de SvelteKit
 * Aplica App Signature, JWT y Rate Limiting
 */

import type { Handle } from '@sveltejs/kit'
import { requireAppSignature } from '$lib/server/middleware/appAuth'
import { extractAuthOptional } from '$lib/server/middleware/auth'
import { rateLimitByIP, rateLimitByUser, rateLimitGlobal } from '$lib/server/middleware/rateLimit'

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url
  
  // Obtener IP del cliente (puede fallar en ciertos entornos)
  let ip = '0.0.0.0';
  try {
    ip = event.getClientAddress();
  } catch (e) {
    // Fallback a IP por defecto si falla
  }

  // DESARROLLO: Deshabilitar rate limiting y app auth en desarrollo
  const isLocalIP = event.url.hostname === 'localhost' ||
                    event.url.hostname === '127.0.0.1' ||
                    event.url.hostname.startsWith('192.168.') ||
                    event.url.hostname.startsWith('172.') ||
                    event.url.hostname.startsWith('10.')

  // ============================================
  // 1. RATE LIMITING GLOBAL (todos los requests)
  // ============================================
  // EXCLUIR endpoints públicos del rate limiting global
  const publicEndpoints = [
    '/api/polls/',  // GET de encuestas y POST de votos
    '/api/geocode', // Geocoding
    '/api/users/trending',
    '/api/users/with-activity',
    '/votes-history' // Histórico de votos (datos públicos)
  ]
  
  const isPublicEndpoint = publicEndpoints.some(endpoint => pathname.includes(endpoint))
  
  // Solo aplicar rate limiting global a endpoints privados (crear encuestas, comentarios, etc.)
  if (!isLocalIP && !isPublicEndpoint) {
    try {
      await rateLimitGlobal(ip)
    } catch (err) {
      // Rate limit excedido, pero dejamos que el error se maneje después
    }
  }

  // ============================================
  // 2. APP SIGNATURE (endpoints públicos de API)
  // ============================================
  const appOnlyEndpoints = [
    '/api/polls',
    '/api/geocode',
    '/api/users/trending',
    '/api/users/with-activity'
  ]
  
  // Excluir explícitamente votes-history de app auth (es público)
  const appAuthExclusions = ['/votes-history']
  const isExcludedFromAppAuth = appAuthExclusions.some(exc => pathname.includes(exc))

  const requiresAppAuth = !isExcludedFromAppAuth && appOnlyEndpoints.some(endpoint => pathname.startsWith(endpoint))

  if (requiresAppAuth && !isLocalIP) {
    try {
      await requireAppSignature(event)
    } catch (err) {
      // El error ya incluye el código y mensaje apropiado
      throw err
    }
  } else if (requiresAppAuth && isLocalIP) {
    console.log('[DEV] App auth deshabilitada para:', pathname)
  }

  // ============================================
  // 3. EXTRAER USUARIO JWT (si existe)
  // ============================================
  const user = await extractAuthOptional(event)
  
  // Agregar usuario a locals para uso en endpoints
  event.locals.user = user || undefined

  // ============================================
  // 4. RATE LIMITING ESPECÍFICO
  // ============================================
  // NO aplicar rate limiting a votos (el backend ya maneja duplicados por IP/userId)
  // Votar es una acción pública que no debe tener límites restrictivos
  
  // Geocoding tiene límite más permisivo (usado para ubicación de votos)
  if (pathname.startsWith('/api/geocode') && !isLocalIP) {
    try {
      // Límite muy generoso: 500 geocodes/hora
      await rateLimitByIP(ip, 'geocode', { max: 500, windowMs: 3600000 })
    } catch (err) {
      throw err
    }
  }

  // ============================================
  // 5. LOGGING (opcional pero recomendado)
  // ============================================
  const startTime = Date.now()

  try {
    const response = await resolve(event)
    const duration = Date.now() - startTime

    // CACHE CONTROL: Forzar revalidación en páginas HTML para evitar servir código antiguo
    if (pathname === '/' || pathname.endsWith('.html') || !pathname.includes('.')) {
      response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
      response.headers.set('Expires', '0')
    }

    // Excluir del logging: archivos estáticos y peticiones 304 (caché)
    const isStaticFile = pathname.includes('/geojson/') || 
                         pathname.includes('.topojson') || 
                         pathname.includes('.json') ||
                         pathname.includes('.svg') ||
                         pathname.includes('.png') ||
                         pathname.includes('.jpg') ||
                         pathname.includes('.webp')
    
    const isCached = response.status === 304
    const shouldLog = !isStaticFile || (!isCached && duration > 100) // Solo loguear archivos estáticos si tardan >100ms

    // Log de request exitoso (solo APIs y páginas importantes)
    if (shouldLog) {
      console.log(`[${new Date().toISOString()}] ${event.request.method} ${pathname} - ${response.status} (${duration}ms)${user ? ` - User ${user.userId}` : ' - Anonymous'}`)
    }

    // Agregar headers de rate limit a la response
    if (user) {
      response.headers.set('X-User-Role', user.role)
    }

    return response
  } catch (err: any) {
    const duration = Date.now() - startTime

    // Log de error (siempre loguear errores)
    console.error(`[${new Date().toISOString()}] ${event.request.method} ${pathname} - ERROR (${duration}ms)`, err.message)

    throw err
  }
}

// Extender tipos de SvelteKit
declare global {
  namespace App {
    interface Locals {
      user?: {
        userId: number
        username: string
        email?: string
        role: 'user' | 'verified' | 'premium' | 'moderator' | 'admin'
      }
    }
  }
}
