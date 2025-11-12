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

		// Agrupar votos por TODOS los niveles (individual Y agregado)
		// Esto permite visualización en nivel 2 Y drill-down a nivel 3
		const subdivisionVotes: Record<string, Record<string, number>> = {};

		for (const vote of votes) {
			const optionKey = optionIdToKey.get(vote.optionId);
			if (!optionKey) continue;

			// 1. Guardar voto en el nivel COMPLETO (nivel 3)
			// BRA.20.124 → BRA.20.124
			const fullKey = vote.subdivision.subdivisionId;
			if (!subdivisionVotes[fullKey]) {
				subdivisionVotes[fullKey] = {};
			}
			subdivisionVotes[fullKey][optionKey] = 
				(subdivisionVotes[fullKey][optionKey] || 0) + 1;

			// 2. TAMBIÉN agregar al nivel 2 (para visualización de estados)
			// BRA.20.124 → BRA.20 (agregado)
			const parts = vote.subdivision.subdivisionId.split('.');
			if (parts.length >= 3) {
				// Solo agregar si es nivel 3 o superior
				const level2Key = `${parts[0]}.${parts[1]}`; // BRA.20
				if (!subdivisionVotes[level2Key]) {
					subdivisionVotes[level2Key] = {};
				}
				subdivisionVotes[level2Key][optionKey] = 
					(subdivisionVotes[level2Key][optionKey] || 0) + 1;
			}
		}

		
		return json({ data: subdivisionVotes });

	} catch (error) {
		console.error('[API] Error loading subdivision votes:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
