import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { parsePollIdInternal } from '$lib/server/hashids';

/**
 * POST /api/polls/[id]/hide
 * Ocultar una encuesta (no me interesa)
 */
export const POST: RequestHandler = async ({ params, locals }) => {
  try {
    const pollId = parsePollIdInternal(params.id);
    
    if (!pollId) {
      throw error(400, 'ID de encuesta inválido');
    }
    
    const userId = locals.user?.userId || locals.user?.id;
    if (!userId) {
      throw error(401, 'Debes iniciar sesión');
    }
    
    // Verificar que la encuesta existe
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { id: true }
    });
    
    if (!poll) {
      throw error(404, 'Encuesta no encontrada');
    }
    
    // Verificar si ya está oculta
    const existingHide = await prisma.pollInteraction.findUnique({
      where: {
        pollId_userId_interactionType: {
          pollId,
          userId: Number(userId),
          interactionType: 'hide'
        }
      }
    });
    
    if (existingHide) {
      return json({ success: true, message: 'Ya oculta' });
    }
    
    // Crear el registro de ocultar
    await prisma.pollInteraction.create({
      data: {
        pollId,
        userId: Number(userId),
        interactionType: 'hide'
      }
    });
    
    return json({ success: true, message: 'Encuesta ocultada' });
  } catch (err: any) {
    console.error('[Hide] Error:', err);
    if (err.status) throw err;
    throw error(500, `Error al ocultar: ${err.message}`);
  }
};

/**
 * DELETE /api/polls/[id]/hide
 * Mostrar de nuevo una encuesta oculta
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const pollId = parsePollIdInternal(params.id);
    
    if (!pollId) {
      throw error(400, 'ID de encuesta inválido');
    }
    
    const userId = locals.user?.userId || locals.user?.id;
    if (!userId) {
      throw error(401, 'Debes iniciar sesión');
    }
    
    const existingHide = await prisma.pollInteraction.findUnique({
      where: {
        pollId_userId_interactionType: {
          pollId,
          userId: Number(userId),
          interactionType: 'hide'
        }
      }
    });
    
    if (existingHide) {
      await prisma.pollInteraction.delete({
        where: { id: existingHide.id }
      });
    }
    
    return json({ success: true, message: 'Encuesta visible de nuevo' });
  } catch (err: any) {
    console.error('[Hide DELETE] Error:', err);
    if (err.status) throw err;
    throw error(500, `Error: ${err.message}`);
  }
};
