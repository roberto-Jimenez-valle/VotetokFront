/**
 * Verificar cómo se agregan los votos por país
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando agregación de votos por país...\n');
  
  // Obtener una encuesta activa
  const poll = await prisma.poll.findFirst({
    where: { status: 'active' },
    include: { options: true }
  });
  
  if (!poll) {
    console.log('❌ No hay encuestas activas');
    return;
  }
  
  console.log(`📊 Encuesta: #${poll.id} - ${poll.title}\n`);
  
  // Simular la agregación que hace el endpoint /api/polls/[id]/votes-by-country
  const votes = await prisma.vote.findMany({
    where: { pollId: poll.id },
    include: {
      subdivision: {
        select: { subdivisionId: true }
      }
    }
  });
  
  console.log(`Total votos en encuesta: ${votes.length}\n`);
  
  // Agrupar por país (nivel 1)
  const optionIdToKey = new Map(poll.options.map(opt => [opt.id, opt.optionKey]));
  const countryVotes: Record<string, Record<string, number>> = {};
  
  for (const vote of votes) {
    if (!vote.subdivision) continue;
    
    // Extraer código de país (primer segmento antes del punto)
    const countryIso = vote.subdivision.subdivisionId.split('.')[0];
    const optionKey = optionIdToKey.get(vote.optionId);
    
    if (!optionKey) continue;
    
    if (!countryVotes[countryIso]) {
      countryVotes[countryIso] = {};
    }
    countryVotes[countryIso][optionKey] = (countryVotes[countryIso][optionKey] || 0) + 1;
  }
  
  console.log('📊 Países con votos:');
  console.log(`   Total: ${Object.keys(countryVotes).length}\n`);
  
  // Mostrar muestra de países nuevos
  const newCountries = ['LBY', 'UKR', 'ARM', 'MKD', 'ISR'];
  
  console.log('Muestra de países nuevos:\n');
  
  for (const code of newCountries) {
    if (countryVotes[code]) {
      const total = Object.values(countryVotes[code]).reduce((sum, count) => sum + count, 0);
      console.log(`   ✅ ${code}: ${total} votos`);
      console.log(`      Distribución:`, countryVotes[code]);
    } else {
      console.log(`   ❌ ${code}: Sin votos`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 VERIFICACIÓN DEL PROBLEMA\n');
  
  // Verificar si hay votos con subdivisionId NULL
  const votesWithoutSubdivision = await prisma.vote.count({
    where: {
      pollId: poll.id,
      subdivisionId: null
    }
  });
  
  console.log(`Votos sin subdivisión: ${votesWithoutSubdivision}`);
  
  if (votesWithoutSubdivision > 0) {
    console.log('⚠️  Hay votos sin subdivisión asignada');
  }
  
  // Verificar si los subdivision_id son correctos
  console.log('\n🔍 Muestra de subdivision_id de Libia:\n');
  
  const libyaVotes = await prisma.$queryRaw<Array<{ subdivision_id: string, count: bigint }>>`
    SELECT s.subdivision_id, COUNT(*) as count
    FROM votes v
    JOIN subdivisions s ON v.subdivision_id = s.id
    WHERE s.subdivision_id LIKE 'LBY.%'
      AND v.poll_id = ${poll.id}
    GROUP BY s.subdivision_id
    LIMIT 5
  `;
  
  if (libyaVotes.length > 0) {
    libyaVotes.forEach(row => {
      console.log(`   ${row.subdivision_id}: ${row.count} votos`);
    });
    
    // Verificar si el split funciona correctamente
    const firstId = libyaVotes[0].subdivision_id;
    const countryCode = firstId.split('.')[0];
    console.log(`\n   ✅ Extracción correcta: "${firstId}" → país: "${countryCode}"`);
  } else {
    console.log('   ❌ No hay votos de Libia en esta encuesta');
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
