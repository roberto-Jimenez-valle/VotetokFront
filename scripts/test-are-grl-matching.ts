/**
 * Test específico de matching para ARE y GRL
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Test de matching ARE y GRL...\n');
  
  // Simular lo que hace el endpoint /api/polls/[id]/votes-by-country
  
  const poll = await prisma.poll.findFirst({
    where: { status: 'active' },
    include: { options: true }
  });
  
  if (!poll) {
    console.log('❌ No hay encuestas activas');
    return;
  }
  
  console.log(`📊 Encuesta: #${poll.id}\n`);
  
  // Obtener votos y agrupar por país
  const votes = await prisma.vote.findMany({
    where: { pollId: poll.id },
    include: {
      subdivision: {
        select: { subdivisionId: true }
      }
    }
  });
  
  const countryVotes: Record<string, number> = {};
  
  for (const vote of votes) {
    if (!vote.subdivision) continue;
    
    const countryIso = vote.subdivision.subdivisionId.split('.')[0];
    countryVotes[countryIso] = (countryVotes[countryIso] || 0) + 1;
  }
  
  console.log('🌍 ARE (Emiratos Árabes):');
  if (countryVotes['ARE']) {
    console.log(`   ✅ ${countryVotes['ARE']} votos en esta encuesta`);
    console.log(`   ✅ Debería aparecer COLOREADO en el mapa\n`);
  } else {
    console.log(`   ❌ 0 votos en esta encuesta`);
    console.log(`   ⚠️  Aparecerá GRIS (sin datos para esta encuesta específica)\n`);
  }
  
  console.log('🌍 GRL (Groenlandia):');
  if (countryVotes['GRL']) {
    console.log(`   ✅ ${countryVotes['GRL']} votos en esta encuesta`);
    console.log(`   ✅ Debería aparecer COLOREADO en el mapa\n`);
  } else {
    console.log(`   ❌ 0 votos en esta encuesta`);
    console.log(`   ⚠️  Aparecerá GRIS (sin datos para esta encuesta específica)\n`);
  }
  
  console.log('='.repeat(70));
  console.log('💡 IMPORTANTE:\n');
  console.log('Los países se colorean POR ENCUESTA ACTIVA.');
  console.log('Si una encuesta no tiene votos de ARE/GRL, aparecerán grises.');
  console.log('\nPara verificar que tienen datos en general:');
  
  // Verificar votos totales
  const areTotal = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM votes v
    JOIN subdivisions s ON v.subdivision_id = s.id
    WHERE s.subdivision_id LIKE 'ARE.%'
  `;
  
  const grlTotal = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM votes v
    JOIN subdivisions s ON v.subdivision_id = s.id
    WHERE s.subdivision_id LIKE 'GRL.%'
  `;
  
  console.log(`\n   ARE (total): ${areTotal[0].count} votos`);
  console.log(`   GRL (total): ${grlTotal[0].count} votos`);
  
  console.log('\n🔧 SOLUCIÓN:');
  console.log('   1. Hacer HARD REFRESH (Ctrl + Shift + R)');
  console.log('   2. Abrir DevTools → Console');
  console.log('   3. Buscar: [computeGlobeViewModel]');
  console.log('   4. Verificar que ARE y GRL estén en "Con datos"');
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
