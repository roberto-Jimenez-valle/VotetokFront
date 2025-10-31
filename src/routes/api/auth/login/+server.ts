/**
 * Endpoint de login
 * POST /api/auth/login
 */

import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { generateAccessToken, generateRefreshToken } from '$lib/server/auth/jwt'
import { prisma } from '$lib/server/prisma'

// Para producción, usa bcrypt o argon2
// import bcrypt from 'bcrypt'

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { email, password } = await request.json()

    // Validaciones básicas
    if (!email || !password) {
      return json({
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      }, { status: 400 })
    }

    // Buscar usuario por email o username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { username: email } // Permitir login con username también
        ]
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        verified: true,
        role: true
        // passwordHash: true  // En producción, agregar este campo
      }
    })

    if (!user) {
      return json({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      }, { status: 401 })
    }

    // TODO: En producción, verificar password con bcrypt
    // const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    // if (!isValidPassword) {
    //   throw error(401, {
    //     message: 'Invalid credentials',
    //     code: 'INVALID_CREDENTIALS'
    //   })
    // }

    // Determinar rol (si no existe en la tabla, asignar 'user')
    const userRole = (user.role as any) || 'user'

    // Generar tokens JWT
    const accessToken = await generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email || undefined,
      role: userRole
    })

    const refreshToken = await generateRefreshToken({
      userId: user.id,
      username: user.username,
      email: user.email || undefined,
      role: userRole
    })

    // TODO: En producción, guardar refreshToken en la base de datos
    // await prisma.refreshToken.create({
    //   data: {
    //     token: refreshToken,
    //     userId: user.id,
    //     expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    //   }
    // })

    // Retornar tokens y datos del usuario
    return json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        userId: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: userRole
      }
    })

  } catch (err) {
    console.error('Login error:', err)
    return json({
      message: 'Login failed',
      code: 'LOGIN_ERROR'
    }, { status: 500 })
  }
}
