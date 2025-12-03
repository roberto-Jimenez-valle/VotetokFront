import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

/**
 * POST /api/polls/[id]/report
 * Reportar una encuesta
 */
export const POST: RequestHandler = async ({ params, locals, request }) => {
  try {
    const pollId = Number(params.id);
    
    if (isNaN(pollId)) {
      throw error(400, 'ID de encuesta inválido');
    }
    
    const userId = locals.user?.userId || locals.user?.id;
    if (!userId) {
      throw error(401, 'Debes iniciar sesión para reportar');
    }
    
    // Obtener razón del reporte (opcional)
    let reason = 'other';
    try {
      const body = await request.json();
      reason = body.reason || 'other';
    } catch {
      // Sin body, usar razón por defecto
    }
    
    // Verificar que la encuesta existe
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { id: true, userId: true }
    });
    
    if (!poll) {
      throw error(404, 'Encuesta no encontrada');
    }
    
    // No permitir reportar tu propia encuesta
    if (poll.userId === Number(userId)) {
      throw error(400, 'No puedes reportar tu propia encuesta');
    }
    
    // Verificar si ya reportó
    const existingReport = await prisma.pollInteraction.findUnique({
      where: {
        pollId_userId_interactionType: {
          pollId,
          userId: Number(userId),
          interactionType: 'report'
        }
      }
    });
    
    if (existingReport) {
      return json({ success: true, message: 'Ya has reportado esta encuesta' });
    }
    
    // Crear el reporte
    await prisma.pollInteraction.create({
      data: {
        pollId,
        userId: Number(userId),
        interactionType: 'report'
      }
    });
    
    // Contar reportes totales
    const reportCount = await prisma.pollInteraction.count({
      where: { pollId, interactionType: 'report' }
    });
    
    // Si hay muchos reportes, podríamos marcar la encuesta para revisión
    // Por ahora solo logueamos
    if (reportCount >= 5) {
      console.log(`[Report] ⚠️ Encuesta ${pollId} tiene ${reportCount} reportes - revisar`);
    }
    
    return json({ 
      success: true, 
      message: 'Gracias por tu reporte. Lo revisaremos pronto.',
      reportCount 
    });
  } catch (err: any) {
    console.error('[Report] Error:', err);
    if (err.status) throw err;
    throw error(500, `Error al reportar: ${err.message}`);
  }
};
