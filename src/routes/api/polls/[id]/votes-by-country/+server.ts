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
export const GET: RequestHandler = async ({ params, url }) => {
	const pollId = parseInt(params.id);
	const hoursParam = url.searchParams.get('hours');
	const hours = hoursParam ? parseInt(hoursParam) : null;

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

		// Construir filtro de fecha si se especificó hours
		const dateFilter = hours ? {
			createdAt: {
				gte: new Date(Date.now() - hours * 60 * 60 * 1000)
			}
		} : {};

		// Obtener votos con subdivisión (filtrados por fecha si aplica)
		const votes = await prisma.vote.findMany({
			where: {
				pollId,
				...dateFilter
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


		const hoursLabel = hours ? `últimas ${hours}h` : 'todos';
		console.log(`[API votes-by-country] Poll ${pollId} (${hoursLabel}): ${votes.length} votos, ${Object.keys(countryVotes).length} países`);

		return json({ data: countryVotes });

	} catch (error) {
		console.error('[API] Error loading country votes:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
