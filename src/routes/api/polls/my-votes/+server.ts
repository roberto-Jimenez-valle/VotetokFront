import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/polls/my-votes?pollIds=1,2,3
 * Obtiene los votos del usuario actual para las encuestas especificadas
 */
export const GET: RequestHandler = async ({ url, locals, getClientAddress }) => {
  try {
    const pollIdsParam = url.searchParams.get('pollIds');
    
    if (!pollIdsParam) {
      return json({ data: {} });
    }
    
    const pollIds = pollIdsParam.split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));
    
    if (pollIds.length === 0) {
      return json({ data: {} });
    }
    
    // Obtener userId del contexto de sesión o IP
    const userId = locals.user?.userId || locals.user?.id || null;
    const ipAddress = getClientAddress();
    
    if (!userId && !ipAddress) {
      return json({ data: {} });
    }
    
    // Buscar votos del usuario para las encuestas especificadas
    const votes = await prisma.vote.findMany({
      where: {
        pollId: { in: pollIds },
        OR: [
          userId ? { userId: Number(userId) } : { ipAddress },
          { ipAddress },
        ],
      },
      include: {
        option: {
          select: {
            id: true,
            optionKey: true,
          }
        }
      }
    });
    
    // Transformar a Record<pollId, optionKey>
    const userVotes: Record<string, string> = {};
    for (const vote of votes) {
      if (vote.option?.optionKey) {
        userVotes[vote.pollId.toString()] = vote.option.optionKey;
      }
    }
    
    return json({ data: userVotes });
  } catch (error) {
    console.error('[API my-votes] Error:', error);
    return json({ data: {}, error: 'Failed to get user votes' }, { status: 500 });
  }
};
