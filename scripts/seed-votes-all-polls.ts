import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Agregando votos ficticios a todas las encuestas...\n');

  // Obtener subdivisiones NIVEL 3 (ciudades) con coordenadas
  const subdivisions = await prisma.subdivision.findMany({
    where: {
      latitude: { not: 0 },
      longitude: { not: 0 },
      level: 3 // Usar nivel 3 (ciudades/municipios)
    },
    take: 2000, // Más ciudades de más países
    select: {
      id: true,
      latitude: true,
      longitude: true,
      name: true
    }
  });

  if (subdivisions.length === 0) {
    console.log('❌ No hay subdivisiones con coordenadas. Usando coordenadas genéricas.');
  } else {
    console.log(`📍 Usando ${subdivisions.length} subdivisiones para votos\n`);
  }

  // Obtener todas las encuestas con sus opciones
  const polls = await prisma.poll.findMany({
    include: {
      options: true,
      _count: { select: { votes: true } }
    },
    orderBy: { id: 'desc' }
  });

  console.log(`📊 Total de encuestas encontradas: ${polls.length}\n`);

  let totalVotesAdded = 0;

  for (const poll of polls) {
    const questionText = poll.question || poll.title || 'Sin título';
    console.log(`📋 Encuesta #${poll.id}: "${questionText.substring(0, 60)}"`);
    console.log(`   Opciones: ${poll.options.length}`);
    console.log(`   Votos actuales: ${poll._count.votes}`);

    if (poll.options.length === 0) {
      console.log('   ⚠️ Sin opciones, saltando...\n');
      continue;
    }

    // Agregar entre 200 y 500 votos por encuesta
    const votesToAdd = Math.floor(Math.random() * 301) + 200;
    console.log(`   ➕ Agregando ${votesToAdd} votos nuevos...`);

    const votesData = [];

    for (let i = 0; i < votesToAdd; i++) {
      // Seleccionar opción aleatoria (con peso hacia las primeras opciones)
      const optionIndex = Math.floor(Math.random() * Math.random() * poll.options.length);
      const option = poll.options[optionIndex];

      // Seleccionar ubicación aleatoria
      let lat = 40.4168 + (Math.random() - 0.5) * 50; // Default: cerca de Madrid
      let lng = -3.7038 + (Math.random() - 0.5) * 100;
      let subdivisionId: number | null = null;

      if (subdivisions.length > 0) {
        const randomSub = subdivisions[Math.floor(Math.random() * subdivisions.length)];
        lat = randomSub.latitude! + (Math.random() - 0.5) * 0.5;
        lng = randomSub.longitude! + (Math.random() - 0.5) * 0.5;
        subdivisionId = randomSub.id;
      }

      // Fecha aleatoria en los últimos 90 días
      const daysAgo = Math.floor(Math.random() * 90);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);
      createdAt.setHours(Math.floor(Math.random() * 24));
      createdAt.setMinutes(Math.floor(Math.random() * 60));

      votesData.push({
        pollId: poll.id,
        optionId: option.id,
        userId: null,
        latitude: lat,
        longitude: lng,
        subdivisionId: subdivisionId,
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        userAgent: 'Mozilla/5.0 (Seed Script)',
        createdAt: createdAt
      });
    }

    // Insertar votos en batch
    await prisma.vote.createMany({
      data: votesData,
      skipDuplicates: true
    });

    totalVotesAdded += votesData.length;

    // Contar votos actuales
    const voteCount = await prisma.vote.count({
      where: { pollId: poll.id }
    });

    console.log(`   ✅ Ahora tiene ${voteCount} votos totales\n`);
  }

  console.log('🎉 RESUMEN FINAL:');
  console.log('='.repeat(60));
  console.log(`📊 Encuestas procesadas: ${polls.length}`);
  console.log(`➕ Votos totales agregados: ${totalVotesAdded}`);
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
