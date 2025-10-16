import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVotes() {
  console.log('═'.repeat(60));
  console.log('🔍 VERIFICACIÓN DE VOTOS EN LA BASE DE DATOS');
  console.log('═'.repeat(60));
  
  try {
    // Contar total de votos
    const totalVotes = await prisma.vote.count();
    console.log(`\n📊 Total de votos en la base de datos: ${totalVotes}`);
    
    // Obtener los últimos 10 votos
    const recentVotes = await prisma.vote.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        poll: { select: { id: true, title: true } },
        option: { select: { id: true, optionLabel: true } }
      }
    });
    
    console.log(`\n📋 Últimos ${recentVotes.length} votos:`);
    console.log('─'.repeat(60));
    
    recentVotes.forEach((vote, index) => {
      console.log(`\n${index + 1}. Voto ID: ${vote.id}`);
      console.log(`   Encuesta: #${vote.pollId} - ${vote.poll.title}`);
      console.log(`   Opción: #${vote.optionId} - ${vote.option.optionLabel}`);
      console.log(`   Usuario ID: ${vote.userId || 'Anónimo'}`);
      console.log(`   IP: ${vote.ipAddress || 'N/A'}`);
      console.log(`   País: ${vote.countryName} (${vote.countryIso3})`);
      console.log(`   Subdivisión: ${vote.subdivisionName || 'N/A'} (${vote.subdivisionId || 'N/A'})`);
      console.log(`   Ubicación: ${vote.latitude}, ${vote.longitude}`);
      console.log(`   Fecha: ${vote.createdAt.toLocaleString()}`);
    });
    
    // Contar votos por encuesta
    console.log('\n\n📊 VOTOS POR ENCUESTA:');
    console.log('─'.repeat(60));
    
    const votesByPoll = await prisma.vote.groupBy({
      by: ['pollId'],
      _count: { id: true }
    });
    
    for (const group of votesByPoll) {
      const poll = await prisma.poll.findUnique({
        where: { id: group.pollId },
        select: { id: true, title: true }
      });
      console.log(`Encuesta #${poll.id} "${poll.title}": ${group._count.id} votos`);
    }
    
    // Verificar si hay votos recientes (últimos 5 minutos)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentCount = await prisma.vote.count({
      where: {
        createdAt: { gte: fiveMinutesAgo }
      }
    });
    
    console.log('\n\n⏱️ VOTOS RECIENTES (últimos 5 minutos):');
    console.log(`   ${recentCount} votos`);
    
    if (recentCount > 0) {
      const veryRecentVotes = await prisma.vote.findMany({
        where: {
          createdAt: { gte: fiveMinutesAgo }
        },
        orderBy: { createdAt: 'desc' },
        include: {
          poll: { select: { title: true } },
          option: { select: { optionLabel: true } }
        }
      });
      
      veryRecentVotes.forEach(vote => {
        console.log(`   - ${vote.poll.title} → ${vote.option.optionLabel} (${vote.createdAt.toLocaleTimeString()})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error al verificar votos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVotes();
