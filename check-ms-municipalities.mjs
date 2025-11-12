import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  // Municipios de Mato Grosso do Sul (BRA.11.X)
  const municipalities = await prisma.subdivision.findMany({
    where: {
      subdivisionId: {
        startsWith: 'BRA.11.'
      },
      level: 3
    },
    select: {
      subdivisionId: true,
      name: true,
      _count: {
        select: {
          votes: true
        }
      }
    }
  });
  
  const totalVotes = municipalities.reduce((sum, s) => sum + s._count.votes, 0);
  const withVotes = municipalities.filter(s => s._count.votes > 0);
  
  console.log('📊 Mato Grosso do Sul (BRA.11) - Municipios:');
  console.log('  Total municipios:', municipalities.length);
  console.log('  Con votos:', withVotes.length);
  console.log('  Total votos:', totalVotes);
  
  if (withVotes.length > 0) {
    console.log('\n✅ Municipios con votos:');
    withVotes.forEach(s => {
      console.log(`  ${s.subdivisionId.padEnd(20)} - ${s.name.padEnd(30)} - ${s._count.votes} votos`);
    });
  } else {
    console.log('\n❌ NO HAY VOTOS en Mato Grosso do Sul');
  }
  
} finally {
  await prisma.$disconnect();
}
