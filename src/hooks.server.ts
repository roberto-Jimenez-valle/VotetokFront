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
  const ip = event.getClientAddress()

  // DESARROLLO: Deshabilitar rate limiting solo en IPs locales (testing móvil)
  // localhost mantiene el flujo normal
  const isLocalIP = event.url.hostname.startsWith('192.168.') ||
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
    '/api/users/with-activity'
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

  const requiresAppAuth = appOnlyEndpoints.some(endpoint => pathname.startsWith(endpoint))

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

    // Log de request exitoso
    console.log(`[${new Date().toISOString()}] ${event.request.method} ${pathname} - ${response.status} (${duration}ms)${user ? ` - User ${user.userId}` : ' - Anonymous'}`)

    // Agregar headers de rate limit a la response
    if (user) {
      response.headers.set('X-User-Role', user.role)
    }

    return response
  } catch (err: any) {
    const duration = Date.now() - startTime

    // Log de error
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
