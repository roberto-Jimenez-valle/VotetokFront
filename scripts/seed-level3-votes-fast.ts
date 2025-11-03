/**
 * Script RÁPIDO para poblar votos nivel 3 - OPTIMIZADO
 * 
 * - Participación 10-20% (más rápido)
 * - Batch inserts grandes (mejor performance)
 * - ~1 hora de ejecución
 * - ~30,000-50,000 votos totales
 * 
 * Uso: npx tsx scripts/seed-level3-votes-fast.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuración optimizada para velocidad
const VOTES_PER_POLL = {
  min: 1500,
  max: 5000
};

// Batch size para inserts (más grande = más rápido)
const BATCH_SIZE = 500;

const VOTE_DISTRIBUTIONS = [
  [0.45, 0.30, 0.15, 0.10],
  [0.35, 0.35, 0.20, 0.10],
  [0.40, 0.25, 0.25, 0.10],
  [0.28, 0.27, 0.25, 0.20],
  [0.50, 0.25, 0.15, 0.10],
  [0.38, 0.32, 0.20, 0.10],
  [0.42, 0.28, 0.18, 0.12],
];

function getRandomDistribution() {
  return VOTE_DISTRIBUTIONS[Math.floor(Math.random() * VOTE_DISTRIBUTIONS.length)];
}

function getRandomVoteCount() {
  return Math.floor(Math.random() * (VOTES_PER_POLL.max - VOTES_PER_POLL.min + 1)) + VOTES_PER_POLL.min;
}

async function main() {
  const startTime = Date.now();
  console.log('⚡ Iniciando seed RÁPIDO de votos nivel 3...\n');

  // 1. ELIMINAR VOTOS ACTUALES
  console.log('🗑️  Paso 1: Eliminando votos actuales...');
  const deletedVotes = await prisma.vote.deleteMany({});
  console.log(`   ✅ ${deletedVotes.count} votos eliminados\n`);

  // 2. OBTENER SUBDIVISIONES DE NIVEL 3
  console.log('📊 Paso 2: Obteniendo subdivisiones de nivel 3...');
  const level3Subdivisions = await prisma.subdivision.findMany({
    where: {
      level: 3
    },
    select: {
      id: true,
      subdivisionId: true,
      name: true,
      latitude: true,
      longitude: true,
    }
  });

  console.log(`   ✅ ${level3Subdivisions.length.toLocaleString()} subdivisiones nivel 3 encontradas\n`);

  if (level3Subdivisions.length === 0) {
    console.log('❌ No hay subdivisiones de nivel 3');
    return;
  }

  // 3. OBTENER ENCUESTAS Y OPCIONES
  console.log('📋 Paso 3: Obteniendo encuestas activas...');
  const polls = await prisma.poll.findMany({
    where: {
      status: 'active'
    },
    include: {
      options: {
        orderBy: {
          displayOrder: 'asc'
        }
      }
    }
  });

  console.log(`   ✅ ${polls.length} encuestas activas\n`);

  if (polls.length === 0) {
    console.log('❌ No hay encuestas activas');
    return;
  }

  // 4. OBTENER USUARIOS
  const users = await prisma.user.findMany({ select: { id: true } });
  console.log(`   👥 ${users.length} usuarios\n`);

  // 5. CREAR VOTOS PARA TODAS LAS ENCUESTAS
  console.log('🗳️  Paso 4: Creando votos (MODO RÁPIDO)...\n');

  let totalVotesCreated = 0;

  for (let pollIndex = 0; pollIndex < polls.length; pollIndex++) {
    const poll = polls[pollIndex];
    
    console.log(`   📊 [${pollIndex + 1}/${polls.length}] Encuesta #${poll.id}: ${poll.title.substring(0, 50)}...`);

    if (poll.options.length === 0) {
      console.log(`      ⚠️  Sin opciones, saltando...\n`);
      continue;
    }

    // OPTIMIZADO: 10-20% participación (mucho más rápido)
    const participationRate = 0.10 + Math.random() * 0.10; // 10-20%
    const participatingSubdivisions = level3Subdivisions
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(level3Subdivisions.length * participationRate));

    console.log(`      🎯 Subdivisiones: ${participatingSubdivisions.length.toLocaleString()} (${(participationRate * 100).toFixed(0)}%)`);

    const targetVotesForPoll = getRandomVoteCount();
    const distribution = getRandomDistribution();
    
    const adjustedDistribution = distribution.slice(0, poll.options.length);
    const sum = adjustedDistribution.reduce((a, b) => a + b, 0);
    const normalizedDistribution = adjustedDistribution.map(d => d / sum);

    console.log(`      📈 Objetivo: ${targetVotesForPoll.toLocaleString()} votos | Distribución: ${normalizedDistribution.map(d => `${(d * 100).toFixed(0)}%`).join('/')}`);

    // Calcular votos por subdivisión para alcanzar el objetivo
    const votesPerSubdivision = Math.ceil(targetVotesForPoll / participatingSubdivisions.length);
    
    let batchBuffer = [];
    let votesCreatedForPoll = 0;

    // Distribuir votos
    for (let subIndex = 0; subIndex < participatingSubdivisions.length; subIndex++) {
      const subdivision = participatingSubdivisions[subIndex];
      
      // 3-15 votos por subdivisión
      const votesFromSubdivision = Math.min(
        Math.floor(Math.random() * 13) + 3,
        votesPerSubdivision
      );

      for (let i = 0; i < votesFromSubdivision; i++) {
        // Seleccionar opción basada en distribución
        const rand = Math.random();
        let cumulativeProb = 0;
        let selectedOptionIndex = 0;

        for (let j = 0; j < normalizedDistribution.length; j++) {
          cumulativeProb += normalizedDistribution[j];
          if (rand <= cumulativeProb) {
            selectedOptionIndex = j;
            break;
          }
        }

        const option = poll.options[selectedOptionIndex];
        const userId = Math.random() > 0.3 ? users[Math.floor(Math.random() * users.length)].id : null;

        const latVariation = (Math.random() - 0.5) * 0.05;
        const lngVariation = (Math.random() - 0.5) * 0.05;

        batchBuffer.push({
          pollId: poll.id,
          optionId: option.id,
          userId: userId,
          subdivisionId: subdivision.id,
          latitude: subdivision.latitude + latVariation,
          longitude: subdivision.longitude + lngVariation,
          ipAddress: `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          userAgent: 'Mozilla/5.0 (Seed Script Fast)'
        });

        // Insertar batch cuando alcanza el tamaño
        if (batchBuffer.length >= BATCH_SIZE) {
          await prisma.vote.createMany({
            data: batchBuffer,
            skipDuplicates: true
          });
          
          votesCreatedForPoll += batchBuffer.length;
          totalVotesCreated += batchBuffer.length;
          batchBuffer = [];
          
          // Progress cada batch
          process.stdout.write(`\r      ⚡ Votos: ${votesCreatedForPoll.toLocaleString()}...`);
        }
      }
    }

    // Insertar batch restante
    if (batchBuffer.length > 0) {
      await prisma.vote.createMany({
        data: batchBuffer,
        skipDuplicates: true
      });
      votesCreatedForPoll += batchBuffer.length;
      totalVotesCreated += batchBuffer.length;
    }

    console.log(`\r      ✅ Votos creados: ${votesCreatedForPoll.toLocaleString()}                    `);
    
    // Distribución final
    const voteCounts = await prisma.vote.groupBy({
      by: ['optionId'],
      where: { pollId: poll.id },
      _count: { id: true }
    });

    console.log(`      📊 Distribución:`);
    for (const option of poll.options) {
      const count = voteCounts.find(vc => vc.optionId === option.id)?._count.id || 0;
      const pct = votesCreatedForPoll > 0 ? (count / votesCreatedForPoll * 100).toFixed(1) : '0.0';
      const label = option.optionLabel.substring(0, 30);
      console.log(`         ${label}: ${count.toLocaleString()} (${pct}%)`);
    }
    console.log();
  }

  // 6. RESUMEN FINAL
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(1);
  
  console.log('\n' + '='.repeat(70));
  console.log('⚡ SEED RÁPIDO COMPLETADO\n');
  console.log(`📊 Estadísticas:`);
  console.log(`   - ⏱️  Tiempo total: ${duration} minutos`);
  console.log(`   - 📍 Subdivisiones nivel 3: ${level3Subdivisions.length.toLocaleString()}`);
  console.log(`   - 📋 Encuestas procesadas: ${polls.length}`);
  console.log(`   - 🎉 Votos totales: ${totalVotesCreated.toLocaleString()}`);
  console.log(`   - 📈 Promedio/encuesta: ${Math.round(totalVotesCreated / polls.length).toLocaleString()}`);
  console.log(`   - ⚡ Velocidad: ${Math.round(totalVotesCreated / (duration * 60)).toLocaleString()} votos/segundo`);
  console.log('='.repeat(70));

  // Top países
  console.log('\n📍 Top 10 países por votos:');
  const votesByCountry = await prisma.$queryRaw<Array<{ country: string; count: bigint }>>`
    SELECT 
      SUBSTRING(s.subdivision_id, 1, 3) as country,
      COUNT(v.id)::bigint as count
    FROM votes v
    JOIN subdivisions s ON v.subdivision_id = s.id
    WHERE s.level = 3
    GROUP BY SUBSTRING(s.subdivision_id, 1, 3)
    ORDER BY count DESC
    LIMIT 10
  `;

  for (const row of votesByCountry) {
    console.log(`   ${row.country}: ${Number(row.count).toLocaleString()} votos`);
  }

  console.log('\n✅ Listo! Refresca la app para ver los nuevos datos.');
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
