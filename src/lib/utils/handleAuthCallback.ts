/**
 * Manejar callback de autenticación OAuth
 * Procesa los parámetros de la URL después del login con Google
 */

import { setAuth } from '$lib/stores/auth'
import { browser } from '$app/environment'

export function handleAuthCallback() {
  if (!browser) return

  const params = new URLSearchParams(window.location.search)
  const authStatus = params.get('auth')
  const userData = params.get('user')
  const token = params.get('token')
  const error = params.get('error')

  // Manejar errores
  if (error) {
    console.error('[Auth Callback] Error:', error)
    
    const errorMessages: Record<string, string> = {
      google_auth_cancelled: 'Autenticación cancelada',
      google_auth_failed: 'Error al autenticar con Google',
      google_config_missing: 'Configuración de Google incompleta',
      google_token_failed: 'Error al obtener tokens de Google',
      google_userinfo_failed: 'Error al obtener información del usuario',
      google_auth_error: 'Error en el proceso de autenticación',
    }

    const message = errorMessages[error] || 'Error desconocido'
    alert(`Error: ${message}`)
    
    // Limpiar parámetros de la URL
    window.history.replaceState({}, '', window.location.pathname)
    return
  }

  // Manejar login exitoso
  if (authStatus === 'success' && userData && token) {
    try {
      const user = JSON.parse(decodeURIComponent(userData))
      
      console.log('[Auth Callback] Login exitoso:', user.username)
      
      // Guardar en el store y localStorage
      setAuth(token, user)
      
      // Limpiar parámetros de la URL
      window.history.replaceState({}, '', window.location.pathname)
      
      // Opcional: Mostrar mensaje de bienvenida
      console.log(`¡Bienvenido, ${user.displayName || user.username}!`)
      
    } catch (err) {
      console.error('[Auth Callback] Error procesando datos del usuario:', err)
      alert('Error al procesar la autenticación')
    }
  }
}
