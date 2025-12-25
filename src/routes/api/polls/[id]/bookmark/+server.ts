import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { parsePollIdInternal } from '$lib/server/hashids';

/**
 * POST /api/polls/[id]/bookmark
 * Guardar una encuesta
 */
export const POST: RequestHandler = async ({ params, locals }) => {
  try {
    const pollId = parsePollIdInternal(params.id || '');

    if (!pollId) {
      throw error(400, 'ID de encuesta inválido');
    }

    const userId = locals.user?.userId || (locals.user as any)?.id;
    if (!userId) {
      throw error(401, 'Debes iniciar sesión para guardar');
    }

    // Verificar que la encuesta existe
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { id: true }
    });

    if (!poll) {
      throw error(404, 'Encuesta no encontrada');
    }

    // Verificar si ya existe un bookmark
    const existingBookmark = await prisma.pollInteraction.findUnique({
      where: {
        pollId_userId_interactionType: {
          pollId,
          userId: Number(userId),
          interactionType: 'bookmark'
        }
      }
    });

    if (existingBookmark) {
      throw error(400, 'Ya has guardado esta encuesta');
    }

    // Crear el bookmark
    await prisma.pollInteraction.create({
      data: {
        pollId,
        userId: Number(userId),
        interactionType: 'bookmark'
      }
    });

    // Obtener conteo actualizado
    const bookmarkCount = await prisma.pollInteraction.count({
      where: { pollId, interactionType: 'bookmark' }
    });

    return json({ success: true, bookmarkCount });
  } catch (err: any) {
    console.error('[Bookmark] Error:', err);
    if (err.status) throw err;
    throw error(500, `Error al guardar: ${err.message}`);
  }
};

/**
 * DELETE /api/polls/[id]/bookmark
 * Quitar encuesta guardada
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const pollId = parsePollIdInternal(params.id || '');

    if (!pollId) {
      throw error(400, 'ID de encuesta inválido');
    }

    const userId = locals.user?.userId || (locals.user as any)?.id;
    if (!userId) {
      throw error(401, 'Debes iniciar sesión');
    }

    const existingBookmark = await prisma.pollInteraction.findUnique({
      where: {
        pollId_userId_interactionType: {
          pollId,
          userId: Number(userId),
          interactionType: 'bookmark'
        }
      }
    });

    if (!existingBookmark) {
      throw error(404, 'No has guardado esta encuesta');
    }

    await prisma.pollInteraction.delete({
      where: { id: existingBookmark.id }
    });

    const bookmarkCount = await prisma.pollInteraction.count({
      where: { pollId, interactionType: 'bookmark' }
    });

    return json({ success: true, bookmarkCount });
  } catch (err: any) {
    console.error('[Bookmark DELETE] Error:', err);
    if (err.status) throw err;
    throw error(500, `Error al quitar guardado: ${err.message}`);
  }
};

/**
 * GET /api/polls/[id]/bookmark
 * Verificar si está guardada y obtener conteo
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const pollId = parsePollIdInternal(params.id || '');

    if (!pollId) {
      throw error(400, 'ID de encuesta inválido');
    }

    const userId = locals.user?.userId || (locals.user as any)?.id;

    const bookmarkCount = await prisma.pollInteraction.count({
      where: { pollId, interactionType: 'bookmark' }
    });

    let hasBookmarked = false;
    if (userId) {
      const userBookmark = await prisma.pollInteraction.findUnique({
        where: {
          pollId_userId_interactionType: {
            pollId,
            userId: Number(userId),
            interactionType: 'bookmark'
          }
        }
      });
      hasBookmarked = !!userBookmark;
    }

    return json({ bookmarkCount, hasBookmarked });
  } catch (err: any) {
    console.error('[Bookmark GET] Error:', err);
    if (err.status) throw err;
    throw error(500, `Error al obtener guardados: ${err.message}`);
  }
};
