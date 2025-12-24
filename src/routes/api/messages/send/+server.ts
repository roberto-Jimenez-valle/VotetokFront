
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { createNotification } from '$lib/server/notifications';

export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        const user = locals.user;
        if (!user?.userId) {
            throw error(401, 'No autenticado');
        }

        const { recipientId, content } = await request.json();

        if (!recipientId || !content) {
            throw error(400, 'Faltan datos');
        }

        // 1. Buscar o crear conversación
        // Buscamos si ya existe una conversación entre estos dos usuarios
        let conversation = await prisma.conversation.findFirst({
            where: {
                AND: [
                    { participants: { some: { userId: user.userId } } },
                    { participants: { some: { userId: recipientId } } }
                ]
            }
        });

        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    participants: {
                        create: [
                            { userId: user.userId },
                            { userId: recipientId }
                        ]
                    }
                }
            });
        }

        // 2. Crear mensaje
        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                senderId: user.userId,
                content
            }
        });

        // 3. Notificar al receptor (Podríamos usar createNotification si agregamos tipo MESSAGE)
        // Por ahora, solo nos aseguramos de que el contador de 'unread' suba
        await prisma.conversationParticipant.updateMany({
            where: {
                conversationId: conversation.id,
                userId: recipientId
            },
            data: {
                unreadCount: { increment: 1 }
            }
        });

        // Opcional: Crear notificación de sistema visible en la campanita
        // await createNotification(recipientId, user.userId, 'MESSAGE', 'te envió un mensaje', { conversationId: conversation.id });

        return json({ success: true, data: message });

    } catch (err) {
        console.error('[API Messages] Error:', err);
        return json({ error: 'Error al enviar mensaje' }, { status: 500 });
    }
};
