import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    const pollId = parseInt(params.id);
    const data = await request.json();
    const { label, color, userId } = data;

    // Validaciones
    if (!label || label.trim().length === 0) {
      return error(400, { message: 'El label es requerido' });
    }

    // Verificar que la encuesta existe y es colaborativa
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: true }
    });

    if (!poll) {
      return error(404, { message: 'Encuesta no encontrada' });
    }

    if (poll.type !== 'collaborative') {
      return error(400, { message: 'Solo se pueden añadir opciones a encuestas colaborativas' });
    }

    if (poll.options.length >= 10) {
      return error(400, { message: 'Ya hay 10 opciones, límite alcanzado' });
    }

    // Determinar el userId a usar
    let finalUserId = userId;
    
    // Si no se proporciona userId, intentar obtenerlo de locals (sesión)
    if (!finalUserId && locals.user) {
      finalUserId = locals.user.id;
    }
    
    // Si aún no hay userId, usar el creador de la encuesta como fallback
    if (!finalUserId) {
      finalUserId = poll.userId;
    }

    // Obtener el usuario para el avatarUrl
    const user = await prisma.user.findUnique({
      where: { id: finalUserId },
      select: { avatarUrl: true }
    });

    // Generar optionKey único
    const optionKey = `opt-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Crear la nueva opción
    const newOption = await prisma.pollOption.create({
      data: {
        pollId: pollId,
        optionKey: optionKey,
        optionLabel: label.trim(),
        color: color || '#3b82f6',
        createdById: finalUserId,
        displayOrder: poll.options.length
      },
      include: {
        createdBy: {
          select: {
            id: true,
            avatarUrl: true,
            displayName: true
          }
        },
        _count: {
          select: {
            votes: true
          }
        }
      }
    });

    // Transformar datos para compatibilidad con frontend
    const transformedOption = {
      ...newOption,
      voteCount: newOption._count.votes,
      avatarUrl: newOption.createdBy?.avatarUrl || null
    };

    return json({
      success: true,
      data: transformedOption
    });

  } catch (err: any) {
    console.error('Error creating option:', err);
    return error(500, { message: err.message || 'Error al crear la opción' });
  }
};
