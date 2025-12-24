/**
 * Endpoint para renovar el Access Token usando el Refresh Token
 * POST /api/auth/refresh
 * 
 * Flujo:
 * 1. Cliente detecta que el access token está por expirar o recibe 401
 * 2. Cliente llama a este endpoint con el refresh token (en cookie o header)
 * 3. Servidor verifica el refresh token y genera nuevo access token
 * 4. Cliente recibe nuevo access token y continúa operando
 */

import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { verifyJWT, generateAccessToken, type JWTPayload } from '$lib/server/auth/jwt'
import { prisma } from '$lib/server/prisma'

export const POST: RequestHandler = async ({ cookies, request }) => {
    try {
        // 1. Obtener refresh token de cookies o header
        let refreshToken = cookies.get('voutop-refresh-token')

        // Fallback: buscar en header Authorization
        if (!refreshToken) {
            const authHeader = request.headers.get('Authorization')
            if (authHeader?.startsWith('Bearer ')) {
                // Si viene en body como { refreshToken: '...' }
                try {
                    const body = await request.json()
                    refreshToken = body.refreshToken
                } catch {
                    // No hay body JSON
                }
            }
        }

        if (!refreshToken) {
            console.log('[Auth Refresh] No refresh token provided')
            throw error(401, { message: 'No refresh token provided' })
        }

        // 2. Verificar que el refresh token sea válido
        let payload: JWTPayload
        try {
            payload = await verifyJWT(refreshToken)
            console.log('[Auth Refresh] Refresh token válido para usuario:', payload.username)
        } catch (err) {
            console.log('[Auth Refresh] Refresh token inválido o expirado')
            // Limpiar cookies si el refresh token expiró
            cookies.delete('voutop-auth-token', { path: '/' })
            cookies.delete('voutop-refresh-token', { path: '/' })
            throw error(401, { message: 'Refresh token expired or invalid. Please login again.' })
        }

        // 3. Verificar que el usuario aún existe en la base de datos
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                displayName: true,
                avatarUrl: true,
            }
        })

        if (!user) {
            console.log('[Auth Refresh] Usuario no encontrado:', payload.userId)
            cookies.delete('voutop-auth-token', { path: '/' })
            cookies.delete('voutop-refresh-token', { path: '/' })
            throw error(401, { message: 'User not found' })
        }

        // 4. Generar nuevo access token
        const newAccessToken = await generateAccessToken({
            userId: user.id,
            username: user.username,
            email: user.email || undefined,
            role: (user.role as any) || 'user',
        })

        // 5. Actualizar cookie del access token
        cookies.set('voutop-auth-token', newAccessToken, {
            path: '/',
            httpOnly: true,
            secure: request.url.startsWith('https'),
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30, // 30 días
        })

        console.log('[Auth Refresh] ✅ Nuevo access token generado para:', user.username)

        // 6. Devolver nuevo token y datos del usuario
        return json({
            success: true,
            token: newAccessToken,
            user: {
                userId: user.id,
                username: user.username,
                email: user.email,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                role: user.role || 'user',
            }
        })

    } catch (err: any) {
        console.error('[Auth Refresh] Error:', err)

        // Re-throw SvelteKit errors
        if (err.status) {
            throw err
        }

        throw error(500, { message: 'Internal server error during token refresh' })
    }
}
