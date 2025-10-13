/**
 * Script para verificar que los votos se guarden con subdivisionId correcto
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testVoteWithSubdivision() {
  console.log('🧪 Verificando votos con subdivisionId...\n');

  try {
    // Obtener los últimos 10 votos
    const recentVotes = await prisma.vote.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        poll: {
          select: { title: true }
        },
        option: {
          select: { optionLabel: true }
        }
      }
    });

    console.log('📊 Últimos 10 votos:\n');

    if (recentVotes.length === 0) {
      console.log('⚠️  No hay votos en la base de datos');
      console.log('\n💡 Vota en la aplicación y vuelve a ejecutar este script');
      return;
    }

    let votosConSubdivisionId = 0;
    let votosSinSubdivisionId = 0;

    recentVotes.forEach((vote, index) => {
      console.log(`${index + 1}. ${vote.poll?.title || 'Encuesta desconocida'}`);
      console.log(`   Opción: ${vote.option?.optionLabel || 'Opción desconocida'}`);
      console.log(`   País: ${vote.countryName || 'N/A'} (${vote.countryIso3 || 'N/A'})`);
      
      if (vote.subdivisionId) {
        console.log(`   ✅ Subdivisión: ${vote.subdivisionName} (${vote.subdivisionId})`);
        votosConSubdivisionId++;
      } else {
        console.log(`   ❌ Subdivisión: NO DETECTADA`);
        votosSinSubdivisionId++;
      }
      
      console.log(`   📍 GPS: ${vote.latitude?.toFixed(4)}, ${vote.longitude?.toFixed(4)}`);
      console.log(`   🕐 Fecha: ${vote.createdAt.toLocaleString('es-ES')}`);
      console.log();
    });

    console.log('═'.repeat(60));
    console.log('📈 RESUMEN:');
    console.log(`   ✅ Votos con subdivisionId: ${votosConSubdivisionId}`);
    console.log(`   ❌ Votos sin subdivisionId: ${votosSinSubdivisionId}`);
    console.log('═'.repeat(60));

    if (votosSinSubdivisionId > 0) {
      console.log('\n💡 INSTRUCCIONES:');
      console.log('1. Reinicia el servidor (npm run dev)');
      console.log('2. Recarga la aplicación (Ctrl+F5)');
      console.log('3. Vota en una encuesta');
      console.log('4. Mira la consola del navegador, debe mostrar:');
      console.log('   [BottomSheet] 🌍 Ubicación geocodificada: {');
      console.log('     país: "España",');
      console.log('     subdivisión: "Madrid",');
      console.log('     subdivisionId: "ESP.8"');
      console.log('   }');
    } else {
      console.log('\n🎉 ¡PERFECTO! Todos los votos tienen subdivisionId');
    }

    // Mostrar ejemplo de subdivisiones disponibles
    console.log('\n📍 Subdivisiones de España disponibles:');
    const espSubdivisions = await prisma.subdivision.findMany({
      where: { 
        country: { iso3: 'ESP' },
        level: 1
      },
      orderBy: { subdivisionId: 'asc' },
      take: 10
    });

    espSubdivisions.forEach(sub => {
      console.log(`   ${sub.subdivisionId}: ${sub.name} (${sub.latitude.toFixed(2)}, ${sub.longitude.toFixed(2)})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testVoteWithSubdivision();
