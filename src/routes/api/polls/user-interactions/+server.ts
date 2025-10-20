import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/polls/user-interactions?userId=X&types=save,repost&limit=20
 * Obtiene las encuestas guardadas (save) o reposteadas (isRell=true) por el usuario
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId');
    const typesParam = url.searchParams.get('types') || 'save,repost';
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));

    if (!userId) {
      return json({ 
        data: [],
        error: 'userId is required'
      }, { status: 400 });
    }

    // Parse tipos de interacción
    const interactionTypes = typesParam.split(',').map(t => t.trim());
    
    const whereConditions: any[] = [];

    // Si incluye "repost", buscar encuestas con isRell=true del usuario
    if (interactionTypes.includes('repost')) {
      whereConditions.push({
        userId: Number(userId),
        isRell: true,
        status: 'active'
      });
    }

    // Si incluye "save", buscar encuestas guardadas via PollInteraction
    if (interactionTypes.includes('save')) {
      const savedInteractions = await prisma.pollInteraction.findMany({
        where: {
          userId: Number(userId),
          interactionType: 'save'
        },
        select: { pollId: true },
        take: limit
      });
      
      const savedPollIds = savedInteractions.map(i => i.pollId);
      
      if (savedPollIds.length > 0) {
        whereConditions.push({
          id: { in: savedPollIds },
          status: 'active'
        });
      }
    }

    if (whereConditions.length === 0) {
      return json({ data: [] });
    }

    // Obtener las encuestas completas
    const polls = await prisma.poll.findMany({
      where: {
        OR: whereConditions
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
        originalPoll: {
          select: {
            id: true,
            title: true,
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
              orderBy: { displayOrder: 'asc' },
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
              }
            }
          },
        },
        options: {
          orderBy: { displayOrder: 'asc' },
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
          }
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

    // Transformar datos
    const transformedPolls = polls.map(poll => {
      // Si es un rell sin opciones propias, usar las opciones del poll original
      let pollOptions = poll.options;
      
      if (poll.isRell && poll.originalPoll && poll.options.length === 0 && poll.originalPoll.options) {
        console.log('[API user-interactions] ✅ Rell sin opciones, usando las del original. Rell ID:', poll.id, 'Original:', poll.originalPollId);
        pollOptions = poll.originalPoll.options;
      }
      
      return {
        ...poll,
        options: pollOptions.map((option: any) => ({
          ...option,
          voteCount: option._count?.votes || 0,
          avatarUrl: option.createdBy?.avatarUrl || null
        }))
      };
    });

    return json({
      data: transformedPolls,
      meta: {
        userId: Number(userId),
        types: interactionTypes,
        total: transformedPolls.length
      }
    });

  } catch (error) {
    console.error('[API user-interactions] Error:', error);
    return json({ 
      data: [],
      error: 'Failed to fetch user interactions'
    }, { status: 500 });
  }
};
