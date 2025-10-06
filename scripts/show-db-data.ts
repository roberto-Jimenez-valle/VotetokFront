import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function showDatabaseData() {
  try {
    
    // Usuarios
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: {
            polls: true,
            votes: true,
          },
        },
      },
    });
        users.forEach(user => {
                                  });

    // Polls
    const polls = await prisma.poll.findMany({
      include: {
        user: {
          select: {
            displayName: true,
            username: true,
          },
        },
        options: true,
        _count: {
          select: {
            votes: true,
            comments: true,
          },
        },
      },
    });
        polls.forEach(poll => {
                              poll.options.forEach(opt => {
              });
          });

    // Votos
    const votes = await prisma.vote.findMany({
      include: {
        poll: {
          select: {
            title: true,
          },
        },
        option: {
          select: {
            optionLabel: true,
          },
        },
      },
      take: 10,
    });
        votes.forEach(vote => {
                            });

    // Usuarios destacados
    const featuredUsers = await prisma.featuredUser.findMany({
      include: {
        user: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    });
        featuredUsers.forEach(featured => {
                            });

    // Hashtags
    const hashtags = await prisma.hashtag.findMany({
      orderBy: {
        usageCount: 'desc',
      },
      take: 10,
    });
        hashtags.forEach(tag => {
          });

    // Historial de votos
    const voteHistory = await prisma.voteHistory.findMany({
      take: 5,
      orderBy: {
        recordedAt: 'desc',
      },
      include: {
        poll: {
          select: {
            title: true,
          },
        },
        option: {
          select: {
            optionLabel: true,
          },
        },
      },
    });
        voteHistory.forEach(history => {
                            });

      } catch (error) {
    console.error('Error al consultar la base de datos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

showDatabaseData();
