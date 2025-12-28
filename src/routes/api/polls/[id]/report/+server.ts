import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { parsePollIdInternal } from '$lib/server/hashids';
import { sendReportNotification } from '$lib/server/email';

const REPORT_THRESHOLD_HIDE = 5; // Ocultar automáticamente tras 5 reportes

/**
 * POST /api/polls/[id]/report
 * Reportar una encuesta
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
  try {
    const pollId = parsePollIdInternal(params.id || '');

    if (!pollId) {
      throw error(400, 'ID de encuesta inválido');
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
      // Sin body, usar valores por defecto
    }

    // Validar razón
    const validReasons = ['spam', 'inappropriate', 'misleading', 'hate', 'harassment', 'violence', 'other'];
    if (!validReasons.includes(reason)) {
      reason = 'other';
    }

    // Verificar que la encuesta existe y obtener info
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
        userId: true,
        title: true,
        user: {
          select: { username: true }
        }
      }
    });

    if (!poll) {
      throw error(404, 'Encuesta no encontrada');
    }

    // No permitir reportar tu propia encuesta
    if (poll.userId === Number(userId)) {
      throw error(400, 'No puedes reportar tu propia encuesta');
    }

    // Obtener info del usuario que reporta
    const reporter = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { username: true, email: true }
    });

    // Verificar si ya reportó - usar nuevo modelo Report
    const existingReport = await prisma.report.findUnique({
      where: {
        pollId_userId: {
          pollId,
          userId: Number(userId)
        }
      }
    });

    if (existingReport) {
      return json({ success: true, message: 'Ya has reportado esta encuesta' });
    }

    // Crear el reporte en el nuevo modelo
    await prisma.report.create({
      data: {
        pollId,
        userId: Number(userId),
        reason,
        notes
      }
    });

    // También crear interacción para mantener compatibilidad
    await prisma.pollInteraction.upsert({
      where: {
        pollId_userId_interactionType: {
          pollId,
          userId: Number(userId),
          interactionType: 'report'
        }
      },
      create: {
        pollId,
        userId: Number(userId),
        interactionType: 'report'
      },
      update: {} // No actualizar nada si ya existe
    });

    // Contar reportes totales
    const reportCount = await prisma.report.count({
      where: { pollId }
    });

    // Auto-ocultar si supera el umbral
    let wasHidden = false;
    if (reportCount >= REPORT_THRESHOLD_HIDE) {
      await prisma.poll.update({
        where: { id: pollId },
        data: { isHidden: true }
      });
      wasHidden = true;
      console.log(`[Report] 🚫 Encuesta ${pollId} ocultada automáticamente (${reportCount} reportes)`);
    }

    // Enviar notificación por email al admin
    await sendReportNotification({
      pollId,
      pollTitle: poll.title,
      pollAuthor: poll.user?.username || 'Desconocido',
      reporterUsername: reporter?.username || 'Anónimo',
      reason,
      notes: notes || undefined,
      reportCount
    });

    return json({
      success: true,
      message: wasHidden
        ? 'Gracias por tu reporte. La encuesta ha sido ocultada para revisión.'
        : 'Gracias por tu reporte. Lo revisaremos pronto.',
      reportCount,
      wasHidden
    });
  } catch (err: any) {
    console.error('[Report] Error:', err);
    if (err.status) throw err;
    throw error(500, `Error al reportar: ${err.message}`);
  }
};
