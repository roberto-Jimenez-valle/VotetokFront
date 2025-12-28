import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { parsePollIdInternal } from '$lib/server/hashids';

/**
 * POST /api/polls/[id]/view
 * Registrar una visualización de encuesta (no requiere autenticación)
 */
export const POST: RequestHandler = async ({ params, locals, getClientAddress }) => {
  try {
    const pollId = parsePollIdInternal(params.id || '');

    if (!pollId) {
      throw error(400, 'ID de encuesta inválido');
    }

    // Verificar que la encuesta existe
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { id: true }
    });

    if (!poll) {
      throw error(404, 'Encuesta no encontrada');
    }

    const userId = locals.user?.userId;
    const ip = getClientAddress();

    // Evitar duplicados: buscar view existente
    let existingView = null;

    if (userId) {
      // Usuario autenticado: buscar por userId
      existingView = await prisma.pollInteraction.findUnique({
        where: {
          pollId_userId_interactionType: {
            pollId,
            userId: Number(userId),
            interactionType: 'view'
          }
        }
      });
    } else {
      // Usuario anónimo: buscar por IP (últimas 24 horas)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      existingView = await prisma.pollInteraction.findFirst({
        where: {
          pollId,
          interactionType: 'view',
          ipAddress: ip,
          userId: null,
          createdAt: { gte: oneDayAgo }
        }
      });
    }

    if (!existingView) {
      // Crear la visualización
      await prisma.pollInteraction.create({
        data: {
          pollId,
          userId: userId ? Number(userId) : null,
          interactionType: 'view',
          ipAddress: ip
        }
      });
    }

    // Obtener conteo actualizado
    const viewCount = await prisma.pollInteraction.count({
      where: { pollId, interactionType: 'view' }
    });

    return json({ success: true, viewCount });
  } catch (err: any) {
    console.error('[View] Error:', err);
    if (err.status) throw err;
    throw error(500, `Error al registrar visualización: ${err.message}`);
  }
};

/**
 * GET /api/polls/[id]/view
 * Obtener conteo de visualizaciones
 */
export const GET: RequestHandler = async ({ params }) => {
  try {
    const pollId = parsePollIdInternal(params.id || '');

    if (!pollId) {
      throw error(400, 'ID de encuesta inválido');
    }

    const viewCount = await prisma.pollInteraction.count({
      where: { pollId, interactionType: 'view' }
    });

    return json({ viewCount });
  } catch (err: any) {
    console.error('[View GET] Error:', err);
    if (err.status) throw err;
    throw error(500, `Error al obtener visualizaciones: ${err.message}`);
  }
};
