import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { parsePollIdInternal } from '$lib/server/hashids';

/**
 * POST /api/polls/[id]/repost
 * Republicar una encuesta (crear repost)
 */// POST
export const POST: RequestHandler = async ({ params, locals }) => {
  try {
    console.log('[Repost API] POST request received for id:', params.id);
    const pollId = parsePollIdInternal(params.id || '');
    console.log('[Repost API] Parsed pollId:', pollId);

    if (!pollId) {
      console.log('[Repost API] Invalid poll ID');
      return json({ success: false, message: 'ID de encuesta inválido' }, { status: 400 });
    }

    // Verificar autenticación
    const userId = locals.user?.userId;
    console.log('[Repost API] User ID:', userId);

    if (!userId) {
      return json({ success: false, message: 'Debes iniciar sesión para republicar' }, { status: 401 });
    }

    // Verificar que la encuesta existe
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { id: true, userId: true }
    });

    if (!poll) {
      console.log('[Repost API] Poll not found');
      return json({ success: false, message: 'Encuesta no encontrada' }, { status: 404 });
    }

    // No permitir republicar tu propia encuesta
    if (poll.userId === Number(userId)) {
      console.log('[Repost API] Attempted self-repost');
      return json({ success: false, message: 'No puedes republicar tu propia encuesta' }, { status: 400 });
    }

    // Verificar si ya existe un repost
    const existingRepost = await prisma.pollInteraction.findUnique({
      where: {
        pollId_userId_interactionType: {
          pollId,
          userId: Number(userId),
          interactionType: 'repost'
        }
      }
    });

    if (existingRepost) {
      console.log('[Repost API] Already reposted');
      return json({ success: false, message: 'Ya has republicado esta encuesta' }, { status: 400 });
    }

    // Crear el repost
    const repost = await prisma.pollInteraction.create({
      data: {
        pollId,
        userId: Number(userId),
        interactionType: 'repost'
      }
    });

    // Obtener el conteo actualizado de reposts
    const repostCount = await prisma.pollInteraction.count({
      where: {
        pollId,
        interactionType: 'repost'
      }
    });

    console.log(`[Repost] ✅ Usuario ${userId} republicó encuesta ${pollId}`);

    return json({
      success: true,
      repost,
      repostCount,
      message: 'Encuesta republicada correctamente'
    });
  } catch (err: any) {
    console.error('[Repost] Error:', err);
    return json({
      success: false,
      message: err.message || 'Error al republicar'
    }, { status: err.status || 500 });
  }
};

/**
 * DELETE /api/polls/[id]/repost
 * Eliminar repost de una encuesta
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const pollId = parsePollIdInternal(params.id || '');

    if (!pollId) {
      return json({ success: false, message: 'ID de encuesta inválido' }, { status: 400 });
    }

    // Verificar autenticación
    const userId = locals.user?.userId;
    if (!userId) {
      return json({ success: false, message: 'Debes iniciar sesión' }, { status: 401 });
    }

    // Buscar el repost existente
    const existingRepost = await prisma.pollInteraction.findUnique({
      where: {
        pollId_userId_interactionType: {
          pollId,
          userId: Number(userId),
          interactionType: 'repost'
        }
      }
    });

    if (!existingRepost) {
      return json({ success: false, message: 'No has republicado esta encuesta' }, { status: 404 });
    }

    // Eliminar el repost
    await prisma.pollInteraction.delete({
      where: { id: existingRepost.id }
    });

    // Obtener el conteo actualizado
    const repostCount = await prisma.pollInteraction.count({
      where: {
        pollId,
        interactionType: 'repost'
      }
    });

    console.log(`[Repost] 🗑️ Usuario ${userId} eliminó repost de encuesta ${pollId}`);

    return json({
      success: true,
      repostCount,
      message: 'Repost eliminado correctamente'
    });
  } catch (err: any) {
    console.error('[Repost DELETE] Error:', err);
    return json({
      success: false,
      message: err.message || 'Error al eliminar repost'
    }, { status: err.status || 500 });
  }
};

/**
 * GET /api/polls/[id]/repost
 * Verificar si el usuario ha republicado y obtener conteo
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const pollId = parsePollIdInternal(params.id || '');

    if (!pollId) {
      throw error(400, 'ID de encuesta inválido');
    }

    const userId = locals.user?.userId;

    // Obtener conteo de reposts
    const repostCount = await prisma.pollInteraction.count({
      where: {
        pollId,
        interactionType: 'repost'
      }
    });

    // Verificar si el usuario actual ha republicado
    let hasReposted = false;
    if (userId) {
      const userRepost = await prisma.pollInteraction.findUnique({
        where: {
          pollId_userId_interactionType: {
            pollId,
            userId: Number(userId),
            interactionType: 'repost'
          }
        }
      });
      hasReposted = !!userRepost;
    }

    return json({
      repostCount,
      hasReposted
    });
  } catch (err: any) {
    console.error('[Repost GET] Error:', err);
    if (err.status) throw err;
    throw error(500, `Error al obtener reposts: ${err.message}`);
  }
};
