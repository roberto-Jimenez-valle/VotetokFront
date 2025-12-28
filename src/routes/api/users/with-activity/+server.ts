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

    // 5. Calcular hasNewPoll (green border) para usuario actual
    if (currentUserId && users.length > 0) {
      const authorIds = users.map(u => u.id);
      const authorStats: Record<number, { active: number; viewed: number }> = {};

      // 5a. Active Polls Count (considering expiration)
      const activePollsCounts = await prisma.poll.groupBy({
        by: ['userId'],
        where: {
          userId: { in: authorIds },
          status: 'active',
          isRell: true,
          OR: [
            { closedAt: null },
            { closedAt: { gt: new Date() } }
          ]
        },
        _count: { id: true }
      });

      // 5b. Viewed Polls Count
      const viewedPolls = await prisma.pollInteraction.findMany({
        where: {
          userId: Number(currentUserId),
          interactionType: 'view',
          poll: {
            userId: { in: authorIds },
            status: 'active',
            isRell: true,
            OR: [
              { closedAt: null },
              { closedAt: { gt: new Date() } }
            ]
          }
        },
        select: {
          poll: { select: { userId: true } }
        }
      });

      const viewedCounts: Record<number, number> = {};
      viewedPolls.forEach(v => {
        const authId = v.poll.userId;
        viewedCounts[authId] = (viewedCounts[authId] || 0) + 1;
      });

      activePollsCounts.forEach(bg => {
        authorStats[bg.userId] = {
          active: bg._count.id,
          viewed: viewedCounts[bg.userId] || 0
        };
      });

      users = users.map(u => {
        let hasNewPoll = false;
        const stats = authorStats[u.id];
        if (stats) {
          hasNewPoll = stats.active > stats.viewed;
        }
        return { ...u, hasNewPoll };
      });
    } else {
      // Not logged in, defaults
      users = users.map(u => ({ ...u, hasNewPoll: u.rellsCount > 0 }));
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
