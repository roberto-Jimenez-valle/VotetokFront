import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPollData() {
  
  try {
    // 1. Listar todas las encuestas
    const polls = await prisma.poll.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        totalVotes: true,
        _count: {
          select: {
            options: true,
            votes: true
          }
        }
      }
    });

    
    for (const poll of polls) {
                                    
      // Obtener opciones
      const options = await prisma.pollOption.findMany({
        where: { pollId: poll.id },
        select: {
          optionKey: true,
          optionLabel: true,
          color: true,
          voteCount: true
        }
      });

            options.forEach(opt => {
              });

      // Verificar votos por país
      const votesByCountry = await prisma.vote.groupBy({
        by: ['countryIso3'],
        where: { pollId: poll.id },
        _count: true
      });

            votesByCountry.forEach(item => {
              });

      // Verificar votos con subdivisionId
      const votesWithSubdivision = await prisma.vote.count({
        where: {
          pollId: poll.id,
          subdivisionId: { not: null }
        }
      });

      
      // Mostrar ejemplos de subdivisionId
      const sampleVotes = await prisma.vote.findMany({
        where: {
          pollId: poll.id,
          subdivisionId: { not: null }
        },
        select: {
          subdivisionId: true,
          countryIso3: true
        },
        distinct: ['subdivisionId'],
        take: 5
      });

      if (sampleVotes.length > 0) {
                sampleVotes.forEach(v => {
                  });
      }

          }

    // Verificar si hay votos sin encuesta
    const orphanVotes = await prisma.vote.count({
      where: {
        pollId: { not: { in: polls.map(p => p.id) } }
      }
    });

    if (orphanVotes > 0) {
          }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPollData();
