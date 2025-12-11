/**
 * Middleware de autenticación JWT
 * Para endpoints que requieren usuario autenticado
 */

import { error, type RequestEvent } from '@sveltejs/kit'
import { verifyJWT, type JWTPayload } from '../auth/jwt'

/**
 * Extraer token JWT del header Authorization O de cookie httpOnly (OPCIONAL)
 * Retorna null si no hay token o es inválido
 */
export async function extractAuthOptional(event: RequestEvent): Promise<JWTPayload | null> {
  const path = event.url.pathname
  const isRepostEndpoint = path.includes('/repost')
  
  // 1. Primero intentar del header Authorization
  const authHeader = event.request.headers.get('Authorization')
  
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1]
      const payload = await verifyJWT(token)
      return payload
    } catch (err) {
      // Token de header inválido, seguir buscando en cookie
    }
  }

  // 2. Si no hay header, buscar en cookie httpOnly
  const cookieToken = event.cookies.get('voutop-auth-token')
  
  if (isRepostEndpoint) {
    console.log('[Auth] 🍪 Cookie voutop-auth-token:', cookieToken ? `${cookieToken.substring(0, 20)}...` : 'NO EXISTE')
  }
  
  if (cookieToken) {
    try {
      const payload = await verifyJWT(cookieToken)
      if (isRepostEndpoint) console.log('[Auth] ✅ Token de cookie válido, userId:', payload.userId)
      return payload
    } catch (err) {
      if (isRepostEndpoint) console.log('[Auth] ❌ Token de cookie inválido:', err)
      return null // Token de cookie inválido
    }
  }

  if (isRepostEndpoint) console.log('[Auth] ❌ Sin autenticación')
  return null
}

/**
 * Requerir autenticación (OBLIGATORIO)
 * Lanza error 401 si no hay token válido
 */
export async function requireAuth(event: RequestEvent): Promise<JWTPayload> {
  const user = await extractAuthOptional(event)
  
  if (!user) {
    throw error(401, {
      message: 'Authentication required. Please login.',
      code: 'AUTH_REQUIRED'
    })
  }
  
  return user
}

/**
 * Requerir rol específico
 */
export async function requireRole(
  event: RequestEvent, 
  allowedRoles: JWTPayload['role'][]
): Promise<JWTPayload> {
  const user = await requireAuth(event)
  
  if (!allowedRoles.includes(user.role)) {
    throw error(403, {
      message: `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`,
      code: 'FORBIDDEN',
      required: allowedRoles
    })
  }
  
  return user
}

/**
 * Verificar que el usuario es el dueño del recurso
 */
export async function requireOwnership(
  event: RequestEvent,
  resourceUserId: number
): Promise<JWTPayload> {
  const user = await requireAuth(event)
  
  // Admins y moderadores pueden acceder a cualquier recurso
  if (user.role === 'admin' || user.role === 'moderator') {
    return user
  }
  
  // Usuario debe ser el dueño
  if (user.userId !== resourceUserId) {
    throw error(403, {
      message: 'You can only access your own resources',
      code: 'NOT_OWNER'
    })
  }
  
  return user
}
