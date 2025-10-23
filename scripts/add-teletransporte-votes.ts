import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addTeletransporteVotesForAllUsers() {
  console.log('🚀 Iniciando script: Votos de teletransporte para todos los usuarios\n');

  try {
    // 1. Buscar la encuesta de superpoderes
    const poll = await prisma.poll.findFirst({
      where: {
        title: '¿Cuál es tu superpoder ideal?'
      },
      include: {
        options: true
      }
    });

    if (!poll) {
      console.error('❌ No se encontró la encuesta "¿Cuál es tu superpoder ideal?"');
      console.log('💡 Ejecuta primero: insert-encuestas-divertidas.sql');
      return;
    }

    console.log(`✅ Encuesta encontrada: "${poll.title}" (ID: ${poll.id})`);

    // 2. Buscar la opción "teletransporte"
    const teletransporteOption = poll.options.find(opt => opt.optionKey === 'teletransporte');

    if (!teletransporteOption) {
      console.error('❌ No se encontró la opción "teletransporte"');
      console.log('Opciones disponibles:', poll.options.map(o => o.optionKey).join(', '));
      return;
    }

    console.log(`✅ Opción encontrada: "${teletransporteOption.optionLabel}" (ID: ${teletransporteOption.id})`);

    // 3. Obtener todos los usuarios
    const users = await prisma.user.findMany();
    
    if (users.length === 0) {
      console.error('❌ No hay usuarios en la base de datos');
      console.log('💡 Ejecuta primero: npm run db:seed');
      return;
    }

    console.log(`✅ Usuarios encontrados: ${users.length}`);
    console.log('Usuarios:', users.map(u => u.username).join(', '));

    // 4. Eliminar votos previos de estos usuarios en esta encuesta
    console.log('\n🗑️  Eliminando votos previos de usuarios en esta encuesta...');
    const deletedVotes = await prisma.vote.deleteMany({
      where: {
        pollId: poll.id,
        userId: {
          in: users.map(u => u.id)
        }
      }
    });
    console.log(`   Eliminados: ${deletedVotes.count} votos previos`);

    // 5. Buscar subdivisión (Madrid)
    const madridSubdivision = await prisma.subdivision.findFirst({
      where: {
        OR: [
          { id: 65101 },
          { name: { contains: 'Madrid' }, level: 2 }
        ]
      }
    });

    // 6. Crear votos para todos los usuarios
    console.log('\n📊 Creando votos para todos los usuarios...');
    const votesCreated = [];

    for (const user of users) {
      const vote = await prisma.vote.create({
        data: {
          pollId: poll.id,
          optionId: teletransporteOption.id,
          userId: user.id,
          latitude: 40.4168 + (Math.random() - 0.5) * 0.1, // Madrid con variación
          longitude: -3.7038 + (Math.random() - 0.5) * 0.1,
          subdivisionId: madridSubdivision?.id || null,
        }
      });
      
      votesCreated.push(vote);
      console.log(`   ✓ ${user.username} → teletransporte`);
    }

    console.log(`\n✅ ${votesCreated.length} votos creados exitosamente!`);

    // 7. Verificar resultados
    console.log('\n📈 Resultados finales:');
    const results = await prisma.vote.groupBy({
      by: ['optionId'],
      where: {
        pollId: poll.id
      },
      _count: {
        id: true
      }
    });

    for (const result of results) {
      const option = poll.options.find(o => o.id === result.optionId);
      console.log(`   ${option?.optionLabel}: ${result._count.id} votos`);
    }

    console.log('\n🎉 Script completado!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
addTeletransporteVotesForAllUsers()
  .catch((e) => {
    console.error('❌ Error fatal:', e);
    process.exit(1);
  });
