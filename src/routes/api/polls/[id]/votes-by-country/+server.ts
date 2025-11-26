import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/polls/{id}/votes-by-country
 * 
 * Retorna votos REALES agrupados por país
 * Endpoint de solo lectura sin rate limiting (datos públicos)
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

	if (isNaN(pollId)) {
		return json({ error: 'Invalid poll ID' }, { status: 400 });
	}

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

		// Obtener todos los votos con subdivisión
		const votes = await prisma.vote.findMany({
			where: {
				pollId
			},
			select: {
				optionId: true,
				subdivision: {
					select: {
						subdivisionId: true  // ESP.1.2 -> extraer ESP
					}
				}
			}
		});


		// Crear mapa de optionId -> optionKey
		const optionIdToKey = new Map(
			pollOptions.map(opt => [opt.id, opt.optionKey])
		);

		// Agrupar votos por país (extraer ISO3 de subdivisionId)
		const countryVotes: Record<string, Record<string, number>> = {};

		for (const vote of votes) {
			if (!vote.subdivision) continue;  // Skip si no tiene subdivisión

			// Extraer código país: ESP.1.2 -> ESP, ESP -> ESP
			const countryIso = vote.subdivision.subdivisionId.split('.')[0];
			const optionKey = optionIdToKey.get(vote.optionId);

			if (!optionKey) continue;

			if (!countryVotes[countryIso]) {
				countryVotes[countryIso] = {};
			}

			countryVotes[countryIso][optionKey] =
				(countryVotes[countryIso][optionKey] || 0) + 1;
		}


		console.log(`[API votes-by-country] Poll ${pollId}: ${votes.length} votos encontrados en BD`);
		console.log(`[API votes-by-country] Poll ${pollId}: ${Object.keys(countryVotes).length} países con datos`);
		console.log(`[API votes-by-country] Poll ${pollId}: Países:`, Object.keys(countryVotes));

		return json({ data: countryVotes });

	} catch (error) {
		console.error('[API] Error loading country votes:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
