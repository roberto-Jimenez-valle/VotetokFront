/**
 * Sistema de App Signature (HMAC-SHA256)
 * Protege endpoints públicos para que solo sean accesibles desde la app oficial
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { APP_SECRET as ENV_APP_SECRET, JWT_SECRET } from '$env/static/private'

const APP_SECRET = ENV_APP_SECRET || 'change-this-app-secret-in-production-random-64-chars'
const TIMESTAMP_TOLERANCE = 5 * 60 * 1000 // 5 minutos

// App IDs válidos
const VALID_APP_IDS = new Set([
  'votetok-web-v1',
  'votetok-ios-v1',
  'votetok-android-v1'
])

export interface AppSignatureData {
  appId: string
  timestamp: number
  signature: string
}

export interface AppAuthResult {
  valid: boolean
  appId: string
  timestamp: number
  error?: string
}

/**
 * Crear signature HMAC-SHA256
 */
export function createSignature(
  method: string,
  path: string,
  timestamp: number,
  body?: string
): string {
  const message = `${method}:${path}:${timestamp}:${body || ''}`
  
  return createHmac('sha256', APP_SECRET)
    .update(message)
    .digest('hex')
}

/**
 * Validar App Signature
 */
export function validateAppSignature(
  method: string,
  path: string,
  signatureData: AppSignatureData,
  body?: string
): AppAuthResult {
  const { appId, timestamp, signature } = signatureData
  
  // DEBUG: Log de validación
  console.log(`[AUTH] ${method} ${path} - AppID: ${appId}, Secret: ${APP_SECRET.substring(0, 20)}...`)

  // 1. Validar App ID
  if (!VALID_APP_IDS.has(appId)) {
    return {
      valid: false,
      appId,
      timestamp,
      error: 'INVALID_APP_ID'
    }
  }

  // 2. Validar timestamp (evitar replay attacks)
  const now = Date.now()
  
  if (isNaN(timestamp)) {
    return {
      valid: false,
      appId,
      timestamp,
      error: 'INVALID_TIMESTAMP'
    }
  }

  const timeDiff = Math.abs(now - timestamp)
  if (timeDiff > TIMESTAMP_TOLERANCE) {
    return {
      valid: false,
      appId,
      timestamp,
      error: 'TIMESTAMP_EXPIRED'
    }
  }

  // 3. Recrear y validar signature
  const expectedSignature = createSignature(method, path, timestamp, body)
  
  // DEBUG: Comparar firmas
  const match = signature === expectedSignature
  console.log(`[AUTH] Firma: ${match ? '✅ VÁLIDA' : '❌ INVÁLIDA'} - Rec: ${signature.substring(0, 20)}... Esp: ${expectedSignature.substring(0, 20)}...`)

  // Comparación timing-safe (protección contra timing attacks)
  const signatureBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')

  if (signatureBuffer.length !== expectedBuffer.length) {
    return {
      valid: false,
      appId,
      timestamp,
      error: 'INVALID_SIGNATURE'
    }
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return {
      valid: false,
      appId,
      timestamp,
      error: 'INVALID_SIGNATURE'
    }
  }

  // Todo válido
  return {
    valid: true,
    appId,
    timestamp
  }
}

/**
 * Agregar nuevo App ID válido (para testing o nuevas plataformas)
 */
export function addValidAppId(appId: string): void {
  VALID_APP_IDS.add(appId)
}

/**
 * Verificar si un App ID es válido
 */
export function isValidAppId(appId: string): boolean {
  return VALID_APP_IDS.has(appId)
}
