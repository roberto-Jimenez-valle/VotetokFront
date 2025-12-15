<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';

  let status = $state<'loading' | 'success' | 'error'>('loading');
  let message = $state('Procesando autenticación...');

  onMount(() => {
    if (!browser) return;

    // Usar get($page) para obtener los parámetros correctamente
    const pageData = get(page);
    const params = pageData.url.searchParams;
    const authStatus = params.get('auth');
    const userData = params.get('user');
    const token = params.get('token');
    const error = params.get('error');
    
    // Debug: mostrar qué parámetros llegaron
    console.log('[Auth Callback Popup] Parámetros recibidos:', {
      auth: authStatus,
      hasUser: !!userData,
      hasToken: !!token,
      error: error,
      fullUrl: pageData.url.href
    });

    if (error) {
      status = 'error';
      const errorMessages: Record<string, string> = {
        google_auth_cancelled: 'Autenticación cancelada',
        google_auth_failed: 'Error al autenticar con Google',
        google_config_missing: 'Configuración de Google incompleta',
        google_token_failed: 'Error al obtener tokens de Google',
        google_userinfo_failed: 'Error al obtener información del usuario',
        google_auth_error: 'Error en el proceso de autenticación',
      };
      message = errorMessages[error] || 'Error desconocido';
      
      // Comunicar error a la ventana padre
      if (window.opener) {
        window.opener.postMessage({
          type: 'OAUTH_ERROR',
          error: error,
          message: message
        }, window.location.origin);
        
        setTimeout(() => window.close(), 2000);
      }
      return;
    }

    if (authStatus === 'success' && userData && token) {
      try {
        const user = JSON.parse(decodeURIComponent(userData));
        
        status = 'success';
        message = `¡Bienvenido, ${user.displayName || user.username}!`;
        
        // Comunicar éxito a la ventana padre
        if (window.opener) {
          window.opener.postMessage({
            type: 'OAUTH_SUCCESS',
            token: token,
            user: user
          }, window.location.origin);
          
          setTimeout(() => window.close(), 1500);
        }
      } catch (err) {
        status = 'error';
        message = 'Error al procesar la autenticación';
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'OAUTH_ERROR',
            error: 'parse_error',
            message: message
          }, window.location.origin);
          
          setTimeout(() => window.close(), 2000);
        }
      }
    } else {
      status = 'error';
      message = 'Respuesta de autenticación inválida';
      
      if (window.opener) {
        window.opener.postMessage({
          type: 'OAUTH_ERROR',
          error: 'invalid_response',
          message: message
        }, window.location.origin);
        
        setTimeout(() => window.close(), 2000);
      }
    }
  });
</script>

<div class="callback-container">
  <div class="callback-card">
    {#if status === 'loading'}
      <div class="spinner"></div>
      <p>{message}</p>
    {:else if status === 'success'}
      <div class="icon success">✓</div>
      <p>{message}</p>
      <small>Esta ventana se cerrará automáticamente...</small>
    {:else}
      <div class="icon error">✕</div>
      <p>{message}</p>
      <small>Esta ventana se cerrará automáticamente...</small>
    {/if}
  </div>
</div>

<style>
  .callback-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    font-family: system-ui, -apple-system, sans-serif;
  }

  .callback-card {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 40px;
    text-align: center;
    color: white;
    max-width: 400px;
    margin: 20px;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top-color: #4285f4;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    margin: 0 auto 20px;
  }

  .icon.success {
    background: #22c55e;
  }

  .icon.error {
    background: #ef4444;
  }

  p {
    font-size: 18px;
    margin: 0 0 10px;
  }

  small {
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
  }
</style>
