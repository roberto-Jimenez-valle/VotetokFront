import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

const ADMIN_EMAIL = 'voutop.oficial@gmail.com';

/**
 * PATCH /api/admin/reports/[id]
 * Actualizar estado de un reporte
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    try {
        const user = locals.user;
        if (!user || (user.email !== ADMIN_EMAIL && user.role !== 'admin')) {
            throw error(403, 'No autorizado');
        }

        const reportId = parseInt(params.id!);
        if (isNaN(reportId)) {
            throw error(400, 'ID de reporte inválido');
        }

        const body = await request.json();
        const { status, reviewNotes, action } = body;

        // Validar estado
        const validStatuses = ['pending', 'reviewed', 'dismissed', 'actioned'];
        if (status && !validStatuses.includes(status)) {
            throw error(400, 'Estado inválido');
        }

        // Obtener el reporte actual
        const report = await prisma.report.findUnique({
            where: { id: reportId },
            include: { poll: true }
        });

        if (!report) {
            throw error(404, 'Reporte no encontrado');
        }

        // Actualizar reporte
        const updatedReport = await prisma.report.update({
            where: { id: reportId },
            data: {
                ...(status && { status }),
                ...(reviewNotes !== undefined && { reviewNotes }),
                reviewedBy: user.userId,
                reviewedAt: new Date()
            }
        });

        // Si se toma acción, aplicar a la encuesta
        if (action) {
            switch (action) {
                case 'hide':
                    await prisma.poll.update({
                        where: { id: report.pollId },
                        data: { isHidden: true }
                    });
                    break;
                case 'unhide':
                    await prisma.poll.update({
                        where: { id: report.pollId },
                        data: { isHidden: false }
                    });
                    break;
                case 'delete':
                    await prisma.poll.delete({
                        where: { id: report.pollId }
                    });
                    break;
                case 'ban_user':
                    await prisma.user.update({
                        where: { id: report.poll?.userId },
                        data: {
                            isBanned: true,
                            banReason: `Contenido reportado: ${report.reason}`,
                            bannedAt: new Date()
                        }
                    });
                    break;
            }
        }

        // Si se marca como "dismissed", restaurar la encuesta si estaba oculta
        if (status === 'dismissed' && report.poll?.isHidden) {
            // Verificar si hay otros reportes pendientes para esta encuesta
            const otherPendingReports = await prisma.report.count({
                where: {
                    pollId: report.pollId,
                    status: 'pending',
                    id: { not: reportId }
                }
            });

            // Si no hay más reportes pendientes, restaurar
            if (otherPendingReports === 0) {
                await prisma.poll.update({
                    where: { id: report.pollId },
                    data: { isHidden: false }
                });
            }
        }

        return json({
            success: true,
            data: updatedReport
        });
    } catch (err: any) {
        console.error('[Admin Reports] Error updating:', err);
        if (err.status) throw err;
        throw error(500, 'Error al actualizar reporte');
    }
};

/**
 * DELETE /api/admin/reports/[id]
 * Eliminar un reporte (y potencialmente la encuesta)
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
    try {
        const user = locals.user;
        if (!user || (user.email !== ADMIN_EMAIL && user.role !== 'admin')) {
            throw error(403, 'No autorizado');
        }

        const reportId = parseInt(params.id!);
        if (isNaN(reportId)) {
            throw error(400, 'ID de reporte inválido');
        }

        await prisma.report.delete({
            where: { id: reportId }
        });

        return json({ success: true });
    } catch (err: any) {
        console.error('[Admin Reports] Error deleting:', err);
        if (err.status) throw err;
        throw error(500, 'Error al eliminar reporte');
    }
};
