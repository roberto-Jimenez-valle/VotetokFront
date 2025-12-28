import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { encodePollId, encodeOptionId, encodeUserId } from '$lib/server/hashids';

/**
 * GET /api/users/[id]/votes
 * Obtiene los votos realizados por un usuario
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
  try {
    console.log('[API /users/[id]/votes] Request params:', params);
    const profileUserId = parseInt(params.id);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const currentUserId = locals.user?.userId || (locals.user as any)?.id;

    console.log('[API /users/[id]/votes] Fetching votes for user:', profileUserId, 'limit:', limit, 'offset:', offset);

    if (isNaN(profileUserId)) {
      return json(
        { success: false, error: 'ID de usuario inválido' },
        { status: 400 }
      );
    }

    // Obtener votos del usuario con relaciones
    const votes = await prisma.vote.findMany({
      where: {
        userId: profileUserId
      },
      include: {
        poll: {
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
                comments: true
              }
            }
          }
        },
        option: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    });

    console.log('[API /users/[id]/votes] Found', votes.length, 'votes');

    // Obtener IDs únicos de polls y sus autores
    const pollIds = [...new Set(votes.map(v => v.poll.id))];
    const authorIds = [...new Set(votes.map(v => v.poll.userId))];

    // Si hay usuario actual, obtener sus relaciones
    let followingIds = new Set<number>();
    let pendingIds = new Set<number>();
    let bookmarkedPollIds = new Set<number>();
    let repostedPollIds = new Set<number>();
    let commentedPollIds = new Set<number>();

    if (currentUserId) {
      // Obtener relaciones de seguimiento
      const followRelations = await prisma.userFollower.findMany({
        where: {
          followerId: Number(currentUserId),
          followingId: { in: authorIds }
        }
      });

      followRelations.forEach((f: { status: string; followingId: number }) => {
        if (f.status === 'accepted') {
          followingIds.add(f.followingId);
        } else if (f.status === 'pending') {
          pendingIds.add(f.followingId);
        }
      });

      // Obtener bookmarks del usuario actual
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

    // Formatear respuesta
    const formattedVotes = votes.map(vote => {
      const poll = vote.poll;
      const userObj = poll.user ? {
        id: poll.user.id,
        username: poll.user.username,
        displayName: poll.user.displayName,
        avatarUrl: poll.user.avatarUrl,
        verified: poll.user.verified,
        hashId: encodeUserId(poll.user.id),
      } : null;

      return {
        id: vote.id,
        createdAt: vote.createdAt,
        location: {
          latitude: vote.latitude,
          longitude: vote.longitude,
          subdivisionId: vote.subdivisionId
        },
        poll: {
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
          options: poll.options.map((opt: any) => ({
            id: opt.id,
            hashId: encodeOptionId(opt.id),
            key: opt.optionKey,
            label: opt.optionLabel,
            optionLabel: opt.optionLabel,
            color: opt.color,
            imageUrl: opt.imageUrl,
            displayOrder: opt.displayOrder,
            voteCount: opt._count?.votes || 0,
            votes: opt._count?.votes || 0
          })),
          stats: {
            totalVotes: poll._count.votes,
            interactions: poll._count.interactions,
            comments: poll._count.comments
          },
          _count: poll._count
        },
        option: {
          id: vote.option.id,
          hashId: encodeOptionId(vote.option.id),
          key: vote.option.optionKey,
          label: vote.option.optionLabel,
          color: vote.option.color,
          imageUrl: vote.option.imageUrl,
        }
      };
    });

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
