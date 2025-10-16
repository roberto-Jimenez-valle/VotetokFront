import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const GET: RequestHandler = async ({ params }) => {
  const pollId = Number(params.id);

  // Verificar que la encuesta existe
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: { id: true },
  });

  if (!poll) {
    throw error(404, 'Poll not found');
  }

  // Obtener estadísticas
  const [totalVotes, votesByOption, votesBySubdivision] = await Promise.all([
    // Total de votos
    prisma.vote.count({
      where: { pollId },
    }),

    // Votos por opción
    prisma.vote.groupBy({
      by: ['optionId'],
      where: { pollId },
      _count: true,
    }),

    // Votos por subdivisión (incluye país, comunidad, provincia)
    prisma.vote.groupBy({
      by: ['subdivisionId'],
      where: { pollId },
      _count: true,
    }),
  ]);

  // Obtener datos completos de subdivisiones para agrupar por país
  const subdivisions = await prisma.subdivision.findMany({
    where: {
      id: {
        in: votesBySubdivision.map(v => v.subdivisionId)
      }
    },
    select: {
      id: true,
      subdivisionId: true,
      name: true,
      level: true
    }
  });

  const subdivisionMap = new Map(subdivisions.map(s => [s.id, s]));

  // Formatear resultados
  const votesByOptionMap = votesByOption.reduce((acc, item) => {
    acc[item.optionId] = item._count;
    return acc;
  }, {} as Record<number, number>);

  // Agrupar por país (nivel 1)
  const votesByCountryMap: Record<string, number> = {};
  const votesBySubdivisionMap: Record<string, { name: string, level: number, count: number }> = {};

  for (const vote of votesBySubdivision) {
    const sub = subdivisionMap.get(vote.subdivisionId);
    if (sub) {
      // Extraer código país
      const countryIso = sub.subdivisionId.split('.')[0];
      votesByCountryMap[countryIso] = (votesByCountryMap[countryIso] || 0) + vote._count;
      
      // Guardar también por subdivisión
      votesBySubdivisionMap[sub.subdivisionId] = {
        name: sub.name,
        level: sub.level,
        count: vote._count
      };
    }
  }

  return json({
    data: {
      totalVotes,
      votesByOption: votesByOptionMap,
      votesByCountry: votesByCountryMap,
      votesBySubdivision: votesBySubdivisionMap,
    },
  });
};
