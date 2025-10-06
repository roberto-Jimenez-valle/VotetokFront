import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const GET: RequestHandler = async () => {
  const featuredUsers = await prisma.featuredUser.findMany({
    where: { isActive: true },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          verified: true,
          bio: true,
        },
      },
    },
    orderBy: { featuredOrder: 'asc' },
  });

  // Formatear respuesta para mantener compatibilidad
  const formattedUsers = featuredUsers.map((fu) => ({
    id: fu.user.id,
    name: fu.user.displayName,
    role: fu.roleTitle || '',
    citations: fu.citationsCount,
    size: fu.displaySize,
    color: fu.highlightColor || '#3b82f6',
    image: fu.user.avatarUrl || '',
    verified: fu.user.verified,
    bio: fu.user.bio,
  }));

  return json({ data: formattedUsers });
};
