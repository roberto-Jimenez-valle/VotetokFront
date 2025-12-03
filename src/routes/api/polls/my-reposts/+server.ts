import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/polls/my-reposts?pollIds=1,2,3
 * Obtiene los reposts del usuario actual para las encuestas especificadas
 */
export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    const pollIdsParam = url.searchParams.get('pollIds');
    
    if (!pollIdsParam) {
      return json({ data: {} });
    }
    
    const pollIds = pollIdsParam.split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));
    
    if (pollIds.length === 0) {
      return json({ data: {} });
    }
    
    // Obtener userId del contexto de sesión
    const userId = locals.user?.userId || locals.user?.id || null;
    
    if (!userId) {
      return json({ data: {} });
    }
    
    // Buscar reposts del usuario para las encuestas especificadas
    const reposts = await prisma.pollInteraction.findMany({
      where: {
        pollId: { in: pollIds },
        userId: Number(userId),
        interactionType: 'repost'
      },
      select: {
        pollId: true
      }
    });
    
    // Transformar a Record<pollId, boolean>
    const userReposts: Record<string, boolean> = {};
    for (const repost of reposts) {
      userReposts[repost.pollId.toString()] = true;
    }
    
    return json({ data: userReposts });
  } catch (error) {
    console.error('[API my-reposts] Error:', error);
    return json({ data: {}, error: 'Failed to get user reposts' }, { status: 500 });
  }
};
