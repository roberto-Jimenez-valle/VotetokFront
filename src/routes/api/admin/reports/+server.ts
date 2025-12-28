import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { encodePollId, encodeUserId } from '$lib/server/hashids';

const ADMIN_EMAIL = 'voutop.oficial@gmail.com';

/**
 * GET /api/admin/reports
 * Obtener todos los reportes para el panel de admin
 */
export const GET: RequestHandler = async ({ url, locals }) => {
    try {
        // Solo admin puede ver reportes
        const user = locals.user;
        if (!user || (user.email !== ADMIN_EMAIL && user.role !== 'admin')) {
            throw error(403, 'No autorizado');
        }

        const status = url.searchParams.get('status') || 'all';
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        const where: any = {};
        if (status !== 'all') {
            where.status = status;
        }

        const [reports, total] = await Promise.all([
            (prisma.report as any).findMany({
                where,
                include: {
                    poll: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                            isHidden: true,
                            createdAt: true,
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    displayName: true,
                                    avatarUrl: true
                                }
                            }
                        }
                    },
                    user: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatarUrl: true
                        }
                    },
                    comment: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    displayName: true
                                }
                            }
                        }
                    },
                    reviewer: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            }),
            (prisma.report as any).count({ where })
        ]);

        // Agrupar reportes por encuesta para ver conteo total
        const reportsByPoll: Record<number, number> = {};
        for (const r of reports) {
            reportsByPoll[r.pollId] = (reportsByPoll[r.pollId] || 0) + 1;
        }

        const formattedReports = (reports as any[]).map(report => ({
            id: report.id,
            reason: report.reason,
            notes: report.notes,
            status: report.status,
            reviewNotes: report.reviewNotes,
            createdAt: report.createdAt,
            reviewedAt: report.reviewedAt,
            poll: report.poll ? {
                id: report.poll.id,
                hashId: encodePollId(report.poll.id),
                title: report.poll.title,
                status: report.poll.status,
                isHidden: report.poll.isHidden,
                createdAt: report.poll.createdAt,
                author: report.poll.user ? {
                    id: report.poll.user.id,
                    hashId: encodeUserId(report.poll.user.id),
                    username: report.poll.user.username,
                    displayName: report.poll.user.displayName,
                    avatarUrl: report.poll.user.avatarUrl
                } : null,
                totalReports: reportsByPoll[report.pollId] || 1
            } : null,
            comment: (report as any).comment ? {
                id: (report as any).comment.id,
                content: (report as any).comment.content,
                author: (report as any).comment.user ? {
                    id: (report as any).comment.user.id,
                    username: (report as any).comment.user.username,
                    displayName: (report as any).comment.user.displayName
                } : null
            } : null,
            reporter: report.user ? {
                id: report.user.id,
                hashId: encodeUserId(report.user.id),
                username: report.user.username,
                displayName: report.user.displayName,
                avatarUrl: report.user.avatarUrl
            } : null,
            reviewer: report.reviewer ? {
                id: report.reviewer.id,
                username: report.reviewer.username,
                displayName: report.reviewer.displayName
            } : null
        }));

        // Estadísticas
        const stats = await prisma.report.groupBy({
            by: ['status'],
            _count: true
        });

        const statsMap: Record<string, number> = {
            pending: 0,
            reviewed: 0,
            dismissed: 0,
            actioned: 0
        };
        stats.forEach(s => {
            statsMap[s.status] = s._count;
        });

        return json({
            success: true,
            data: formattedReports,
            meta: {
                total,
                limit,
                offset,
                stats: statsMap
            }
        });
    } catch (err: any) {
        console.error('[Admin Reports] Error:', err);
        if (err.status) throw err;
        throw error(500, 'Error al obtener reportes');
    }
};
