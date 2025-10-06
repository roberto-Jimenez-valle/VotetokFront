import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addVotes() {
  
  try {
    // Obtener las últimas 20 encuestas (las graciosas)
    const polls = await prisma.poll.findMany({
      orderBy: { id: 'desc' },
      take: 20,
      include: {
        options: true,
      },
    });

    // Obtener usuarios
    const users = await prisma.user.findMany();

    let votesCreated = 0;

    for (const poll of polls) {
      // Crear entre 10-30 votos por encuesta
      const numVotes = Math.floor(Math.random() * 20) + 10;

      for (let i = 0; i < numVotes; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)];

        // Coordenadas aleatorias en España (Madrid area)
        const lat = 40.4 + (Math.random() - 0.5) * 0.3;
        const lng = -3.7 + (Math.random() - 0.5) * 0.3;

        try {
          await prisma.vote.create({
            data: {
              userId: randomUser.id,
              pollId: poll.id,
              optionId: randomOption.id,
              latitude: lat,
              longitude: lng,
            },
          });

          votesCreated++;
        } catch (error) {
          // Ignorar errores de votos duplicados (unique constraint)
        }
      }

          }

    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addVotes();
