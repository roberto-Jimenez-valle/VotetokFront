/**
 * Sistema JWT para autenticación de usuarios
 * Usado solo en endpoints que requieren login
 */

import { SignJWT, jwtVerify } from 'jose'
import { JWT_SECRET as ENV_JWT_SECRET } from '$env/static/private'

const JWT_SECRET = new TextEncoder().encode(
  ENV_JWT_SECRET || 'change-this-secret-in-production-use-random-32-chars'
)

export interface JWTPayload {
  userId: number
  username: string
  email?: string
  role: 'user' | 'verified' | 'premium' | 'moderator' | 'admin'
  iat?: number
  exp?: number
}

/**
 * Generar Access Token (15 minutos de validez)
 */
export async function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET)
}

/**
 * Generar Refresh Token (7 días de validez)
 */
export async function generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

/**
 * Verificar y decodificar JWT
 * @throws Error si el token es inválido o expirado
 */
export async function verifyJWT(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as JWTPayload
  } catch (err) {
    throw new Error('Invalid or expired token')
  }
}

/**
 * Verificar si el token ha expirado sin lanzar error
 */
export async function isTokenExpired(token: string): Promise<boolean> {
  try {
    await verifyJWT(token)
    return false
  } catch {
    return true
  }
}
