import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { parsePollIdInternal } from '$lib/server/hashids';

/**
 * GET /api/polls/[id]/votes-by-subdivision?country=ESP
 * Obtiene los votos de una encuesta desglosados por subdivisión de un país
 * 
 * Retorna: { "ESP.1": { "optionA": 10, "optionB": 5 }, "ESP.2": { "optionA": 3, "optionB": 8 } }
 */
export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const pollId = parsePollIdInternal(params.id!);
    const country = url.searchParams.get('country')?.toUpperCase();

    if (!pollId) {
      return json({ error: 'Invalid poll ID' }, { status: 400 });
    }

    if (!country) {
      return json({ error: 'Country parameter is required' }, { status: 400 });
    }

    // Obtener votos de la encuesta filtrados por país (usando prefijo de subdivisionId)
    const countryPrefix = `${country}.`;

    const votes = await prisma.vote.findMany({
      where: {
        pollId,
        subdivision: {
          subdivisionId: {
            startsWith: countryPrefix,
          },
        },
      },
      select: {
        optionId: true,
        subdivision: {
          select: {
            subdivisionId: true,
          },
        },
      },
    });

    // Obtener las opciones de la encuesta para mapear optionId -> optionKey
    const pollOptions = await prisma.pollOption.findMany({
      where: { pollId },
      select: {
        id: true,
        optionKey: true,
      },
    });

    const optionKeyMap = new Map(pollOptions.map(opt => [opt.id, opt.optionKey]));

    // Agregar votos por subdivisión
    const votesBySubdivision: Record<string, Record<string, number>> = {};

    for (const vote of votes) {
      const subdivisionId = vote.subdivision?.subdivisionId;
      if (!subdivisionId) continue;

      // Extraer el ID de nivel 1 (ESP.1, ESP.2, etc.) del subdivisionId completo
      // El formato es ESP.1, ESP.1.2, ESP.1.2.3 - queremos solo ESP.X
      const parts = subdivisionId.split('.');
      const level1Id = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : subdivisionId;

      if (!votesBySubdivision[level1Id]) {
        votesBySubdivision[level1Id] = {};
      }

      const optionKey = optionKeyMap.get(vote.optionId) || `option_${vote.optionId}`;
      votesBySubdivision[level1Id][optionKey] = (votesBySubdivision[level1Id][optionKey] || 0) + 1;
    }

    console.log(`[API votes-by-subdivision] Poll ${pollId}, Country ${country}: ${votes.length} votos, ${Object.keys(votesBySubdivision).length} subdivisiones`);

    return json({
      data: votesBySubdivision,
      meta: {
        pollId,
        country,
        totalVotes: votes.length,
        subdivisionCount: Object.keys(votesBySubdivision).length,
      },
    });
  } catch (error) {
    console.error('[API] Error getting votes by subdivision:', error);
    return json({ error: 'Failed to get votes by subdivision' }, { status: 500 });
  }
};
