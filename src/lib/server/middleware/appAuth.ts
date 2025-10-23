/**
 * Middleware de App Signature
 * Protege endpoints públicos para que solo sean accesibles desde la app oficial
 */

import { error, type RequestEvent } from '@sveltejs/kit'
import { validateAppSignature, type AppSignatureData, type AppAuthResult } from '../auth/signature'

/**
 * Validar que el request viene desde la app oficial
 */
export async function requireAppSignature(event: RequestEvent): Promise<AppAuthResult> {
  const appId = event.request.headers.get('X-App-ID')
  const timestamp = event.request.headers.get('X-Timestamp')
  const signature = event.request.headers.get('X-Signature')

  // 1. Verificar headers presentes
  if (!appId || !timestamp || !signature) {
    throw error(401, {
      message: 'App authentication required. Please use the official app.',
      code: 'APP_AUTH_MISSING',
      hint: 'Missing X-App-ID, X-Timestamp, or X-Signature headers'
    })
  }

  // 2. Leer body si existe (para POST/PUT/PATCH)
  const method = event.request.method
  let body = ''

  if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE') {
    try {
      body = await event.request.text()
      
      // Recrear request con el body leído (ya que solo se puede leer una vez)
      event.request = new Request(event.request.url, {
        method: event.request.method,
        headers: event.request.headers,
        body: body || undefined
      })
    } catch (err) {
      // Body vacío o no parseable, continuar
    }
  }

  // 3. Validar signature
  const path = new URL(event.request.url).pathname
  const timestampNum = parseInt(timestamp)

  const signatureData: AppSignatureData = {
    appId,
    timestamp: timestampNum,
    signature
  }

  const result = validateAppSignature(method, path, signatureData, body)

  if (!result.valid) {
    // Mapear errores específicos
    const errorMessages: Record<string, { message: string; code: string; status: number }> = {
      INVALID_APP_ID: {
        message: 'Invalid app ID. Please update your app to the latest version.',
        code: 'INVALID_APP_ID',
        status: 403
      },
      INVALID_TIMESTAMP: {
        message: 'Invalid timestamp format.',
        code: 'INVALID_TIMESTAMP',
        status: 400
      },
      TIMESTAMP_EXPIRED: {
        message: 'Request expired. Please sync your device clock and try again.',
        code: 'TIMESTAMP_EXPIRED',
        status: 401
      },
      INVALID_SIGNATURE: {
        message: 'Invalid signature. Please update your app.',
        code: 'INVALID_SIGNATURE',
        status: 403
      }
    }

    const errorData = errorMessages[result.error || 'INVALID_SIGNATURE']
    
    throw error(errorData.status, {
      message: errorData.message,
      code: errorData.code
    })
  }

  return result
}

/**
 * Verificar app signature sin lanzar error (para logging/analytics)
 */
export async function verifyAppSignatureOptional(event: RequestEvent): Promise<AppAuthResult | null> {
  try {
    return await requireAppSignature(event)
  } catch {
    return null
  }
}
