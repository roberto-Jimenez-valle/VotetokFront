/**
 * Security Module - Exportaciones centralizadas
 * 
 * Sistema de seguridad anti-bot inspirado en Instagram/Twitter/Reddit
 * 
 * Principio clave: "Los bots no mueren en el login, mueren en la interacción"
 */

// User Guard - Verificación server-side
export {
    guardUserAction,
    guardUserRead,
    getUserIdFromToken,
    incrementSuspectScore,
    shouldFakeAction,
    type UserContext,
    type GuardResult
} from './userGuard';

// Honeypot - Campos ocultos anti-bot
export {
    detectHoneypotBot,
    isHoneypotTriggered,
    getHoneypotFieldsHTML,
    HONEYPOT_FIELDS
} from './honeypot';

// Behavior Detector - Análisis de patrones
export {
    recordUserAction,
    analyzeUserBehavior,
    processUserBehavior,
    cleanupBehaviorHistory
} from './behaviorDetector';

/**
 * Helper para respuesta shadowban
 * Simula éxito sin hacer nada real
 */
export function shadowbanResponse(data: Record<string, unknown> = {}): Response {
    return new Response(JSON.stringify({
        success: true,
        ...data
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Helper para verificación completa en endpoints
 * 
 * Uso típico:
 * ```ts
 * import { secureAction } from '$lib/server/security';
 * 
 * export const POST: RequestHandler = async ({ request }) => {
 *     const result = await secureAction(request, 'vote');
 *     
 *     if (result.blocked) {
 *         return result.response;  // Puede ser shadowban o error real
 *     }
 *     
 *     // Acción real aquí
 *     const { user } = result;
 * };
 * ```
 */
export async function secureAction(
    request: Request,
    action: string,
    options: {
        checkHoneypot?: boolean;
        requireAge?: boolean;
    } = {}
): Promise<{
    blocked: boolean;
    response?: Response;
    user?: import('./userGuard').UserContext;
    isShadowbanned?: boolean;
}> {
    const { checkHoneypot = false, requireAge = true } = options;

    // 1. Verificar honeypot si se pasa body
    if (checkHoneypot) {
        try {
            const clonedRequest = request.clone();
            const body = await clonedRequest.json();
            const { isHoneypotTriggered } = await import('./honeypot');

            if (isHoneypotTriggered(body)) {
                console.log(`[Security] Honeypot triggered for action: ${action}`);
                return {
                    blocked: true,
                    response: shadowbanResponse()
                };
            }
        } catch {
            // Si no hay body JSON, continuar
        }
    }

    // 2. Verificar usuario
    const { guardUserAction } = await import('./userGuard');
    const guard = await guardUserAction(request, { requireAge });

    // 3. Procesar comportamiento
    const { processUserBehavior } = await import('./behaviorDetector');
    const behavior = await processUserBehavior(
        guard.user.userId,
        action,
        request.headers.get('user-agent') || undefined
    );

    // 4. Si está shadowbanned, responder con éxito falso
    if (guard.isShadowbanned || behavior.isShadowbanned) {
        return {
            blocked: true,
            response: shadowbanResponse(),
            isShadowbanned: true
        };
    }

    // 5. Si comportamiento muy sospechoso, bloquear silenciosamente
    if (behavior.shouldBlock) {
        return {
            blocked: true,
            response: shadowbanResponse()
        };
    }

    return {
        blocked: false,
        user: guard.user,
        isShadowbanned: false
    };
}
