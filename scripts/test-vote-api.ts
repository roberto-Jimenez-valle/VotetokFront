/**
 * Script para probar el endpoint API de votación
 * Uso: npx tsx scripts/test-vote-api.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testVoteAPI() {
  console.log('🧪 Probando API de votación HTTP...\n');

  try {
    // 1. Obtener una encuesta y opción
    const poll = await prisma.poll.findFirst({
      include: {
        options: true
      }
    });

    if (!poll) {
      console.error('❌ No hay encuestas en la base de datos');
      return;
    }

    const firstOption = poll.options[0];
    console.log('✅ Probando con encuesta:', {
      id: poll.id,
      title: poll.title,
      optionId: firstOption.id,
      optionLabel: firstOption.optionLabel
    });

    // 2. Hacer petición HTTP al endpoint
    const voteData = {
      optionId: firstOption.id,
      userId: 4, // Usuario de prueba
      latitude: 40.4168,
      longitude: -3.7038,
      countryIso3: 'ESP',
      countryName: 'España',
      subdivisionId: 'ESP.1',
      subdivisionName: 'Andalucía',
      cityName: 'Sevilla'
    };

    console.log('\n📤 Enviando voto a: http://localhost:5173/api/polls/' + poll.id + '/vote');
    console.log('📦 Datos:', JSON.stringify(voteData, null, 2));

    const response = await fetch(`http://localhost:5173/api/polls/${poll.id}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Test Script'
      },
      body: JSON.stringify(voteData)
    });

    console.log('\n📊 Status:', response.status, response.statusText);

    const result = await response.json();
    console.log('📊 Respuesta:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('\n✅ ÉXITO: El endpoint API funciona correctamente');
      
      // Verificar que el voto se guardó
      const savedVote = await prisma.vote.findUnique({
        where: { id: result.vote.id }
      });

      if (savedVote) {
        console.log('✅ Voto verificado en BD:', {
          id: savedVote.id,
          userId: savedVote.userId,
          subdivisionId: savedVote.subdivisionId
        });

        // Limpiar
        await prisma.vote.delete({
          where: { id: savedVote.id }
        });
        console.log('🧹 Voto de prueba eliminado');
      }
    } else {
      console.error('\n❌ FALLO: El endpoint retornó un error');
      console.error('Detalles:', result);
    }

  } catch (error) {
    console.error('\n❌ ERROR EN LA PRUEBA:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testVoteAPI();
