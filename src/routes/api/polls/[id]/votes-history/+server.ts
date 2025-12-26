import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { parsePollIdInternal } from '$lib/server/hashids';

// Endpoint público - no requiere autenticación
export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const pollId = parsePollIdInternal(params.id || '');
    
    if (!pollId) {
      throw error(400, 'Invalid poll ID');
    }
    const days = Number(url.searchParams.get('days') || '30');
    
    console.log('[API votes-history] Consultando votos para poll', pollId, 'últimos', days, 'días');
    const optionKey = url.searchParams.get('optionKey'); // Opcional: filtrar por opción

    // Obtener opciones de la encuesta SOLO para colores/labels (no para conteos)
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { 
        id: true,
        options: {
          select: {
            id: true,
            optionKey: true,
            optionLabel: true,
            color: true
          }
        }
      },
    });

    if (!poll) {
      throw error(404, 'Poll not found');
    }

    // Calcular fecha de inicio
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // OBTENER TODOS LOS VOTOS - ÚNICA FUENTE DE DATOS
    const votes = await prisma.vote.findMany({
      where: {
        pollId,
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        id: true,
        createdAt: true,
        optionId: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log('[API votes-history] Consultando SOLO tabla votes, encontrados:', votes.length, 'votos totales');

    // PASO 1: Generar TODOS los períodos del rango (con 0 si no hay votos)
    const allPeriods = generateAllPeriods(startDate, new Date(), days);
    console.log('[API votes-history] Generados', allPeriods.length, 'períodos para', days, 'días');
    
    // PASO 2: Agrupar votos reales por período
    const votesGrouped = new Map<string, Map<number, number>>();
    
    votes.forEach((vote) => {
      const periodKey = getPeriodKey(vote.createdAt, days);
      
      if (!votesGrouped.has(periodKey)) {
        votesGrouped.set(periodKey, new Map());
      }
      
      const periodVotes = votesGrouped.get(periodKey)!;
      periodVotes.set(vote.optionId, (periodVotes.get(vote.optionId) || 0) + 1);
    });

    // Crear un mapa de optionId -> opción para fácil acceso
    const optionsMap = new Map(poll.options.map(opt => [opt.id, opt]));

    // PASO 3: Generar serie temporal con TODOS los períodos
    const timeSeries: Array<{
      timestamp: number;
      totalVotes: number;
      optionsData: Array<{
        optionId: number;
        optionKey: string;
        optionLabel: string;
        color: string;
        votes: number;
      }>;
    }> = [];

    // Para cada período en el rango completo
    allPeriods.forEach((periodKey) => {
      const optionVotes = votesGrouped.get(periodKey) || new Map();
      const totalVotes = Array.from(optionVotes.values()).reduce((sum, count) => sum + count, 0);
      
      // Crear array con datos de TODAS las opciones (con 0 si no hay votos)
      const optionsData = poll.options.map(option => {
        const votes = optionVotes.get(option.id) || 0;
        return {
          optionId: option.id,
          optionKey: option.optionKey,
          optionLabel: option.optionLabel,
          color: option.color,
          votes
        };
      });

      timeSeries.push({
        timestamp: new Date(periodKey).getTime(),
        totalVotes,
        optionsData
      });
    });

    // VERIFICAR: Sumar todos los votos de los puntos debe igual al total de votos
    const totalVotesInSeries = timeSeries.reduce((sum, point) => sum + point.totalVotes, 0);
    console.log('[API votes-history] ✅ Verificación:', {
      votosEnTabla: votes.length,
      votosEnSeries: totalVotesInSeries,
      coinciden: votes.length === totalVotesInSeries,
      puntos: timeSeries.length,
      opciones: poll.options.length
    });

    return json({
      data: timeSeries,
      poll: {
        id: poll.id,
        options: poll.options
      },
      meta: {
        pollId,
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        dataPoints: timeSeries.length,
        totalVotesFromDB: votes.length, // Total real de la tabla votes
        totalVotesInSeries: totalVotesInSeries // Suma de todos los puntos
      },
    });
  } catch (err) {
    console.error('[API] Error loading poll votes history:', err);
    throw error(500, 'Failed to load votes history');
  }
};

// Helper para generar TODOS los períodos del rango
function generateAllPeriods(startDate: Date, endDate: Date, days: number): string[] {
  const periods: string[] = [];
  const current = new Date(startDate);
  
  if (days <= 1) {
    // 1 día → 24 horas
    for (let i = 0; i < 24; i++) {
      const periodDate = new Date(endDate);
      periodDate.setHours(periodDate.getHours() - (23 - i), 0, 0, 0);
      periods.push(periodDate.toISOString());
    }
  } else if (days <= 7) {
    // 5-7 días → Por días
    const numDays = days;
    for (let i = 0; i < numDays; i++) {
      const periodDate = new Date(endDate);
      periodDate.setDate(periodDate.getDate() - (numDays - 1 - i));
      periodDate.setHours(0, 0, 0, 0);
      periods.push(periodDate.toISOString());
    }
  } else if (days <= 30) {
    // 30 días → Por días
    for (let i = 0; i < 30; i++) {
      const periodDate = new Date(endDate);
      periodDate.setDate(periodDate.getDate() - (29 - i));
      periodDate.setHours(0, 0, 0, 0);
      periods.push(periodDate.toISOString());
    }
  } else if (days <= 180) {
    // 6 meses → 6 puntos (1 por mes)
    for (let i = 0; i < 6; i++) {
      const periodDate = new Date(endDate);
      periodDate.setMonth(periodDate.getMonth() - (5 - i));
      periodDate.setDate(1);
      periodDate.setHours(0, 0, 0, 0);
      periods.push(periodDate.toISOString());
    }
  } else {
    // 1 año → 12 meses
    for (let i = 0; i < 12; i++) {
      const periodDate = new Date(endDate);
      periodDate.setMonth(periodDate.getMonth() - (11 - i));
      periodDate.setDate(1);
      periodDate.setHours(0, 0, 0, 0);
      periods.push(periodDate.toISOString());
    }
  }
  
  return periods;
}

// Helper para determinar la clave de período según la granularidad
function getPeriodKey(date: Date, days: number): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hour = date.getHours();
  
  if (days <= 1) {
    // 1 día → Por horas
    return new Date(year, month, day, hour, 0, 0, 0).toISOString();
  } else if (days <= 7) {
    // Hasta 7 días → Por días
    return new Date(year, month, day, 0, 0, 0, 0).toISOString();
  } else if (days <= 30) {
    // Hasta 30 días → Por días
    return new Date(year, month, day, 0, 0, 0, 0).toISOString();
  } else if (days <= 180) {
    // Hasta 6 meses → Por meses
    return new Date(year, month, 1, 0, 0, 0, 0).toISOString();
  } else {
    // Más de 6 meses → Por meses
    return new Date(year, month, 1, 0, 0, 0, 0).toISOString();
  }
}
