import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { parsePollIdInternal } from '$lib/server/hashids';
import { sendReportNotification } from '$lib/server/email';

const REPORT_THRESHOLD_HIDE = 5;

export const POST: RequestHandler = async ({ params, locals, request }) => {
  try {
    const rawId = params.id || '';
    const pollId = parsePollIdInternal(rawId);
    console.log(`[Report API] 🔍 Reporte de ENCUESTA iniciado para: ${rawId} (ID: ${pollId})`);

    if (!pollId) {
      return json({ success: false, message: 'ID de encuesta inválido' }, { status: 400 });
    }

    const userId = locals.user?.userId;
    if (!userId) {
      throw error(401, 'Debes iniciar sesión para reportar');
    }

    const body = await request.json().catch(() => ({}));
    const reason = body.reason || 'other';
    const notes = body.notes || null;

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { id: true, userId: true, title: true, user: { select: { username: true } } }
    });

    if (!poll) throw error(404, 'Encuesta no encontrada');
    if (poll.userId === Number(userId)) throw error(400, 'No puedes reportar tu propia encuesta');

    // Buscar reporte existente del usuario para esta encuesta
    const existingReport = await (prisma as any).report.findFirst({
      where: {
        pollId,
        userId: Number(userId)
      }
    });

    if (existingReport) {
      return json({ success: true, message: 'Ya has reportado esta encuesta' });
    }

    await (prisma as any).report.create({
      data: { pollId, userId: Number(userId), reason, notes }
    });

    const reportCount = await (prisma as any).report.count({
      where: { pollId }
    });

    if (reportCount >= REPORT_THRESHOLD_HIDE) {
      await prisma.poll.update({ where: { id: pollId }, data: { isHidden: true } });
    }

    // Enviar email en segundo plano (no bloquea la respuesta)
    console.log('[Report API] 📧 Iniciando envío de email...');
    console.log('[Report API] Datos:', { pollId, pollTitle: poll.title, reason, reportCount });

    sendReportNotification({
      pollId,
      pollTitle: poll.title,
      pollAuthor: poll.user?.username || 'Desconocido',
      reporterUsername: locals.user?.username || 'Anónimo',
      reason,
      notes: notes || undefined,
      reportCount
    })
      .then(result => console.log('[Report API] ✅ Email result:', result))
      .catch(e => console.error('[Report API] ❌ Error email:', e));

    return json({ success: true, reportCount });
  } catch (err: any) {
    console.error('[Report API] Error:', err);
    throw error(err.status || 500, err.message || 'Error interno');
  }
};
