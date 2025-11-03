import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/polls/trending-aggregated-data
 * 
 * Retorna trending polls con sus votos agregados por subdivisión en UNA sola petición
 * 
 * Query params:
 * - region: nombre de la región (ej: "Spain", "Andalucía")
 * - country: código ISO3 del país (ej: "ESP")
 * - limit: número de encuestas (default: 20)
 * 
 * Optimización: En lugar de 21 peticiones (1 trending + 20 votes-by-subdivisions),
 * hace todo en una sola petición con una query SQL agregada.
 */
export const GET: RequestHandler = async ({ url }) => {
  const region = url.searchParams.get('region') || '';
  const country = url.searchParams.get('country') || '';
  const limit = parseInt(url.searchParams.get('limit') || '20');

  console.log('[API] 📊 trending-aggregated-data:', { region, country, limit });

  try {
    // 1. Obtener trending polls para la región
    const trendingPolls = await prisma.poll.findMany({
      where: {
        OR: [
          {
            user: {
              countryIso3: country
            }
          },
          {
            votes: {
              some: {
                subdivision: {
                  countryIso3: country
                }
              }
            }
          }
        ],
        status: 'active'
      },
      include: {
        options: {
          include: {
            _count: {
              select: {
                votes: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            verified: true
          }
        },
        _count: {
          select: {
            votes: true,
            comments: true
          }
        }
      },
      orderBy: [
        { votes: { _count: 'desc' } },
        { createdAt: 'desc' }
      ],
      take: limit
    });

    console.log('[API] ✅ Found', trendingPolls.length, 'trending polls');

    if (trendingPolls.length === 0) {
      return json({
        data: {
          polls: [],
          aggregatedVotes: {}
        }
      });
    }

    const pollIds = trendingPolls.map(p => p.id);

    // 2. Obtener TODOS los votos agregados en UNA sola query SQL
    // Agrupa por poll_id, subdivision y option_key
    const aggregatedVotesRaw = await prisma.$queryRaw<Array<{
      poll_id: number;
      subdivision_id: string;
      option_key: string;
      vote_count: bigint;
    }>>`
      SELECT 
        v.poll_id,
        s.hierarchical_id as subdivision_id,
        po.option_key,
        COUNT(*) as vote_count
      FROM votes v
      INNER JOIN subdivisions s ON v.subdivision_id = s.subdivision_id
      INNER JOIN poll_options po ON v.option_id = po.option_id
      WHERE 
        v.poll_id IN (${prisma.$raw(pollIds.join(','))})
        AND s.country_iso3 = ${country}
        AND s.level = 1
      GROUP BY v.poll_id, s.hierarchical_id, po.option_key
      ORDER BY s.hierarchical_id, v.poll_id
    `;

    console.log('[API] 📊 Aggregated', aggregatedVotesRaw.length, 'vote groups');

    // 3. Transformar a estructura: { "ESP.1": { "poll_123": 1500, "poll_124": 800 } }
    const aggregatedVotes: Record<string, Record<string, number>> = {};
    
    for (const row of aggregatedVotesRaw) {
      const subdivisionId = row.subdivision_id;
      const pollKey = `poll_${row.poll_id}`;
      
      if (!aggregatedVotes[subdivisionId]) {
        aggregatedVotes[subdivisionId] = {};
      }
      
      if (!aggregatedVotes[subdivisionId][pollKey]) {
        aggregatedVotes[subdivisionId][pollKey] = 0;
      }
      
      // Convertir bigint a number
      aggregatedVotes[subdivisionId][pollKey] += Number(row.vote_count);
    }

    // 4. Añadir colores a las encuestas
    const pollColors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
      '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'
    ];

    const pollsWithColors = trendingPolls.map((poll, i) => ({
      id: poll.id,
      question: poll.question,
      title: poll.title,
      description: poll.description,
      status: poll.status,
      createdAt: poll.createdAt,
      options: poll.options.map(opt => ({
        id: opt.id,
        optionKey: opt.optionKey,
        optionText: opt.optionText,
        color: opt.color,
        imageUrl: opt.imageUrl,
        votes: opt._count.votes
      })),
      user: poll.user,
      color: pollColors[i % pollColors.length],
      totalVotes: poll._count.votes,
      commentsCount: poll._count.comments
    }));

    console.log('[API] ✅ Returning', pollsWithColors.length, 'polls with aggregated data');

    return json({
      data: {
        polls: pollsWithColors,
        aggregatedVotes: aggregatedVotes
      }
    });

  } catch (error) {
    console.error('[API] ❌ Error loading trending aggregated data:', error);
    return json(
      { 
        error: 'Failed to load trending aggregated data',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
};
