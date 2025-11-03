/**
 * Script para poblar votos SOLO en subdivisiones de NIVEL 3
 * 
 * - Elimina todos los votos actuales
 * - Crea votos solo para subdivisiones con level=3 (ESP.1.2.3, IND.4.5, etc.)
 * - Distribuye votos realísticamente entre opciones
 * 
 * Uso: npx tsx scripts/seed-level3-votes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Distribución realista de votos por encuesta
const VOTES_PER_POLL = {
  min: 500,    // Mínimo de votos por encuesta
  max: 3000    // Máximo de votos por encuesta
};

// Distribución de votos por opción (porcentajes aproximados)
const VOTE_DISTRIBUTIONS = [
  [0.45, 0.30, 0.15, 0.10],  // Una opción domina fuertemente
  [0.35, 0.35, 0.20, 0.10],  // Dos opciones competitivas
  [0.40, 0.25, 0.25, 0.10],  // Una lidera, dos compiten
  [0.28, 0.27, 0.25, 0.20],  // Cuatro opciones muy competitivas
  [0.50, 0.25, 0.15, 0.10],  // Victoria clara
];

function getRandomDistribution() {
  return VOTE_DISTRIBUTIONS[Math.floor(Math.random() * VOTE_DISTRIBUTIONS.length)];
}

function getRandomVoteCount() {
  return Math.floor(Math.random() * (VOTES_PER_POLL.max - VOTES_PER_POLL.min + 1)) + VOTES_PER_POLL.min;
}

async function main() {
  console.log('🚀 Iniciando seed de votos nivel 3...\n');

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
      level1Id: true,
      level2Id: true,
      level3Id: true
    }
  });

  console.log(`   ✅ ${level3Subdivisions.length} subdivisiones nivel 3 encontradas\n`);

  if (level3Subdivisions.length === 0) {
    console.log('❌ No hay subdivisiones de nivel 3 en la base de datos');
    console.log('💡 Ejecuta primero los scripts de extracción de subdivisiones');
    return;
  }

  // Agrupar por país para distribución realista
  const subdivisionsByCountry = new Map<string, typeof level3Subdivisions>();
  for (const sub of level3Subdivisions) {
    const countryCode = sub.subdivisionId.split('.')[0];
    if (!subdivisionsByCountry.has(countryCode)) {
      subdivisionsByCountry.set(countryCode, []);
    }
    subdivisionsByCountry.get(countryCode)!.push(sub);
  }

  console.log(`   📍 Países con subdivisiones nivel 3: ${subdivisionsByCountry.size}`);
  for (const [country, subs] of subdivisionsByCountry) {
    console.log(`      ${country}: ${subs.length} subdivisiones`);
  }
  console.log();

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

  console.log(`   ✅ ${polls.length} encuestas activas encontradas\n`);

  if (polls.length === 0) {
    console.log('❌ No hay encuestas activas');
    return;
  }

  // 4. CREAR VOTOS PARA CADA ENCUESTA
  console.log('🗳️  Paso 4: Creando votos en subdivisiones nivel 3...\n');

  let totalVotesCreated = 0;
  const users = await prisma.user.findMany({ select: { id: true } });

  for (const poll of polls) {
    console.log(`   📊 Encuesta #${poll.id}: ${poll.title}`);
    console.log(`      Opciones: ${poll.options.length}`);

    if (poll.options.length === 0) {
      console.log(`      ⚠️  Sin opciones, saltando...\n`);
      continue;
    }

    // Seleccionar un subconjunto aleatorio de subdivisiones nivel 3 para esta encuesta
    // (no todas las subdivisiones votan en todas las encuestas)
    const participationRate = 0.3 + Math.random() * 0.4; // 30-70% de subdivisiones participan
    const participatingSubdivisions = level3Subdivisions
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(level3Subdivisions.length * participationRate));

    console.log(`      🎯 Subdivisiones participantes: ${participatingSubdivisions.length} (${(participationRate * 100).toFixed(0)}%)`);

    // Generar distribución de votos
    const totalVotesForPoll = getRandomVoteCount();
    const distribution = getRandomDistribution();
    
    // Ajustar distribución al número de opciones disponibles
    const adjustedDistribution = distribution.slice(0, poll.options.length);
    const sum = adjustedDistribution.reduce((a, b) => a + b, 0);
    const normalizedDistribution = adjustedDistribution.map(d => d / sum);

    console.log(`      📈 Votos totales: ${totalVotesForPoll}`);
    console.log(`      📊 Distribución: ${normalizedDistribution.map(d => `${(d * 100).toFixed(1)}%`).join(' / ')}`);

    let votesCreatedForPoll = 0;

    // Distribuir votos entre subdivisiones
    for (const subdivision of participatingSubdivisions) {
      // Número de votos de esta subdivisión (1-20 votos por subdivisión)
      const votesFromSubdivision = Math.floor(Math.random() * 15) + 1;

      for (let i = 0; i < votesFromSubdivision; i++) {
        // Seleccionar opción basada en la distribución
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
        
        // Usuario aleatorio (o null para voto anónimo)
        const userId = Math.random() > 0.3 ? users[Math.floor(Math.random() * users.length)].id : null;

        // Pequeña variación en lat/lng para simular diferentes ubicaciones dentro de la subdivisión
        const latVariation = (Math.random() - 0.5) * 0.1;
        const lngVariation = (Math.random() - 0.5) * 0.1;

        await prisma.vote.create({
          data: {
            pollId: poll.id,
            optionId: option.id,
            userId: userId,
            subdivisionId: subdivision.id,
            latitude: subdivision.latitude + latVariation,
            longitude: subdivision.longitude + lngVariation,
            ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            userAgent: 'Mozilla/5.0 (Seed Script)'
          }
        });

        votesCreatedForPoll++;
        totalVotesCreated++;

        // Log de progreso cada 100 votos
        if (votesCreatedForPoll % 100 === 0) {
          process.stdout.write(`\r      ✍️  Votos creados: ${votesCreatedForPoll}...`);
        }
      }
    }

    console.log(`\r      ✅ Votos creados: ${votesCreatedForPoll}`);
    
    // Mostrar distribución final
    const voteCounts = await prisma.vote.groupBy({
      by: ['optionId'],
      where: { pollId: poll.id },
      _count: { id: true }
    });

    console.log(`      📊 Distribución final por opción:`);
    for (const option of poll.options) {
      const count = voteCounts.find(vc => vc.optionId === option.id)?._count.id || 0;
      const pct = votesCreatedForPoll > 0 ? (count / votesCreatedForPoll * 100).toFixed(1) : '0.0';
      console.log(`         ${option.optionLabel}: ${count} votos (${pct}%)`);
    }
    console.log();
  }

  // 5. RESUMEN FINAL
  console.log('\n' + '='.repeat(60));
  console.log('✨ SEED COMPLETADO\n');
  console.log(`📊 Estadísticas:`);
  console.log(`   - Subdivisiones nivel 3: ${level3Subdivisions.length}`);
  console.log(`   - Países con datos: ${subdivisionsByCountry.size}`);
  console.log(`   - Encuestas procesadas: ${polls.length}`);
  console.log(`   - Votos totales creados: ${totalVotesCreated}`);
  console.log(`   - Promedio por encuesta: ${Math.round(totalVotesCreated / polls.length)}`);
  console.log('='.repeat(60));

  // Mostrar desglose por país
  console.log('\n📍 Votos por país (nivel 3):');
  const votesByCountry = await prisma.$queryRaw<Array<{ country: string; count: bigint }>>`
    SELECT 
      SUBSTRING(s.subdivision_id, 1, 3) as country,
      COUNT(v.id) as count
    FROM votes v
    JOIN subdivisions s ON v.subdivision_id = s.id
    WHERE s.level = 3
    GROUP BY SUBSTRING(s.subdivision_id, 1, 3)
    ORDER BY count DESC
    LIMIT 10
  `;

  for (const row of votesByCountry) {
    console.log(`   ${row.country}: ${row.count} votos`);
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
