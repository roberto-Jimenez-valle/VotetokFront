import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllVotesUser1() {
  console.log('🔍 Verificando TODOS los votos del usuario ID 1...\n');
  
  const votes = await prisma.vote.findMany({
    where: { userId: 1 },
    orderBy: { createdAt: 'desc' },
    include: {
      poll: { select: { id: true, title: true } },
      option: { select: { optionLabel: true } }
    }
  });
  
  console.log(`📊 Total de votos del usuario 1: ${votes.length}\n`);
  
  votes.forEach((vote, index) => {
    console.log('─'.repeat(60));
    console.log(`${index + 1}. Voto ID: ${vote.id}`);
    console.log(`   Encuesta: #${vote.poll.id} - ${vote.poll.title.substring(0, 50)}`);
    console.log(`   Opción: ${vote.option.optionLabel}`);
    console.log(`   País: ${vote.countryName} (${vote.countryIso3})`);
    console.log(`   Subdivisión: ${vote.subdivisionName || 'NULL'} (${vote.subdivisionId || 'NULL'})`);
    console.log(`   Fecha: ${vote.createdAt.toLocaleString('es-ES')}`);
    
    if (vote.subdivisionId) {
      console.log(`   ✅ subdivisionId: ${vote.subdivisionId}`);
    } else {
      console.log(`   ❌ subdivisionId: NULL`);
    }
  });
  
  console.log('\n' + '═'.repeat(60));
  
  const withSubdivision = votes.filter(v => v.subdivisionId !== null);
  const withoutSubdivision = votes.filter(v => v.subdivisionId === null);
  
  console.log(`✅ Votos CON subdivisionId: ${withSubdivision.length}`);
  console.log(`❌ Votos SIN subdivisionId: ${withoutSubdivision.length}`);
  
  await prisma.$disconnect();
}

checkAllVotesUser1();
