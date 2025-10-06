import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/polls/{id}/votes-by-subdivisions?country={iso}
 * 
 * Retorna votos REALES agrupados por subdivisión para un país específico
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

		// 🔥 CORREGIDO: Obtener votos por subdivisionName (no subdivisionId que está NULL)
		const votes = await prisma.vote.findMany({
			where: {
				pollId,
				countryIso3: countryIso,
				subdivisionName: {
					not: null
				}
			},
			select: {
				subdivisionId: true,
				subdivisionName: true,
				optionId: true
			}
		});

		
		// Crear mapa de optionId -> optionKey
		const optionIdToKey = new Map(
			pollOptions.map(opt => [opt.id, opt.optionKey])
		);

		// Agrupar votos por subdivisión (nivel 1: ESP.1, ESP.2, etc.)
		const subdivisionVotes: Record<string, Record<string, number>> = {};

		for (const vote of votes) {
			// 🔥 Extraer el nivel 1 del subdivisionId granular
			// Si subdivisionId es "ESP.1.1", extraer "ESP.1"
			let subdivisionKey = vote.subdivisionId || vote.subdivisionName;
			if (!subdivisionKey) continue;

			// Si es un ID granular (ESP.1.1), extraer el nivel 1 (ESP.1)
			if (subdivisionKey.includes('.')) {
				const parts = subdivisionKey.split('.');
				if (parts.length === 3) {
					// "ESP.1.1" → "ESP.1"
					subdivisionKey = `${parts[0]}.${parts[1]}`;
				}
			}

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
