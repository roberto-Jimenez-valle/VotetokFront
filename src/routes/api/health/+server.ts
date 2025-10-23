import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    // Verificar conexión a BD
    const pollCount = await prisma.poll.count();
    const voteCount = await prisma.vote.count();
    const subdivisionCount = await prisma.subdivision.count();
    
    // Verificar polls recientes
    const recentPolls = await prisma.poll.findMany({
      take: 3,
      orderBy: { id: 'desc' },
      select: { id: true, title: true }
    });
    
    return json({
      status: 'ok',
      database: 'connected',
      counts: {
        polls: pollCount,
        votes: voteCount,
        subdivisions: subdivisionCount
      },
      recentPolls,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};
