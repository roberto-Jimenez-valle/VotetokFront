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
  const [totalVotes, votesByOption, votesByCountry, votesByCity] = await Promise.all([
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

    // Votos por país
    prisma.vote.groupBy({
      by: ['countryIso3'],
      where: { pollId },
      _count: true,
    }),

    // Votos por ciudad
    prisma.vote.groupBy({
      by: ['cityName'],
      where: { 
        pollId,
        cityName: { not: null },
      },
      _count: true,
    }),
  ]);

  // Formatear resultados
  const votesByOptionMap = votesByOption.reduce((acc, item) => {
    acc[item.optionId] = item._count;
    return acc;
  }, {} as Record<number, number>);

  const votesByCountryMap = votesByCountry.reduce((acc, item) => {
    acc[item.countryIso3] = item._count;
    return acc;
  }, {} as Record<string, number>);

  const votesByCityMap = votesByCity.reduce((acc, item) => {
    if (item.cityName) {
      acc[item.cityName] = item._count;
    }
    return acc;
  }, {} as Record<string, number>);

  return json({
    data: {
      totalVotes,
      votesByOption: votesByOptionMap,
      votesByCountry: votesByCountryMap,
      votesByCity: votesByCityMap,
    },
  });
};
