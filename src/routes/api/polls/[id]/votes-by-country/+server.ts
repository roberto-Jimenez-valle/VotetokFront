import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/polls/{id}/votes-by-country
 * 
 * Retorna votos REALES agrupados por país
 * 
 * Response:
 * {
 *   "data": {
 *     "ESP": { "option1": 150, "option2": 200, "option3": 100 },
 *     "FRA": { "option1": 300, "option2": 250, "option3": 200 },
 *     ...
 *   }
 * }
 */
export const GET: RequestHandler = async ({ params }) => {
	const pollId = parseInt(params.id);

	try {
		
		// Obtener todas las opciones de la encuesta
		const pollOptions = await prisma.pollOption.findMany({
			where: { pollId },
			select: {
				id: true,
				optionKey: true
			}
		});

		if (pollOptions.length === 0) {
			return json({ data: {} });
		}

		// Obtener todos los votos agrupados por país y opción
		const votes = await prisma.vote.findMany({
			where: {
				pollId
			},
			select: {
				countryIso3: true,
				optionId: true
			}
		});

		
		// Crear mapa de optionId -> optionKey
		const optionIdToKey = new Map(
			pollOptions.map(opt => [opt.id, opt.optionKey])
		);

		// Agrupar votos por país
		const countryVotes: Record<string, Record<string, number>> = {};

		for (const vote of votes) {
			const countryIso = vote.countryIso3;
			const optionKey = optionIdToKey.get(vote.optionId);

			if (!optionKey) continue;

			if (!countryVotes[countryIso]) {
				countryVotes[countryIso] = {};
			}

			countryVotes[countryIso][optionKey] = 
				(countryVotes[countryIso][optionKey] || 0) + 1;
		}

		
		return json({ data: countryVotes });

	} catch (error) {
		console.error('[API] Error loading country votes:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
