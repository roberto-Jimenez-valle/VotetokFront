import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { requireAuth } from '$lib/server/middleware/auth';

// POST - Crear un Rell (repost) de una encuesta existente
export const POST: RequestHandler = async (event) => {
    try {
        const user = await requireAuth(event);
        const originalPollId = parseInt(event.params.id || '');

        if (isNaN(originalPollId)) {
            throw error(400, 'ID de encuesta inválido');
        }

        // Verificar que la encuesta original existe
        const originalPoll = await prisma.poll.findUnique({
            where: { id: originalPollId }
        });

        if (!originalPoll) {
            throw error(404, 'Encuesta no encontrada');
        }

        // Verificar si ya existe un rell de este usuario para esta encuesta
        const existingRell = await prisma.poll.findFirst({
            where: {
                userId: user.userId,
                isRell: true,
                originalPollId: originalPollId
            }
        });

        if (existingRell) {
            return json({ success: true, alreadyExists: true, data: existingRell });
        }

        // Crear el Rell
        const rell = await prisma.poll.create({
            data: {
                userId: user.userId,
                title: originalPoll.title, // Copiamos el título o podríamos dejarlo vacío si la UI lo maneja
                description: originalPoll.description,
                category: originalPoll.category,
                type: originalPoll.type,
                status: 'active',
                isRell: true,
                originalPollId: originalPoll.id,
                imageUrl: originalPoll.imageUrl,
                // No copiamos opciones, usamos la referencia al original
            }
        });

        // Registrar interacción (opcional, si queremos contar "reposts" en analytics)
        await prisma.pollInteraction.create({
            data: {
                pollId: originalPollId,
                userId: user.userId,
                interactionType: 'rell'
            }
        }).catch(e => console.error('Error tracking interaction:', e));

        return json({ success: true, data: rell });

    } catch (err: any) {
        console.error('Error creating rell:', err);
        return json({ error: err.message || 'Error al crear el rell' }, { status: err.status || 500 });
    }
};
