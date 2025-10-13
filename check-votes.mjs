// Verificar votos en la última encuesta creada
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVotes() {
  console.log('🔍 Verificando última encuesta y sus votos...\n');
  
  // Obtener última encuesta
  const lastPoll = await prisma.poll.findFirst({
    orderBy: { id: 'desc' },
    include: {
      options: true
    }
  });
  
  if (!lastPoll) {
    console.log('❌ No hay encuestas en la base de datos');
    return;
  }
  
  console.log(`📊 Encuesta: "${lastPoll.title}" (ID: ${lastPoll.id})`);
  console.log(`   Total votos registrados: ${lastPoll.totalVotes}`);
  console.log(`   Creada: ${lastPoll.createdAt}`);
  console.log(`   Cierra: ${lastPoll.closedAt || 'Sin límite'}\n`);
  
  console.log('📋 Opciones:');
  for (const option of lastPoll.options) {
    // Contar votos reales de esta opción
    const realVotes = await prisma.vote.count({
      where: { optionId: option.id }
    });
    
    const match = option.voteCount === realVotes ? '✅' : '⚠️';
    console.log(`   ${match} ${option.optionLabel}`);
    console.log(`      - ID: ${option.id}`);
    console.log(`      - voteCount: ${option.voteCount}`);
    console.log(`      - Votos reales en BD: ${realVotes}`);
  }
  
  // Contar todos los votos de esta encuesta
  const totalRealVotes = await prisma.vote.count({
    where: { pollId: lastPoll.id }
  });
  
  console.log(`\n📊 Resumen:`);
  console.log(`   - totalVotes en poll: ${lastPoll.totalVotes}`);
  console.log(`   - Votos reales en tabla votes: ${totalRealVotes}`);
  
  if (lastPoll.totalVotes !== totalRealVotes) {
    console.log(`   ⚠️  HAY DESINCRONIZACIÓN`);
  } else if (totalRealVotes === 0) {
    console.log(`   ⚠️  NO HAY VOTOS GUARDADOS`);
  } else {
    console.log(`   ✅ Todo sincronizado`);
  }
  
  // Mostrar los últimos 3 votos
  console.log(`\n🗳️  Últimos votos en esta encuesta:`);
  const recentVotes = await prisma.vote.findMany({
    where: { pollId: lastPoll.id },
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: {
      option: true
    }
  });
  
  if (recentVotes.length === 0) {
    console.log('   (Ninguno)');
  } else {
    recentVotes.forEach((vote, i) => {
      console.log(`   ${i + 1}. ${vote.option.optionLabel}`);
      console.log(`      - Voto ID: ${vote.id}`);
      console.log(`      - IP: ${vote.ipAddress}`);
      console.log(`      - Fecha: ${vote.createdAt}`);
    });
  }
}

checkVotes()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
