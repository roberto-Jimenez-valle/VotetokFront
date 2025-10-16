// Script para monitorear votos en tiempo real
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let lastVoteId = 0;

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
    
    if (latestVote && latestVote.id > lastVoteId) {
      console.log('\n🆕 NUEVO VOTO DETECTADO!');
      console.log('═'.repeat(60));
      console.log(`ID: ${latestVote.id}`);
      console.log(`Encuesta: ${latestVote.poll.title}`);
      console.log(`Opción: ${latestVote.option.optionLabel}`);
      console.log(`País: ${latestVote.countryName} (${latestVote.countryIso3})`);
      console.log(`Subdivisión: ${latestVote.subdivisionName || 'N/A'}`);
      console.log(`Usuario: ${latestVote.userId || 'Anónimo'}`);
      console.log(`IP: ${latestVote.ipAddress || 'N/A'}`);
      console.log(`Fecha: ${latestVote.createdAt.toLocaleString()}`);
      console.log('═'.repeat(60));
      
      lastVoteId = latestVote.id;
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function init() {
  // Obtener el ID del último voto al iniciar
  const latest = await prisma.vote.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true }
  });
  
  lastVoteId = latest?.id || 0;
  
  console.log('🔍 MONITOR DE VOTOS EN TIEMPO REAL');
  console.log('═'.repeat(60));
  console.log(`Último voto en BD: #${lastVoteId}`);
  console.log('Esperando nuevos votos...');
  console.log('Presiona Ctrl+C para salir\n');
  
  // Verificar cada segundo
  setInterval(checkNewVotes, 1000);
}

init();
