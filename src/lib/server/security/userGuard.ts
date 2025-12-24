/**
 * User Guard - Sistema de verificación server-side
 * 
 * Verifica en cada acción:
 * - Token válido
 * - Usuario +16 años
 * - Cuenta no baneada
 * - Cuenta no shadowbanned (silenciosamente)
 */

import { error } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface UserContext {
    userId: number;
    username: string;
    email: string;
    role: string;
    verified: boolean;
    isBanned: boolean;
    isShadowbanned: boolean;
    isSuspect: boolean;
    suspectScore: number;
    isOver16: boolean;
}

export interface GuardResult {
    user: UserContext;
    isShadowbanned: boolean;  // Para que el endpoint sepa si debe "fingir"
}

/**
 * Extrae userId del token JWT
 */
export function getUserIdFromToken(authHeader: string | null): number | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
        return decoded.userId;
    } catch {
        return null;
    }
}

/**
 * Verificación COMPLETA del usuario para acciones críticas
 * 
 * Uso:
 * ```
 * const { user, isShadowbanned } = await guardUserAction(request);
 * 
 * if (isShadowbanned) {
 *     // Fingir éxito pero no hacer nada real
 *     return json({ success: true });
 * }
 * 
 * // Proceder con la acción real
 * ```
 */
export async function guardUserAction(
    request: Request,
    options: {
        requireAge?: boolean;      // Requiere verificación +16
        allowShadowbanned?: boolean;  // Si true, no lanzar error pero indicar
    } = {}
): Promise<GuardResult> {
    const { requireAge = true, allowShadowbanned = true } = options;

    // 1. Verificar token
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    if (!userId) {
        throw error(401, 'No autorizado');
    }

    // 2. Obtener usuario completo con consentimiento
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            consent: true
        }
    });

    if (!user) {
        throw error(401, 'Usuario no encontrado');
    }

    // 3. Verificar si está baneado (esto SÍ se le muestra)
    if (user.isBanned) {
        throw error(403, 'Tu cuenta ha sido suspendida');
    }

    // 4. Verificar edad +16 si se requiere
    const isOver16 = user.consent?.isOver16 ?? false;
    if (requireAge && !isOver16) {
        throw error(403, 'Debes confirmar que tienes al menos 16 años');
    }

    // 5. Verificar consentimiento de términos
    const termsAccepted = user.consent?.termsAccepted ?? false;
    const privacyAccepted = user.consent?.privacyAccepted ?? false;
    if (requireAge && (!termsAccepted || !privacyAccepted)) {
        throw error(403, 'Debes aceptar los términos de uso');
    }

    // 6. Actualizar última actividad
    await prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() }
    }).catch(() => { });  // No fallar si esto falla

    // 7. Preparar contexto
    const userContext: UserContext = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        verified: user.verified,
        isBanned: user.isBanned,
        isShadowbanned: user.isShadowbanned,
        isSuspect: user.isSuspect,
        suspectScore: user.suspectScore,
        isOver16
    };

    // 8. Si está shadowbanned, NO lanzar error pero indicarlo
    // El endpoint decide qué hacer (fingir éxito)
    return {
        user: userContext,
        isShadowbanned: user.isShadowbanned
    };
}

/**
 * Verificación LIGERA solo para lectura (no modifica nada)
 */
export async function guardUserRead(request: Request): Promise<UserContext | null> {
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    if (!userId) return null;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { consent: true }
    });

    if (!user || user.isBanned) return null;

    return {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        verified: user.verified,
        isBanned: user.isBanned,
        isShadowbanned: user.isShadowbanned,
        isSuspect: user.isSuspect,
        suspectScore: user.suspectScore,
        isOver16: user.consent?.isOver16 ?? false
    };
}

/**
 * Incrementar puntuación de sospecha
 */
export async function incrementSuspectScore(
    userId: number,
    points: number = 1,
    reason?: string
): Promise<void> {
    const user = await prisma.user.update({
        where: { id: userId },
        data: {
            suspectScore: { increment: points },
            isSuspect: true  // Marcar como sospechoso automáticamente
        }
    });

    // Si supera umbral, shadowban automático
    if (user.suspectScore >= 50) {
        await prisma.user.update({
            where: { id: userId },
            data: { isShadowbanned: true }
        });
        console.log(`[Security] User ${userId} shadowbanned (score: ${user.suspectScore})`);
    }

    if (reason) {
        console.log(`[Security] User ${userId} suspect +${points}: ${reason}`);
    }
}

/**
 * Verificar si una acción debe ser "fingida" (shadowban effect)
 */
export function shouldFakeAction(guard: GuardResult): boolean {
    return guard.isShadowbanned;
}
