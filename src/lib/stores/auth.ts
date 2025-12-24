/**
 * Store UNIFICADO de autenticación de usuario
 * Este es el único store de autenticación - NO usar otros stores para currentUser
 */

import { writable, get } from 'svelte/store'
import { browser } from '$app/environment'

export interface User {
  // ID puede venir como 'id' o 'userId' dependiendo del contexto
  id?: number
  userId?: number
  username: string
  email?: string
  role: 'user' | 'verified' | 'premium' | 'moderator' | 'admin' | string
  avatarUrl?: string
  displayName?: string
  verified?: boolean
  countryIso3?: string
  subdivisionId?: string
}

// Normalizar usuario para manejar id/userId
function normalizeUser(user: any): User | null {
  if (!user) return null

  const userId = user.userId ?? user.id
  if (!userId) return null

  return {
    id: userId,
    userId: userId,
    username: user.username,
    email: user.email,
    role: user.role || 'user',
    avatarUrl: user.avatarUrl,
    displayName: user.displayName || user.username,
    verified: user.verified || false,
    countryIso3: user.countryIso3,
    subdivisionId: user.subdivisionId
  }
}

// Token JWT
export const authToken = writable<string | null>(null)

// Usuario actual - STORE ÚNICO
export const currentUser = writable<User | null>(null)

// Estado de autenticación
export const isAuthenticated = writable<boolean>(false)

/**
 * Inicializar autenticación desde localStorage
 * Se llama automáticamente al cargar el módulo
 */
export function initAuth() {
  if (!browser) return

  // Primero intentar autenticación real (OAuth/JWT)
  const token = localStorage.getItem('voutop-auth-token')
  const userData = localStorage.getItem('voutop-user')

  if (token && userData) {
    try {
      const user = JSON.parse(userData)
      const normalizedUser = normalizeUser(user)
      if (normalizedUser) {
        // Verificar si el token es válido (no expirado)
        if (isTokenExpired(token)) {
          console.warn('[Auth] ⚠️ Token expirado, limpiando sesión...')
          logout()
          return
        }

        authToken.set(token)
        currentUser.set(normalizedUser)
        isAuthenticated.set(true)
        console.log('[Auth] ✅ Usuario OAuth restaurado:', normalizedUser.username)
        // NOTA: Ya no validamos con el servidor al iniciar para evitar bucles
        // El refresh se hará automáticamente si recibimos 401 en fetchWithAuth()
        return
      }
    } catch (err) {
      console.warn('[Auth] ⚠️ Error parsing OAuth user, limpiando...')
      logout()
    }
  }

  // Fallback: Usuario de prueba (solo desarrollo)
  const testUser = localStorage.getItem('voutop-test-user')
  if (testUser) {
    try {
      const user = JSON.parse(testUser)
      const normalizedUser = normalizeUser(user)
      if (normalizedUser) {
        currentUser.set(normalizedUser)
        isAuthenticated.set(true)
        console.log('[Auth] 🧪 Usuario de prueba restaurado:', normalizedUser.username)
      }
    } catch (err) {
      console.warn('[Auth] ⚠️ Error parsing test user')
    }
  }
}

/**
 * Verificar si un token JWT está expirado
 */
function isTokenExpired(token: string): boolean {
  try {
    // Decodificar payload del JWT (parte central)
    const payload = token.split('.')[1]
    if (!payload) return true

    const decoded = JSON.parse(atob(payload))
    if (!decoded.exp) return false // Sin expiración

    // Comparar con timestamp actual (exp está en segundos)
    const now = Math.floor(Date.now() / 1000)
    const isExpired = decoded.exp < now

    if (isExpired) {
      console.log('[Auth] Token expirado:', new Date(decoded.exp * 1000).toLocaleString())
    }

    return isExpired
  } catch (err) {
    console.warn('[Auth] Error decodificando token:', err)
    return true // Si no se puede decodificar, considerarlo expirado
  }
}

/**
 * Validar token con el servidor en background
 * Si el servidor rechaza el token, hacer logout (el refresh se hará en fetchWithAuth si es necesario)
 */
async function validateTokenWithServer(token: string) {
  try {
    const response = await fetch('/api/auth/validate', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      console.warn('[Auth] ⚠️ Servidor rechazó el token, cerrando sesión...')
      logout()
    } else {
      console.log('[Auth] ✅ Token validado con el servidor')
    }
  } catch (err) {
    // Error de red - no cerrar sesión, podría ser problema de conectividad
    console.warn('[Auth] ⚠️ No se pudo validar token con servidor (error de red):', err)
  }
}

