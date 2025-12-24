/**
 * Sistema de Detección de Comportamiento Sospechoso
 * 
 * Los bots no se comportan como humanos.
 * Este sistema detecta patrones anómalos y acumula "puntos de sospecha".
 */

import { prisma } from '$lib/server/prisma';

interface ActionRecord {
    timestamp: number;
    action: string;
    metadata?: Record<string, unknown>;
}

// Store en memoria para tracking de acciones recientes
const userActionHistory = new Map<number, ActionRecord[]>();

// Configuración de detección
const BEHAVIOR_CONFIG = {
    // Ventana de tiempo para análisis (5 minutos)
    analysisWindow: 5 * 60 * 1000,

    // Umbrales de sospecha
    thresholds: {
        // Votar más de 20 veces en 60 segundos
        rapidVoting: { count: 20, windowMs: 60000, points: 10 },

        // Comentar más de 5 veces en 30 segundos
        rapidCommenting: { count: 5, windowMs: 30000, points: 15 },

        // Seguir más de 20 usuarios en 60 segundos
        rapidFollowing: { count: 20, windowMs: 60000, points: 10 },

        // Crear más de 3 encuestas en 60 segundos
        rapidPollCreation: { count: 3, windowMs: 60000, points: 20 },

        // Acciones sin tiempo mínimo de lectura (menos de 500ms entre acciones)
        noReadTime: { minMs: 500, points: 5 },

        // Misma acción repetitiva
        repetitiveAction: { count: 10, windowMs: 60000, points: 8 }
    },

    // User agents sospechosos
    suspiciousUserAgents: [
        'curl', 'wget', 'python-requests', 'axios', 'node-fetch',
        'go-http-client', 'java', 'httpie', 'postman'
    ]
};

/**
 * Registra una acción del usuario para análisis
 */
export function recordUserAction(
    userId: number,
    action: string,
    metadata?: Record<string, unknown>
): void {
    const now = Date.now();
    const record: ActionRecord = { timestamp: now, action, metadata };

    let history = userActionHistory.get(userId);
    if (!history) {
        history = [];
        userActionHistory.set(userId, history);
    }

    history.push(record);

    // Limpiar acciones antiguas
    const cutoff = now - BEHAVIOR_CONFIG.analysisWindow;
    userActionHistory.set(
        userId,
        history.filter(r => r.timestamp > cutoff)
    );
}

/**
 * Analiza el comportamiento del usuario y retorna puntos de sospecha
 */
