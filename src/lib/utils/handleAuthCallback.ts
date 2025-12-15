/**
 * Manejar callback de autenticación OAuth
 * Procesa los parámetros de la URL después del login con Google
 */

import { setAuth, getPendingAction, clearPendingAction, type PendingAction } from '$lib/stores/auth'
import { browser } from '$app/environment'
import { createPollModalOpen } from '$lib/stores/globalState'

// Store para datos de encuesta pendiente (se usa desde CreatePollModal)
export const pendingPollData = { current: null as any }

export function handleAuthCallback(): { pendingAction: PendingAction | null } {
  if (!browser) return { pendingAction: null }

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
      
      // Verificar si hay acción pendiente
      const pendingAction = getPendingAction()
      
      if (pendingAction) {
        console.log('[Auth Callback] 🔄 Restaurando acción pendiente:', pendingAction.type)
        
        // Guardar datos para que el componente los use
        pendingPollData.current = pendingAction.data
        
        // Limpiar la acción pendiente
        clearPendingAction()
        
        // Si era crear encuesta, abrir el modal
        if (pendingAction.type === 'create_poll') {
          console.log('[Auth Callback] 📝 Abriendo modal de crear encuesta con datos guardados')
          // Dar tiempo para que se monte el componente
          setTimeout(() => {
            createPollModalOpen.set(true)
          }, 100)
        }
        
        return { pendingAction }
      }
      
      console.log(`¡Bienvenido, ${user.displayName || user.username}!`)
      
    } catch (err) {
      console.error('[Auth Callback] Error procesando datos del usuario:', err)
      alert('Error al procesar la autenticación')
    }
  }
  
  return { pendingAction: null }
}
