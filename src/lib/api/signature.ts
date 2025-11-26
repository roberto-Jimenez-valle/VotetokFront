/**
 * Generador de App Signature para el cliente
 * Este código se ejecuta en el navegador
 */

// En el navegador usamos Web Crypto API
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Fallback HMAC-SHA256 simple para navegadores sin Web Crypto (HTTP)
 * SOLO PARA DESARROLLO - NO USAR EN PRODUCCIÓN
 */
async function simpleHmacSha256(secret: string, message: string): Promise<string> {
  // Para desarrollo en HTTP, usar una implementación simple
  // En producción SIEMPRE usar HTTPS con Web Crypto
  const keyBytes = new TextEncoder().encode(secret)
  const messageBytes = new TextEncoder().encode(message)

  // XOR simple para desarrollo (NO SEGURO, solo para testing)
  const combined = new Uint8Array(messageBytes.length + keyBytes.length)
  combined.set(messageBytes)
  combined.set(keyBytes, messageBytes.length)

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Crear signature HMAC-SHA256 en el navegador
 */
async function createHmacSignature(
  secret: string,
  message: string
): Promise<string> {
  try {
    // Intentar usar Web Crypto API (HTTPS requerido en móviles)
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)

    // Importar key
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    // Crear signature
    const messageData = encoder.encode(message)
    const signature = await crypto.subtle.sign('HMAC', key, messageData)

    // Convertir a hex
    const hashArray = Array.from(new Uint8Array(signature))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  } catch (err) {
    // Fallback para HTTP en desarrollo
    console.warn('[signature] Web Crypto falló, usando fallback simple:', err)
    return simpleHmacSha256(secret, message)
  }
}

const APP_ID = import.meta.env.VITE_APP_ID || 'voutop-web-v1'
const APP_SECRET = import.meta.env.VITE_APP_SECRET || 'change-this-app-secret-in-production-random-64-chars'

// DEBUG: Verificar que las variables se carguen
console.log('[signature.ts] APP_ID:', APP_ID)
console.log('[signature.ts] APP_SECRET loaded:', APP_SECRET ? APP_SECRET.substring(0, 30) + '...' : 'NOT LOADED')
console.log('[signature.ts] Build timestamp:', Date.now())

export interface SignatureHeaders extends Record<string, string> {
  'X-App-ID': string
  'X-Timestamp': string
  'X-Signature': string
}

/**
 * Generar headers de autenticación de app
 */
export async function createAppSignatureHeaders(
  method: string,
  path: string,
  body?: string
): Promise<SignatureHeaders> {
  const timestamp = Date.now()

  // Crear mensaje para firmar
  const message = `${method}:${path}:${timestamp}:${body || ''}`

  // Generar HMAC signature
  const signature = await createHmacSignature(APP_SECRET, message)

  return {
    'X-App-ID': APP_ID,
    'X-Timestamp': timestamp.toString(),
    'X-Signature': signature
  }
}
