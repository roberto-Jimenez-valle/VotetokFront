import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { encodePollId, encodeUserId, encodeOptionId } from '$lib/server/hashids';

/**
 * GET /api/polls/trending-by-region?region=Global&limit=5&hours=720
 * Obtiene las encuestas más trending de una región específica
 * 
 * Parámetros:
 * - region: "Global" para todas, o código ISO de país (ej: "ESP", "USA")
 * - limit: número máximo de encuestas (1-20)
 * - hours: ventana de tiempo en horas (default: 720 = 30 días)
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const region = url.searchParams.get('region') || 'Global';
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') ?? '10')));
    const hoursAgo = Number(url.searchParams.get('hours') ?? '720'); // 30 días por defecto

    const dateLimit = new Date();
    dateLimit.setHours(dateLimit.getHours() - hoursAgo);

    const isGlobal = region === 'Global' || region === 'global';

    // Construir filtro base
    const baseWhere: any = {
      status: 'active',
      isRell: false,
      createdAt: {
        gte: dateLimit,
      },
    };

    // Si es una región específica (país), filtrar encuestas que tengan votos en ese país
    if (!isGlobal) {
      // Buscar encuestas que tengan al menos un voto en el país especificado
      // El país se identifica por el prefijo del subdivisionId (ej: "ESP.1" para España)
      // Añadimos el punto para asegurar match exacto del país (ESP. no ESPx)
      const countryPrefix = `${region.toUpperCase()}.`;
      baseWhere.votes = {
        some: {
          subdivision: {
            subdivisionId: {
              startsWith: countryPrefix,
            },
          },
        },
      };
    }

    // Obtener encuestas activas de la región
    const polls = await prisma.poll.findMany({
      where: baseWhere,
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
        // Si es región específica, también obtener conteo de votos en esa región
        ...(isGlobal ? {} : {
          votes: {
            where: {
              subdivision: {
                subdivisionId: {
                  startsWith: `${region.toUpperCase()}.`,
                },
              },
            },
            select: {
              id: true,
            },
          },
        }),
      },
      orderBy: [
        { votes: { _count: 'desc' } },
        { createdAt: 'desc' }
      ],
    });

    // Calcular score de trending (usando votos de la región si es específica)
    const pollsWithScore = polls.map((poll: any) => {
      // Si es región específica, usar votos de esa región; si no, usar total
      const regionalVotes = !isGlobal && poll.votes ? poll.votes.length : poll._count.votes;
      const totalVotes = poll._count.votes;
      
      const votesScore = regionalVotes;
      const viewsScore = regionalVotes * 1.5;
      const engagementRate = regionalVotes > 0 ? 2.0 : 0;
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

      // Eliminar el array de votes del resultado final para no enviar datos innecesarios
      const { votes: _, ...pollWithoutVotes } = poll;

      return {
        ...pollWithoutVotes,
        trendingScore: Math.round(trendingScore),
        regionalVotes: !isGlobal ? regionalVotes : undefined,
      };
    });

    // Ordenar por score y tomar los top
    // Agregar hashIds para URLs públicas
    const trendingPolls = pollsWithScore
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit)
      .map(poll => ({
        ...poll,
        hashId: encodePollId(poll.id),
        user: poll.user ? {
          ...poll.user,
          hashId: encodeUserId(poll.user.id),
        } : null,
        options: poll.options.map((option: any) => ({
          ...option,
          hashId: encodeOptionId(option.id),
          voteCount: option._count.votes,
          avatarUrl: option.createdBy?.avatarUrl || null,
          createdBy: option.createdBy ? {
            ...option.createdBy,
            hashId: encodeUserId(option.createdBy.id),
          } : null,
        }))
      }));

    return json({
      data: trendingPolls,
      meta: {
        region,
        isGlobal,
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
