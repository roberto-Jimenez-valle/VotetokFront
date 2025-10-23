import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/polls/{id}/votes-by-subdivisions?country={iso}
 * 
 * Retorna votos REALES agrupados por subdivisión para un país específico
 * Endpoint de solo lectura sin rate limiting (datos públicos)
 * 
 * Response:
 * {
 *   "data": {
 *     "1": { "option1": 50, "option2": 75, "option3": 25 },
 *     "2": { "option1": 30, "option2": 40, "option3": 20 },
 *     ...
 *   }
 * }
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const pollId = parseInt(params.id);
	const countryIso = url.searchParams.get('country');

	if (!countryIso) {
		return json({ error: 'Country ISO code is required' }, { status: 400 });
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

		// Obtener votos con subdivisión del país especificado
		const votes = await prisma.vote.findMany({
			where: {
				pollId,
				subdivision: {
					subdivisionId: {
						startsWith: countryIso  // ESP, FRA, etc.
					}
				}
			},
			select: {
				optionId: true,
				subdivision: {
					select: {
						subdivisionId: true,  // ESP.1.2
						level: true
					}
				}
			}
		});

		
		// Crear mapa de optionId -> optionKey
		const optionIdToKey = new Map(
			pollOptions.map(opt => [opt.id, opt.optionKey])
		);

		// Agrupar votos por subdivisión nivel 2 (comunidades/estados)
		const subdivisionVotes: Record<string, Record<string, number>> = {};

		for (const vote of votes) {
			// Extraer nivel 2 del subdivisionId
			// ESP.1.2 → ESP.1 (comunidad)
			// ESP.1 → ESP.1 (ya es comunidad)
			const parts = vote.subdivision.subdivisionId.split('.');
			const subdivisionKey = parts.length >= 2 
				? `${parts[0]}.${parts[1]}`  // ESP.1
				: vote.subdivision.subdivisionId;  // ESP (fallback a país)

			const optionKey = optionIdToKey.get(vote.optionId);
			if (!optionKey) continue;

			if (!subdivisionVotes[subdivisionKey]) {
				subdivisionVotes[subdivisionKey] = {};
			}

			subdivisionVotes[subdivisionKey][optionKey] = 
				(subdivisionVotes[subdivisionKey][optionKey] || 0) + 1;
		}

		
		return json({ data: subdivisionVotes });

	} catch (error) {
		console.error('[API] Error loading subdivision votes:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
