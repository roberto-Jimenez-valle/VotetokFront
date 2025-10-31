/**
 * Sistema JWT para autenticación de usuarios
 * Usado solo en endpoints que requieren login
 */

import { SignJWT, jwtVerify } from 'jose'
import { env } from '$env/dynamic/private'

const JWT_SECRET = new TextEncoder().encode(
  env.JWT_SECRET || 'change-this-secret-in-production-use-random-32-chars-minimum'
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
    // Safe type assertion with validation
    const jwtPayload = payload as unknown as JWTPayload;
    if (!jwtPayload.userId || !jwtPayload.username || !jwtPayload.role) {
      throw new Error('Invalid token payload structure');
    }
    return jwtPayload;
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