export function analyzeUserBehavior(
    userId: number,
    currentAction: string,
    userAgent?: string
): { suspectPoints: number; reasons: string[] } {
    const reasons: string[] = [];
    let suspectPoints = 0;

    const history = userActionHistory.get(userId) || [];
    const now = Date.now();

    // 1. Detectar user agent sospechoso
    if (userAgent) {
        const ua = userAgent.toLowerCase();
        for (const suspicious of BEHAVIOR_CONFIG.suspiciousUserAgents) {
            if (ua.includes(suspicious)) {
                suspectPoints += 15;
                reasons.push(`User agent sospechoso: ${suspicious}`);
                break;
            }
        }
    }

    // 2. Detectar acciones rápidas sin tiempo de lectura
    if (history.length > 0) {
        const lastAction = history[history.length - 1];
        const timeSinceLastAction = now - lastAction.timestamp;

        if (timeSinceLastAction < BEHAVIOR_CONFIG.thresholds.noReadTime.minMs) {
            suspectPoints += BEHAVIOR_CONFIG.thresholds.noReadTime.points;
            reasons.push(`Acción muy rápida: ${timeSinceLastAction}ms`);
        }
    }

    // 3. Detectar acciones repetitivas por tipo
    const actionCounts = new Map<string, number>();
    for (const record of history) {
        actionCounts.set(record.action, (actionCounts.get(record.action) || 0) + 1);
    }

    // 4. Verificar umbrales específicos por acción
    const recentVotes = history.filter(
        r => r.action === 'vote' && now - r.timestamp < BEHAVIOR_CONFIG.thresholds.rapidVoting.windowMs
    );
    if (recentVotes.length >= BEHAVIOR_CONFIG.thresholds.rapidVoting.count) {
        suspectPoints += BEHAVIOR_CONFIG.thresholds.rapidVoting.points;
        reasons.push(`Votación rápida: ${recentVotes.length} votos en ${BEHAVIOR_CONFIG.thresholds.rapidVoting.windowMs / 1000}s`);
    }

    const recentComments = history.filter(
        r => r.action === 'comment' && now - r.timestamp < BEHAVIOR_CONFIG.thresholds.rapidCommenting.windowMs
    );
    if (recentComments.length >= BEHAVIOR_CONFIG.thresholds.rapidCommenting.count) {
        suspectPoints += BEHAVIOR_CONFIG.thresholds.rapidCommenting.points;
        reasons.push(`Comentando rápido: ${recentComments.length} comentarios`);
    }

    const recentFollows = history.filter(
        r => r.action === 'follow' && now - r.timestamp < BEHAVIOR_CONFIG.thresholds.rapidFollowing.windowMs
    );
    if (recentFollows.length >= BEHAVIOR_CONFIG.thresholds.rapidFollowing.count) {
        suspectPoints += BEHAVIOR_CONFIG.thresholds.rapidFollowing.points;
        reasons.push(`Siguiendo rápido: ${recentFollows.length} follows`);
    }

    const recentPolls = history.filter(
        r => r.action === 'poll_create' && now - r.timestamp < BEHAVIOR_CONFIG.thresholds.rapidPollCreation.windowMs
    );
    if (recentPolls.length >= BEHAVIOR_CONFIG.thresholds.rapidPollCreation.count) {
        suspectPoints += BEHAVIOR_CONFIG.thresholds.rapidPollCreation.points;
        reasons.push(`Creación rápida de encuestas: ${recentPolls.length}`);
    }

    // 5. Detectar acciones muy repetitivas
    for (const [action, count] of actionCounts) {
        if (count >= BEHAVIOR_CONFIG.thresholds.repetitiveAction.count) {
            suspectPoints += BEHAVIOR_CONFIG.thresholds.repetitiveAction.points;
            reasons.push(`Acción repetitiva: ${action} x${count}`);
        }
    }

    return { suspectPoints, reasons };
}

/**
 * Procesa comportamiento sospechoso y actualiza usuario si necesario
 */
export async function processUserBehavior(
    userId: number,
    action: string,
    userAgent?: string
): Promise<{ shouldBlock: boolean; isShadowbanned: boolean }> {
    // Registrar acción
    recordUserAction(userId, action);

    // Analizar comportamiento
    const { suspectPoints, reasons } = analyzeUserBehavior(userId, action, userAgent);

    if (suspectPoints > 0) {
        // Actualizar puntuación en BD
        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                suspectScore: { increment: suspectPoints },
                isSuspect: suspectPoints >= 10  // Marcar como sospechoso si acumula puntos
            }
        });

        if (reasons.length > 0) {
            console.log(`[Behavior] User ${userId}: +${suspectPoints} points`, reasons);
        }

        // Shadowban automático si supera umbral
        if (user.suspectScore >= 50 && !user.isShadowbanned) {
            await prisma.user.update({
                where: { id: userId },
                data: { isShadowbanned: true }
            });
            console.log(`[Behavior] User ${userId} auto-shadowbanned (score: ${user.suspectScore})`);
            return { shouldBlock: false, isShadowbanned: true };
        }

        // Bloquear temporalmente si acción muy sospechosa
        if (suspectPoints >= 20) {
            return { shouldBlock: true, isShadowbanned: user.isShadowbanned };
        }

        return { shouldBlock: false, isShadowbanned: user.isShadowbanned };
    }

    return { shouldBlock: false, isShadowbanned: false };
}

/**
 * Limpiar historial de usuarios inactivos (ejecutar periódicamente)
 */
export function cleanupBehaviorHistory(): number {
    const now = Date.now();
    const cutoff = now - BEHAVIOR_CONFIG.analysisWindow * 2;
    let cleaned = 0;

    for (const [userId, history] of userActionHistory.entries()) {
        if (history.length === 0 || history[history.length - 1].timestamp < cutoff) {
            userActionHistory.delete(userId);
            cleaned++;
        }
    }

    return cleaned;
}

// Limpiar cada 15 minutos
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const cleaned = cleanupBehaviorHistory();
        if (cleaned > 0) {
            console.log(`[Behavior] Cleaned ${cleaned} inactive user histories`);
        }
    }, 15 * 60 * 1000);
}
