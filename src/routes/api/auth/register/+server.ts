/**
 * Endpoint de registro
 * POST /api/auth/register
 */

import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { generateAccessToken, generateRefreshToken } from '$lib/server/auth/jwt'
import { prisma } from '$lib/server/prisma'

// Para producción, usa bcrypt o argon2
// import bcrypt from 'bcrypt'

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { username, email, password, displayName } = await request.json()

    // Validaciones básicas
    if (!username || !email || !password) {
      throw error(400, {
        message: 'Username, email and password are required',
        code: 'MISSING_FIELDS'
      })
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw error(400, {
        message: 'Invalid email format',
        code: 'INVALID_EMAIL'
      })
    }

    // Validar username (alfanumérico, guiones bajos)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
    if (!usernameRegex.test(username)) {
      throw error(400, {
        message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores',
        code: 'INVALID_USERNAME'
      })
    }

    // Verificar que username no exista
    const existingUsername = await prisma.user.findUnique({
      where: { username }
    })

    if (existingUsername) {
      throw error(409, {
        message: 'Username already taken',
        code: 'USERNAME_EXISTS'
      })
    }

    // Verificar que email no exista
    const existingEmail = await prisma.user.findFirst({
      where: { email }
    })

    if (existingEmail) {
      throw error(409, {
        message: 'Email already registered',
        code: 'EMAIL_EXISTS'
      })
    }

    // TODO: En producción, hashear password con bcrypt/argon2
    // const passwordHash = await bcrypt.hash(password, 10)

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        username,
        email,
        displayName: displayName || username,
        // passwordHash, // En producción
        verified: false,
        role: 'user' as any // Cast necesario si el enum no está definido en Prisma
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        verified: true
      }
    })

    // Generar tokens JWT
    const accessToken = await generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email || undefined,
      role: 'user'
    })

    const refreshToken = await generateRefreshToken({
      userId: user.id,
      username: user.username,
      email: user.email || undefined,
      role: 'user'
    })

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
        role: 'user'
      }
    }, { status: 201 })

  } catch (err: any) {
    console.error('[Register Error]', err)
    
    if (err.status) {
      throw err
    }
    
    throw error(500, {
      message: 'Registration failed',
      code: 'REGISTER_ERROR'
    })
  }
}
