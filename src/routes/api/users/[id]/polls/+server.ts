import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/users/[id]/polls
 * Obtiene las encuestas creadas por un usuario
 */
export const GET: RequestHandler = async ({ params, url }) => {
  try {
    console.log('[API /users/[id]/polls] Request params:', params);
    const userId = parseInt(params.id);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    console.log('[API /users/[id]/polls] Fetching polls for user:', userId, 'limit:', limit, 'offset:', offset);

    if (isNaN(userId)) {
      return json(
        { success: false, error: 'ID de usuario inválido' },
        { status: 400 }
      );
    }

    // Obtener encuestas del usuario
    const polls = await prisma.poll.findMany({
      where: {
        userId,
        status: 'active'
      },
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
            comments: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    });

    console.log('[API /users/[id]/polls] Found', polls.length, 'polls');
    
    // Formatear respuesta
    const formattedPolls = polls.map(poll => ({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      category: poll.category,
      imageUrl: poll.imageUrl,
      type: poll.type,
      createdAt: poll.createdAt,
      user: poll.user,
      options: poll.options.map(opt => ({
        id: opt.id,
        key: opt.optionKey,
        label: opt.optionLabel,
        color: opt.color,
        votes: opt._count.votes
      })),
      stats: {
        totalVotes: poll._count.votes,
        interactions: poll._count.interactions,
        comments: poll._count.comments,
      }
    }));

    return json({
      success: true,
      data: formattedPolls,
      meta: {
        total: formattedPolls.length,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('[API /users/[id]/polls] Error completo:', error);
    console.error('[API /users/[id]/polls] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('[API /users/[id]/polls] Error message:', error instanceof Error ? error.message : error);
    return json(
      { 
        success: false, 
        error: 'Error al obtener encuestas',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
};
