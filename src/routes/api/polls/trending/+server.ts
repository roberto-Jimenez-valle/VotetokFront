import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/polls/trending
 * Obtiene las encuestas más relevantes (trending topics)
 * Calcula un score basado en votos recientes, vistas y engagement
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const limit = Math.min(10, Math.max(1, Number(url.searchParams.get('limit') ?? '5')));
    const hoursAgo = Number(url.searchParams.get('hours') ?? '24'); // Últimas 24 horas por defecto

    // Calcular fecha límite
    const dateLimit = new Date();
    dateLimit.setHours(dateLimit.getHours() - hoursAgo);

    // Obtener todas las encuestas activas (excluyendo rells)
    const polls = await prisma.poll.findMany({
      where: {
        status: 'active',
        isRell: false, // Excluir rells del trending
        createdAt: {
          gte: dateLimit, // Solo encuestas recientes
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
        createdAt: true,
        updatedAt: true,
        closedAt: true,
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
          include: {
            createdBy: {
              select: {
                id: true,
                avatarUrl: true,
                displayName: true
              }
            },
            _count: {
              select: {
                votes: true
              }
            }
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

    // Calcular score de trending para cada encuesta
    const pollsWithScore = polls.map(poll => {
      // Factores del score:
      // 1. Votos totales (peso: 1.0) - calculado desde _count.votes
      const totalVotes = poll._count.votes;
      const votesScore = totalVotes;
      
      // 2. Vistas (peso: 0.5) - campo legacy, usar votos como proxy
      const viewsScore = totalVotes * 1.5; // Asumir 3x visualizaciones por voto
      
      // 3. Engagement rate (peso: 2.0)
      const engagementRate = totalVotes > 0 ? 2.0 : 0;
      
      // 4. Comentarios (peso: 3.0 - más valioso)
      const commentsScore = poll._count.comments * 3.0;
      
      // 5. Interacciones (likes, shares, etc.) (peso: 2.0)
      const interactionsScore = poll._count.interactions * 2.0;
      
      // 6. Factor de recencia (más reciente = más score)
      const hoursOld = (Date.now() - poll.createdAt.getTime()) / (1000 * 60 * 60);
      const recencyFactor = Math.max(0, 1 - (hoursOld / hoursAgo));
      
      // Score final
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
      .slice(0, limit)
      .map(poll => ({
        ...poll,
        options: poll.options.map(option => ({
          ...option,
          voteCount: option._count.votes,
          avatarUrl: option.createdBy?.avatarUrl || null
        }))
      }));

    return json({
      data: trendingPolls,
      meta: {
        hoursAgo,
        totalPolls: polls.length,
        dateLimit: dateLimit.toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Error getting trending polls:', error);
    return json({ data: [], meta: { error: 'Failed to get trending polls' } }, { status: 500 });
  }
};
