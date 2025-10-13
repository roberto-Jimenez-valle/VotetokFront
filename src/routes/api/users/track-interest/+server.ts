import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

/**
 * POST /api/users/track-interest
 * Rastrea interacciones del usuario para mejorar recomendaciones
 * 
 * Body: {
 *   userId: number,
 *   pollId: number,
 *   interactionType: 'view' | 'vote' | 'comment' | 'share' | 'like'
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId, pollId, interactionType } = await request.json();

    if (!userId || !pollId || !interactionType) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Obtener la encuesta para conocer su categoría y hashtags
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        hashtags: {
          include: { hashtag: true }
          }
      }
    });

    if (!poll) {
      return json({ error: 'Poll not found' }, { status: 404 });
    }

    // Peso de cada tipo de interacción
    const interactionWeights = {
      view: 0.1,
      vote: 1.0,
      comment: 0.8,
      share: 0.6,
      like: 0.4,
    };

    const weight = interactionWeights[interactionType as keyof typeof interactionWeights] || 0.1;

    // Actualizar o crear interés en la categoría
    if (poll.category) {
      const existingInterest = await prisma.userInterest.findUnique({
        where: {
          userId_category: {
            userId,
            category: poll.category,
          },
        },
      });

      if (existingInterest) {
        // Incrementar score existente
        await prisma.userInterest.update({
          where: { id: existingInterest.id },
          data: {
            score: existingInterest.score + weight,
            updatedAt: new Date(),
          },
        });
      } else {
        // Crear nuevo interés
        await prisma.userInterest.create({
          data: {
            userId,
            category: poll.category,
            score: weight,
          },
        });
      }
    }

    return json({
      success: true,
      message: 'Interest tracked successfully',
      category: poll.category,
      weight,
    });
  } catch (error) {
    console.error('[API] Error tracking interest:', error);
    return json({ error: 'Failed to track interest' }, { status: 500 });
  }
};
