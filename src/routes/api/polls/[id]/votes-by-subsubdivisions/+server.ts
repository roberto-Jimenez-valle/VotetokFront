import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/polls/{id}/votes-by-subsubdivisions?country={iso}&subdivision={id}
 * 
 * Retorna votos REALES agrupados por sub-subdivisión (nivel 2) para una subdivisión específica
 * Endpoint de solo lectura sin rate limiting (datos públicos)
 * 
 * Ejemplo: /api/polls/1/votes-by-subsubdivisions?country=ESP&subdivision=1
 * (Retorna votos de Sevilla, Jaén, etc. dentro de Andalucía)
 * 
 * IMPORTANTE: Usa IDs jerárquicos en subdivisionId (ESP.1.1, ESP.1.2, etc.)
 * 
 * Response:
 * {
 *   "data": {
 *     "ESP.1.1": { "option1": 20, "option2": 30, "option3": 10 },  // Sevilla
 *     "ESP.1.2": { "option1": 15, "option2": 25, "option3": 12 },  // Jaén
 *     ...
 *   }
 * }
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const pollId = parseInt(params.id);
	const countryIso = url.searchParams.get('country');
	const subdivisionId = url.searchParams.get('subdivision');

	if (!countryIso) {
		return json({ error: 'Country ISO code is required' }, { status: 400 });
	}

	if (!subdivisionId) {
		return json({ error: 'Subdivision ID is required' }, { status: 400 });
	}

	try {
		// Validar pollId
		if (isNaN(pollId) || pollId <= 0) {
			return json({ error: 'Invalid poll ID' }, { status: 400 });
		}

		// Normalizar subdivisionId para construir el patrón de búsqueda
		// Si viene "1", convertir a "ESP.1"
		// Si viene "ESP.1", mantener
		const normalizedSubdivisionId = subdivisionId.includes('.') 
			? subdivisionId 
			: `${countryIso}.${subdivisionId}`;
		
		console.log('[API votes-by-subsubdivisions] Buscando votos:', {
			pollId,
			countryIso,
			subdivisionId,
			normalizedSubdivisionId
		});
		
		// Obtener todas las opciones de la encuesta
		const pollOptions = await prisma.pollOption.findMany({
			where: { pollId },
			select: {
				id: true,
				optionKey: true
			}
		});

		if (pollOptions.length === 0) {
			console.log('[API votes-by-subsubdivisions] No se encontraron opciones para poll:', pollId);
			return json({ data: {} });
		}

		// 🔥 CORREGIDO: JOIN con subdivisions para obtener el subdivision_id jerárquico
		// votes.subdivision_id es INTEGER (FK)
		// subdivisions.subdivision_id es STRING jerárquico ("ESP.1.2")
		const searchPattern = normalizedSubdivisionId + '.%';
		
		const votes = await prisma.$queryRaw<Array<{ subdivisionId: string; optionId: number }>>`
			SELECT s.subdivision_id as "subdivisionId", v.option_id as "optionId"
			FROM votes v
			INNER JOIN subdivisions s ON v.subdivision_id = s.id
			WHERE v.poll_id = ${pollId}
			  AND s.subdivision_id LIKE ${searchPattern}
		`;
		
		console.log('[API votes-by-subsubdivisions] Votos encontrados:', votes.length);

		
		// Crear mapa de optionId -> optionKey
		const optionIdToKey = new Map(
			pollOptions.map(opt => [opt.id, opt.optionKey])
		);

		// Agrupar votos por sub-subdivisión
		const subSubdivisionVotes: Record<string, Record<string, number>> = {};

		for (const vote of votes) {
			if (!vote.subdivisionId) continue;

			// El subdivisionId ya viene en formato jerárquico (ESP.1.1, ESP.1.2, etc.)
			const subSubdivisionId = vote.subdivisionId;
			const optionKey = optionIdToKey.get(vote.optionId);

			if (!optionKey) continue;

			if (!subSubdivisionVotes[subSubdivisionId]) {
				subSubdivisionVotes[subSubdivisionId] = {};
			}

			subSubdivisionVotes[subSubdivisionId][optionKey] = 
				(subSubdivisionVotes[subSubdivisionId][optionKey] || 0) + 1;
		}

				
		return json({ data: subSubdivisionVotes });

	} catch (error) {
		console.error('[API votes-by-subsubdivisions] Error completo:', error);
		console.error('[API votes-by-subsubdivisions] Stack:', error instanceof Error ? error.stack : 'No stack');
		console.error('[API votes-by-subsubdivisions] Mensaje:', error instanceof Error ? error.message : String(error));
		
		// Retornar error detallado en desarrollo
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		const isDev = process.env.NODE_ENV === 'development';
		
		return json({ 
			error: 'Internal server error',
			...(isDev && { details: errorMessage, stack: error instanceof Error ? error.stack : undefined })
		}, { status: 500 });
	}
};
