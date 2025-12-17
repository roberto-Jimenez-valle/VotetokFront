import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { parsePollId, encodePollId } from '$lib/server/hashids';

export const load: PageServerLoad = async ({ params, url }) => {
  // SOLO acepta hashIds - IDs numéricos son rechazados
  const pollId = parsePollId(params.id);
  
  if (!pollId) {
    throw error(400, 'ID de encuesta inválido');
  }
  
  // Parámetros de personalización del embed
  const theme = url.searchParams.get('theme') || 'dark'; // dark | light
  const compact = url.searchParams.get('compact') === 'true'; // Versión compacta
  
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          verified: true,
        },
      },
      options: {
        include: {
          _count: {
            select: {
              votes: true
            }
          }
        },
        orderBy: { displayOrder: 'asc' },
      },
      _count: {
        select: {
          votes: true,
          comments: true,
        },
      },
    },
  });

  if (!poll) {
    throw error(404, 'Encuesta no encontrada');
  }

  // Calcular total de votos y porcentajes
  const totalVotes = poll._count.votes;
  
  const transformedPoll = {
    id: poll.id,
    hashId: encodePollId(poll.id), // ID hasheado para URLs públicas
    title: poll.title,
    description: poll.description,
    createdAt: poll.createdAt,
    closedAt: poll.closedAt,
    totalVotes,
    user: poll.user,
    options: poll.options.map(option => ({
      id: option.id,
      key: option.optionKey,
      text: option.optionLabel || `Opción ${option.optionKey}`,
      color: option.color || '#6366f1',
      votes: option._count.votes,
      percentage: totalVotes > 0 ? Math.round((option._count.votes / totalVotes) * 100) : 0,
      imageUrl: option.imageUrl,
    }))
  };

  return {
    poll: transformedPoll,
    theme,
    compact,
    baseUrl: `${url.protocol}//${url.host}`
  };
};
