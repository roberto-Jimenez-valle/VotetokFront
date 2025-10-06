import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/users/trending?limit=10
 * 
 * Retorna usuarios trending basados en actividad reciente
 * 
 * Response:
 * {
 *   "data": [
 *     {
 *       "id": 1,
 *       "username": "user1",
 *       "displayName": "Usuario 1",
 *       "avatarUrl": "https://...",
 *       "verified": true
 *     },
 *     ...
 *   ]
 * }
 */
export const GET: RequestHandler = async ({ url }) => {
	const limit = parseInt(url.searchParams.get('limit') || '10');

	try {
		
		// Obtener usuarios con más encuestas activas recientes
		const trendingUsers = await prisma.user.findMany({
			where: {
				polls: {
					some: {
						status: 'active',
						createdAt: {
							gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
						}
					}
				}
			},
			select: {
				id: true,
				username: true,
				displayName: true,
				avatarUrl: true,
				verified: true,
				_count: {
					select: {
						polls: {
							where: {
								status: 'active'
							}
						}
					}
				}
			},
			orderBy: {
				polls: {
					_count: 'desc'
				}
			},
			take: limit
		});

		
		return json({ data: trendingUsers });

	} catch (error) {
		console.error('[API] Error loading trending users:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
