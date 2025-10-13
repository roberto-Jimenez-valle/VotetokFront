/**
 * Script para verificar los votos más recientes en la BD
 * Uso: npx tsx scripts/check-recent-votes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRecentVotes() {
  console.log('🔍 Verificando votos recientes en la base de datos...\n');

  try {
    // Contar total de votos
    const totalVotes = await prisma.vote.count();
    console.log('📊 Total de votos en la BD:', totalVotes);

    // Obtener los últimos 5 votos
    const recentVotes = await prisma.vote.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        poll: { select: { title: true } },
        option: { select: { optionLabel: true } }
      }
    });

    console.log('\n📋 Últimos 5 votos registrados:');
    recentVotes.forEach((vote, i) => {
      console.log(`\n${i + 1}. Voto #${vote.id}`);
      console.log(`   Encuesta: ${vote.poll.title}`);
      console.log(`   Opción: ${vote.option.optionLabel}`);
      console.log(`   Usuario: ${vote.userId || 'anónimo'}`);
      console.log(`   Ubicación: ${vote.countryName} - ${vote.subdivisionName || 'N/A'}`);
      console.log(`   IP: ${vote.ipAddress}`);
      console.log(`   Fecha: ${vote.createdAt.toLocaleString()}`);
    });

    // Votos de los últimos 5 minutos
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const veryRecentVotes = await prisma.vote.count({
      where: {
        createdAt: {
          gte: fiveMinutesAgo
        }
      }
    });

    console.log(`\n⏰ Votos en los últimos 5 minutos: ${veryRecentVotes}`);

    if (veryRecentVotes === 0) {
      console.log('⚠️ NO HAY VOTOS NUEVOS - El sistema de votación no está guardando en BD');
    } else {
      console.log('✅ Hay votos recientes - El sistema está funcionando');
    }

  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentVotes();
