import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { parsePollIdInternal } from '$lib/server/hashids';

/**
 * GET /api/polls/{id}/votes-by-country
 * 
 * Retorna votos REALES agrupados por país
 * Endpoint de solo lectura sin rate limiting (datos públicos)
 */
export const GET: RequestHandler = async ({ params, url }) => {
	console.log(`[API votes-by-country] Request for ID: ${params.id}`);
	const pollId = parsePollIdInternal(params.id!);
	console.log(`[API votes-by-country] Decoded pollId: ${pollId}`);

	const hoursParam = url.searchParams.get('hours');
	const hours = hoursParam ? parseInt(hoursParam) : null;

	if (!pollId) {
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
						subdivisionId: true
					}
				}
			}
		});

		console.log(`[API votes-by-country] Poll ${pollId}: Found ${votes.length} total votes`);
		const votesWithSubdivision = votes.filter(v => v.subdivision);
		console.log(`[API votes-by-country] Votes with subdivision: ${votesWithSubdivision.length}`);
		if (votes.length > 0 && votesWithSubdivision.length === 0) {
			console.warn(`[API votes-by-country] ⚠️ ALERT: Poll has votes but NONE have subdivision data!`);
		}

		// Crear mapa de optionId -> optionKey
		const optionIdToKey = new Map(
			pollOptions.map(opt => [opt.id, opt.optionKey])
		);

		// Agrupar votos por país (extraer ISO3 de subdivisionId)
		const countryVotes: Record<string, Record<string, number>> = {};

		for (const vote of votes) {
			if (!vote.subdivision) continue;

			// Extraer código país: ESP.1.2 -> ESP, ESP -> ESP
			const countryIso = vote.subdivision.subdivisionId.split('.')[0].toUpperCase();
			const optionKey = optionIdToKey.get(vote.optionId);

			if (!optionKey) continue;

			if (!countryVotes[countryIso]) {
				countryVotes[countryIso] = {};
			}

			countryVotes[countryIso][optionKey] =
				(countryVotes[countryIso][optionKey] || 0) + 1;
		}

		const hoursLabel = hours ? `últimas ${hours}h` : 'todos';
		const totalVotes = votes.length;
		const totalWithSubdivision = votesWithSubdivision.length;

		console.log(`[API votes-by-country] Poll ${pollId} (${hoursLabel}): ${totalVotes} total, ${totalWithSubdivision} with subdiv, ${Object.keys(countryVotes).length} countries`);

		return json({
			data: countryVotes,
			debug: {
				totalVotes,
				totalWithSubdivision,
				pollId,
				hoursLabel
			}
		});

	} catch (error) {
		console.error('[API] Error loading country votes:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
