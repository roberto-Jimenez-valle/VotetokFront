
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
    const userId = url.searchParams.get('userId');
    const limit = Number(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || '';

    if (!userId) {
        return json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        // Buscar gente a la que SIGO
        const following = await prisma.userFollower.findMany({
            where: {
                followerId: parseInt(userId),
                following: {
                    OR: [
                        { username: { contains: search, mode: 'insensitive' } },
                        { displayName: { contains: search, mode: 'insensitive' } }
                    ]
                }
            },
            take: limit,
            include: {
                following: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
            }
        });

        // Buscar gente que ME SIGUE (Followers)
        const followers = await prisma.userFollower.findMany({
            where: {
                followingId: parseInt(userId),
                follower: {
                    OR: [
                        { username: { contains: search, mode: 'insensitive' } },
                        { displayName: { contains: search, mode: 'insensitive' } }
                    ]
                }
            },
            take: limit,
            include: {
                follower: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
            }
        });

        // Combinar listas y eliminar duplicados por ID
        const combinedUsers = new Map();

        following.forEach(f => {
            combinedUsers.set(f.following.id, {
                id: f.following.id,
                username: f.following.username,
                name: f.following.displayName,
                avatar: f.following.avatarUrl,
                relation: 'following'
            });
        });

        followers.forEach(f => {
            if (combinedUsers.has(f.follower.id)) {
                combinedUsers.get(f.follower.id).relation = 'mutual';
            } else {
                combinedUsers.set(f.follower.id, {
                    id: f.follower.id,
                    username: f.follower.username,
                    name: f.follower.displayName,
                    avatar: f.follower.avatarUrl,
                    relation: 'follower'
                });
            }
        });

        return json(Array.from(combinedUsers.values()));
    } catch (error) {
        console.error('Error fetching connected users:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
};
