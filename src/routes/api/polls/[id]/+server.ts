import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { parsePollIdInternal, encodePollId, encodeUserId, encodeOptionId } from '$lib/server/hashids';

export const GET: RequestHandler = async ({ params, locals }) => {
  // Soporta tanto IDs numéricos (interno) como hashes
  console.log('[API GET Poll] Param ID recibido:', params.id);
  const pollId = parsePollIdInternal(params.id);
  console.log('[API GET Poll] ID parseado:', pollId);
  if (!pollId) {
    console.error('[API GET Poll] ❌ ID inválido:', params.id);
    throw error(400, 'Invalid poll ID');
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

  // Buscar votos del usuario actual SOLO por userId (no por IP)
  const userId = locals.user?.userId;
  
  let userVotes: string[] = [];
  if (userId) {
    const existingVotes = await prisma.vote.findMany({
      where: {
        pollId: pollId,
        userId: Number(userId)
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
    
    console.log('[API GET Poll] Votos del usuario', userId, ':', existingVotes.length);
    
    userVotes = existingVotes
      .map(v => v.option?.optionKey)
      .filter((key): key is string => key !== null && key !== undefined);
  }
  
  // Para compatibilidad, también incluir userVote (el primero o null)
  const userVote = userVotes.length > 0 ? userVotes[0] : null;

  // Transformar opciones para incluir voteCount, avatarUrl e imageUrl
  // Usar IDs hasheados en la respuesta
  const transformedPoll = {
    ...poll,
    id: poll.id, // ID numérico interno
    hashId: encodePollId(poll.id), // ID hasheado para URLs públicas
    userVote, // Compatibilidad: primer voto o null
    userVotes, // Array de todos los votos (para múltiples)
    user: poll.user ? {
      ...poll.user,
      hashId: encodeUserId(poll.user.id),
    } : null,
    options: poll.options.map(option => ({
      ...option,
      hashId: encodeOptionId(option.id),
      voteCount: option._count.votes,
      avatarUrl: option.createdBy?.avatarUrl || null,
      imageUrl: (option as any).imageUrl || null,
      createdBy: option.createdBy ? {
        ...option.createdBy,
        hashId: encodeUserId(option.createdBy.id),
      } : null,
    }))
  };

  return json({ data: transformedPoll });
};

export const PUT: RequestHandler = async ({ params, request }) => {
  const pollId = parsePollIdInternal(params.id);
  if (!pollId) {
    throw error(400, 'Invalid poll ID');
  }

  const body = await request.json();
  const { title, description, category, status } = body;

  const poll = await prisma.poll.update({
    where: { id: pollId },
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
  const pollId = parsePollIdInternal(params.id);
  if (!pollId) {
    throw error(400, 'Invalid poll ID');
  }

  await prisma.poll.delete({
    where: { id: pollId },
  });

  return json({ success: true });
};
