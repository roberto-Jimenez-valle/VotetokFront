import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { parsePollIdInternal } from '$lib/server/hashids';

/**
 * POST /api/polls/[id]/share
 * Registra un share de la encuesta usando PollInteraction
 */
export const POST: RequestHandler = async ({ params, locals, getClientAddress }) => {
  try {
    const pollId = parsePollIdInternal(params.id);
    
    if (!pollId) {
      return json({ error: 'ID de encuesta inválido' }, { status: 400 });
    }

    // Verificar que la encuesta existe
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { id: true }
    });

    if (!poll) {
      return json({ error: 'Encuesta no encontrada' }, { status: 404 });
    }

    // Obtener userId si está autenticado
    const userId = locals?.user?.id || null;
    
    // Obtener IP para tracking anónimo
    let ipAddress: string | null = null;
    try {
      ipAddress = getClientAddress();
    } catch {
      ipAddress = null;
    }

    // Registrar el share como interacción
    // Si el usuario está logueado, intentar crear o actualizar
    // Si es anónimo (userId null), crear con IP
    try {
      if (userId) {
        // Para usuarios logueados, usar upsert para evitar duplicados
        await prisma.pollInteraction.upsert({
          where: {
            pollId_userId_interactionType: {
              pollId,
              userId,
              interactionType: 'share'
            }
          },
          update: {
            createdAt: new Date() // Actualizar timestamp
          },
          create: {
            pollId,
            userId,
            interactionType: 'share',
            ipAddress
          }
        });
      } else {
        // Para usuarios anónimos, crear nueva entrada cada vez
        await prisma.pollInteraction.create({
          data: {
            pollId,
            userId: null,
            interactionType: 'share',
            ipAddress
          }
        });
      }
    } catch (e) {
      // Ignorar errores de constraint - el share ya existe
      console.log('[Share] Interacción ya existe o error:', e);
    }

    // Contar todos los shares
    const shareCount = await prisma.pollInteraction.count({
      where: {
        pollId,
        interactionType: 'share'
      }
    });

    return json({
      success: true,
      shareCount,
      shareUrl: `/poll/${pollId}`
    });

  } catch (error) {
    console.error('[Share API] Error:', error);
    return json({ error: 'Error al registrar el share' }, { status: 500 });
  }
};

/**
 * GET /api/polls/[id]/share
 * Obtiene el contador de shares
 */
export const GET: RequestHandler = async ({ params }) => {
  try {
    const pollId = parsePollIdInternal(params.id);
    
    if (!pollId) {
      return json({ error: 'ID de encuesta inválido' }, { status: 400 });
    }

    // Verificar que la encuesta existe
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { id: true }
    });

    if (!poll) {
      return json({ error: 'Encuesta no encontrada' }, { status: 404 });
    }

    // Contar shares desde PollInteraction
    const shareCount = await prisma.pollInteraction.count({
      where: {
        pollId,
        interactionType: 'share'
      }
    });

    return json({
      shareCount
    });

  } catch (error) {
    console.error('[Share API] Error:', error);
    return json({ error: 'Error al obtener el contador' }, { status: 500 });
  }
};
