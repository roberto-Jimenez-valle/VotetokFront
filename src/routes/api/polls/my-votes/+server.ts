import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { encodePollId, encodeOptionId } from '$lib/server/hashids';

/**
 * GET /api/polls/my-votes?pollIds=1,2,3
 * Obtiene los votos del usuario actual para las encuestas especificadas
 */
export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    const pollIdsParam = url.searchParams.get('pollIds');
    const pollIds = pollIdsParam
      ? pollIdsParam.split(',').map(id => Number(id.trim())).filter(id => !isNaN(id))
      : [];

    // Obtener userId del JWT - autenticación obligatoria
    const userId = locals.user?.userId;

    if (!userId) {
      // Usuario no autenticado - no tiene votos
      return json({ data: [] });
    }

    // Si hay IDs, filtrar. Si no, traer los últimos N votos.
    const where: any = { userId: Number(userId) };
    if (pollIds.length > 0) {
      where.pollId = { in: pollIds };
    }

    // Buscar votos del usuario
    const votes = await prisma.vote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200, // Limite razonable para feed
      include: {
        poll: { select: { id: true, type: true } },
        option: {
          select: {
            id: true,
            optionKey: true,
          }
        }
      }
    });

    // Transformar a formato esperado por fetchUserVotes
    const formattedVotes = votes.map(vote => ({
      pollId: vote.pollId,
      optionId: vote.optionId,
      poll: {
        hashId: encodePollId(vote.pollId),
      },
      option: {
        hashId: encodeOptionId(vote.optionId || 0), // optionId should not be null usually
      }
    }));

    return json({ data: formattedVotes });
  } catch (error) {
    console.error('[API my-votes] Error:', error);
    return json({ data: {}, error: 'Failed to get user votes' }, { status: 500 });
  }
};
