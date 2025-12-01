import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/polls/available-time-filters
 * 
 * Devuelve qué filtros de tiempo tienen datos disponibles.
 * 
 * Query params:
 * - pollId (opcional): ID de encuesta específica para ver qué períodos tienen votos
 * - region (opcional): Región para filtrar (Global, ESP, ESP.1, etc.)
 * 
 * Sin pollId: Devuelve períodos con encuestas trending
 * Con pollId: Devuelve períodos con votos para esa encuesta
 */
export const GET: RequestHandler = async ({ url }) => {
	const pollIdParam = url.searchParams.get('pollId');
	const pollId = pollIdParam ? parseInt(pollIdParam) : null;
	const region = url.searchParams.get('region') || 'Global';

	// Definir los períodos de tiempo en horas
	const TIME_PERIODS = {
		'24h': 24,
		'7d': 168,
		'30d': 720,
		'90d': 2160,
		'1y': 8760,
		'5y': 43800
	};

	const result: Record<string, boolean> = {};
	const now = new Date();

	try {
		if (pollId) {
			// Modo encuesta específica: verificar si hay votos en cada período
			
			// Primero, obtener la fecha de creación de la encuesta
			const poll = await prisma.poll.findUnique({
				where: { id: pollId },
				select: { createdAt: true }
			});
			
			if (!poll) {
				return json({ data: { '30d': true } }); // Fallback si no existe
			}
			
			// Calcular antigüedad de la encuesta en horas
			const pollAgeHours = (now.getTime() - poll.createdAt.getTime()) / (1000 * 60 * 60);
			
			for (const [period, hours] of Object.entries(TIME_PERIODS)) {
				// No mostrar filtros mayores que la antigüedad de la encuesta
				// (con un margen del 10% para ser flexibles)
				if (hours > pollAgeHours * 1.1) {
					result[period] = false;
					continue;
				}
				
				const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
				
				const whereClause: any = {
					pollId,
					createdAt: { gte: since }
				};

				// Filtrar por región si no es Global
				if (region !== 'Global') {
					whereClause.subdivision = {
						subdivisionId: {
							startsWith: region
						}
					};
				}

				const count = await prisma.vote.count({
					where: whereClause
				});

				result[period] = count > 0;
			}
		} else {
			// Modo trending: verificar si hay encuestas con votos en cada período
			for (const [period, hours] of Object.entries(TIME_PERIODS)) {
				const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
				
				// Buscar encuestas que tengan votos en este período
				const whereClause: any = {
					createdAt: { gte: since }
				};

				// Filtrar por región si no es Global
				if (region !== 'Global') {
					whereClause.subdivision = {
						subdivisionId: {
							startsWith: region
						}
					};
				}

				const count = await prisma.vote.count({
					where: whereClause
				});

				result[period] = count > 0;
			}
		}

		// Asegurar que al menos un período tenga datos (el más grande como fallback)
		const hasAnyData = Object.values(result).some(v => v);
		if (!hasAnyData) {
			result['30d'] = true; // Fallback: siempre mostrar 30d
		}

		return json({ data: result });

	} catch (error) {
		console.error('[API available-time-filters] Error:', error);
		// En caso de error, devolver todos como disponibles
		return json({ 
			data: {
				'24h': true,
				'7d': true,
				'30d': true,
				'90d': true,
				'1y': true,
				'5y': true
			}
		});
	}
};
