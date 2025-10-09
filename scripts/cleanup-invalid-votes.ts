import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpiando votos sin formato jerárquico correcto...\n');

  // Contar votos totales
  const totalVotes = await prisma.vote.count();
  console.log(`📊 Total de votos en DB: ${totalVotes}`);

  // Encontrar votos sin dos puntos en subdivisionId
  const invalidVotes = await prisma.vote.findMany({
    where: {
      OR: [
        // Votos sin subdivisionId
        { subdivisionId: null },
        // Votos que no tienen el formato jerárquico (sin dos puntos)
        {
          subdivisionId: {
            not: {
              contains: '.'
            }
          }
        }
      ]
    },
    select: {
      id: true,
      subdivisionId: true,
      countryIso3: true,
      cityName: true
    }
  });

  console.log(`❌ Votos sin formato jerárquico encontrados: ${invalidVotes.length}`);
  
  if (invalidVotes.length > 0) {
    console.log('\n📋 Ejemplos de IDs inválidos:');
    invalidVotes.slice(0, 10).forEach(vote => {
      console.log(`   - ID: ${vote.id}, subdivisionId: "${vote.subdivisionId}", País: ${vote.countryIso3}, Ciudad: ${vote.cityName}`);
    });

    console.log('\n🗑️  Eliminando votos inválidos...');
    
    const result = await prisma.vote.deleteMany({
      where: {
        OR: [
          { subdivisionId: null },
          {
            subdivisionId: {
              not: {
                contains: '.'
              }
            }
          }
        ]
      }
    });

    console.log(`✅ ${result.count} votos eliminados`);

    // Actualizar contadores de polls y opciones
    console.log('\n🔄 Actualizando contadores de encuestas y opciones...');

    const polls = await prisma.poll.findMany({
      include: {
        options: {
          include: {
            votes: true
          }
        },
        votes: true
      }
    });

    for (const poll of polls) {
      // Actualizar contador total del poll
      await prisma.poll.update({
        where: { id: poll.id },
        data: { totalVotes: poll.votes.length }
      });

      // Actualizar contador de cada opción
      for (const option of poll.options) {
        await prisma.pollOption.update({
          where: { id: option.id },
          data: { voteCount: option.votes.length }
        });
      }
    }

    console.log('✅ Contadores actualizados');

    // Mostrar resumen
    const finalVotes = await prisma.vote.count();
    console.log('\n📊 RESUMEN:');
    console.log('='.repeat(50));
    console.log(`Votos iniciales: ${totalVotes}`);
    console.log(`Votos eliminados: ${result.count}`);
    console.log(`Votos finales: ${finalVotes}`);
    console.log('='.repeat(50));
  } else {
    console.log('✅ No hay votos inválidos para eliminar');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
