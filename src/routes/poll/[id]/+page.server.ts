import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';

export const load: PageServerLoad = async ({ params }) => {
  const pollId = Number(params.id);
  
  if (isNaN(pollId)) {
    throw error(400, 'ID de encuesta inválido');
  }

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

  // Transformar opciones
  const transformedPoll = {
    ...poll,
    options: poll.options.map(option => ({
      ...option,
      voteCount: option._count.votes,
    }))
  };

  return {
    poll: transformedPoll
  };
};
