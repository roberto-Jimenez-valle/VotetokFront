import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Agregando votos ficticios...');

  // Obtener todas las encuestas con sus opciones
  const polls = await prisma.poll.findMany({
    include: { options: true }
  });
  console.log(`📊 Encontradas ${polls.length} encuestas`);

  // Obtener subdivisiones nivel 3 (provincias/municipios)
  let subdivisions = await prisma.subdivision.findMany({
    where: { level: 3 },
    take: 100
  });

  // Si no hay nivel 3, usar nivel 2
  if (subdivisions.length === 0) {
    console.log('⚠️ No hay subdivisiones nivel 3, usando nivel 2...');
    subdivisions = await prisma.subdivision.findMany({
      where: { level: 2 },
      take: 100
    });
  }

  // Si todavía no hay, usar nivel 1
  if (subdivisions.length === 0) {
    console.log('⚠️ No hay subdivisiones nivel 2, usando nivel 1...');
    subdivisions = await prisma.subdivision.findMany({
      where: { level: 1 },
      take: 100
    });
  }

  console.log(`🌍 Usando ${subdivisions.length} subdivisiones`);

  if (subdivisions.length === 0) {
    console.log('❌ No hay subdivisiones en la base de datos');
    return;
  }

  // Crear usuarios ficticios
  const fakeUsers: number[] = [];
  for (let i = 1; i <= 50; i++) {
    const user = await prisma.user.upsert({
      where: { email: `fake${i}@votetok.com` },
      update: {},
      create: {
        email: `fake${i}@votetok.com`,
        username: `user${i}`,
        displayName: `Usuario ${i}`,
      }
    });
    fakeUsers.push(user.id);
  }
  console.log(`👥 ${fakeUsers.length} usuarios creados/encontrados`);

  let totalVotes = 0;

  // Agregar votos a cada encuesta
  for (const poll of polls) {
    if (poll.options.length === 0) continue;

    // Generar entre 20 y 100 votos por encuesta
    const numVotes = Math.floor(Math.random() * 80) + 20;

    for (let i = 0; i < numVotes; i++) {
      const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)];
      const randomUser = fakeUsers[Math.floor(Math.random() * fakeUsers.length)];
      const randomSubdivision = subdivisions[Math.floor(Math.random() * subdivisions.length)];

      try {
        // Verificar si ya votó este usuario en esta encuesta
        const existingVote = await prisma.vote.findFirst({
          where: {
            pollId: poll.id,
            odooUserId: randomUser
          }
        });

        if (!existingVote) {
          await prisma.vote.create({
            data: {
              pollId: poll.id,
              optionId: randomOption.id,
              odooUserId: randomUser,
              subdivisionId: randomSubdivision.id,
              countryIso: randomSubdivision.countryIso || 'ESP',
              createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Últimos 7 días
            }
          });
          totalVotes++;
        }
      } catch (e) {
        // Ignorar errores de duplicados
      }
    }
    console.log(`✅ Encuesta "${poll.title.substring(0, 30)}..." - votos agregados`);
  }

  console.log(`\n🎉 Total de votos agregados: ${totalVotes}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
