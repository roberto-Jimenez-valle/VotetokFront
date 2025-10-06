import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const GET: RequestHandler = async ({ url }) => {
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') ?? '8')));
  const excludeUserId = Number(url.searchParams.get('excludeUserId'));

  try {
    // Obtener usuarios sugeridos basados en actividad reciente
    const suggestions = await prisma.user.findMany({
      where: {
        ...(excludeUserId && { id: { not: excludeUserId } }),
        role: { not: 'banned' },
      },
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
            followers: true,
          },
        },
      },
      orderBy: [
        { verified: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return json({
      data: suggestions.map(user => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio || 'Usuario de VoteTok',
        verified: user.verified,
        pollsCount: user._count.polls,
        followersCount: user._count.followers,
      })),
    });
  } catch (error) {
    console.error('[API] Error loading user suggestions:', error);
    return json({ data: [] });
  }
};
