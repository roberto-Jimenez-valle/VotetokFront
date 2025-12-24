import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

export const GET: RequestHandler = async ({ url, locals }) => {
  const query = url.searchParams.get('q') || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '5', 10), 20);
  const userId = locals.user?.userId;

  if (!query || query.length < 1) {
    return json({ users: [] });
  }

  try {
    // 1. Buscar usuarios que coincidan con el texto
    // Priorizando amigos y seguidos
    
    // Si no está autenticado, solo busca públicos
    if (!userId) {
      const users = await prisma.user.findMany({
        where: {
          isPrivate: false,
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          verified: true,
          isPrivate: true
        },
        take: limit
      });
      return json({ users });
    }

    // Si está autenticado, lógica más compleja:
    // - Perfiles públicos
    // - O Amigos (Mutuals) - donde yo sigo a X y X me sigue a mí
    // - O Personas que sigo (opcionalmente, pero el usuario pidió "amigos que sigues y te siguen")
    
    // Nota: La restricción estricta del usuario fue "personas con perfil publico y tus amigos que sigues y te siguen".
    // Interpretación: 
    // Publicos: OK
    // Privados: Solo si son amigos (mutuals).
    
    // Para optimizar, primero obtenemos los IDs de los amigos si es necesario, 
    // pero dado que es una búsqueda, podemos hacerlo en la query si es posible, 
    // o filtrar después. 
    
    // Prisma no tiene un "isMutual" fácil en una sola query sin raw query compleja o joins multiples.
    // Haremos: Buscar candidatos por nombre -> Filtrar visibilidad en código o query.
    
    const candidates = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } }
        ],
        NOT: {
          id: userId // No mencionarse a uno mismo
        }
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        verified: true,
        isPrivate: true,
        followers: { // Relación "UserFollowers": Registros donde el candidato es el seguidor
          where: { followingId: userId }, // ¿Sigue al usuario actual?
          select: { followingId: true } 
        },
        following: { // Relación "UserFollowing": Registros donde el candidato es seguido
          where: { followerId: userId }, // ¿Es seguido por el usuario actual?
          select: { followerId: true } 
        }
      },
      take: limit * 2 // Traemos un poco más para filtrar
    });

    const results = candidates.filter(candidate => {
      // 1. Si es público, pasa.
      if (!candidate.isPrivate) return true;

      // 2. Si es privado, debe ser amigo (mutual).
      // Él me sigue (estoy en su lista de 'followers' - donde él es el follower)
      const theyFollowMe = candidate.followers.length > 0;
      // Yo le sigo (estoy en su lista de 'following' - donde él es el seguido)
      const iFollowThem = candidate.following.length > 0;

      return iFollowThem && theyFollowMe;
    }).slice(0, limit);

    // Formatear respuesta
    const mappedUsers = results.map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      verified: u.verified
    }));

    return json({ users: mappedUsers });

  } catch (error) {
    console.error('[Search Mentions] Error:', error);
    return json({ error: 'Error al buscar usuarios' }, { status: 500 });
  }
};
