import { json } from '@sveltejs/kit';
import type { RequestHandler} from './$types';
import { prisma } from '$lib/server/prisma';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const query = url.searchParams.get('q') || '';
		const level = parseInt(url.searchParams.get('level') || '0', 10);
		const limit = parseInt(url.searchParams.get('limit') || '20', 10);

		if (!query || query.trim().length < 2) {
			return json({ places: [] });
		}

		const whereClause: any = {
			OR: [
				{ name: { contains: query, mode: 'insensitive' } },
				{ nameLocal: { contains: query, mode: 'insensitive' } },
				{ nameVariant: { contains: query, mode: 'insensitive' } }
			]
		};

		// Filtrar por nivel si se especifica
		if (level > 0) {
			whereClause.level = level;
		}

		const places = await prisma.subdivision.findMany({
			where: whereClause,
			select: {
				id: true,
				subdivisionId: true,
				name: true,
				nameLocal: true,
				level: true,
				typeEnglish: true,
				latitude: true,
				longitude: true,
				_count: {
					select: {
						votes: true
					}
				}
			},
			orderBy: [
				{ name: 'asc' }
			],
			take: limit
		});

		const results = places.map(place => ({
			id: place.id,
			subdivisionId: place.subdivisionId,
			name: place.name,
			nameLocal: place.nameLocal,
			level: place.level,
			type: place.typeEnglish,
			latitude: place.latitude,
			longitude: place.longitude,
			votesCount: place._count.votes
		}));

		return json({ places: results });
	} catch (error) {
		console.error('[Search Places] Error:', error);
		return json({ error: 'Error searching places' }, { status: 500 });
	}
};
