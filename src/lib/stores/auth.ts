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
        
        // Validar token con el servidor en background
        validateTokenWithServer(token)
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
 * Si el servidor rechaza el token, cerrar sesión
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
    console.warn('[Auth] ⚠️ No se pudo validar token con servidor:', err)
  }
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

// Inicializar al cargar el módulo
if (browser) {
  initAuth()
}