// Flag para evitar refreshes concurrentes (IMPORTANTE: evita bucles infinitos)
let isRefreshing = false
// Promise para que múltiples llamadas esperen al mismo refresh
let refreshPromise: Promise<boolean> | null = null

/**
 * Refrescar el access token usando el refresh token
 * @returns true si se refrescó exitosamente, false si falló
 */
export async function refreshAccessToken(): Promise<boolean> {
  if (!browser) return false

  // Si ya hay un refresh en progreso, esperar a que termine
  if (isRefreshing && refreshPromise) {
    console.log('[Auth] ⏳ Esperando refresh en progreso...')
    return refreshPromise
  }

  isRefreshing = true
  console.log('[Auth] 🔄 Intentando refrescar access token...')

  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' // Importante: incluir cookies
      })

      if (!response.ok) {
        console.warn('[Auth] ❌ Refresh token inválido o expirado')
        return false
      }

      const data = await response.json()

      if (data.success && data.token && data.user) {
        // Actualizar localStorage PRIMERO (sin triggear stores)
        localStorage.setItem('voutop-auth-token', data.token)
        localStorage.setItem('voutop-user', JSON.stringify(data.user))

        // Actualizar stores (esto puede triggear reactividad)
        authToken.set(data.token)
        currentUser.set(normalizeUser(data.user))
        isAuthenticated.set(true)

        console.log('[Auth] ✅ Token refrescado exitosamente para:', data.user.username)
        return true
      }

      return false
    } catch (err) {
      console.error('[Auth] ❌ Error refrescando token:', err)
      return false
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/**
 * Wrapper para fetch que maneja automáticamente errores 401
 * Intenta refrescar el token y reintentar la petición
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (!browser) {
    return fetch(url, options)
  }

  // Obtener token actual
  const token = localStorage.getItem('voutop-auth-token')

  // Añadir Authorization header si hay token
  const headers = new Headers(options.headers)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  // Primera intento
  let response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  })

  // Si recibimos 401, intentar refrescar y reintentar
  if (response.status === 401) {
    console.log('[Auth] 🔄 Recibido 401, intentando refresh automático...')

    const refreshed = await refreshAccessToken()

    if (refreshed) {
      // Obtener nuevo token
      const newToken = localStorage.getItem('voutop-auth-token')
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`)
      }

      // Reintentar la petición original
      console.log('[Auth] 🔄 Reintentando petición con nuevo token...')
      response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include'
      })
    } else {
      // No se pudo refrescar, hacer logout
      console.warn('[Auth] ❌ No se pudo refrescar token, cerrando sesión...')
      logout()
    }
  }

  return response
}

/**
 * Guardar sesión con token OAuth
 */
export function setAuth(token: string, user: any) {
  if (!browser) return

  const normalizedUser = normalizeUser(user)
  if (!normalizedUser) {
    console.error('[Auth] ❌ Usuario inválido, no se puede guardar sesión')
    return
  }

  localStorage.setItem('voutop-auth-token', token)
  localStorage.setItem('voutop-user', JSON.stringify(normalizedUser))

  authToken.set(token)
  currentUser.set(normalizedUser)
  isAuthenticated.set(true)

  console.log('[Auth] ✅ Sesión guardada para:', normalizedUser.username)
}

/**
 * Setear usuario (sin token - para usuarios de prueba)
 * Alias de compatibilidad con código legacy
 */
export function setCurrentUser(user: any) {
  if (!browser) return

  if (!user) {
    logout()
    return
  }

  const normalizedUser = normalizeUser(user)
  if (!normalizedUser) {
    console.error('[Auth] ❌ Usuario inválido')
    return
  }

  // Si no hay token OAuth, guardar como usuario de prueba
  const hasOAuthToken = localStorage.getItem('voutop-auth-token')
  if (!hasOAuthToken) {
    localStorage.setItem('voutop-test-user', JSON.stringify(normalizedUser))
  }

  currentUser.set(normalizedUser)
  isAuthenticated.set(true)

  console.log('[Auth] ✅ Usuario seteado:', normalizedUser.username)
}

/**
 * Cerrar sesión
 */
export function logout() {
  if (!browser) return

  localStorage.removeItem('voutop-auth-token')
  localStorage.removeItem('voutop-user')
  localStorage.removeItem('voutop-test-user')

  authToken.set(null)
  currentUser.set(null)
  isAuthenticated.set(false)

  console.log('[Auth] 👋 Sesión cerrada')
}

/**
 * Actualizar datos del usuario
 */
export function updateUser(userData: Partial<User>) {
  if (!browser) return

  currentUser.update(user => {
    if (!user) return null

    const updatedUser = { ...user, ...userData }

    // Actualizar en localStorage según el tipo de sesión
    const hasOAuthToken = localStorage.getItem('voutop-auth-token')
    if (hasOAuthToken) {
      localStorage.setItem('voutop-user', JSON.stringify(updatedUser))
    } else {
      localStorage.setItem('voutop-test-user', JSON.stringify(updatedUser))
    }

    return updatedUser
  })
}

/**
 * Obtener el ID del usuario actual de forma segura
 */
export function getCurrentUserId(): number | null {
  const user = get(currentUser)
  return user?.userId ?? user?.id ?? null
}

/**
 * Verificar si hay un usuario logueado
 */
export function isUserLoggedIn(): boolean {
  return get(isAuthenticated)
}

// ========================================
// PENDING ACTION SYSTEM
// Para guardar estado antes del login OAuth
// ========================================

const PENDING_ACTION_KEY = 'voutop-pending-action'
const PENDING_ACTION_TTL = 10 * 60 * 1000 // 10 minutos

export interface PendingAction {
  type: 'create_poll' | 'vote' | 'comment' | 'other'
  data: any
  timestamp: number
  returnUrl?: string
}

/**
 * Guardar acción pendiente antes del login OAuth
 * Se restaurará automáticamente después del callback
 */
export function savePendingAction(action: Omit<PendingAction, 'timestamp'>) {
  if (!browser) return

  const pendingAction: PendingAction = {
    ...action,
    timestamp: Date.now(),
    returnUrl: window.location.href
  }

  localStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(pendingAction))
  console.log('[Auth] 💾 Acción pendiente guardada:', action.type)
}

