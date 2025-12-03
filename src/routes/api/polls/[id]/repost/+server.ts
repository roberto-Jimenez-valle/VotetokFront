import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

/**
 * POST /api/polls/[id]/repost
 * Republicar una encuesta (crear repost)
 */
export const POST: RequestHandler = async ({ params, locals }) => {
  try {
    const pollId = Number(params.id);
    
    if (isNaN(pollId)) {
      throw error(400, 'ID de encuesta inválido');
    }
    
    // Verificar autenticación
    const userId = locals.user?.userId || locals.user?.id;
    if (!userId) {
      throw error(401, 'Debes iniciar sesión para republicar');
    }
    
    // Verificar que la encuesta existe
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { id: true, userId: true }
    });
    
    if (!poll) {
      throw error(404, 'Encuesta no encontrada');
    }
    
    // No permitir republicar tu propia encuesta
    if (poll.userId === Number(userId)) {
      throw error(400, 'No puedes republicar tu propia encuesta');
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
      throw error(400, 'Ya has republicado esta encuesta');
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
    if (err.status) throw err;
    throw error(500, `Error al republicar: ${err.message}`);
  }
};

/**
 * DELETE /api/polls/[id]/repost
 * Eliminar repost de una encuesta
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const pollId = Number(params.id);
    
    if (isNaN(pollId)) {
      throw error(400, 'ID de encuesta inválido');
    }
    
    // Verificar autenticación
    const userId = locals.user?.userId || locals.user?.id;
    if (!userId) {
      throw error(401, 'Debes iniciar sesión');
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
      throw error(404, 'No has republicado esta encuesta');
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
    if (err.status) throw err;
    throw error(500, `Error al eliminar repost: ${err.message}`);
  }
};

/**
 * GET /api/polls/[id]/repost
 * Verificar si el usuario ha republicado y obtener conteo
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const pollId = Number(params.id);
    
    if (isNaN(pollId)) {
      throw error(400, 'ID de encuesta inválido');
    }
    
    const userId = locals.user?.userId || locals.user?.id;
    
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
