import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { sendReportNotification } from '$lib/server/email';

const REPORT_THRESHOLD_HIDE = 5; // Ocultar automáticamente tras 5 reportes

export const POST: RequestHandler = async ({ params, locals, request }) => {
    try {
        const rawId = params.id || '';
        const commentId = parseInt(rawId);
        console.log(`[Comment Report API] 📥 POST request received for id: "${rawId}" (parsed: ${commentId})`);

        if (isNaN(commentId)) {
            console.error(`[Comment Report API] ❌ Invalid numeric ID: "${rawId}"`);
            return json({ success: false, message: 'ID de comentario inválido (debe ser numérico)' }, { status: 400 });
        }

        const userId = locals.user?.userId;
        if (!userId) {
            throw error(401, 'Debes iniciar sesión para reportar');
        }

        // Obtener razón y notas del reporte
        let reason = 'other';
        let notes = null;

        try {
            const body = await request.json();
            reason = body.reason || 'other';
            notes = body.notes || null;
        } catch {
            // Sin body
        }

        // Validar razón
        const validReasons = ['spam', 'inappropriate', 'misleading', 'hate', 'harassment', 'violence', 'other'];
        if (!validReasons.includes(reason)) {
            reason = 'other';
        }

        // Verificar que el comentario existe y obtener info
        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            select: {
                id: true,
                userId: true,
                content: true,
                pollId: true,
                user: {
                    select: { username: true }
                }
            }
        });

        if (!comment) {
            throw error(404, 'Comentario no encontrado');
        }

        // No permitir reportar tu propio comentario
        if (comment.userId === Number(userId)) {
            throw error(400, 'No puedes reportar tu propio comentario');
        }

        // Usar pollId del comentario
        const pollId = comment.pollId;

        // Verificar si ya reportó
        const existingReport = await (prisma.report as any).findFirst({
            where: {
                pollId,
                userId: Number(userId),
                commentId
            }
        });

        if (existingReport) {
            return json({ success: true, message: 'Ya has reportado este comentario' });
        }

        // Crear el reporte
        await (prisma.report as any).create({
            data: {
                pollId,
                commentId,
                userId: Number(userId),
                reason,
                notes
            }
        });

        // Contar reportes totales de este comentario
        const reportCount = await (prisma.report as any).count({
            where: { commentId }
        });

        // Enviar notificación por email al admin
        // Reutilizamos sendReportNotification, pero indicando que es un comentario
        await sendReportNotification({
            pollId,
            pollTitle: `Comentario: ${comment.content.substring(0, 50)}${comment.content.length > 50 ? '...' : ''}`,
            pollAuthor: comment.user?.username || 'Desconocido',
            reporterUsername: locals.user?.username || 'Anónimo',
            reason,
            notes: notes ? `CONTENIDO: ${comment.content}\n\nNOTAS: ${notes}` : `CONTENIDO: ${comment.content}`,
            reportCount
        });

        return json({
            success: true,
            message: 'Gracias por tu reporte. Lo revisaremos pronto.',
            reportCount
        });
    } catch (err: any) {
        console.error('[Comment Report] Error:', err);
        if (err.status) throw err;
        throw error(500, `Error al reportar: ${err.message}`);
    }
};
