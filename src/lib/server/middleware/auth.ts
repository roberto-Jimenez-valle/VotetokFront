/**
 * Middleware de autenticación JWT
 * Para endpoints que requieren usuario autenticado
 */

import { error, type RequestEvent } from '@sveltejs/kit'
import { verifyJWT, type JWTPayload } from '../auth/jwt'

/**
 * Extraer token JWT del header Authorization (OPCIONAL)
 * Retorna null si no hay token o es inválido
 */
export async function extractAuthOptional(event: RequestEvent): Promise<JWTPayload | null> {
  const authHeader = event.request.headers.get('Authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  try {
    const token = authHeader.split(' ')[1]
    const payload = await verifyJWT(token)
    return payload
  } catch {
    return null // Token inválido, tratar como anónimo
  }
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
