/**
 * Test inmediato del endpoint de votación
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testVoteNow() {
  console.log('🧪 PRUEBA DEL ENDPOINT DE VOTACIÓN\n');

  try {
    // 1. Obtener una encuesta activa
    const poll = await prisma.poll.findFirst({
      where: { status: 'active' },
      include: { options: true }
    });

    if (!poll || !poll.options.length) {
      console.error('❌ No hay encuestas disponibles');
      return;
    }

    console.log('✅ Encuesta:', poll.title);
    console.log('✅ Opción:', poll.options[0].optionLabel);

    // 2. Hacer petición HTTP real
    const voteData = {
      optionId: poll.options[0].id,
      userId: null,
      latitude: 40.4168,
      longitude: -3.7038,
      countryIso3: 'ESP',
      countryName: 'España',
      subdivisionId: 'ESP.1',
      subdivisionName: 'Andalucía',
      cityName: 'Sevilla'
    };

    console.log('\n📤 Enviando voto a:', `http://localhost:5173/api/polls/${poll.id}/vote`);
    console.log('📦 Datos:', JSON.stringify(voteData, null, 2));

    const response = await fetch(`http://localhost:5173/api/polls/${poll.id}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(voteData)
    });

    console.log('\n📊 Status:', response.status, response.statusText);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Respuesta:', JSON.stringify(result, null, 2));

      // 3. Verificar en BD
      const savedVote = await prisma.vote.findUnique({
        where: { id: result.vote.id }
      });

      if (savedVote) {
        console.log('\n✅ ÉXITO: Voto verificado en BD');
        console.log('   ID:', savedVote.id);
        console.log('   PollId:', savedVote.pollId);
        console.log('   OptionId:', savedVote.optionId);
        console.log('   SubdivisionId:', savedVote.subdivisionId);
        console.log('   Fecha:', savedVote.createdAt);

        // Limpiar
        await prisma.vote.delete({ where: { id: savedVote.id } });
        console.log('\n🧹 Voto de prueba eliminado');
      }
    } else {
      const error = await response.text();
      console.error('\n❌ ERROR:', error);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testVoteNow();
