// Script para probar el endpoint de votación
// Ejecutar con: node test-vote-endpoint.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testVoteCreation() {
  console.log('═'.repeat(60));
  console.log('🧪 PRUEBA DE CREACIÓN DE VOTO DIRECTAMENTE EN BD');
  console.log('═'.repeat(60));
  
  try {
    // 1. Buscar una encuesta activa
    const poll = await prisma.poll.findFirst({
      where: { status: 'active' },
      include: { options: true }
    });
    
    if (!poll) {
      console.error('❌ No se encontró ninguna encuesta activa');
      return;
    }
    
    console.log(`\n✅ Encuesta encontrada: #${poll.id} - ${poll.title}`);
    console.log(`   Opciones disponibles: ${poll.options.length}`);
    
    if (poll.options.length === 0) {
      console.error('❌ La encuesta no tiene opciones');
      return;
    }
    
    // 2. Usar la primera opción
    const option = poll.options[0];
    console.log(`\n📝 Creando voto de prueba para opción: #${option.id} - ${option.optionLabel}`);
    
    // 3. Crear voto de prueba
    const testVote = await prisma.vote.create({
      data: {
        pollId: poll.id,
        optionId: option.id,
        userId: null, // Voto anónimo
        latitude: 40.4168,
        longitude: -3.7038,
        countryIso3: 'ESP',
        countryName: 'España',
        subdivisionId: null,
        subdivisionName: null,
        cityName: 'Madrid',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Script'
      }
    });
    
    console.log('\n✅ Voto de prueba creado exitosamente:');
    console.log(`   ID: ${testVote.id}`);
    console.log(`   Encuesta: ${testVote.pollId}`);
    console.log(`   Opción: ${testVote.optionId}`);
    console.log(`   Fecha: ${testVote.createdAt}`);
    
    // 4. Verificar que el voto existe
    const verification = await prisma.vote.findUnique({
      where: { id: testVote.id },
      include: {
        poll: { select: { title: true } },
        option: { select: { optionLabel: true } }
      }
    });
    
    console.log('\n✅ Verificación del voto:');
    console.log(`   Encuesta: ${verification.poll.title}`);
    console.log(`   Opción: ${verification.option.optionLabel}`);
    
    // 5. Contar votos totales
    const totalVotes = await prisma.vote.count();
    console.log(`\n📊 Total de votos en BD: ${totalVotes}`);
    
    console.log('\n✅ CONCLUSIÓN: La base de datos funciona correctamente');
    console.log('   El problema debe estar en el endpoint o en el frontend');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('   Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testVoteCreation();
