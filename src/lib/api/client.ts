/**
 * Cliente API con App Signature y JWT
 * Maneja automáticamente la autenticación app-only y de usuario
 */

import { createAppSignatureHeaders } from './signature'
import { get } from 'svelte/store'
import { authToken, logout } from '$lib/stores/auth'
import { loginModalOpen } from '$lib/stores/globalState'

export interface ApiRequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
  skipAppAuth?: boolean  // Para casos especiales donde no se requiere app auth
}

/**
 * Realizar request a la API con App Signature automática
 */
export async function apiCall(
  url: string,
  options: ApiRequestOptions = {}
): Promise<Response> {
  const method = options.method || 'GET'
  const path = new URL(url, window.location.origin).pathname

  // Preparar body
  let bodyString: string | undefined
  if (options.body) {
    if (typeof options.body === 'string') {
      bodyString = options.body
    } else {
      bodyString = JSON.stringify(options.body)
    }
  }

  // Generar headers de app signature
  let appHeaders: Record<string, string> = {}

  // DESARROLLO: Skip app auth solo en IPs locales (Web Crypto no funciona sin HTTPS)
  // localhost mantiene autenticación normal
  const isLocalIP = window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('172.') ||
    window.location.hostname.startsWith('10.')

  if (!options.skipAppAuth && !isLocalIP) {
    try {
      appHeaders = await createAppSignatureHeaders(method, path, bodyString)
      console.debug('[apiCall] Headers generados para:', method, path)
    } catch (err) {
      console.error('[apiCall] ❌ Error generando headers:', err)
      alert('Error de autenticación: ' + (err as Error).message)
      throw err
    }
  } else if (isLocalIP) {
    console.debug('[apiCall] ⚠️ App auth deshabilitada para IP local:', method, path)
  }

  // Agregar JWT si existe (para endpoints protegidos)
  let token = get(authToken)
  
  // Fallback: intentar obtener del localStorage si el store está vacío
  if (!token && typeof window !== 'undefined') {
    token = localStorage.getItem('voutop-auth-token')
    if (token) {
      console.log('[apiCall] 🔄 Token obtenido de localStorage (store vacío)')
    }
  }
  
  const authHeaders: Record<string, string> = {}
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`
    console.debug('[apiCall] ✅ Token JWT encontrado, agregando a headers')
  } else {
    console.warn('[apiCall] ⚠️ No hay token JWT - petición sin autenticación')
  }

  // Combinar headers
  const headers = {
    'Content-Type': 'application/json',
    ...appHeaders,
    ...authHeaders,
    ...options.headers
  }

  // Realizar request
  const response = await fetch(url, {
    ...options,
    method,
    headers,
    body: bodyString,
    credentials: 'include' // Incluir cookies de sesión
  })

  // Manejar errores comunes
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))

    // 401 Unauthorized: Token expirado o inválido
    if (response.status === 401) {
      console.warn('[apiCall] ⚠️ 401 Unauthorized - Token expirado o inválido, cerrando sesión...')
      logout()
      loginModalOpen.set(true)
      throw new ApiError('Sesión expirada. Por favor inicia sesión de nuevo.', 'SESSION_EXPIRED', 401, error)
    }

    // Error específico con código o mensaje
    if (error.code || error.message || error.error) {
      const errorMessage = error.message || error.error || response.statusText
      const errorCode = error.code || 'API_ERROR'
      throw new ApiError(errorMessage, errorCode, response.status, error)
    }

    throw new ApiError(response.statusText, 'API_ERROR', response.status)
  }

  return response
}

/**
 * Helper para GET
 */
export async function apiGet<T = any>(url: string, options?: ApiRequestOptions): Promise<T> {
  const response = await apiCall(url, { ...options, method: 'GET' })
  return response.json()
}

/**
 * Helper para POST
 */
export async function apiPost<T = any>(
  url: string,
  data: any,
  options?: ApiRequestOptions
): Promise<T> {
  const response = await apiCall(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data)
  })
  return response.json()
}

/**
 * Helper para PUT
 */
export async function apiPut<T = any>(
  url: string,
  data: any,
  options?: ApiRequestOptions
): Promise<T> {
  const response = await apiCall(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data)
  })
  return response.json()
}

/**
 * Helper para PATCH
 */
export async function apiPatch<T = any>(
  url: string,
  data: any,
  options?: ApiRequestOptions
): Promise<T> {
  const response = await apiCall(url, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(data)
  })
  return response.json()
}

/**
 * Helper para DELETE
 */
export async function apiDelete<T = any>(url: string, options?: ApiRequestOptions): Promise<T> {
  const response = await apiCall(url, { ...options, method: 'DELETE' })
  return response.json()
}

/**
 * Clase de error personalizada para la API
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Manejar errores de API de forma amigable
 */
export function handleApiError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'APP_AUTH_MISSING':
      case 'INVALID_APP_ID':
      case 'INVALID_SIGNATURE':
        return 'Por favor actualiza la app a la última versión'

      case 'TIMESTAMP_EXPIRED':
        return 'El reloj de tu dispositivo está desincronizado. Por favor ajústalo.'

      case 'AUTH_REQUIRED':
        return 'Debes iniciar sesión para realizar esta acción'

      case 'FORBIDDEN':
        return 'No tienes permisos para realizar esta acción'

      case 'RATE_LIMIT_EXCEEDED':
        const retryAfter = err.details?.retryAfter || 60
        return `Has alcanzado el límite. Intenta de nuevo en ${retryAfter} segundos.`

      case 'NOT_OWNER':
        return 'Solo puedes modificar tu propio contenido'

      default:
        return err.message || 'Error al procesar la solicitud'
    }
  }

  return 'Error de conexión. Por favor intenta de nuevo.'
}
