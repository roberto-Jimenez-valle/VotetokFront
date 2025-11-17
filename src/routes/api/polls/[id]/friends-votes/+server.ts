import { json, type RequestHandler, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/polls/[id]/friends-votes?userId=X
 * Obtiene los amigos del usuario que han votado en esta encuesta, agrupados por opción
 */
export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const pollId = Number(params.id);
    const userId = Number(url.searchParams.get('userId'));

    if (!userId) {
      return json({ data: {} });
    }

    // Verificar que la encuesta existe
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { id: true },
    });

    if (!poll) {
      throw error(404, 'Poll not found');
    }

    // Obtener usuarios que sigue el usuario actual
    const following = await prisma.userFollower.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = following.map(f => f.followingId);

    if (followingIds.length === 0) {
      return json({ data: {} });
    }

    // Obtener el último voto de cada usuario seguido en esta encuesta
    // Agrupamos por userId y tomamos solo el más reciente
    const votes = await prisma.vote.findMany({
      where: {
        pollId,
        userId: { in: followingIds },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            verified: true,
          },
        },
        option: {
          select: {
            optionKey: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Más recientes primero
      },
    });

    // Agrupar por opción y eliminar duplicados
    const friendsByOption: Record<string, Array<{
      id: string;
      name: string;
      username: string;
      avatarUrl: string | null;
      verified: boolean;
    }>> = {};

    // Usar un Set para rastrear usuarios ya agregados por opción
    const addedUsersByOption: Record<string, Set<number>> = {};

    for (const vote of votes) {
      const optionKey = vote.option.optionKey;
      if (!friendsByOption[optionKey]) {
        friendsByOption[optionKey] = [];
        addedUsersByOption[optionKey] = new Set();
      }

      // Solo agregar si el usuario no ha sido agregado ya para esta opción
      if (vote.user && !addedUsersByOption[optionKey].has(vote.user.id)) {
        addedUsersByOption[optionKey].add(vote.user.id);
        friendsByOption[optionKey].push({
          id: vote.user.id.toString(),
          name: vote.user.displayName,
          username: vote.user.username,
          avatarUrl: vote.user.avatarUrl,
          verified: vote.user.verified,
        });
      }
    }

    return json({ data: friendsByOption });
  } catch (err) {
    console.error('[API] Error loading friends votes:', err);
    return json({ data: {} });
  }
};
