/**
 * Test directo del endpoint de votos por país
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Simulando endpoint /api/polls/[id]/votes-by-country...\n');
  
  const poll = await prisma.poll.findFirst({
    where: { status: 'active' },
    include: { options: true }
  });
  
  if (!poll) {
    console.log('❌ No hay encuestas activas');
    return;
  }
  
  console.log(`📊 Encuesta: #${poll.id}\n`);
  
  // Simular exactamente lo que hace el endpoint
  const votes = await prisma.vote.findMany({
    where: { pollId: poll.id },
    include: {
      subdivision: {
        select: { subdivisionId: true }
      }
    }
  });
  
  // Agrupar por país y opción
  const optionIdToKey = new Map(poll.options.map(opt => [opt.id, opt.optionKey]));
  const countryVotes: Record<string, Record<string, number>> = {};
  
  for (const vote of votes) {
    if (!vote.subdivision) continue;
    
    const countryIso = vote.subdivision.subdivisionId.split('.')[0];
    const optionKey = optionIdToKey.get(vote.optionId);
    
    if (!optionKey) continue;
    
    if (!countryVotes[countryIso]) {
      countryVotes[countryIso] = {};
    }
    countryVotes[countryIso][optionKey] = (countryVotes[countryIso][optionKey] || 0) + 1;
  }
  
  // Verificar ARE específicamente
  console.log('='.repeat(70));
  console.log('🇦🇪 EMIRATOS ÁRABES (ARE):\n');
  
  if (countryVotes['ARE']) {
    console.log('✅ PRESENTE en la respuesta del endpoint');
    console.log('\nDatos que debería recibir el frontend:');
    console.log(JSON.stringify({ ARE: countryVotes['ARE'] }, null, 2));
    
    const total = Object.values(countryVotes['ARE']).reduce((sum, count) => sum + count, 0);
    console.log(`\nTotal votos: ${total}`);
  } else {
    console.log('❌ NO PRESENTE en la respuesta');
    console.log('   Esto explica por qué sale gris');
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🔧 VERIFICACIÓN:\n');
  
  console.log('1. Abre en tu navegador:');
  console.log(`   http://localhost:5173/api/polls/${poll.id}/votes-by-country\n`);
  
  console.log('2. Busca "ARE" en la respuesta JSON');
  console.log('   - Si aparece: El problema es CACHÉ del navegador');
  console.log('   - Si NO aparece: El problema es el ENDPOINT\n');
  
  console.log('3. Para limpiar caché:');
  console.log('   - DevTools (F12) → Network → Disable cache');
  console.log('   - Hard refresh (Ctrl + Shift + R)');
  console.log('   - O modo incógnito\n');
  
  // Mostrar muestra de otros países para comparar
  console.log('📊 Muestra de otros países (para comparar):\n');
  const sample = Object.keys(countryVotes).slice(0, 5);
  sample.forEach(code => {
    const total = Object.values(countryVotes[code]).reduce((sum, count) => sum + count, 0);
    console.log(`   ${code}: ${total} votos`);
  });
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
