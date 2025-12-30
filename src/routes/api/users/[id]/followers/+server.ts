import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { encodeUserId } from '$lib/server/hashids';

/**
 * GET /api/users/[id]/followers
 * Obtiene la lista de seguidores de un usuario
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

        // Obtener seguidores del usuario (usuarios que siguen a este usuario)
        const followers = await prisma.userFollower.findMany({
            where: {
                followingId: userId,
                status: 'accepted'
            },
            include: {
                follower: {
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

        // Get current user to check if we follow these followers
        const currentUser = locals.user;
        const currentUserId = currentUser?.userId || (currentUser as any)?.id;

        // Formatear la respuesta
        const formattedFollowers = await Promise.all(followers.map(async f => {
            let isFollowing = false;
            let isPending = false;

            if (currentUserId && currentUserId !== f.follower.id) {
                const rel = await prisma.userFollower.findFirst({
                    where: {
                        followerId: Number(currentUserId),
                        followingId: f.follower.id
                    }
                });
                if (rel) {
                    if (rel.status === 'accepted') isFollowing = true;
                    else if (rel.status === 'pending') isPending = true;
                }
            }

            return {
                id: f.follower.id,
                hashId: encodeUserId(f.follower.id),
                username: f.follower.username,
                displayName: f.follower.displayName,
                avatarUrl: f.follower.avatarUrl,
                verified: f.follower.verified,
                bio: f.follower.bio,
                followedAt: f.createdAt,
                isFollowing,
                isPending
            };
        }));

        return json({
            success: true,
            data: formattedFollowers,
            meta: {
                total: formattedFollowers.length,
                limit,
                offset
            }
        });
    } catch (error) {
        console.error('[API /users/[id]/followers] Error:', error);
        return json(
            {
                success: false,
                error: 'Error al obtener seguidores',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
};
