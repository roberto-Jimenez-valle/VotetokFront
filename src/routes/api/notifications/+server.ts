
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import type { NotificationType } from '$lib/server/notifications';

// GET - Obtener notificaciones del usuario actual
export const GET: RequestHandler = async ({ locals, url }) => {
    try {
        const user = locals.user;
        if (!user?.userId) {
            return json({ error: 'No autenticado' }, { status: 401 });
        }

        const filter = url.searchParams.get('filter') || 'all';
        const page = Number(url.searchParams.get('page')) || 1;
        const limit = 20;

        let typeFilter: any = undefined;

        switch (filter) {
            case 'mentions':
                // Incluimos comentarios y menciones explícitas
                typeFilter = { in: ['COMMENT', 'MENTION'] };
                break;
            case 'votes':
                // Incluimos votos y likes (o likes en otra si hubiera tab)
                // Por ahora el tab dice "Votos", metemos likes ahí también para que no se pierdan?
                // O solo votos. El screenshot mostraba "Likes" en la lista general.
                // Vamos a meter LIKES y VOTES en la misma categoria de interacción si el usuario quiere ver "actividad"
                // Pero el tab dice Votos. Seamos estrictos: VOTE.
                typeFilter = { in: ['VOTE'] };
                break;
            case 'follows':
                typeFilter = { in: ['NEW_FOLLOWER', 'FOLLOW_REQUEST'] };
                break;
            case 'all':
            default:
                typeFilter = undefined;
                break;
        }

        const whereCondition: any = {
            userId: user.userId,
            ...(typeFilter && { type: typeFilter })
        };

        const [notifications, total, unreadCounts] = await Promise.all([
            prisma.notification.findMany({
                where: whereCondition,
                include: {
                    actor: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatarUrl: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.notification.count({ where: whereCondition }),
            // Calculate unread counts by type
            prisma.notification.groupBy({
                by: ['type'],
                where: {
                    userId: user.userId,
                    read: false
                },
                _count: {
                    _all: true
                }
            })
        ]);

        // Process counts
        const counts = {
            all: 0,
            mentions: 0,
            votes: 0,
            follows: 0,
            messages: 0 // Placeholder for future chat integration
        };

        unreadCounts.forEach(c => {
            const count = c._count._all;
            counts.all += count;
            if (['COMMENT', 'MENTION'].includes(c.type)) counts.mentions += count;
            if (['VOTE', 'LIKE'].includes(c.type)) counts.votes += count;
            if (['NEW_FOLLOWER', 'FOLLOW_REQUEST'].includes(c.type)) counts.follows += count;
        });

        // Process notifications with follow status
        const processedNotifications = await Promise.all(notifications.map(async n => {
            if (!n.actor) return n;

            let isFollowing = false;
            let isPending = false;

            // 1. Check follow status
            const rel = await prisma.userFollower.findFirst({
                where: {
                    followerId: user.userId,
                    followingId: n.actor.id
                }
            });

            if (rel) {
                if (rel.status === 'accepted') isFollowing = true;
                else if (rel.status === 'pending') isPending = true;
            }

            // 2. Unseen Reels Logic
            let hasUnseenReels = false;
            const activeCount = await prisma.poll.count({
                where: {
                    userId: n.actor.id,
                    status: 'active',
                    OR: [
                        { closedAt: null },
                        { closedAt: { gt: new Date() } }
                    ]
                }
            });

            if (activeCount > 0) {
                const viewedCount = await prisma.pollInteraction.count({
                    where: {
                        userId: user.userId,
                        interactionType: 'view',
                        poll: {
                            userId: n.actor.id,
                            status: 'active',
                            OR: [
                                { closedAt: null },
                                { closedAt: { gt: new Date() } }
                            ]
                        }
                    }
                });
                hasUnseenReels = activeCount > viewedCount;
            }

            return {
                ...n,
                actor: {
                    ...n.actor,
                    isFollowing,
                    isPending,
                    hasUnseenReels
                }
            };
        }));

        return json({
            success: true,
            data: processedNotifications,
            counts, // Return the calculated counts
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[Notifications] Error:', error);
        return json({ error: 'Error al cargar notificaciones' }, { status: 500 });
    }
};

// PATCH - Marcar como leidas
export const PATCH: RequestHandler = async ({ locals, request }) => {
    try {
        const user = locals.user;
        if (!user?.userId) return json({ error: 'No autenticado' }, { status: 401 });

        const body = await request.json();
        const { id, all } = body;

        if (all) {
            await prisma.notification.updateMany({
                where: { userId: user.userId, read: false },
                data: { read: true }
            });
        } else if (id) {
            await prisma.notification.update({
                where: { id: id, userId: user.userId },
                data: { read: true }
            });
        }

        return json({ success: true });
    } catch (error) {
        console.error('[Notifications] Error marking read:', error);
        return json({ error: 'Error al actualizar notificaciones' }, { status: 500 });
    }
};
