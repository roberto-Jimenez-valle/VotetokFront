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
// Estrategia anti-bot: límites estrictos por minuto para matar bots baratos
export const RATE_LIMITS = {
  // Anónimos (por IP) - Solo lectura permitida
  anonymous: {
    vote: { max: 5, windowMs: 60000 },         // 5 votos/minuto (anti-spam)
    view: { max: 100, windowMs: 60000 },       // 100 views/minuto
    geocode: { max: 10, windowMs: 60000 },     // 10 geocodes/minuto
    api: { max: 60, windowMs: 60000 }          // 60 requests/minuto general
  },

  // Usuarios autenticados - Límites estrictos por minuto
  user: {
    vote: { max: 5, windowMs: 60000 },         // 5 votos/minuto
    poll_create: { max: 1, windowMs: 60000 },  // 1 encuesta/minuto
    comment: { max: 3, windowMs: 60000 },      // 3 comentarios/minuto
    follow: { max: 10, windowMs: 60000 },      // 10 follows/minuto
    message: { max: 10, windowMs: 60000 },     // 10 mensajes/minuto
    api: { max: 120, windowMs: 60000 }         // 120 requests/minuto
  },

  // Premium - Límites más generosos
  premium: {
    vote: { max: 15, windowMs: 60000 },
    poll_create: { max: 3, windowMs: 60000 },
    comment: { max: 10, windowMs: 60000 },
    follow: { max: 30, windowMs: 60000 },
    message: { max: 30, windowMs: 60000 },
    api: { max: 300, windowMs: 60000 }
  },

  // Admin (sin límites prácticos)
  admin: {
    vote: { max: 999999, windowMs: 60000 },
    poll_create: { max: 999999, windowMs: 60000 },
    comment: { max: 999999, windowMs: 60000 },
    follow: { max: 999999, windowMs: 60000 },
    message: { max: 999999, windowMs: 60000 },
    api: { max: 999999, windowMs: 60000 }
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

  // Si alcanzó el límite - NO dar detalles al atacante
  if (record.count >= config.max) {
    throw error(429, 'Too many requests')
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
