import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  // Verificar subdivisiones del Distrito Federal
  const dfSubs = await prisma.subdivision.findMany({
    where: {
      subdivisionId: {
        startsWith: 'BRA.7'
      }
    },
    select: {
      subdivisionId: true,
      name: true,
      level: true,
      _count: {
        select: {
          votes: true
        }
      }
    }
  });
  
  console.log('📊 Distrito Federal (BRA.7):');
  console.log(`Total subdivisiones: ${dfSubs.length}\n`);
  
  dfSubs.forEach(sub => {
    console.log(`  ${sub.subdivisionId.padEnd(15)} (nivel ${sub.level}) - ${sub.name.padEnd(30)} - ${sub._count.votes} votos`);
  });
  
  const totalVotes = dfSubs.reduce((sum, s) => sum + s._count.votes, 0);
  console.log(`\n📊 Total de votos: ${totalVotes}`);
  
  const level2 = dfSubs.filter(s => s.level === 2);
  const level3 = dfSubs.filter(s => s.level === 3);
  
  console.log(`\n📊 Distribución:`);
  console.log(`  Nivel 2: ${level2.length} subdivisiones, ${level2.reduce((s, sub) => s + sub._count.votes, 0)} votos`);
  console.log(`  Nivel 3: ${level3.length} subdivisiones, ${level3.reduce((s, sub) => s + sub._count.votes, 0)} votos`);
  
} finally {
  await prisma.$disconnect();
}
