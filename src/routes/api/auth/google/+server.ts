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

  if (!GOOGLE_CLIENT_ID) {
    console.error('[Google Auth] GOOGLE_CLIENT_ID no está configurado')
    throw redirect(303, '/?error=google_config_missing')
  }

  // Construir URL de autorización de Google
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  
  googleAuthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  googleAuthUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
  googleAuthUrl.searchParams.set('response_type', 'code')
  googleAuthUrl.searchParams.set('scope', 'openid email profile')
  googleAuthUrl.searchParams.set('access_type', 'offline')
  googleAuthUrl.searchParams.set('prompt', 'consent')

  console.log('[Google Auth] Redirigiendo a Google OAuth:', googleAuthUrl.toString())

  // Redirigir al usuario a Google
  throw redirect(303, googleAuthUrl.toString())
}
