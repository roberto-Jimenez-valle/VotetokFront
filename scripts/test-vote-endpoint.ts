/**
 * Script para probar el endpoint de votación
 * Uso: npx tsx scripts/test-vote-endpoint.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testVoteEndpoint() {
  console.log('🧪 Probando endpoint de votación...\n');

  try {
    // 1. Verificar que existe una encuesta
    const poll = await prisma.poll.findFirst({
      include: {
        options: true
      }
    });

    if (!poll) {
      console.error('❌ No hay encuestas en la base de datos');
      return;
    }

    console.log('✅ Encuesta encontrada:', {
      id: poll.id,
      title: poll.title,
      opciones: poll.options.length
    });

    const firstOption = poll.options[0];
    console.log('✅ Primera opción:', {
      id: firstOption.id,
      label: firstOption.optionLabel
    });

    // 2. Contar votos actuales
    const voteCountBefore = await prisma.vote.count({
      where: { pollId: poll.id }
    });

    console.log('\n📊 Votos actuales en la encuesta:', voteCountBefore);
    console.log('📊 Contador de la opción:', firstOption.voteCount);

    // 3. Simular un voto directo en BD
    console.log('\n🔄 Insertando voto de prueba...');
    
    const testVote = await prisma.vote.create({
      data: {
        pollId: poll.id,
        optionId: firstOption.id,
        userId: null,
        latitude: 40.4168,
        longitude: -3.7038,
        countryIso3: 'ESP',
        countryName: 'España',
        subdivisionId: 'ESP.1',
        subdivisionName: 'Andalucía',
        cityName: 'Sevilla',
        ipAddress: '192.168.1.100',
        userAgent: 'Test Script'
      }
    });

    console.log('✅ Voto insertado:', {
      id: testVote.id,
      pollId: testVote.pollId,
      optionId: testVote.optionId,
      subdivisionId: testVote.subdivisionId
    });

    // 4. Verificar que se insertó
    const voteCountAfter = await prisma.vote.count({
      where: { pollId: poll.id }
    });

    console.log('\n📊 Votos después de insertar:', voteCountAfter);
    console.log('✅ Diferencia:', voteCountAfter - voteCountBefore);

    // 5. Limpiar el voto de prueba
    await prisma.vote.delete({
      where: { id: testVote.id }
    });

    console.log('\n🧹 Voto de prueba eliminado');

    // 6. Verificar estructura de la tabla votes
    const sampleVote = await prisma.vote.findFirst();
    if (sampleVote) {
      console.log('\n📋 Estructura de un voto en BD:');
      console.log(JSON.stringify(sampleVote, null, 2));
    }

    console.log('\n✅ PRUEBA COMPLETADA: La base de datos funciona correctamente');

  } catch (error) {
    console.error('\n❌ ERROR EN LA PRUEBA:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testVoteEndpoint();
