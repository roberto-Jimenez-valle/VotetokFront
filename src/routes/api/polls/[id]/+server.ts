import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const GET: RequestHandler = async ({ params }) => {
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

  // Transformar opciones para incluir voteCount y avatarUrl
  const transformedPoll = {
    ...poll,
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
