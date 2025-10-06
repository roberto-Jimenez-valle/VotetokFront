import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteVotesWithoutSubdivision() {
  
  try {
    // Primero, contar cuántos votos se van a eliminar
    const countToDelete = await prisma.vote.count({
      where: {
        subdivisionId: null
      }
    });

    
    if (countToDelete === 0) {
            return;
    }

    // Mostrar algunos ejemplos antes de eliminar
    const examples = await prisma.vote.findMany({
      where: {
        subdivisionId: null
      },
      select: {
        id: true,
        countryIso3: true,
        countryName: true,
        cityName: true,
        createdAt: true
      },
      take: 5
    });

        examples.forEach(vote => {
          });

    // Confirmar eliminación
        
    // Eliminar los votos
    const result = await prisma.vote.deleteMany({
      where: {
        subdivisionId: null
      }
    });

    
    // Mostrar estadísticas finales
    const remainingVotes = await prisma.vote.count();
    const votesWithSubdivision = await prisma.vote.count({
      where: {
        subdivisionId: { not: null }
      }
    });

                
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteVotesWithoutSubdivision();
