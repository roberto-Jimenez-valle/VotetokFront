/**
 * Script para monitorear votos en tiempo real
 * Uso: npx tsx scripts/watch-votes.ts
 * 
 * Deja este script corriendo y vota en la aplicación.
 * Verás si el voto se guarda en la BD.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let lastVoteId = 0;
let checkCount = 0;

async function checkNewVotes() {
  try {
    // Obtener el último voto
    const latestVote = await prisma.vote.findFirst({
      orderBy: { id: 'desc' },
      include: {
        poll: { select: { title: true } },
        option: { select: { optionLabel: true } }
      }
    });

    if (!latestVote) {
      console.log('❌ No hay votos en la base de datos');
      return;
    }

    if (lastVoteId === 0) {
      // Primera ejecución
      lastVoteId = latestVote.id;
      console.log('👀 Monitoreando votos...');
      console.log(`📊 Último voto en BD: #${lastVoteId}`);
      console.log(`   Encuesta: ${latestVote.poll.title}`);
      console.log(`   Opción: ${latestVote.option.optionLabel}`);
      console.log(`   Fecha: ${latestVote.createdAt.toLocaleString()}`);
      console.log('\n⏰ Esperando nuevos votos... (vota en la aplicación)');
      console.log('─'.repeat(60));
    } else if (latestVote.id > lastVoteId) {
      // ¡NUEVO VOTO DETECTADO!
      console.log('\n🎉 ¡NUEVO VOTO DETECTADO!');
      console.log('═'.repeat(60));
      console.log(`✅ Voto #${latestVote.id} guardado en BD`);
      console.log(`   Encuesta: ${latestVote.poll.title}`);
      console.log(`   Opción: ${latestVote.option.optionLabel}`);
      console.log(`   Usuario: ${latestVote.userId || 'anónimo'}`);
      console.log(`   País: ${latestVote.countryName || 'N/A'}`);
      console.log(`   Subdivisión: ${latestVote.subdivisionName || 'N/A'}`);
      console.log(`   SubdivisionId: ${latestVote.subdivisionId || 'N/A'}`);
      console.log(`   Ubicación: ${latestVote.latitude}, ${latestVote.longitude}`);
      console.log(`   IP: ${latestVote.ipAddress}`);
      console.log(`   Fecha: ${latestVote.createdAt.toLocaleString()}`);
      console.log('═'.repeat(60));
      console.log('⏰ Esperando más votos...\n');
      
      lastVoteId = latestVote.id;
    } else {
      // Mostrar un punto cada 10 checks para indicar que está activo
      checkCount++;
      if (checkCount % 10 === 0) {
        process.stdout.write('.');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

console.log('═'.repeat(60));
console.log('🔍 MONITOR DE VOTOS EN TIEMPO REAL');
console.log('═'.repeat(60));
console.log('Instrucciones:');
console.log('1. Deja este script corriendo');
console.log('2. Ve a tu aplicación y vota en una encuesta');
console.log('3. Si el voto se guarda, verás un mensaje aquí');
console.log('4. Presiona Ctrl+C para detener');
console.log('═'.repeat(60));
console.log('');

// Verificar inmediatamente
checkNewVotes();

// Verificar cada 2 segundos
const interval = setInterval(checkNewVotes, 2000);

// Manejar Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n\n👋 Deteniendo monitor...');
  clearInterval(interval);
  await prisma.$disconnect();
  process.exit(0);
});
