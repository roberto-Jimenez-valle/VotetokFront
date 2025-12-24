import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Obtener user ID del token
function getUserIdFromToken(authHeader: string | null): number | null {
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
 * DELETE - Eliminar cuenta de usuario (GDPR Compliant)
 * 
 * Según la Política de Privacidad y el GDPR:
 * - Se eliminarán los datos personales del usuario
 * - Se eliminará todo el contenido textual creado por el usuario
 * - Se eliminarán las encuestas creadas por el usuario
 * - Los votos se CONSERVARÁN de forma ANÓNIMA (userId = null)
 */
export const DELETE: RequestHandler = async ({ request }) => {
    const userId = getUserIdFromToken(request.headers.get('authorization'));

    if (!userId) {
        throw error(401, 'No autorizado');
    }

    try {
        // Verificar que el usuario existe
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, email: true }
        });

        if (!user) {
            throw error(404, 'Usuario no encontrado');
        }

        console.log(`[API DeleteAccount] 🗑️ Iniciando eliminación GDPR para usuario ${userId} (${user.username})`);

        // Realizar todas las eliminaciones en una transacción
        await prisma.$transaction(async (tx) => {

            // 1. ANONIMIZAR VOTOS (conservar datos agregados, eliminar PII)
            // Los votos se mantienen pero se desvinculan del usuario
            const votesUpdated = await tx.vote.updateMany({
                where: { userId },
                data: {
                    userId: null,
                    // También anonimizar IP si está presente
                    ipAddress: null,
                    userAgent: null
                }
            });
            console.log(`[API DeleteAccount] ✅ ${votesUpdated.count} votos anonimizados`);

            // 2. ELIMINAR ENCUESTAS CREADAS POR EL USUARIO
            // (Esto también eliminará en cascada: options, votes de esas encuestas, comments, etc.)
            const pollsDeleted = await tx.poll.deleteMany({
                where: { userId }
            });
            console.log(`[API DeleteAccount] ✅ ${pollsDeleted.count} encuestas eliminadas`);

            // 3. ELIMINAR OPCIONES CREADAS POR EL USUARIO EN ENCUESTAS DE OTROS
            const optionsDeleted = await tx.pollOption.deleteMany({
                where: { createdById: userId }
            });
            console.log(`[API DeleteAccount] ✅ ${optionsDeleted.count} opciones eliminadas`);

            // 4. ELIMINAR COMENTARIOS
            const commentsDeleted = await tx.comment.deleteMany({
                where: { userId }
            });
            console.log(`[API DeleteAccount] ✅ ${commentsDeleted.count} comentarios eliminados`);

            // 5. ELIMINAR MENSAJES PRIVADOS
            const messagesDeleted = await tx.message.deleteMany({
                where: { senderId: userId }
            });
            console.log(`[API DeleteAccount] ✅ ${messagesDeleted.count} mensajes eliminados`);

            // 6. ELIMINAR PARTICIPACIONES EN CONVERSACIONES
            await tx.conversationParticipant.deleteMany({
                where: { userId }
            });

            // 7. ELIMINAR NOTIFICACIONES
            await tx.notification.deleteMany({
                where: {
                    OR: [
                        { userId },
                        { actorId: userId }
                    ]
                }
            });

            // 8. ELIMINAR RELACIONES DE SEGUIMIENTO
            await tx.userFollower.deleteMany({
                where: {
                    OR: [
                        { followerId: userId },
                        { followingId: userId }
                    ]
                }
            });

            // 9. ELIMINAR INTERACCIONES CON ENCUESTAS
            await tx.pollInteraction.deleteMany({
                where: { userId }
            });

            // 10. ELIMINAR INTERESES DEL USUARIO
            await tx.userInterest.deleteMany({
                where: { userId }
            });

            // 11. ELIMINAR SEGUIMIENTO DE HASHTAGS
            await tx.userHashtagFollow.deleteMany({
                where: { userId }
            });

            // 12. ELIMINAR COLABORACIONES EN ENCUESTAS
            await tx.pollCollaborator.deleteMany({
                where: { userId }
            });

            // 13. ELIMINAR BORRADORES
            await tx.pollDraft.deleteMany({
                where: { userId }
            });

            // 14. ELIMINAR CONSENTIMIENTO
            await tx.userConsent.deleteMany({
                where: { userId }
            });

            // 15. ELIMINAR PERFIL DESTACADO SI EXISTE
            await tx.featuredUser.deleteMany({
                where: { userId }
            });

            // 16. FINALMENTE, ELIMINAR EL USUARIO
            await tx.user.delete({
                where: { id: userId }
            });

            console.log(`[API DeleteAccount] ✅ Usuario ${userId} eliminado completamente`);
        });

        console.log(`[API DeleteAccount] 🎉 Eliminación GDPR completada para usuario ${userId}`);

        return json({
            success: true,
            message: 'Tu cuenta ha sido eliminada correctamente. Todos tus datos personales y contenido han sido eliminados. Los votos se han anonimizado.',
            deletedAt: new Date().toISOString()
        });

    } catch (err) {
        console.error('[API DeleteAccount] ❌ Error eliminando cuenta:', err);

        if ((err as any)?.status) {
            throw err;
        }

        throw error(500, 'Error al eliminar la cuenta. Por favor, contacta con soporte.');
    }
};

// GET - Obtener información sobre qué se eliminará
export const GET: RequestHandler = async ({ request }) => {
    const userId = getUserIdFromToken(request.headers.get('authorization'));

    if (!userId) {
        throw error(401, 'No autorizado');
    }

    try {
        // Obtener estadísticas del usuario
        const [
            pollCount,
            voteCount,
            commentCount,
            messageCount,
            optionCount
        ] = await Promise.all([
            prisma.poll.count({ where: { userId } }),
            prisma.vote.count({ where: { userId } }),
            prisma.comment.count({ where: { userId } }),
            prisma.message.count({ where: { senderId: userId } }),
            prisma.pollOption.count({ where: { createdById: userId } })
        ]);

        return json({
            summary: {
                polls: pollCount,
                votes: voteCount,
                comments: commentCount,
                messages: messageCount,
                options: optionCount
            },
            willBeDeleted: [
                'Datos personales (nombre, email, avatar)',
                `${pollCount} encuestas creadas`,
                `${optionCount} opciones añadidas a encuestas`,
                `${commentCount} comentarios`,
                `${messageCount} mensajes privados`,
                'Historial de seguimientos',
                'Preferencias e intereses',
                'Notificaciones'
            ],
            willBeAnonymized: [
                `${voteCount} votos (se conservan de forma anónima para estadísticas)`
            ],
            warning: 'Esta acción es IRREVERSIBLE. Una vez eliminada tu cuenta, no podrás recuperar ningún dato.',
            gdprCompliance: {
                article: 'RGPD Artículo 17 - Derecho de supresión',
                description: 'Tienes derecho a que se supriman tus datos personales sin demoras indebidas.'
            }
        });

    } catch (err) {
        console.error('[API DeleteAccount] Error obteniendo resumen:', err);
        throw error(500, 'Error interno del servidor');
    }
};
