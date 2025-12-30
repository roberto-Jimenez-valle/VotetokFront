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

    // 1. Obtener usuarios que tienen rells
    const usersWithRells = await prisma.user.findMany({
      where: {
        polls: {
          some: {
            isRell: true,
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
                isRell: true,
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

      // Modified: Get Active Poll IDs for debugging
      const activePolls = await prisma.poll.findMany({
        where: {
          userId: { in: authorIds },
          status: 'active',
          isRell: true,
          OR: [
            { closedAt: null },
            { closedAt: { gt: new Date() } }
          ]
        },
        select: { id: true, userId: true }
      });

      // Group active polls by user
      const activeMap: Record<number, number[]> = {};
      activePolls.forEach(p => {
        if (!activeMap[p.userId]) activeMap[p.userId] = [];
        activeMap[p.userId].push(p.id);
      });

      // Get viewed interactions
      const viewedInteractions = await prisma.pollInteraction.findMany({
        where: {
          userId: Number(currentUserId),
          interactionType: 'view',
          poll: {
            userId: { in: authorIds },
            status: 'active',
            isRell: true
            // removed date check here to see if we viewed expired ones? NO, consistent with active check
          }
        },
        select: { pollId: true, poll: { select: { userId: true } } }
      });

      const viewedMap: Record<number, number[]> = {};
      viewedInteractions.forEach(v => {
        const uId = v.poll.userId;
        if (!viewedMap[uId]) viewedMap[uId] = [];
        viewedMap[uId].push(v.pollId);
      });

      users = users.map(u => {
        const activeIds = activeMap[u.id] || [];
        const viewedIds = viewedMap[u.id] || [];
        const hasNewPoll = activeIds.length > viewedIds.length;
        return { ...u, hasNewPoll };
      });
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
