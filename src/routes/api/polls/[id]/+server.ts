import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const GET: RequestHandler = async ({ params, locals, getClientAddress }) => {
  const poll = await prisma.poll.findUnique({
    where: { id: Number(params.id) },
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
          createdBy: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              verified: true,
            },
          },
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
    throw error(404, 'Poll not found');
  }

  // Buscar TODOS los votos del usuario actual (para encuestas múltiples)
  const userId = locals.user?.userId || locals.user?.id || null;
  const ipAddress = getClientAddress();
  
  console.log('[API GET Poll] Buscando votos - userId:', userId, 'IP:', ipAddress, 'pollId:', params.id);
  
  let userVotes: string[] = [];
  if (userId || ipAddress) {
    // Buscar por userId O por IP (el voto puede haberse registrado con cualquiera)
    const existingVotes = await prisma.vote.findMany({
      where: {
        pollId: Number(params.id),
        OR: [
          ...(userId ? [{ userId: Number(userId) }] : []),
          { ipAddress },
        ],
      },
      include: {
        option: {
          select: {
            id: true,
            optionKey: true,
          }
        }
      }
    });
    
    console.log('[API GET Poll] Votos encontrados:', existingVotes.length, existingVotes.map(v => ({ optionKey: v.option?.optionKey, optionId: v.optionId })));
    
    // Devolver array de optionKeys votados
    userVotes = existingVotes
      .map(v => v.option?.optionKey)
      .filter((key): key is string => key !== null && key !== undefined);
  }
  
  // Para compatibilidad, también incluir userVote (el primero o null)
  const userVote = userVotes.length > 0 ? userVotes[0] : null;

  // Transformar opciones para incluir voteCount y avatarUrl
  const transformedPoll = {
    ...poll,
    userVote, // Compatibilidad: primer voto o null
    userVotes, // Array de todos los votos (para múltiples)
    options: poll.options.map(option => ({
      ...option,
      voteCount: option._count.votes,
      avatarUrl: option.createdBy?.avatarUrl || null
    }))
  };

  return json({ data: transformedPoll });
};

export const PUT: RequestHandler = async ({ params, request }) => {
  const body = await request.json();
  const { title, description, category, status } = body;

  const poll = await prisma.poll.update({
    where: { id: Number(params.id) },
    data: {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(category && { category }),
      ...(status && { status }),
    },
    include: {
      user: true,
      options: true,
    },
  });

  return json({ data: poll });
};

export const DELETE: RequestHandler = async ({ params }) => {
  await prisma.poll.delete({
    where: { id: Number(params.id) },
  });

  return json({ success: true });
};