/**
 * Obtener y limpiar acción pendiente después del login
 * Retorna null si no hay acción o ha expirado
 */
export function getPendingAction(): PendingAction | null {
  if (!browser) return null

  const stored = localStorage.getItem(PENDING_ACTION_KEY)
  if (!stored) return null

  try {
    const action: PendingAction = JSON.parse(stored)

    // Verificar si ha expirado
    if (Date.now() - action.timestamp > PENDING_ACTION_TTL) {
      console.log('[Auth] ⏰ Acción pendiente expirada, descartando')
      clearPendingAction()
      return null
    }

    return action
  } catch {
    clearPendingAction()
    return null
  }
}

/**
 * Limpiar acción pendiente
 */
export function clearPendingAction() {
  if (!browser) return
  localStorage.removeItem(PENDING_ACTION_KEY)
}

/**
 * Verificar si la sesión está activa (token no expirado)
 * Útil para verificación proactiva antes de acciones importantes
 */
export function checkSession(): { valid: boolean; expiresIn?: number; message?: string } {
  if (!browser) return { valid: false, message: 'No browser environment' }

  const token = localStorage.getItem('voutop-auth-token')
  if (!token) {
    return { valid: false, message: 'No hay sesión activa' }
  }

  try {
    const payload = token.split('.')[1]
    if (!payload) return { valid: false, message: 'Token inválido' }

    const decoded = JSON.parse(atob(payload))
    if (!decoded.exp) return { valid: true } // Sin expiración

    const now = Math.floor(Date.now() / 1000)
    const expiresIn = decoded.exp - now

    if (expiresIn <= 0) {
      return { valid: false, message: 'Tu sesión ha expirado' }
    }

    // Advertir si expira pronto (menos de 5 minutos)
    if (expiresIn < 300) {
      return {
        valid: true,
        expiresIn,
        message: `Tu sesión expira en ${Math.ceil(expiresIn / 60)} minutos`
      }
    }

    return { valid: true, expiresIn }
  } catch {
    return { valid: false, message: 'Error verificando sesión' }
  }
}

/**
 * Verificar sesión y mostrar modal de login si es necesario
 * Retorna true si la sesión es válida, false si necesita login
 */
export function requireSession(): boolean {
  const session = checkSession()

  if (!session.valid) {
    console.log('[Auth] ⚠️ Sesión inválida:', session.message)
    return false
  }

  if (session.message) {
    console.log('[Auth] ⏰', session.message)
  }

  return true
}

// Inicializar al cargar el módulo
if (browser) {
  initAuth()
}
