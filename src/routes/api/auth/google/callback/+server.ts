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

  // Si el usuario canceló o hubo error
  if (error_param) {
    console.error('[Google Callback] Error:', error_param)
    throw redirect(303, '/?error=google_auth_cancelled')
  }

  if (!code) {
    console.error('[Google Callback] No code received')
    throw redirect(303, '/?error=google_auth_failed')
  }

  const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID
  const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET
  const GOOGLE_REDIRECT_URI = env.GOOGLE_REDIRECT_URI || `${url.origin}/api/auth/google/callback`

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('[Google Callback] Credenciales de Google no configuradas')
    throw redirect(303, '/?error=google_config_missing')
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
      throw redirect(303, '/?error=google_token_failed')
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
      throw redirect(303, '/?error=google_userinfo_failed')
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

    // 5. Guardar tokens en cookies httpOnly
    cookies.set('votetok-auth-token', jwtAccessToken, {
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    })

    cookies.set('votetok-refresh-token', jwtRefreshToken, {
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 días
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

    throw redirect(303, `/?auth=success&user=${userData}&token=${jwtAccessToken}`)

  } catch (err: any) {
    console.error('[Google Callback] Error:', err)
    
    if (err.status) {
      throw err
    }
    
    throw redirect(303, '/?error=google_auth_error')
  }
}
