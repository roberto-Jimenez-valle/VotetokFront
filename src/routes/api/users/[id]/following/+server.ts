import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { encodeUserId } from '$lib/server/hashids';

/**
 * GET /api/users/[id]/following
 * Obtiene la lista de usuarios que sigue un usuario
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
    try {
        const userId = parseInt(params.id);
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        if (isNaN(userId)) {
            return json(
                { success: false, error: 'ID de usuario inválido' },
                { status: 400 }
            );
        }

        // Obtener usuarios que este usuario sigue
        const following = await prisma.userFollower.findMany({
            where: {
                followerId: userId,
                status: 'accepted'
            },
            include: {
                following: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatarUrl: true,
                        verified: true,
                        bio: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: limit,
            skip: offset
        });

        // Get current user to check if we follow these people
        const currentUser = locals.user;
        const currentUserId = currentUser?.userId || (currentUser as any)?.id;

        // Formatear la respuesta
        const formattedFollowing = await Promise.all(following.map(async f => {
            let isFollowing = false;
            let isPending = false;

            if (currentUserId && currentUserId !== f.following.id) {
                const rel = await prisma.userFollower.findFirst({
                    where: {
                        followerId: Number(currentUserId),
                        followingId: f.following.id
                    }
                });
                if (rel) {
                    if (rel.status === 'accepted') isFollowing = true;
                    else if (rel.status === 'pending') isPending = true;
                }
            }

            return {
                id: f.following.id,
                hashId: encodeUserId(f.following.id),
                username: f.following.username,
                displayName: f.following.displayName,
                avatarUrl: f.following.avatarUrl,
                verified: f.following.verified,
                bio: f.following.bio,
                followedAt: f.createdAt,
                isFollowing,
                isPending
            };
        }));

        return json({
            success: true,
            data: formattedFollowing,
            meta: {
                total: formattedFollowing.length,
                limit,
                offset
            }
        });
    } catch (error) {
        console.error('[API /users/[id]/following] Error:', error);
        return json(
            {
                success: false,
                error: 'Error al obtener siguiendo',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
};
