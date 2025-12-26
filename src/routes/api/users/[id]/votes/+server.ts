import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { encodePollId, encodeOptionId } from '$lib/server/hashids';

/**
 * GET /api/users/[id]/votes
 * Obtiene los votos realizados por un usuario
 */
export const GET: RequestHandler = async ({ params, url }) => {
  try {
    console.log('[API /users/[id]/votes] Request params:', params);
    const userId = parseInt(params.id);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    console.log('[API /users/[id]/votes] Fetching votes for user:', userId, 'limit:', limit, 'offset:', offset);

    if (isNaN(userId)) {
      return json(
        { success: false, error: 'ID de usuario inválido' },
        { status: 400 }
      );
    }

    // Obtener votos del usuario
    const votes = await prisma.vote.findMany({
      where: {
        userId
      },
      select: {
        id: true,
        createdAt: true,
        latitude: true,
        longitude: true,
        subdivisionId: true,
        poll: {
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            imageUrl: true,
            type: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                verified: true,
              }
            },
            options: {
              select: {
                id: true,
                optionKey: true,
                optionLabel: true,
                color: true,
                displayOrder: true,
                _count: {
                  select: {
                    votes: true
                  }
                }
              },
              orderBy: {
                displayOrder: 'asc'
              }
            },
            _count: {
              select: {
                votes: true,
                interactions: true,
                comments: true
              }
            }
          }
        },
        option: {
          select: {
            id: true,
            optionKey: true,
            optionLabel: true,
            color: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    });

    console.log('[API /users/[id]/votes] Found', votes.length, 'votes');

    // Formatear respuesta
    const formattedVotes = votes.map(vote => ({
      id: vote.id,
      createdAt: vote.createdAt,
      location: {
        latitude: vote.latitude,
        longitude: vote.longitude,
        subdivisionId: vote.subdivisionId
      },
      poll: {
        id: vote.poll.id,
        hashId: encodePollId(vote.poll.id),
        title: vote.poll.title,
        description: vote.poll.description,
        category: vote.poll.category,
        imageUrl: vote.poll.imageUrl,
        type: vote.poll.type,
        createdAt: vote.poll.createdAt,
        user: vote.poll.user,
        options: vote.poll.options.map((opt: any) => ({
          id: opt.id,
          hashId: encodeOptionId(opt.id),
          key: opt.optionKey,
          label: opt.optionLabel,
          color: opt.color,
          displayOrder: opt.displayOrder,
          votes: opt._count?.votes || 0
        })),
        stats: {
          totalVotes: vote.poll._count.votes,
          interactions: vote.poll._count.interactions,
          comments: vote.poll._count.comments
        }
      },
      option: { // Matches frontend expectation 'vote.option'
        id: vote.option.id,
        hashId: encodeOptionId(vote.option.id),
        key: vote.option.optionKey,
        label: vote.option.optionLabel,
        color: vote.option.color,
      }
    }));

    return json({
      success: true,
      data: formattedVotes,
      meta: {
        total: formattedVotes.length,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('[API /users/[id]/votes] Error completo:', error);
    console.error('[API /users/[id]/votes] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('[API /users/[id]/votes] Error message:', error instanceof Error ? error.message : error);
    return json(
      {
        success: false,
        error: 'Error al obtener votos',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
};
