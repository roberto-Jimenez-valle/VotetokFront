/**
 * Endpoint de callback de Google OAuth
 * GET /api/auth/google/callback
 */

import { json, redirect, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'
import { generateAccessToken, generateRefreshToken } from '$lib/server/auth/jwt'
import { prisma } from '$lib/server/prisma'

interface GoogleUserInfo {
  id: string
  email: string
  verified_email: boolean
  name: string
  given_name: string
  family_name: string
  picture: string
  locale: string
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code')
  const error_param = url.searchParams.get('error')
  const state = url.searchParams.get('state')

  // Parsear el estado
  const stateParams = new URLSearchParams(state || '');
  const isPopup = stateParams.get('popup') === '1';
  let baseRedirect = stateParams.get('redirect') || '/';

  // Si es popup, forzar callback de popup
  if (isPopup) {
    baseRedirect = '/auth/callback';
  }

  // Si el usuario canceló o hubo error
  if (error_param) {
    console.error('[Google Callback] Error:', error_param)
    throw redirect(303, `${baseRedirect}?error=google_auth_cancelled`)
  }

  if (!code) {
    console.error('[Google Callback] No code received')
    throw redirect(303, `${baseRedirect}?error=google_auth_failed`)
  }

  const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID
  const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET
  const GOOGLE_REDIRECT_URI = env.GOOGLE_REDIRECT_URI || `${url.origin}/api/auth/google/callback`

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('[Google Callback] Credenciales de Google no configuradas')
    throw redirect(303, `${baseRedirect}?error=google_config_missing`)
  }

  try {
    // 1. Intercambiar código por tokens
    console.log('[Google Callback] Intercambiando código por tokens...')
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('[Google Callback] Error obteniendo tokens:', errorData)
      throw redirect(303, `${baseRedirect}?error=google_token_failed`)
    }

    const tokens = await tokenResponse.json()
    const accessToken = tokens.access_token

    // 2. Obtener información del usuario de Google
    console.log('[Google Callback] Obteniendo información del usuario...')
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!userInfoResponse.ok) {
      console.error('[Google Callback] Error obteniendo info del usuario')
      throw redirect(303, `${baseRedirect}?error=google_userinfo_failed`)
    }

    const googleUser: GoogleUserInfo = await userInfoResponse.json()
    console.log('[Google Callback] Usuario de Google:', googleUser.email)

    // 3. Buscar o crear usuario en la base de datos
    let user = await prisma.user.findUnique({
      where: { email: googleUser.email },
    })

    if (!user) {
      // Crear nuevo usuario
      console.log('[Google Callback] Creando nuevo usuario...')

      // Generar username único basado en el email
      const baseUsername = googleUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
      let username = baseUsername
      let counter = 1

      // Verificar que el username no exista
      while (await prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername}${counter}`
        counter++
      }

      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          username,
          displayName: googleUser.name,
          avatarUrl: googleUser.picture,
          verified: googleUser.verified_email,
          role: 'user',
        },
      })

      console.log('[Google Callback] Usuario creado:', user.username)
    } else {
      // Actualizar avatar y nombre si cambió
      await prisma.user.update({
        where: { id: user.id },
        data: {
          avatarUrl: googleUser.picture,
          displayName: googleUser.name,
        },
      })
      console.log('[Google Callback] Usuario existente:', user.username)
    }

    // 4. Generar JWT tokens
    const jwtAccessToken = await generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email || undefined,
      role: (user.role as any) || 'user',
    })

    const jwtRefreshToken = await generateRefreshToken({
      userId: user.id,
      username: user.username,
      email: user.email || undefined,
      role: (user.role as any) || 'user',
    })

    // 5. Guardar tokens en cookies httpOnly (sesión larga tipo "recordarme")
    cookies.set('voutop-auth-token', jwtAccessToken, {
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 año
    })

    cookies.set('voutop-refresh-token', jwtRefreshToken, {
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 año
    })

    // 6. Redirigir a la app con datos del usuario en la URL para que el frontend los guarde
    const userData = encodeURIComponent(JSON.stringify({
      userId: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role || 'user',
    }))

    // URL final de redirección
    const finalRedirectUrl = `${baseRedirect}?auth=success&user=${userData}&token=${jwtAccessToken}`;

    // Si es un esquema personalizado (App), usar una página intermedia para asegurar la redirección
    if (baseRedirect.startsWith('voutop://')) {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Redirigiendo a la App...</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0;
              background: #000; 
              color: #fff; 
              text-align: center; 
              padding: 20px; 
            }
            .logo { 
              font-size: 24px; 
              font-weight: 800; 
              margin-bottom: 30px; 
              background: linear-gradient(to right, #4CAF50, #8BC34A);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            .loader { 
              border: 3px solid rgba(255,255,255,0.1); 
              border-radius: 50%; 
              border-top: 3px solid #4CAF50; 
              width: 50px; 
              height: 50px; 
              animation: spin 1s linear infinite; 
              margin-bottom: 30px; 
            }
            h2 { font-size: 20px; margin-bottom: 10px; }
            p { color: #aaa; margin-bottom: 30px; font-size: 14px; line-height: 1.5; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .btn { 
              padding: 14px 28px; 
              background: #fff; 
              color: #000; 
              text-decoration: none; 
              border-radius: 12px; 
              font-weight: bold; 
              font-size: 15px;
              transition: transform 0.2s;
            }
            .btn:active { transform: scale(0.95); }
            #timer { font-weight: bold; color: #fff; }
          </style>
        </head>
        <body>
          <div class="logo">VouTop</div>
          <div class="loader"></div>
          <h2>¡Bienvenido, ${user.username}!</h2>
          <p>Login exitoso.<br>Volviendo a la app en <span id="timer">3</span> segundos...</p>
          
          <a href="${finalRedirectUrl}" class="btn">Abrir App ahora</a>

          <script>
            let count = 3;
            const timerEl = document.getElementById('timer');
            
            const interval = setInterval(() => {
              count--;
              if (timerEl) timerEl.textContent = count;
              
              if (count <= 0) {
                clearInterval(interval);
                window.location.href = "${finalRedirectUrl}";
              }
            }, 1000);

            // Intentar redirigir inmediatamente también por si acaso el navegador lo permite
            // setTimeout(() => { window.location.href = "${finalRedirectUrl}"; }, 100);
          </script>
        </body>
        </html>
      `;

      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    throw redirect(303, finalRedirectUrl)

  } catch (err: any) {
    console.error('[Google Callback] Error:', err)

    if (err.status) {
      throw err
    }

    throw redirect(303, `${baseRedirect}?error=google_auth_error`)
  }
}
