import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { encodePollId, encodeUserId, encodeOptionId } from '$lib/server/hashids';

/**
 * GET /api/users/[id]/polls
 * Obtiene las encuestas creadas por un usuario
 * Devuelve los mismos campos que /api/polls para consistencia
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
  try {
    console.log('[API /users/[id]/polls] Request params:', params);
    const profileUserId = parseInt(params.id);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const currentUserId = locals.user?.userId || (locals.user as any)?.id;

    console.log('[API /users/[id]/polls] Fetching polls for user:', profileUserId, 'limit:', limit, 'offset:', offset);

    if (isNaN(profileUserId)) {
      return json(
        { success: false, error: 'ID de usuario inválido' },
        { status: 400 }
      );
    }

    // Obtener encuestas del usuario
    const polls = await prisma.poll.findMany({
      where: {
        userId: profileUserId,
        status: 'active'
      },
      include: {
        user: true,
        options: {
          orderBy: {
            displayOrder: 'asc'
          },
          include: {
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

    // Si hay usuario actual, obtener sus relaciones
    let followingIds = new Set<number>();
    let pendingIds = new Set<number>();
    let bookmarkedPollIds = new Set<number>();
    let repostedPollIds = new Set<number>();
    let commentedPollIds = new Set<number>();

    if (currentUserId) {
      console.log('[API /users/[id]/polls] Current user ID:', currentUserId, 'Profile user ID:', profileUserId);

      // Obtener relación de seguimiento con el usuario del perfil
      const followRelation = await prisma.userFollower.findFirst({
        where: {
          followerId: Number(currentUserId),
          followingId: profileUserId
        }
      });

      console.log('[API /users/[id]/polls] Follow relation found:', followRelation);

      if (followRelation) {
        if (followRelation.status === 'accepted') {
          followingIds.add(profileUserId);
          console.log('[API /users/[id]/polls] User is FOLLOWING');
        } else if (followRelation.status === 'pending') {
          pendingIds.add(profileUserId);
          console.log('[API /users/[id]/polls] User follow is PENDING');
        }
      } else {
        console.log('[API /users/[id]/polls] No follow relationship found');
      }

      // Obtener bookmarks del usuario actual para estas encuestas
      const pollIds = polls.map(p => p.id);

      const bookmarks = await prisma.pollInteraction.findMany({
        where: {
          userId: Number(currentUserId),
          pollId: { in: pollIds },
          interactionType: 'bookmark'
        },
        select: { pollId: true }
      });
      bookmarkedPollIds = new Set(bookmarks.map(b => b.pollId));

      // Obtener reposts del usuario actual
      const reposts = await prisma.pollInteraction.findMany({
        where: {
          userId: Number(currentUserId),
          pollId: { in: pollIds },
          interactionType: 'repost'
        },
        select: { pollId: true }
      });
      repostedPollIds = new Set(reposts.map(r => r.pollId));

      // Obtener comentarios del usuario actual
      const comments = await prisma.comment.findMany({
        where: {
          userId: Number(currentUserId),
          pollId: { in: pollIds }
        },
        select: { pollId: true },
        distinct: ['pollId']
      });
      commentedPollIds = new Set(comments.map(c => c.pollId));
    }

    // Obtener estadísticas de reels vistos para el usuario del perfil
    let hasUnseenReels = false;
    if (currentUserId) {
      // Active non-expired reels
      const activeCount = await prisma.poll.count({
        where: {
          userId: profileUserId,
          status: 'active',
          isRell: true,
          OR: [
            { closedAt: null },
            { closedAt: { gt: new Date() } }
          ]
        }
      });

      if (activeCount > 0) {
        const viewedCount = await prisma.pollInteraction.count({
          where: {
            userId: Number(currentUserId),
            interactionType: 'view',
            poll: {
              userId: profileUserId,
              status: 'active',
              isRell: true,
              OR: [
                { closedAt: null },
                { closedAt: { gt: new Date() } }
              ]
            }
          }
        });
        hasUnseenReels = activeCount > viewedCount;
      }
    }

    // Formatear respuesta igual que /api/polls
    const formattedPolls = polls.map(poll => {
      const userObj = poll.user ? {
        id: poll.user.id,
        username: poll.user.username,
        displayName: poll.user.displayName,
        avatarUrl: poll.user.avatarUrl,
        verified: poll.user.verified,
        hashId: encodeUserId(poll.user.id),
        hasUnseenReels
      } : null;

      return {
        id: poll.id,
        hashId: encodePollId(poll.id),
        title: poll.title,
        description: poll.description,
        category: poll.category,
        imageUrl: poll.imageUrl,
        type: poll.type,
        createdAt: poll.createdAt,
        closedAt: poll.closedAt,
        isFollowing: followingIds.has(poll.userId),
        isPending: pendingIds.has(poll.userId),
        isBookmarked: bookmarkedPollIds.has(poll.id),
        isReposted: repostedPollIds.has(poll.id),
        hasCommented: commentedPollIds.has(poll.id),
        user: userObj,
        options: poll.options.map(opt => ({
          id: opt.id,
          hashId: encodeOptionId(opt.id),
          key: opt.optionKey,
          label: opt.optionLabel,
          optionLabel: opt.optionLabel,
          color: opt.color,
          imageUrl: opt.imageUrl,
          displayOrder: opt.displayOrder,
          voteCount: opt._count.votes,
          votes: opt._count.votes
        })),
        stats: {
          totalVotes: poll._count.votes,
          interactions: poll._count.interactions,
          comments: poll._count.comments,
        },
        _count: poll._count
      };
    });

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
