import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/users/[id]
 * Obtiene el perfil completo de un usuario por ID
 */
export const GET: RequestHandler = async ({ params }) => {
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
        }
      }
    });

    if (!user) {
      console.error('[API /users/[id]] User not found:', userId);
      return json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }
    
    console.log('[API /users/[id]] User found:', {
      id: user.id,
      username: user.username,
      polls: user._count.polls,
      votes: user._count.votes
    });

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
        stats: {
          pollsCount: user._count.polls,
          votesCount: user._count.votes,
          followersCount: user._count.followers,
          followingCount: user._count.following,
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
