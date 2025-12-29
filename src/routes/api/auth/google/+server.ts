/**
 * Endpoint para iniciar autenticación con Google OAuth
 * GET /api/auth/google
 */

import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'

export const GET: RequestHandler = async ({ url }) => {
  const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID
  const GOOGLE_REDIRECT_URI = env.GOOGLE_REDIRECT_URI || `${url.origin}/api/auth/google/callback`

  // Detectar si viene de un popup
  const isPopup = url.searchParams.get('popup') === '1'

  if (!GOOGLE_CLIENT_ID) {
    console.error('[Google Auth] GOOGLE_CLIENT_ID no está configurado')
    const errorRedirect = isPopup ? '/auth/callback?error=google_config_missing' : '/?error=google_config_missing'
    throw redirect(303, errorRedirect)
  }

  // Construir URL de autorización de Google
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')

  googleAuthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  googleAuthUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
  googleAuthUrl.searchParams.set('response_type', 'code')
  googleAuthUrl.searchParams.set('scope', 'openid email profile')
  googleAuthUrl.searchParams.set('access_type', 'offline')
  googleAuthUrl.searchParams.set('prompt', 'consent')

  // Construir state con parámetros necesarios (popup, redirect)
  const stateParams = new URLSearchParams();
  if (isPopup) {
    stateParams.set('popup', '1');
  }

  const customRedirect = url.searchParams.get('redirect');
  if (customRedirect) {
    stateParams.set('redirect', customRedirect);
  }

  if (stateParams.toString()) {
    googleAuthUrl.searchParams.set('state', stateParams.toString());
  }

  console.log('[Google Auth] Redirigiendo a Google OAuth:', googleAuthUrl.toString(), isPopup ? '(popup)' : '')

  // Redirigir al usuario a Google
  throw redirect(303, googleAuthUrl.toString())
}
