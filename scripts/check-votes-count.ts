import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVotes() {
  console.log('🔍 Verificando votos en la base de datos...\n');

  try {
    // Contar total de votos
    const totalVotes = await prisma.vote.count();
    console.log(`📊 Total de votos: ${totalVotes}`);

    // Contar votos anónimos (los del seed)
    const anonymousVotes = await prisma.vote.count({
      where: { userId: null }
    });
    console.log(`👤 Votos anónimos (seed): ${anonymousVotes}`);

    // Contar votos por encuesta
    const votesByPoll = await prisma.vote.groupBy({
      by: ['pollId'],
      _count: true,
      orderBy: {
        _count: {
          pollId: 'desc'
        }
      },
      take: 10
    });

    console.log('\n📋 Votos por encuesta (top 10):');
    votesByPoll.forEach((row, i) => {
      console.log(`   ${i + 1}. Poll ${row.pollId}: ${row._count} votos`);
    });

    // Votos del último año
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const votesLastYear = await prisma.vote.count({
      where: {
        createdAt: {
          gte: oneYearAgo
        }
      }
    });
    console.log(`\n📅 Votos del último año: ${votesLastYear}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVotes();
