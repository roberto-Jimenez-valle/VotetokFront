import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/subdivisions/check-lowest?id={subdivisionId}
 * 
 * Verifica si una subdivisión es el último nivel disponible
 * 
 * Response:
 * {
 *   "isLowestLevel": true/false
 * }
 */
export const GET: RequestHandler = async ({ url }) => {
	const subdivisionId = url.searchParams.get('id');

	if (!subdivisionId) {
		return json({ error: 'Subdivision ID is required' }, { status: 400 });
	}

	try {
		const subdivision = await prisma.subdivision.findFirst({
			where: {
				subdivisionId: subdivisionId
			},
			select: {
				isLowestLevel: true
			}
		});

		if (!subdivision) {
			// Si no existe en la DB, asumir que NO es el último nivel
			// (para compatibilidad con subdivisiones que no están en la DB)
			return json({ isLowestLevel: false });
		}

		return json({ isLowestLevel: subdivision.isLowestLevel });

	} catch (error) {
		console.error('[API] Error checking isLowestLevel:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
