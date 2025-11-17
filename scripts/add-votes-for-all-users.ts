import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addVotesForAllUsers() {
  console.log('🌱 Iniciando seed de votos para todos los usuarios...');

  try {
    // Obtener todos los usuarios
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        countryIso3: true,
        subdivisionId: true
      }
    });

    if (users.length === 0) {
      console.log('❌ No hay usuarios en la base de datos');
      return;
    }

    console.log(`👥 Encontrados ${users.length} usuarios`);

    // Obtener todas las encuestas activas
    const polls = await prisma.poll.findMany({
      where: {
        status: 'active'
      },
      include: {
        options: true
      }
    });

    if (polls.length === 0) {
      console.log('❌ No hay encuestas activas');
      return;
    }

    console.log(`📊 Encontradas ${polls.length} encuestas activas`);

    let totalVotesCreated = 0;
    let totalVotesSkipped = 0;

    // Para cada usuario
    for (const user of users) {
      console.log(`\n👤 Procesando usuario: ${user.username} (ID: ${user.id})`);

      // Cada usuario votará en el 60-80% de las encuestas
      const votePercentage = 0.6 + Math.random() * 0.2;
      const numPollsToVote = Math.floor(polls.length * votePercentage);
      
      // Seleccionar encuestas aleatorias
      const shuffledPolls = [...polls].sort(() => Math.random() - 0.5);
      const pollsToVote = shuffledPolls.slice(0, numPollsToVote);

      console.log(`   Votando en ${pollsToVote.length} de ${polls.length} encuestas...`);

      for (const poll of pollsToVote) {
        // Verificar si el usuario ya votó en esta encuesta
        const existingVote = await prisma.vote.findFirst({
          where: {
            pollId: poll.id,
            userId: user.id
          }
        });

        if (existingVote) {
          totalVotesSkipped++;
          continue;
        }

        // Seleccionar opción aleatoria (distribución no uniforme)
        const randomValue = Math.random();
        let selectedOptionIndex;
        
        if (poll.options.length === 2) {
          selectedOptionIndex = randomValue < 0.6 ? 0 : 1;
        } else if (poll.options.length === 3) {
          if (randomValue < 0.5) selectedOptionIndex = 0;
          else if (randomValue < 0.8) selectedOptionIndex = 1;
          else selectedOptionIndex = 2;
        } else {
          selectedOptionIndex = Math.floor(Math.random() * poll.options.length);
        }

        const selectedOption = poll.options[selectedOptionIndex];

        // Obtener subdivisión del usuario o una aleatoria
        let subdivisionId = user.subdivisionId;
        let latitude = 0;
        let longitude = 0;

        if (subdivisionId) {
          // Usar subdivisión del usuario
          const subdivision = await prisma.subdivision.findUnique({
            where: { subdivisionId: subdivisionId }
          });

          if (subdivision) {
            latitude = subdivision.latitude;
            longitude = subdivision.longitude;
          }
        }

        // Si no tiene subdivisión o no se encontró, usar una aleatoria del mismo país
        if (!subdivisionId || latitude === 0) {
          const countrySubdivisions = await prisma.subdivision.findMany({
            where: {
              subdivisionId: {
                startsWith: user.countryIso3 || 'ESP'
              }
            },
            take: 1
          });

          if (countrySubdivisions.length > 0) {
            const sub = countrySubdivisions[0];
            subdivisionId = sub.subdivisionId;
            latitude = sub.latitude;
            longitude = sub.longitude;
          } else {
            // Fallback a coordenadas por defecto
            latitude = 40.4168;
            longitude = -3.7038;
          }
        }

        // Generar fecha aleatoria en los últimos 30 días
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const randomTime = thirtyDaysAgo.getTime() + Math.random() * (now.getTime() - thirtyDaysAgo.getTime());
        const createdAt = new Date(randomTime);

        try {
          // Crear el voto
          await prisma.vote.create({
            data: {
              pollId: poll.id,
              optionId: selectedOption.id,
              userId: user.id,
              latitude: latitude,
              longitude: longitude,
              subdivisionId: subdivisionId,
              ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
              userAgent: 'Mozilla/5.0 (Script Generated Vote)',
              createdAt: createdAt
            }
          });

          totalVotesCreated++;
        } catch (error) {
          console.error(`   ❌ Error creando voto para encuesta ${poll.id}:`, error);
        }
      }

      console.log(`   ✅ Votos creados para ${user.username}: ${pollsToVote.length - totalVotesSkipped}`);
    }

    console.log('\n📈 Resumen:');
    console.log(`   Total de votos creados: ${totalVotesCreated}`);
    console.log(`   Total de votos omitidos (ya existían): ${totalVotesSkipped}`);
    console.log(`   Usuarios procesados: ${users.length}`);
    console.log('✅ Seed completado exitosamente!');

  } catch (error) {
    console.error('❌ Error durante el seed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addVotesForAllUsers();
