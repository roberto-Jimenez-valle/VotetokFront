/**
 * Script adaptado para agregar votos históricos con fechas distribuidas
 * Basado en seed-subdivision-votes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Agregando votos históricos con fechas distribuidas...\n');
  
  // Obtener encuestas activas
  const polls = await prisma.poll.findMany({
    where: { status: 'active' },
    include: { options: true },
    take: 5
  });

  if (polls.length === 0) {
    console.log('❌ No hay encuestas activas');
    return;
  }

  console.log(`📊 Procesando ${polls.length} encuestas\n`);

  // Obtener subdivisiones reales de la BD
  const subdivisions = await prisma.subdivision.findMany({
    where: { level: 3 },
    take: 20
  });

  if (subdivisions.length === 0) {
    console.log('⚠️ No hay subdivisiones nivel 3, usando nivel 2...');
    const subdivisions = await prisma.subdivision.findMany({
      where: { level: 2 },
      take: 20
    });
  }

  console.log(`📍 Usando ${subdivisions.length} ubicaciones\n`);

  // Fecha de inicio y fin (último año)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);

  let totalVotesCreated = 0;

  for (const poll of polls) {
    console.log(`🗳️  Poll: "${poll.title}" (ID: ${poll.id})`);
    
    if (poll.options.length === 0) {
      console.log('   ⚠️ Sin opciones, saltando...\n');
      continue;
    }

    // 200-400 votos por encuesta
    const numVotes = Math.floor(Math.random() * 200) + 200;
    console.log(`   Generando ${numVotes} votos...`);

    const votesToCreate = [];

    for (let i = 0; i < numVotes; i++) {
      // Fecha aleatoria en el último año
      const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
      const createdAt = new Date(randomTime);

      // Opción aleatoria con distribución no uniforme
      const randomValue = Math.random();
      let selectedOption;
      if (poll.options.length === 2) {
        selectedOption = randomValue < 0.6 ? poll.options[0] : poll.options[1];
      } else {
        selectedOption = poll.options[Math.floor(Math.random() * poll.options.length)];
      }

      // Subdivisión aleatoria
      const subdivision = subdivisions[Math.floor(Math.random() * subdivisions.length)];

      votesToCreate.push({
        pollId: poll.id,
        optionId: selectedOption.id,
        userId: null,
        subdivisionId: subdivision.id, // Usar ID numérico
        latitude: subdivision.latitude,
        longitude: subdivision.longitude,
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        userAgent: 'Mozilla/5.0 (seed script)',
        createdAt: createdAt
      });
    }

    // Insertar en batches de 100
    const batchSize = 100;
    for (let i = 0; i < votesToCreate.length; i += batchSize) {
      const batch = votesToCreate.slice(i, i + batchSize);
      await prisma.vote.createMany({
        data: batch,
        skipDuplicates: true
      });
    }

    totalVotesCreated += votesToCreate.length;
    console.log(`   ✅ ${votesToCreate.length} votos insertados\n`);
  }

  console.log('✅ Seed completado!');
  console.log(`📊 Total de votos creados: ${totalVotesCreated}`);
  console.log(`📅 Rango: ${startDate.toISOString().split('T')[0]} a ${endDate.toISOString().split('T')[0]}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
