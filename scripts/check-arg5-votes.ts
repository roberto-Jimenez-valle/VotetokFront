import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVotes() {
  console.log('🔍 Buscando votos para ARG.5 (Buenos Aires)...\n');
  
  // Buscar votos de Argentina
  const votes = await prisma.vote.findMany({
    where: {
      countryIso3: 'ARG'
    },
    take: 100,
    include: {
      poll: true
    }
  });
  
  // Filtrar solo los votos que empiecen con ARG.5
  const arg5Votes = votes.filter(v => v.subdivisionId?.startsWith('ARG.5'));
  
  console.log(`✅ Encontrados ${arg5Votes.length} votos para ARG.5 (de ${votes.length} votos totales de Argentina)\n`);
  
  if (arg5Votes.length > 0) {
    console.log('📊 Primeros votos:');
    arg5Votes.slice(0, 5).forEach((vote, i) => {
      console.log(`   ${i + 1}. Subdivision: ${vote.subdivisionId}`);
      console.log(`      Poll: ${vote.poll.question || vote.poll.title}`);
      console.log(`      Option ID: ${vote.optionId}`);
      console.log('');
    });
    
    // Agrupar por subdivisionId
    const bySubdivision = arg5Votes.reduce((acc, vote) => {
      const subId = vote.subdivisionId || 'unknown';
      if (!acc[subId]) {
        acc[subId] = 0;
      }
      acc[subId]++;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('📈 Votos por subdivisión:');
    Object.entries(bySubdivision)
      .sort((a, b) => b[1] - a[1])
      .forEach(([sub, count]) => {
        console.log(`   ${sub}: ${count} votos`);
      });
  } else {
    console.log('⚠️  No hay votos para ninguna comuna de Buenos Aires');
    console.log('   Para probar la visualización, necesitas agregar votos con subdivisionId como:');
    console.log('   - ARG.5.1 (Comuna 1)');
    console.log('   - ARG.5.6 (Comuna 6)');
    console.log('   - ARG.5.7 (Comuna 7)');
    console.log('   etc.');
  }
  
  await prisma.$disconnect();
}

checkVotes().catch(console.error);
