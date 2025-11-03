/**
 * Script para probar el endpoint votes-by-country
 * y ver exactamente qué países retorna
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Probando endpoint votes-by-country...\n');

  // Obtener una encuesta trending
  const poll = await prisma.poll.findFirst({
    where: { status: 'active' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true }
  });

  if (!poll) {
    console.log('❌ No hay encuestas activas');
    return;
  }

  console.log(`📊 Encuesta: #${poll.id} - ${poll.title}\n`);

  // Simular lo que hace el endpoint
  const pollOptions = await prisma.pollOption.findMany({
    where: { pollId: poll.id },
    select: {
      id: true,
      optionKey: true
    }
  });

  console.log(`   Opciones: ${pollOptions.length}\n`);

  // Obtener todos los votos con subdivisión
  const votes = await prisma.vote.findMany({
    where: {
      pollId: poll.id
    },
    select: {
      optionId: true,
      subdivision: {
        select: {
          subdivisionId: true
        }
      }
    }
  });

  console.log(`   Votos totales: ${votes.length}\n`);

  // Crear mapa de optionId -> optionKey
  const optionIdToKey = new Map(
    pollOptions.map(opt => [opt.id, opt.optionKey])
  );

  // Agrupar votos por país
  const countryVotes: Record<string, Record<string, number>> = {};

  for (const vote of votes) {
    const countryIso = vote.subdivision.subdivisionId.split('.')[0];
    const optionKey = optionIdToKey.get(vote.optionId);

    if (!optionKey) continue;

    if (!countryVotes[countryIso]) {
      countryVotes[countryIso] = {};
    }

    countryVotes[countryIso][optionKey] = 
      (countryVotes[countryIso][optionKey] || 0) + 1;
  }

  console.log('📍 Países con votos:\n');
  
  const sortedCountries = Object.entries(countryVotes)
    .sort((a, b) => {
      const aTotal = Object.values(a[1]).reduce((sum, count) => sum + count, 0);
      const bTotal = Object.values(b[1]).reduce((sum, count) => sum + count, 0);
      return bTotal - aTotal;
    });

  console.log(`   Total de países: ${sortedCountries.length}\n`);
  
  console.log('📊 Top 30 países:\n');
  for (const [country, votes] of sortedCountries.slice(0, 30)) {
    const total = Object.values(votes).reduce((sum, count) => sum + count, 0);
    const optionsStr = Object.entries(votes)
      .map(([key, count]) => `${key}:${count}`)
      .join(', ');
    console.log(`   ${country}: ${total} votos (${optionsStr})`);
  }

  console.log('\n📊 TODOS los países (resumen):\n');
  for (const [country, votes] of sortedCountries) {
    const total = Object.values(votes).reduce((sum, count) => sum + count, 0);
    console.log(`   ${country}: ${total} votos`);
  }

  console.log(`\n✅ Endpoint retornaría ${sortedCountries.length} países con datos`);
  console.log(`\n💡 Si algunos países salen grises en el frontend:`);
  console.log(`   1. Verifica que el ISO3 coincida EXACTAMENTE (mayúsculas)`);
  console.log(`   2. Verifica que el TopoJSON del país exista en static/geojson/`);
  console.log(`   3. Revisa la consola del navegador para errores`);
  console.log(`   4. Verifica que aggregatedData tenga estos países`);
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
