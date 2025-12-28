import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { sendReportNotification } from '$lib/server/telegram';

export const POST: RequestHandler = async ({ params, locals, request }) => {
    try {
        const commentId = parseInt(params.id || '');
        console.log(`[Comment Report API] 🔍 Reporte de COMENTARIO iniciado para ID: ${commentId}`);

        if (isNaN(commentId)) {
            return json({ success: false, message: 'ID de comentario inválido' }, { status: 400 });
        }

        const userId = locals.user?.userId;
        if (!userId) {
            throw error(401, 'Debes iniciar sesión para reportar');
        }

        const body = await request.json().catch(() => ({}));
        const reason = body.reason || 'other';
        const notes = body.notes || null;

        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            select: { id: true, userId: true, content: true, pollId: true, user: { select: { username: true } } }
        });

        if (!comment) throw error(404, 'Comentario no encontrado');
        if (comment.userId === Number(userId)) throw error(400, 'No puedes reportar tu propio comentario');

        const existingReport = await (prisma.report as any).findFirst({
            where: { pollId: comment.pollId, commentId, userId: Number(userId) }
        });

        if (existingReport) {
            return json({ success: true, message: 'Ya has reportado este comentario' });
        }

        await (prisma.report as any).create({
            data: { pollId: comment.pollId, commentId, userId: Number(userId), reason, notes }
        });

        const reportCount = await (prisma.report as any).count({ where: { commentId } });

        // Enviar email en segundo plano
        sendReportNotification({
            pollId: comment.pollId,
            pollTitle: `Comentario: ${comment.content.substring(0, 50)}`,
            pollAuthor: comment.user?.username || 'Desconocido',
            reporterUsername: locals.user?.username || 'Anónimo',
            reason,
            notes: notes ? `CONTENIDO: ${comment.content}\n\nNOTAS: ${notes}` : `CONTENIDO: ${comment.content}`,
            reportCount
        }).catch(e => console.error('[Comment Report API] Error email:', e));

        return json({ success: true, reportCount });
    } catch (err: any) {
        console.error('[Comment Report API] Error:', err);
        throw error(err.status || 500, err.message || 'Error interno');
    }
};
