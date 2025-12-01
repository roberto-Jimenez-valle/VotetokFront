import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const query = url.searchParams.get('q') || '';
		const filter = url.searchParams.get('filter') || 'all';
		const limit = parseInt(url.searchParams.get('limit') || '20', 10);
		const user = locals.user;
		
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
			if (userType === 'followers' && user?.userId) {
				// Solo seguidores del usuario actual
				whereClauseUsers.followers = {
					some: {
						followingId: user.userId
					}
				};
			} else if (userType === 'following' && user?.userId) {
				// Solo usuarios que el usuario actual sigue
				whereClauseUsers.following = {
					some: {
						followerId: user.userId
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
			if (user?.userId) {
				const following = await prisma.userFollower.findMany({
					where: {
						followerId: user.userId,
						followingId: { in: users.map(u => u.id) }
					},
					select: { followingId: true }
				});
				followingIds = following.map(f => f.followingId);
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
							{ name: { contains: query, mode: 'insensitive' } },
							{ nameLocal: { contains: query, mode: 'insensitive' } },
							{ nameVariant: { contains: query, mode: 'insensitive' } }
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

			// Obtener todos los prefijos a verificar (países y subdivisiones nivel 2)
			const allPrefixes = [...new Set(places
				.filter(p => p.subdivisionId)
				.flatMap(p => {
					const parts = p.subdivisionId.split('.');
					const prefixes = [parts[0]]; // País
					if (parts.length >= 2) {
						prefixes.push(`${parts[0]}.${parts[1]}`); // Subdivisión nivel 2
					}
					return prefixes;
				})
			)];

			// Verificar qué prefijos tienen votos (directos o en subdivisiones hijas)
			// Esto encuentra TODAS las subdivisiones con votos que empiezan con cada prefijo
			const subdivisionsWithVotesResult = allPrefixes.length > 0
				? await prisma.subdivision.findMany({
						where: {
							OR: allPrefixes.map(prefix => ({
								subdivisionId: { startsWith: prefix },
								votes: { some: {} }
							}))
						},
						select: {
							subdivisionId: true
						}
					})
				: [];
			
			// Crear un Set de prefijos que tienen al menos una subdivisión con votos
			const prefixesWithVotesSet = new Set<string>();
			for (const subdiv of subdivisionsWithVotesResult) {
				const parts = subdiv.subdivisionId.split('.');
				// Añadir el país
				prefixesWithVotesSet.add(parts[0]);
				// Añadir la subdivisión nivel 2 si existe
				if (parts.length >= 2) {
					prefixesWithVotesSet.add(`${parts[0]}.${parts[1]}`);
				}
				// Añadir la subdivisión exacta
				prefixesWithVotesSet.add(subdiv.subdivisionId);
			}

			// Para nivel 2+, obtener los nombres de los padres
			const parentIds = places
				.filter(p => p.level >= 2 && p.subdivisionId)
				.map(p => {
					const parts = p.subdivisionId.split('.');
					if (p.level === 2) return parts[0]; // País padre
					if (p.level === 3) return `${parts[0]}.${parts[1]}`; // Subdivisión padre
					return null;
				})
				.filter(Boolean) as string[];

			// Obtener nombres de padres si existen
			const parents = parentIds.length > 0
				? await prisma.subdivision.findMany({
						where: {
							subdivisionId: { in: [...new Set(parentIds)] }
						},
						select: {
							subdivisionId: true,
							name: true,
							nameLocal: true,
							_count: {
								select: {
									votes: true
								}
							}
						}
					})
				: [];

			const parentMap = new Map(parents.map(p => [p.subdivisionId, p]));

			results.places = places.map(place => {
				let parentName = null;
				let parentNameLocal = null;
				let hasData = false;

				const parts = place.subdivisionId?.split('.') || [];
				const countryIso = parts[0];

				if (place.level === 1) {
					// País: tiene datos si hay votos en él o en cualquier subdivisión
					hasData = prefixesWithVotesSet.has(countryIso);
				} else if (place.level === 2) {
					// Subdivisión nivel 2: tiene datos si hay votos en ella o en cualquier subdivisión hija
					const subdivId = `${parts[0]}.${parts[1]}`;
					hasData = prefixesWithVotesSet.has(subdivId);
					// Obtener nombre del país padre
					const parent = parentMap.get(countryIso);
					if (parent) {
						parentName = parent.name;
						parentNameLocal = parent.nameLocal;
					}
				} else if (place.level === 3) {
					// Subdivisión nivel 3: tiene datos si tiene votos directos
					hasData = prefixesWithVotesSet.has(place.subdivisionId);
					// Obtener nombre de la subdivisión padre
					const parentSubdivId = `${parts[0]}.${parts[1]}`;
					const parentSubdiv = parentMap.get(parentSubdivId);
					if (parentSubdiv) {
						parentName = parentSubdiv.name;
						parentNameLocal = parentSubdiv.nameLocal;
					}
				}

				return {
					id: place.id,
					subdivisionId: place.subdivisionId,
					name: place.name,
					nameLocal: place.nameLocal,
					level: place.level,
					type: place.typeEnglish,
					latitude: place.latitude,
					longitude: place.longitude,
					votesCount: place._count.votes,
					hasData,
					parentName,
					parentNameLocal
				};
			});
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
