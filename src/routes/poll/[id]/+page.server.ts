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
  
  // Obtener la URL base del servidor
  const baseUrl = `${url.protocol}//${url.host}`;

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
          interactions: true,
        },
      },
    },
  });

  if (!poll) {
    throw error(404, 'Encuesta no encontrada');
  }

  // Transformar opciones y agregar hashId
  const transformedPoll = {
    ...poll,
    hashId: encodePollId(poll.id), // ID hasheado para URLs públicas
    options: poll.options.map(option => ({
      ...option,
      voteCount: option._count.votes,
    }))
  };

  return {
    poll: transformedPoll,
    baseUrl
  };
};
