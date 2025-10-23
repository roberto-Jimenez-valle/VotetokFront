/**
 * Sistema de Rate Limiting
 * Diferencia entre usuarios anónimos y autenticados
 */

import { error } from '@sveltejs/kit'

export interface RateLimitConfig {
  max: number        // Máximo de requests
  windowMs: number   // Ventana de tiempo en milisegundos
}

interface RateLimitRecord {
  count: number
  resetAt: number
}

// Store en memoria (en producción considera usar Redis)
const rateLimitStore = new Map<string, RateLimitRecord>()

// Configuración de límites por tipo
export const RATE_LIMITS = {
  // Anónimos (por IP)
  anonymous: {
    vote: { max: 100, windowMs: 3600000 },     // 100 votos/hora
    view: { max: 2000, windowMs: 3600000 },    // 2000 views/hora (aumentado para lectura)
    geocode: { max: 50, windowMs: 3600000 },   // 50 geocodes/hora
    api: { max: 1500, windowMs: 3600000 }      // 1500 requests/hora general (aumentado)
  },
  
  // Usuarios autenticados
  user: {
    vote: { max: 500, windowMs: 3600000 },           // 500 votos/hora
    poll_create: { max: 20, windowMs: 86400000 },    // 20 encuestas/día
    comment: { max: 100, windowMs: 86400000 },       // 100 comentarios/día
    follow: { max: 50, windowMs: 86400000 },         // 50 follows/día
    api: { max: 2000, windowMs: 3600000 }            // 2000 requests/hora
  },
  
  // Premium
  premium: {
    vote: { max: 2000, windowMs: 3600000 },
    poll_create: { max: 100, windowMs: 86400000 },
    comment: { max: 500, windowMs: 86400000 },
    follow: { max: 200, windowMs: 86400000 },
    api: { max: 10000, windowMs: 3600000 }
  },
  
  // Admin (sin límites prácticos)
  admin: {
    vote: { max: 999999, windowMs: 3600000 },
    poll_create: { max: 999999, windowMs: 86400000 },
    comment: { max: 999999, windowMs: 86400000 },
    follow: { max: 999999, windowMs: 86400000 },
    api: { max: 999999, windowMs: 3600000 }
  }
} as const

/**
 * Verificar rate limit y actualizar contador
 */
function checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  // Si no existe o expiró, crear nuevo
  if (!record || now > record.resetAt) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetAt: now + config.windowMs
    }
    rateLimitStore.set(key, newRecord)
    
    return {
      allowed: true,
      remaining: config.max - 1,
      resetAt: newRecord.resetAt
    }
  }

  // Si alcanzó el límite
  if (record.count >= config.max) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000)
    
    throw error(429, {
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter,
      limit: config.max,
      resetAt: record.resetAt
    })
  }

  // Incrementar contador
  record.count++
  
  return {
    allowed: true,
    remaining: config.max - record.count,
    resetAt: record.resetAt
  }
}

/**
 * Rate limit por IP (usuarios anónimos)
 */
export async function rateLimitByIP(
  ip: string,
  action: keyof typeof RATE_LIMITS.anonymous,
  customConfig?: RateLimitConfig
): Promise<{ remaining: number; resetAt: number }> {
  const config = customConfig || RATE_LIMITS.anonymous[action]
  const key = `ip:${ip}:${action}`
  
  const result = checkRateLimit(key, config)
  return { remaining: result.remaining, resetAt: result.resetAt }
}

/**
 * Rate limit por userId (usuarios autenticados)
 */
export async function rateLimitByUser(
  userId: number,
  role: 'user' | 'premium' | 'admin',
  action: string,
  customConfig?: RateLimitConfig
): Promise<{ remaining: number; resetAt: number }> {
  // Admin sin límites
  if (role === 'admin') {
    return { remaining: 999999, resetAt: Date.now() + 3600000 }
  }

  const limitsForRole = RATE_LIMITS[role] || RATE_LIMITS.user
  const config = customConfig || (limitsForRole as any)[action] || RATE_LIMITS.user.api
  const key = `user:${userId}:${action}`
  
  const result = checkRateLimit(key, config)
  return { remaining: result.remaining, resetAt: result.resetAt }
}

/**
 * Rate limit general por IP (para protección global)
 */
export async function rateLimitGlobal(ip: string): Promise<void> {
  await rateLimitByIP(ip, 'api')
}

/**
 * Limpiar registros expirados (ejecutar periódicamente)
 */
export function cleanExpiredRecords(): number {
  const now = Date.now()
  let cleaned = 0
  
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key)
      cleaned++
    }
  }
  
  return cleaned
}

// Limpiar cada 10 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cleaned = cleanExpiredRecords()
    if (cleaned > 0) {
      console.log(`[RateLimit] Cleaned ${cleaned} expired records`)
    }
  }, 10 * 60 * 1000)
}
