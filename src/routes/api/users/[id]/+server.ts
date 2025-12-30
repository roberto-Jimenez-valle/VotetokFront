import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/users/[id]
 * Obtiene el perfil completo de un usuario por ID
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    console.log('[API /users/[id]] Request params:', params);
    const userId = parseInt(params.id);

    if (isNaN(userId)) {
      console.error('[API /users/[id]] Invalid user ID:', params.id);
      return json(
        { success: false, error: 'ID de usuario inválido' },
        { status: 400 }
      );
    }

    console.log('[API /users/[id]] Fetching user:', userId);

    // Get current user from locals to check follow status
    const currentUser = locals.user;
    const currentUserId = currentUser?.userId || (currentUser as any)?.id;

    // Obtener usuario con información adicional
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        verified: true,
        countryIso3: true,
        createdAt: true,
        isPrivate: true,
        email: true, // Need this to check for admin account
        // Contadores
        _count: {
          select: {
            polls: {
              where: {
                status: 'active'
              }
            },
            votes: true,
            followers: true,
            following: true,
          }
        },
      }
    });

    if (!user) {
      console.error('[API /users/[id]] User not found:', userId);
      return json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Hide voutop.oficial profile from other users
    const currentUserEmail = locals.user?.email;
    if (user.email === 'voutop.oficial@gmail.com' && currentUserEmail !== 'voutop.oficial@gmail.com') {
      return json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Determine follow status - query separately for reliability
    let isFollowing = false;
    let isPending = false;
    let hasUnseenReels = false;

    if (currentUserId) {
      // 1. Follow relation
      const followRelation = await prisma.userFollower.findFirst({
        where: {
          followerId: Number(currentUserId),
          followingId: userId
        }
      });

      console.log('[API /users/[id]] Current user ID:', currentUserId, 'Follow relation:', followRelation);

      if (followRelation) {
        if (followRelation.status === 'accepted') {
          isFollowing = true;
        } else if (followRelation.status === 'pending') {
          isPending = true;
        }
      }

      // 2. Unseen Reels Logic (Green Border)
      // Get count of active polls by THIS user
      const activePollsCount = await prisma.poll.count({
        where: {
          userId: userId,
          status: 'active',
          isRell: true, // ONLY REELS
          OR: [
            { closedAt: null },
            { closedAt: { gt: new Date() } }
          ]
        }
      });

      if (activePollsCount > 0) {
        // Get count of viewed polls by current user for THIS author
        const viewedPollsCount = await prisma.pollInteraction.count({
          where: {
            userId: currentUserId,
            interactionType: 'view',
            poll: {
              userId: userId,
              status: 'active',
              isRell: true, // ONLY REELS
              OR: [
                { closedAt: null },
                { closedAt: { gt: new Date() } }
              ]
            }
          }
        });

        hasUnseenReels = activePollsCount > viewedPollsCount;
      }
    }

    console.log('[API /users/[id]] Found status:', { isFollowing, isPending, hasUnseenReels });

    return json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        verified: user.verified,
        countryIso3: user.countryIso3,
        createdAt: user.createdAt,
        isFollowing,
        isPending,
        hasUnseenReels,
        stats: {
          pollsCount: user._count.polls,
          votesCount: user._count.votes,
          // Note: Prisma relations are inverted in naming - swap them here
          followersCount: user._count.following,  // People who follow this user
          followingCount: user._count.followers,  // People this user follows
        }
      }
    });
  } catch (error) {
    console.error('[API /users/[id]] Error completo:', error);
    console.error('[API /users/[id]] Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('[API /users/[id]] Error message:', error instanceof Error ? error.message : error);
    return json(
      {
        success: false,
        error: 'Error al obtener usuario',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
};
