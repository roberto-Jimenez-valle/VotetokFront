import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const query = url.searchParams.get('q') || '';
		const filter = url.searchParams.get('filter') || 'all';
		const limit = parseInt(url.searchParams.get('limit') || '20', 10);
		const session = locals.session;
		
		// Subfiltros
		const sort = url.searchParams.get('sort') || 'all'; // all, trending, o recent
		const userType = url.searchParams.get('userType') || 'all'; // all, trending, followers, o following
		const placeType = url.searchParams.get('placeType') || 'trending'; // trending, popular, country, state

		const results: {
			polls: any[];
			users: any[];
			places: any[];
		} = {
			polls: [],
			users: [],
			places: []
		};

		// Buscar encuestas
		if (filter === 'all' || filter === 'polls') {
			const whereClause = query.trim() 
				? {
						status: 'active' as const,
						OR: [
							{ title: { contains: query } },
							{ description: { contains: query } },
							{ category: { contains: query } }
						]
					}
				: { status: 'active' as const };

			// Ordenamiento según subfiltro
			let orderBy;
			if (sort === 'trending') {
				orderBy = [{ votes: { _count: 'desc' as const } }];
			} else if (sort === 'recent') {
				orderBy = [{ createdAt: 'desc' as const }];
			} else {
				// 'all' - mezcla de trending y recent
				orderBy = [
					{ votes: { _count: 'desc' as const } },
					{ createdAt: 'desc' as const }
				];
			}

			const polls = await prisma.poll.findMany({
				where: whereClause,
				include: {
					user: {
						select: {
							id: true,
							username: true,
							displayName: true,
							avatarUrl: true
						}
					},
					options: {
						select: {
							id: true,
							optionKey: true,
							optionLabel: true,
							color: true
						}
					},
					_count: {
						select: {
							votes: true,
							comments: true
						}
					}
				},
				orderBy: orderBy,
				take: limit
			});

			results.polls = polls.map(poll => ({
				id: poll.id,
				title: poll.title,
				description: poll.description,
				category: poll.category,
				imageUrl: poll.imageUrl,
				type: poll.type,
				createdAt: poll.createdAt,
				user: poll.user,
				options: poll.options,
				votesCount: poll._count.votes,
				commentsCount: poll._count.comments
			}));
		}

		// Buscar usuarios
		if (filter === 'all' || filter === 'users') {
			let whereClauseUsers: any = query.trim()
				? {
						OR: [
							{ username: { contains: query } },
							{ displayName: { contains: query } },
							{ bio: { contains: query } }
						]
					}
				: {};
			
			// Filtrar según el tipo de usuario
			if (userType === 'followers' && session?.userId) {
				// Solo seguidores del usuario actual
				whereClauseUsers.followers = {
					some: {
						followingId: session.userId
					}
				};
			} else if (userType === 'following' && session?.userId) {
				// Solo usuarios que el usuario actual sigue
				whereClauseUsers.following = {
					some: {
						followerId: session.userId
					}
				};
			}

			// Ordenamiento según subfiltro de usuarios
			let userOrderBy;
			if (userType === 'trending') {
				// Ordenar por usuarios con más actividad (más encuestas y seguidores)
				userOrderBy = [
					{ polls: { _count: 'desc' as const } },
					{ followers: { _count: 'desc' as const } }
				];
			} else {
				// 'all', 'followers', 'following' - ordenamiento por defecto
				userOrderBy = [
					{ verified: 'desc' as const },
					{ createdAt: 'desc' as const }
				];
			}

			const users = await prisma.user.findMany({
				where: whereClauseUsers,
				select: {
					id: true,
					username: true,
					displayName: true,
					avatarUrl: true,
					bio: true,
					verified: true,
					_count: {
						select: {
							polls: true,
							followers: true
						}
					}
				},
				orderBy: userOrderBy,
				take: limit
			});

			// Obtener lista de usuarios que el usuario actual sigue
			let followingIds: number[] = [];
			if (session?.userId) {
				const following = await prisma.userFollower.findMany({
					where: {
						followerId: session.userId,
						followingId: { in: users.map(u => u.id) }
					},
					select: { followingId: true }
				});
				followingIds = following.map((f: { followingId: number }) => f.followingId);
			}

			results.users = users.map(user => ({
				id: user.id,
				username: user.username,
				displayName: user.displayName,
				avatarUrl: user.avatarUrl,
				bio: user.bio,
				verified: user.verified,
				pollsCount: user._count.polls,
				followersCount: user._count.followers,
				isFollowing: followingIds.includes(user.id)
			}));
		}

		// Buscar lugares (subdivisiones)
		if (filter === 'all' || filter === 'places') {
			let whereClausePlaces: any = query.trim()
				? {
						OR: [
							{ name: { contains: query } },
							{ nameLocal: { contains: query } },
							{ nameVariant: { contains: query } }
						]
					}
				: {};
			
			// Filtrar por nivel geográfico
			if (placeType === 'country') {
				whereClausePlaces.level = 1; // Solo países
			} else if (placeType === 'state') {
				whereClausePlaces.level = 2; // Solo estados/comunidades
			} else if (placeType === 'city') {
				whereClausePlaces.level = 3; // Solo ciudades
			}
			// 'all' no filtra por nivel, muestra todos

			// Todos ordenados por tendencias (más votos)
			const placesOrderBy: any[] = [
				{ votes: { _count: 'desc' } },
				{ name: 'asc' }
			];

			const places = await prisma.subdivision.findMany({
				where: whereClausePlaces,
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
				orderBy: placesOrderBy,
				take: limit
			});

			results.places = places.map(place => ({
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
		}

		return json({
			success: true,
			data: results,
			query: query,
			filter: filter,
			isSearch: query.trim().length > 0
		});

	} catch (error) {
		console.error('[Search API] Error:', error);
		return json(
			{
				success: false,
				error: 'Error al realizar la búsqueda',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
