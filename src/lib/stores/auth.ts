/**
 * Store de autenticación de usuario
 */

import { writable } from 'svelte/store'
import { browser } from '$app/environment'

export interface User {
  userId: number
  username: string
  email?: string
  role: 'user' | 'verified' | 'premium' | 'moderator' | 'admin'
  avatarUrl?: string
  displayName?: string
}

// Token JWT
export const authToken = writable<string | null>(null)

// Usuario actual
export const currentUser = writable<User | null>(null)

// Estado de autenticación
export const isAuthenticated = writable<boolean>(false)

/**
 * Inicializar autenticación desde localStorage
 */
export function initAuth() {
  if (!browser) return
  
  const token = localStorage.getItem('voutop-auth-token')
  const userData = localStorage.getItem('voutop-user')
  
  if (token && userData) {
    try {
      const user = JSON.parse(userData)
      authToken.set(token)
      currentUser.set(user)
      isAuthenticated.set(true)
    } catch (err) {
      // Token o datos inválidos, limpiar
      logout()
    }
  }
}

/**
 * Guardar sesión
 */
export function setAuth(token: string, user: User) {
  if (!browser) return
  
  localStorage.setItem('voutop-auth-token', token)
  localStorage.setItem('voutop-user', JSON.stringify(user))
  
  authToken.set(token)
  currentUser.set(user)
  isAuthenticated.set(true)
}

/**
 * Cerrar sesión
 */
export function logout() {
  if (!browser) return
  
  localStorage.removeItem('voutop-auth-token')
  localStorage.removeItem('voutop-user')
  
  authToken.set(null)
  currentUser.set(null)
  isAuthenticated.set(false)
}

/**
 * Actualizar datos del usuario
 */
export function updateUser(userData: Partial<User>) {
  if (!browser) return
  
  currentUser.update(user => {
    if (!user) return null
    
    const updatedUser = { ...user, ...userData }
    localStorage.setItem('voutop-user', JSON.stringify(updatedUser))
    return updatedUser
  })
}

// Inicializar al cargar
if (browser) {
  initAuth()
}
