
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

// GET - Obtener conversación y mensajes con un usuario específico
export const GET: RequestHandler = async ({ params, locals }) => {
    try {
        const user = locals.user;
        if (!user?.userId) {
            throw error(401, 'No autenticado');
        }

        const targetUserId = parseInt((params as any).userId);
        if (isNaN(targetUserId)) {
            throw error(400, 'ID invalido');
        }

        // Buscar conversación
        const conversation = await prisma.conversation.findFirst({
            where: {
                AND: [
                    { participants: { some: { userId: user.userId } } },
                    { participants: { some: { userId: targetUserId } } }
                ]
            },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                    take: 50 // Últimos 50 mensajes
                },
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                displayName: true,
                                avatarUrl: true
                            }
                        }
                    }
                }
            }
        });

        if (!conversation) {
            return json({ success: true, data: null });
        }

        // Marcar como leídos para mi
        await prisma.conversationParticipant.updateMany({
            where: {
                conversationId: conversation.id,
                userId: user.userId
            },
            data: {
                unreadCount: 0
            }
        });

        return json({ success: true, data: conversation });

    } catch (err) {
        console.error('[API Conversation] Error:', err);
        return json({ error: 'Error al cargar conversación' }, { status: 500 });
    }
};
