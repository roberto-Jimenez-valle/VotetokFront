import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/polls/trending-by-region?region=Spain&limit=5
 * Obtiene las encuestas más trending de una región específica
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const region = url.searchParams.get('region') || 'Global';
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') ?? '10')));
    const hoursAgo = Number(url.searchParams.get('hours') ?? '720'); // 30 días por defecto

    const dateLimit = new Date();
    dateLimit.setHours(dateLimit.getHours() - hoursAgo);

    
    // Obtener encuestas activas de la región
    const polls = await prisma.poll.findMany({
      where: {
        status: 'active',
        createdAt: {
          gte: dateLimit,
        },
      },
      select: {
        id: true,
        userId: true,
        title: true,
        description: true,
        category: true,
        imageUrl: true,
        type: true,
        status: true,
        totalVotes: true,
        totalViews: true,
        createdAt: true,
        updatedAt: true,
        closedAt: true,  // ← AGREGAR closedAt
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            verified: true,
          },
        },
        options: {
          select: {
            id: true,
            optionKey: true,
            optionLabel: true,
            color: true,
            avatarUrl: true,
            voteCount: true,
            displayOrder: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: {
            votes: true,
            comments: true,
            interactions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calcular score de trending
    const pollsWithScore = polls.map(poll => {
      const votesScore = poll.totalVotes;
      const viewsScore = poll.totalViews * 0.5;
      const engagementRate = poll.totalViews > 0 
        ? (poll.totalVotes / poll.totalViews) * 2.0 
        : 0;
      const commentsScore = poll._count.comments * 3.0;
      const interactionsScore = poll._count.interactions * 2.0;
      const hoursOld = (Date.now() - poll.createdAt.getTime()) / (1000 * 60 * 60);
      const recencyFactor = Math.max(0, 1 - (hoursOld / hoursAgo));
      
      const trendingScore = (
        votesScore + 
        viewsScore + 
        engagementRate + 
        commentsScore + 
        interactionsScore
      ) * (1 + recencyFactor);

      return {
        ...poll,
        trendingScore: Math.round(trendingScore),
      };
    });

    // Ordenar por score y tomar los top
    const trendingPolls = pollsWithScore
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);

    
    return json({
      data: trendingPolls,
      meta: {
        region,
        hoursAgo,
        totalPolls: polls.length,
        dateLimit: dateLimit.toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Error getting trending polls by region:', error);
    return json({ data: [], meta: { error: 'Failed to get trending polls' } }, { status: 500 });
  }
};
