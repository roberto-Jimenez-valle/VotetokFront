import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/users/with-activity?limit=8
 * Obtiene usuarios que tienen rells (isRell=true) o saves (PollInteraction type=save)
 */
export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') ?? '8')));
    const currentUserId = locals.user?.userId;

    // 1. Obtener usuarios que tienen actividad (encuestas)
    // Note: Counting ALL active polls, not just reels
    const usersWithRells = await prisma.user.findMany({
      where: {
        polls: {
          some: {
            // isRell: true, // REMOVED
            status: 'active',
            OR: [
              { closedAt: null },
              { closedAt: { gt: new Date() } }
            ]
          }
        }
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        verified: true,
        _count: {
          select: {
            polls: {
              where: {
                // isRell: true, // REMOVED
                status: 'active',
                OR: [
                  { closedAt: null },
                  { closedAt: { gt: new Date() } }
                ]
              }
            }
          }
        }
      },
      take: limit
    });

    // ... (skipping unchanged saves query)

    // 2. Obtener usuarios que tienen saves
    const usersWithSaves = await prisma.user.findMany({
      where: {
        interactions: {
          some: {
            interactionType: 'save'
          }
        }
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        verified: true,
        _count: {
          select: {
            interactions: {
              where: {
                interactionType: 'save'
              }
            }
          }
        }
      },
      take: limit
    });

    // 3. Combinar y eliminar duplicados
    const userMap = new Map<number, any>();

    usersWithRells.forEach(user => {
      userMap.set(user.id, {
        ...user,
        rellsCount: user._count.polls,
        savesCount: 0
      });
    });

    usersWithSaves.forEach(user => {
      if (userMap.has(user.id)) {
        const existing = userMap.get(user.id);
        existing.savesCount = user._count.interactions;
      } else {
        userMap.set(user.id, {
          ...user,
          rellsCount: 0,
          savesCount: user._count.interactions
        });
      }
    });

    // 4. Convertir a array y ordenar por actividad total
    let users = Array.from(userMap.values())
      .map(user => ({
        ...user,
        totalActivity: user.rellsCount + user.savesCount
      }))
      .sort((a, b) => b.totalActivity - a.totalActivity)
      .slice(0, limit);

    const authorIds = users.map(u => u.id);

    // 5. Calcular hasNewPoll (green border) para usuario actual
    if (currentUserId && users.length > 0) {
      // ... (existing code up to activePollsCounts)

      // 5. Calculate hasNewPoll (green border) for current user
      // Logic: Unseen = (Active Authored + Active Reposted) - Viewed

      // A. Get all active authored poll IDs for these users
      const authoredPolls = await prisma.poll.findMany({
        where: {
          userId: { in: authorIds },
          status: 'active',
          OR: [
            { closedAt: null },
            { closedAt: { gt: new Date() } }
          ]
        },
        select: { id: true, userId: true }
      });

      // B. Get all active reposted poll IDs for these users
      const repostedInteractions = await prisma.pollInteraction.findMany({
        where: {
          userId: { in: authorIds },
          interactionType: 'repost',
          poll: {
            status: 'active',
            OR: [
              { closedAt: null },
              { closedAt: { gt: new Date() } }
            ]
          }
        },
        select: { pollId: true, userId: true } // userId here is the retweeter
      });

      // Map: UserID -> Set of PollIDs (Content to see)
      const userContentMap = new Map<number, Set<number>>();

      // Add authored
      authoredPolls.forEach(p => {
        if (!userContentMap.has(p.userId)) userContentMap.set(p.userId, new Set());
        userContentMap.get(p.userId)?.add(p.id);
      });

      // Add reposted
      repostedInteractions.forEach(r => {
        if (r.userId !== null) { // Should not be null for reposts
          if (!userContentMap.has(r.userId)) userContentMap.set(r.userId, new Set());
          userContentMap.get(r.userId)?.add(r.pollId);
        }
      });

      // C. Get all views by CURRENT user for any of these polls
      // We need to check against ALL content IDs we found
      const allContentIds = new Set<number>();
      userContentMap.forEach(set => set.forEach(id => allContentIds.add(id)));

      if (allContentIds.size > 0) {
        const viewedPolls = await prisma.pollInteraction.findMany({
          where: {
            userId: Number(currentUserId),
            interactionType: 'view',
            pollId: { in: Array.from(allContentIds) }
          },
          select: { pollId: true }
        });

        const viewedPollIds = new Set(viewedPolls.map(v => v.pollId));

        users = users.map(u => {
          const content = userContentMap.get(u.id) || new Set();
          let hasNewPoll = false;

          // If any content ID is NOT in viewedPollIds, then it's new
          for (const contentId of content) {
            if (!viewedPollIds.has(contentId)) {
              hasNewPoll = true;
              break;
            }
          }

          return { ...u, hasNewPoll };
        });
      } else {
        users = users.map(u => ({ ...u, hasNewPoll: false }));
      }
    }

    /* console.log('[API with-activity] Usuarios encontrados:', users.length);
    console.log('[API with-activity] Usuarios:', users.map(u => ({
      id: u.id,
      name: u.displayName || u.username,
      rells: u.rellsCount,
      hasNewPoll: u.hasNewPoll
    }))); */

    return json({
      data: users,
      meta: {
        total: users.length,
        withRells: usersWithRells.length,
        withSaves: usersWithSaves.length
      }
    });

  } catch (error) {
    console.error('[API with-activity] Error:', error);
    return json({
      data: [],
      error: 'Failed to fetch users with activity'
    }, { status: 500 });
  }
};
