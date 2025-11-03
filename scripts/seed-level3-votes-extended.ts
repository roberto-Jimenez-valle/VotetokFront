/**
 * Script MEJORADO para poblar MUCHOS votos en TODAS las encuestas
 * Solo en subdivisiones de NIVEL 3
 * 
 * - Elimina todos los votos actuales
 * - Crea MUCHOS votos para TODAS las encuestas
 * - Solo subdivisiones level=3 (ESP.1.2.3, IND.4.5, etc.)
 * 
 * Uso: npx tsx scripts/seed-level3-votes-extended.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// AUMENTADO: Más votos por encuesta
const VOTES_PER_POLL = {
  min: 2000,    // Mínimo aumentado de 500 a 2000
  max: 8000     // Máximo aumentado de 3000 a 8000
};

// Distribución realista de votos por opción
const VOTE_DISTRIBUTIONS = [
  [0.45, 0.30, 0.15, 0.10],  // Una opción domina
  [0.35, 0.35, 0.20, 0.10],  // Dos opciones competitivas
  [0.40, 0.25, 0.25, 0.10],  // Una lidera, dos compiten
  [0.28, 0.27, 0.25, 0.20],  // Cuatro opciones muy competitivas
  [0.50, 0.25, 0.15, 0.10],  // Victoria clara
  [0.38, 0.32, 0.20, 0.10],  // Dos opciones fuertes
  [0.42, 0.28, 0.18, 0.12],  // Una clara ventaja
];

function getRandomDistribution() {
  return VOTE_DISTRIBUTIONS[Math.floor(Math.random() * VOTE_DISTRIBUTIONS.length)];
}

function getRandomVoteCount() {
  return Math.floor(Math.random() * (VOTES_PER_POLL.max - VOTES_PER_POLL.min + 1)) + VOTES_PER_POLL.min;
}

async function main() {
  console.log('🚀 Iniciando seed EXTENDIDO de votos nivel 3...\n');

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
    return;
  }

  // Agrupar por país
  const subdivisionsByCountry = new Map<string, typeof level3Subdivisions>();
  for (const sub of level3Subdivisions) {
    const countryCode = sub.subdivisionId.split('.')[0];
    if (!subdivisionsByCountry.has(countryCode)) {
      subdivisionsByCountry.set(countryCode, []);
    }
    subdivisionsByCountry.get(countryCode)!.push(sub);
  }

  console.log(`   📍 Países con subdivisiones nivel 3: ${subdivisionsByCountry.size}`);
  const topCountries = Array.from(subdivisionsByCountry.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);
  
  console.log(`   🔝 Top 10 países:`);
  for (const [country, subs] of topCountries) {
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

  // 4. OBTENER USUARIOS
  const users = await prisma.user.findMany({ select: { id: true } });
  console.log(`   👥 ${users.length} usuarios encontrados\n`);

  // 5. CREAR VOTOS PARA TODAS LAS ENCUESTAS
  console.log('🗳️  Paso 4: Creando votos en subdivisiones nivel 3...\n');

  let totalVotesCreated = 0;

  for (let pollIndex = 0; pollIndex < polls.length; pollIndex++) {
    const poll = polls[pollIndex];
    
    console.log(`   📊 Encuesta ${pollIndex + 1}/${polls.length} - ID #${poll.id}`);
    console.log(`      Título: ${poll.title}`);
    console.log(`      Opciones: ${poll.options.length}`);

    if (poll.options.length === 0) {
      console.log(`      ⚠️  Sin opciones, saltando...\n`);
      continue;
    }

    // AUMENTADO: 50-80% de subdivisiones participan (antes 30-70%)
    const participationRate = 0.5 + Math.random() * 0.3; // 50-80%
    const participatingSubdivisions = level3Subdivisions
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(level3Subdivisions.length * participationRate));

    console.log(`      🎯 Subdivisiones participantes: ${participatingSubdivisions.length} (${(participationRate * 100).toFixed(0)}%)`);

    // Generar distribución de votos
    const targetVotesForPoll = getRandomVoteCount();
    const distribution = getRandomDistribution();
    
    // Ajustar distribución al número de opciones
    const adjustedDistribution = distribution.slice(0, poll.options.length);
    const sum = adjustedDistribution.reduce((a, b) => a + b, 0);
    const normalizedDistribution = adjustedDistribution.map(d => d / sum);

    console.log(`      📈 Objetivo de votos: ${targetVotesForPoll}`);
    console.log(`      📊 Distribución: ${normalizedDistribution.map(d => `${(d * 100).toFixed(1)}%`).join(' / ')}`);

    let votesCreatedForPoll = 0;
    const votesPerSubdivision = Math.ceil(targetVotesForPoll / participatingSubdivisions.length);

    // Distribuir votos entre subdivisiones
    for (let subIndex = 0; subIndex < participatingSubdivisions.length; subIndex++) {
      const subdivision = participatingSubdivisions[subIndex];
      
      // AUMENTADO: 5-30 votos por subdivisión (antes 1-20)
      const votesFromSubdivision = Math.floor(Math.random() * 26) + 5;

      // Crear votos en batch para mejor performance
      const votesToCreate = [];

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
        
        // Usuario aleatorio (70% registrados, 30% anónimos)
        const userId = Math.random() > 0.3 ? users[Math.floor(Math.random() * users.length)].id : null;

        // Variación en coordenadas
        const latVariation = (Math.random() - 0.5) * 0.1;
        const lngVariation = (Math.random() - 0.5) * 0.1;

        votesToCreate.push({
          pollId: poll.id,
          optionId: option.id,
          userId: userId,
          subdivisionId: subdivision.id,
          latitude: subdivision.latitude + latVariation,
          longitude: subdivision.longitude + lngVariation,
          ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          userAgent: 'Mozilla/5.0 (Seed Script Extended)'
        });
      }

      // Crear votos en batch (mucho más rápido)
      if (votesToCreate.length > 0) {
        await prisma.vote.createMany({
          data: votesToCreate
        });

        votesCreatedForPoll += votesToCreate.length;
        totalVotesCreated += votesToCreate.length;
      }

      // Log de progreso cada 1000 subdivisiones
      if ((subIndex + 1) % 1000 === 0) {
        process.stdout.write(`\r      ✍️  Subdivisiones procesadas: ${subIndex + 1}/${participatingSubdivisions.length} | Votos: ${votesCreatedForPoll}...`);
      }
    }

    console.log(`\r      ✅ Votos creados: ${votesCreatedForPoll.toLocaleString()}                    `);
    
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
      console.log(`         ${option.optionLabel}: ${count.toLocaleString()} votos (${pct}%)`);
    }
    console.log();
  }

  // 6. RESUMEN FINAL
  console.log('\n' + '='.repeat(70));
  console.log('✨ SEED EXTENDIDO COMPLETADO\n');
  console.log(`📊 Estadísticas Finales:`);
  console.log(`   - Subdivisiones nivel 3 totales: ${level3Subdivisions.length.toLocaleString()}`);
  console.log(`   - Países con datos: ${subdivisionsByCountry.size}`);
  console.log(`   - Encuestas procesadas: ${polls.length}`);
  console.log(`   - 🎉 Votos totales creados: ${totalVotesCreated.toLocaleString()}`);
  console.log(`   - 📈 Promedio por encuesta: ${Math.round(totalVotesCreated / polls.length).toLocaleString()}`);
  console.log(`   - 📍 Promedio por subdivisión: ${(totalVotesCreated / level3Subdivisions.length).toFixed(1)}`);
  console.log('='.repeat(70));

  // Mostrar top países
  console.log('\n📍 Top 10 países por número de votos:');
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
    const subCount = subdivisionsByCountry.get(row.country)?.length || 0;
    const avgPerSub = Number(row.count) / subCount;
    console.log(`   ${row.country}: ${Number(row.count).toLocaleString()} votos | ${subCount} subdivs | ${avgPerSub.toFixed(1)} votos/subdiv`);
  }

  console.log('\n✅ Todos los votos han sido creados en subdivisiones de nivel 3!');
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
