import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/users/with-activity?limit=8
 * Obtiene usuarios que tienen rells (isRell=true) o saves (PollInteraction type=save)
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') ?? '8')));

    // 1. Obtener usuarios que tienen rells
    const usersWithRells = await prisma.user.findMany({
      where: {
        polls: {
          some: {
            isRell: true,
            status: 'active'
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
                status: 'active'
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
    const users = Array.from(userMap.values())
      .map(user => ({
        ...user,
        totalActivity: user.rellsCount + user.savesCount
      }))
      .sort((a, b) => b.totalActivity - a.totalActivity)
      .slice(0, limit);

    console.log('[API with-activity] Usuarios encontrados:', users.length);
    console.log('[API with-activity] Usuarios:', users.map(u => ({
      id: u.id,
      name: u.displayName || u.username,
      rells: u.rellsCount,
      saves: u.savesCount
    })));

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
