import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { encodePollId, encodeUserId, encodeOptionId } from '$lib/server/hashids';

/**
 * GET /api/users/[id]/bookmarks
 * Obtener las encuestas guardadas por un usuario
 * Solo accesible por el propio usuario
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
    try {
        const requestedUserId = Number(params.id);

        if (isNaN(requestedUserId)) {
            throw error(400, 'ID de usuario inválido');
        }

        const currentUserId = locals.user?.userId || (locals.user as any)?.id;

        // Solo el propio usuario puede ver sus guardados
        if (!currentUserId || Number(currentUserId) !== requestedUserId) {
            throw error(403, 'No tienes permiso para ver estos guardados');
        }

        const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
        const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));

        // Obtener los bookmarks del usuario con los polls asociados
        const bookmarks = await prisma.pollInteraction.findMany({
            where: {
                userId: requestedUserId,
                interactionType: 'bookmark'
            },
            include: {
                poll: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                displayName: true,
                                avatarUrl: true,
                                verified: true
                            }
                        },
                        options: {
                            orderBy: { displayOrder: 'asc' },
                            include: {
                                _count: {
                                    select: { votes: true }
                                }
                            }
                        },
                        _count: {
                            select: {
                                votes: true,
                                comments: true,
                                interactions: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        });

        // Contar total de bookmarks
        const total = await prisma.pollInteraction.count({
            where: {
                userId: requestedUserId,
                interactionType: 'bookmark'
            }
        });

        // Transformar los datos
        const savedPolls = bookmarks
            .filter(b => b.poll) // Solo incluir si el poll existe
            .map(bookmark => {
                const poll = bookmark.poll!;
                return {
                    id: poll.id,
                    hashId: encodePollId(poll.id),
                    title: poll.title,
                    description: poll.description,
                    category: poll.category,
                    type: poll.type,
                    status: poll.status,
                    imageUrl: poll.imageUrl,
                    createdAt: poll.createdAt,
                    closedAt: poll.closedAt,
                    savedAt: bookmark.createdAt, // Cuándo se guardó
                    user: poll.user ? {
                        ...poll.user,
                        hashId: encodeUserId(poll.user.id)
                    } : null,
                    options: poll.options.map(opt => ({
                        id: opt.id,
                        hashId: encodeOptionId(opt.id),
                        key: opt.optionKey,
                        label: opt.optionLabel,
                        color: opt.color,
                        imageUrl: opt.imageUrl,
                        votes: opt._count?.votes || 0
                    })),
                    stats: {
                        totalVotes: poll._count?.votes || 0,
                        comments: poll._count?.comments || 0,
                        interactions: poll._count?.interactions || 0
                    }
                };
            });

        return json({
            data: savedPolls,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err: any) {
        console.error('[Bookmarks GET] Error:', err);
        if (err.status) throw err;
        throw error(500, `Error al obtener guardados: ${err.message}`);
    }
};
