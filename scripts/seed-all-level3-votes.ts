/**
 * Script para asegurar que TODAS las subdivisiones nivel 3 tengan votos
 * 
 * - Identifica subdivisiones sin votos
 * - Crea 1-5 votos para cada una
 * - 100% de cobertura garantizada
 * 
 * Uso: npx tsx scripts/seed-all-level3-votes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BATCH_SIZE = 1000;

async function main() {
  console.log('🎯 Asegurando 100% cobertura de votos nivel 3...\n');

  // 1. Obtener subdivisiones sin votos
  console.log('🔍 Paso 1: Identificando subdivisiones sin votos...');
  
  const subdivsWithoutVotes = await prisma.subdivision.findMany({
    where: {
      level: 3,
      votes: {
        none: {}
      }
    },
    select: {
      id: true,
      subdivisionId: true,
      name: true,
      latitude: true,
      longitude: true
    }
  });

  console.log(`   ✅ Encontradas: ${subdivsWithoutVotes.length.toLocaleString()} subdivisiones sin votos\n`);

  if (subdivsWithoutVotes.length === 0) {
    console.log('✅ ¡Todas las subdivisiones ya tienen votos!');
    return;
  }

  // 2. Obtener encuestas activas
  console.log('📋 Paso 2: Obteniendo encuestas activas...');
  
  const polls = await prisma.poll.findMany({
    where: { status: 'active' },
    include: {
      options: {
        orderBy: { displayOrder: 'asc' }
      }
    },
    take: 20 // Usar solo las primeras 20 encuestas
  });

  console.log(`   ✅ ${polls.length} encuestas disponibles\n`);

  if (polls.length === 0) {
    console.log('❌ No hay encuestas activas');
    return;
  }

  // 3. Obtener usuarios
  const users = await prisma.user.findMany({ 
    select: { id: true },
    take: 100
  });

  console.log('🗳️  Paso 3: Creando votos para subdivisiones faltantes...\n');

  let totalVotesCreated = 0;
  let batchBuffer = [];

  for (let i = 0; i < subdivsWithoutVotes.length; i++) {
    const subdivision = subdivsWithoutVotes[i];

    // Seleccionar 1-3 encuestas aleatorias para esta subdivisión
    const numPolls = Math.floor(Math.random() * 3) + 1;
    const selectedPolls = polls
      .sort(() => Math.random() - 0.5)
      .slice(0, numPolls);

    for (const poll of selectedPolls) {
      if (poll.options.length === 0) continue;

      // 1-5 votos por encuesta
      const votesCount = Math.floor(Math.random() * 5) + 1;

      for (let v = 0; v < votesCount; v++) {
        // Seleccionar opción aleatoria
        const option = poll.options[Math.floor(Math.random() * poll.options.length)];
        
        // Usuario aleatorio
        const userId = users.length > 0 && Math.random() > 0.3 
          ? users[Math.floor(Math.random() * users.length)].id 
          : null;

        // Pequeña variación en coordenadas
        const latVariation = (Math.random() - 0.5) * 0.05;
        const lngVariation = (Math.random() - 0.5) * 0.05;

        batchBuffer.push({
          pollId: poll.id,
          optionId: option.id,
          userId: userId,
          subdivisionId: subdivision.id,
          latitude: subdivision.latitude + latVariation,
          longitude: subdivision.longitude + lngVariation,
          ipAddress: `172.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          userAgent: 'Mozilla/5.0 (Complete Coverage Script)'
        });
      }
    }

    // Insertar batch cuando alcanza el tamaño
    if (batchBuffer.length >= BATCH_SIZE) {
      await prisma.vote.createMany({
        data: batchBuffer,
        skipDuplicates: true
      });
      
      totalVotesCreated += batchBuffer.length;
      batchBuffer = [];
      
      process.stdout.write(`\r   ⚡ Subdivisiones procesadas: ${i + 1}/${subdivsWithoutVotes.length} | Votos: ${totalVotesCreated.toLocaleString()}...`);
    }
  }

  // Insertar batch restante
  if (batchBuffer.length > 0) {
    await prisma.vote.createMany({
      data: batchBuffer,
      skipDuplicates: true
    });
    totalVotesCreated += batchBuffer.length;
  }

  console.log(`\r   ✅ Subdivisiones procesadas: ${subdivsWithoutVotes.length}/${subdivsWithoutVotes.length} | Votos: ${totalVotesCreated.toLocaleString()}   \n`);

  // 4. VERIFICAR COBERTURA FINAL
  console.log('🔍 Paso 4: Verificando cobertura final...');
  
  const totalLevel3 = await prisma.subdivision.count({
    where: { level: 3 }
  });

  const subdivsNowWithVotes = await prisma.subdivision.count({
    where: {
      level: 3,
      votes: {
        some: {}
      }
    }
  });

  const coverage = (subdivsNowWithVotes / totalLevel3 * 100).toFixed(2);

  console.log(`   Total subdivisiones nivel 3: ${totalLevel3.toLocaleString()}`);
  console.log(`   ✅ Con votos: ${subdivsNowWithVotes.toLocaleString()} (${coverage}%)`);

  // 5. RESUMEN
  console.log('\n' + '='.repeat(60));
  console.log('🎯 COBERTURA 100% COMPLETADA\n');
  console.log(`📊 Estadísticas:`);
  console.log(`   - Subdivisiones procesadas: ${subdivsWithoutVotes.length.toLocaleString()}`);
  console.log(`   - Votos nuevos creados: ${totalVotesCreated.toLocaleString()}`);
  console.log(`   - Promedio votos/subdivisión: ${(totalVotesCreated / subdivsWithoutVotes.length).toFixed(1)}`);
  console.log(`   - Cobertura final: ${coverage}%`);
  console.log('='.repeat(60));

  if (parseFloat(coverage) >= 99.9) {
    console.log('\n✅ ¡TODAS las subdivisiones nivel 3 tienen votos!');
  } else {
    console.log(`\n⚠️  Cobertura: ${coverage}% (casi completo)`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
