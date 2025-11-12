import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const level3 = await prisma.subdivision.findMany({
    where: {
      subdivisionId: {
        startsWith: 'BRA.'
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
  
  const totalVotes = level3.reduce((sum, s) => sum + s._count.votes, 0);
  const withVotes = level3.filter(s => s._count.votes > 0);
  
  console.log('📊 Brasil nivel 3:');
  console.log('  Total subdivisiones:', level3.length);
  console.log('  Con votos:', withVotes.length);
  console.log('  Total votos:', totalVotes);
  
  if (withVotes.length > 0) {
    console.log('\n✅ Primeros 10 con votos:');
    withVotes.slice(0, 10).forEach(s => {
      console.log(`  ${s.subdivisionId.padEnd(15)} - ${s.name.padEnd(30)} - ${s._count.votes} votos`);
    });
  }
  
} finally {
  await prisma.$disconnect();
}
