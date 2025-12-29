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
            :root {
              --primary: #6366f1;
              --success: #22c55e;
              --bg: #000000;
              --card-bg: rgba(255, 255, 255, 0.02);
              --text: #ffffff;
            }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              min-height: 100vh; 
              margin: 0;
              background: var(--bg); 
              color: var(--text); 
              overflow: hidden;
            }
            .bg-particles {
              position: fixed; inset: 0; z-index: 0; pointer-events: none;
            }
            .particle {
              position: absolute; width: 4px; height: 4px; background: rgba(99, 102, 241, 0.4);
              border-radius: 50%; bottom: -10px; animation: float-up 6s ease-in-out infinite;
            }
            @keyframes float-up {
              0% { transform: translateY(0); opacity: 0; }
              50% { opacity: 1; }
              100% { transform: translateY(-100vh); opacity: 0; }
            }
            .callback-card {
              position: relative; z-index: 10;
              background: var(--card-bg);
              backdrop-filter: blur(20px);
              -webkit-backdrop-filter: blur(20px);
              border: 1px solid rgba(255, 255, 255, 0.06);
              border-radius: 24px;
              padding: 40px;
              text-align: center;
              width: 90%; max-width: 380px;
              box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
              animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes slide-up {
              from { transform: translateY(20px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            .user-avatar-container {
              position: relative; width: 80px; height: 80px; margin: 0 auto 20px;
            }
            .user-avatar {
              width: 100%; height: 100%; border-radius: 50%; object-fit: cover;
              border: 3px solid rgba(99, 102, 241, 0.5);
              box-shadow: 0 8px 32px rgba(99, 102, 241, 0.3);
            }
            .check-badge {
              position: absolute; bottom: -2px; right: -2px;
              width: 26px; height: 26px;
              background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
              border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              border: 2px solid #000;
            }
            h2 {
              font-size: 22px; font-weight: 700; margin: 0 0 10px;
              background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
              -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            }
            p { font-size: 14px; color: rgba(255,255,255,0.6); margin: 0 0 24px; line-height: 1.5; }
            .countdown-ring {
              position: relative; width: 48px; height: 48px; margin: 0 auto 12px;
            }
            .countdown-circle {
              fill: none; stroke: var(--success); stroke-width: 3;
              stroke-dasharray: 126; stroke-dashoffset: 0;
              transition: stroke-dashoffset 1s linear;
              transform: rotate(-90deg); transform-origin: center;
            }
            .countdown-bg {
              fill: none; stroke: rgba(255,255,255,0.1); stroke-width: 3;
            }
            .countdown-val {
              position: absolute; inset: 0; display: flex;
              align-items: center; justify-content: center;
              font-weight: bold; font-size: 16px;
            }
            .buttons {
              display: flex; flex-direction: column; gap: 10px; width: 100%; align-items: center; margin-top: 20px;
            }
            .manual-btn {
              display: inline-block; width: 100%; max-width: 200px;
              padding: 12px 0;
              border-radius: 12px; color: white;
              text-decoration: none; font-size: 14px; font-weight: 600;
              transition: all 0.2s; cursor: pointer;
            }
            .manual-btn.primary {
              background: rgba(99, 102, 241, 0.2);
              border: 1px solid rgba(99, 102, 241, 0.4);
              box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
            }
            .manual-btn.primary:hover { background: rgba(99, 102, 241, 0.3); transform: translateY(-2px); }
            
            .manual-btn.secondary {
              background: transparent;
              border: 1px solid rgba(255,255,255,0.1);
              color: rgba(255,255,255,0.7);
              font-weight: 500;
            }
            .manual-btn.secondary:hover { background: rgba(255,255,255,0.05); color: white; }
            
            footer {
              margin-top: 24px; padding-top: 20px;
              border-top: 1px solid rgba(255,255,255,0.08);
              font-size: 12px; color: rgba(255,255,255,0.3);
            }
          </style>
        </head>
        <body>
          <div class="bg-particles">
            <div class="particle" style="left: 10%; animation-duration: 4s;"></div>
            <div class="particle" style="left: 30%; animation-duration: 6s; animation-delay: 1s;"></div>
            <div class="particle" style="left: 70%; animation-duration: 5s; animation-delay: 2s;"></div>
            <div class="particle" style="left: 90%; animation-duration: 7s;"></div>
          </div>
          
          <div class="callback-card">
            <div class="user-avatar-container">
              <img src="${user.avatarUrl || 'https://voutop.com/logo-circle.png'}" class="user-avatar" alt="Avatar">
              <div class="check-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
            </div>

            <h2>¡Bienvenido, ${user.displayName || user.username}!</h2>
            <p>Has iniciado sesión correctamente.<br>Volviendo a la app...</p>

            <div class="countdown-ring">
              <svg width="48" height="48">
                <circle class="countdown-bg" cx="24" cy="24" r="20"></circle>
                <circle class="countdown-circle" id="progress" cx="24" cy="24" r="20"></circle>
              </svg>
              <div class="countdown-val" id="timer">3</div>
            </div>
            <div class="buttons">
              <a href="${finalRedirectUrl}" class="manual-btn primary">Abrir App</a>
              <a href="${finalRedirectUrl.replace('voutop://auth-callback', 'https://voutop.com/')}" class="manual-btn secondary">Continuar en Web</a>
            </div>

            <footer>
              Powered by <strong>VouTop</strong>
            </footer>
          </div>

          <script>
            // Construir Intent URL para Android (fuerza apertura de app más agresivamente)
            // intent://auth-callback?param=val#Intent;scheme=voutop;package=com.votetok.app;end
            const finalRedirectUrl = "${finalRedirectUrl}";
            const intentUrl = finalRedirectUrl.replace('voutop://', 'intent://') + '#Intent;scheme=voutop;package=com.votetok.app;end';
            
            // Detectar si es Android
            const isAndroid = /Android/i.test(navigator.userAgent);
            const targetUrl = isAndroid ? intentUrl : finalRedirectUrl;

            let count = 3;
            const timerEl = document.getElementById('timer');
            const progressEl = document.getElementById('progress');
            const totalLength = 126;
            
            // Actualizar el enlace del botón principal
            document.querySelector('.manual-btn.primary').href = targetUrl;
            
            const interval = setInterval(() => {
              count--;
              if (timerEl) timerEl.textContent = count;
              
              if (progressEl) {
                const offset = totalLength - ((3 - count) / 3) * totalLength;
                progressEl.style.strokeDashoffset = offset;
              }
              
              if (count <= 0) {
                clearInterval(interval);
                window.location.href = targetUrl;
              }
            }, 1000);

            // Backup redirect immediately for Intent
            if (isAndroid) {
                setTimeout(() => {
                    window.location.href = targetUrl;
                }, 500);
            }
          </script>
        </body>
        </html>
      `;

      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
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
