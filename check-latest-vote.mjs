import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLatest() {
  console.log('🔍 Verificando el último voto guardado...\n');
  
  const latestVote = await prisma.vote.findFirst({
    orderBy: { id: 'desc' },
    include: {
      poll: { select: { id: true, title: true } },
      option: { select: { id: true, optionLabel: true } },
      user: { select: { id: true, username: true } }
    }
  });
  
  if (!latestVote) {
    console.log('❌ No hay votos en la base de datos');
    return;
  }
  
  console.log('═'.repeat(60));
  console.log('📊 ÚLTIMO VOTO EN BASE DE DATOS');
  console.log('═'.repeat(60));
  console.log(`ID del voto: ${latestVote.id}`);
  console.log(`Encuesta: #${latestVote.poll.id} - ${latestVote.poll.title}`);
  console.log(`Opción: ${latestVote.option.optionLabel}`);
  console.log(`Usuario: ${latestVote.user ? latestVote.user.username : 'Anónimo'} (ID: ${latestVote.userId || 'N/A'})`);
  console.log('\n📍 UBICACIÓN:');
  console.log(`País: ${latestVote.countryName} (${latestVote.countryIso3})`);
  console.log(`Subdivisión: ${latestVote.subdivisionName || 'N/A'} (ID: ${latestVote.subdivisionId || 'NULL'})`);
  console.log(`Ciudad: ${latestVote.cityName || 'N/A'}`);
  console.log(`Coordenadas: ${latestVote.latitude}, ${latestVote.longitude}`);
  console.log(`IP: ${latestVote.ipAddress || 'N/A'}`);
  console.log(`\nFecha: ${latestVote.createdAt.toLocaleString('es-ES')}`);
  console.log('═'.repeat(60));
  
  if (latestVote.subdivisionId) {
    console.log('\n✅ ¡ÉXITO! El subdivisionId SÍ se guardó correctamente');
    console.log(`   Valor guardado: ${latestVote.subdivisionId}`);
  } else {
    console.log('\n❌ ERROR: subdivisionId es NULL en la base de datos');
  }
  
  await prisma.$disconnect();
}

checkLatest();
