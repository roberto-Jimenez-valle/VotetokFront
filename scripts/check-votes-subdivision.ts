import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVotes() {
  console.log('\n📊 Últimos 10 votos registrados:\n');
  
  const votes = await prisma.vote.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      subdivision: true,
      option: {
        include: {
          poll: true
        }
      }
    }
  });
  
  for (const vote of votes) {
    console.log(`\n🗳️  Voto ID: ${vote.id}`);
    console.log(`   Encuesta: ${vote.option.poll.title}`);
    console.log(`   Opción: ${vote.option.text}`);
    console.log(`   Subdivisión: ${vote.subdivision?.name || 'NULL'} (ID: ${vote.subdivisionId})`);
    console.log(`   Nivel: ${vote.subdivision?.level || 'NULL'}`);
    console.log(`   Fecha: ${vote.createdAt.toLocaleString()}`);
  }
  
  console.log('\n\n📈 Votos agrupados por subdivisión:\n');
  
  const groupedVotes = await prisma.vote.groupBy({
    by: ['subdivisionId'],
    _count: true,
    orderBy: {
      _count: {
        subdivisionId: 'desc'
      }
    },
    take: 10
  });
  
  for (const group of groupedVotes) {
    const subdivision = await prisma.subdivision.findUnique({
      where: { id: group.subdivisionId || 0 }
    });
    
    console.log(`${subdivision?.name || 'NULL'} (${subdivision?.subdivisionId || 'NULL'}): ${group._count} votos`);
  }
  
  await prisma.$disconnect();
}

checkVotes();
