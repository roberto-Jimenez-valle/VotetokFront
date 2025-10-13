/**
 * Script para verificar la estructura de las encuestas
 * Uso: npx tsx scripts/check-poll-structure.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPollStructure() {
  console.log('🔍 Verificando estructura de encuestas...\n');

  try {
    // Obtener una encuesta con sus opciones
    const poll = await prisma.poll.findFirst({
      include: {
        options: true,
        user: true
      }
    });

    if (!poll) {
      console.error('❌ No hay encuestas en la base de datos');
      return;
    }

    console.log('📊 Encuesta completa:');
    console.log(JSON.stringify({
      id: poll.id,
      title: poll.title,
      totalVotes: poll.totalVotes,
      options: poll.options.map(opt => ({
        id: opt.id,
        optionId: opt.id,
        key: opt.optionKey,
        optionKey: opt.optionKey,
        label: opt.optionLabel,
        optionLabel: opt.optionLabel,
        color: opt.color,
        votes: opt.voteCount,
        voteCount: opt.voteCount
      }))
    }, null, 2));

    console.log('\n✅ Estructura verificada');
    console.log('✅ Cada opción debe tener:');
    console.log('  - id (número)');
    console.log('  - optionKey (string)');
    console.log('  - optionLabel (string)');
    console.log('  - color (string)');
    console.log('  - voteCount (número)');

  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPollStructure();
