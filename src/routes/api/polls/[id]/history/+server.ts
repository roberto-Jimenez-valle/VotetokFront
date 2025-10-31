import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const pollId = Number(params.id);
    const days = Number(url.searchParams.get('days') || '30');

    // Verificar que la encuesta existe
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { id: true },
    });

    if (!poll) {
      return json({ message: 'Poll not found' }, { status: 404 });
    }

    // Calcular fecha de inicio
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Obtener historial de votos
    const history = await prisma.voteHistory.findMany({
      where: {
        pollId,
        recordedAt: {
          gte: startDate,
        },
      },
      include: {
        option: {
          select: {
            id: true,
            optionKey: true,
            optionLabel: true,
            color: true,
          },
        },
      },
      orderBy: {
        recordedAt: 'asc',
      },
    });

    return json({
      data: history,
      meta: {
        pollId,
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        recordCount: history.length,
      },
    });
  } catch (err) {
    console.error('[API] Error loading poll history:', err);
    // Si hay error, devolver array vacío en lugar de error 500
    return json({
      data: [],
      meta: {
        pollId: Number(params.id),
        days: Number(url.searchParams.get('days') || '30'),
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        recordCount: 0,
        error: 'Failed to load history',
      },
    });
  }
};
