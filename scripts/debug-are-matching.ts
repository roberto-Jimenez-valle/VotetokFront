/**
 * Debug específico de ARE - por qué sale gris
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Debug completo de Emiratos Árabes...\n');
  
  // 1. Verificar BD
  console.log('📊 BASE DE DATOS:');
  console.log('='.repeat(70));
  
  const subdivisions = await prisma.subdivision.findMany({
    where: { subdivisionId: { startsWith: 'ARE.' } },
    orderBy: { level: 'asc' },
    take: 10
  });
  
  console.log(`Total subdivisiones: ${subdivisions.length}`);
  console.log('\nMuestra:');
  subdivisions.slice(0, 5).forEach(sub => {
    console.log(`   ${sub.subdivisionId} (nivel ${sub.level}): ${sub.name}`);
  });
  
  // 2. Verificar votos en encuesta activa
  console.log('\n📊 VOTOS:');
  console.log('='.repeat(70));
  
  const poll = await prisma.poll.findFirst({
    where: { status: 'active' },
    include: { options: true }
  });
  
  if (!poll) {
    console.log('❌ No hay encuestas activas');
    return;
  }
  
  console.log(`Encuesta activa: #${poll.id} - ${poll.title}`);
  
  const votes = await prisma.vote.findMany({
    where: { 
      pollId: poll.id,
      subdivision: {
        subdivisionId: { startsWith: 'ARE.' }
      }
    },
    include: {
      subdivision: {
        select: { subdivisionId: true, level: true }
      }
    }
  });
  
  console.log(`\nVotos de ARE en esta encuesta: ${votes.length}`);
  
  if (votes.length === 0) {
    console.log('❌ PROBLEMA: No hay votos de ARE en la encuesta activa');
    console.log('   Los países se colorean POR ENCUESTA');
    console.log('   Si la encuesta no tiene votos de ARE, aparece gris\n');
    
    // Verificar total de votos
    const totalVotes = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM votes v
      JOIN subdivisions s ON v.subdivision_id = s.id
      WHERE s.subdivision_id LIKE 'ARE.%'
    `;
    
    console.log(`Total votos ARE (todas las encuestas): ${totalVotes[0].count}`);
  } else {
    // Agrupar por nivel
    const byLevel = votes.reduce((acc, v) => {
      const level = v.subdivision?.level || 0;
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    console.log('\nVotos por nivel:');
    Object.entries(byLevel).forEach(([level, count]) => {
      console.log(`   Nivel ${level}: ${count} votos`);
    });
  }
  
  // 3. Simular agregación por país
  console.log('\n📊 AGREGACIÓN POR PAÍS:');
  console.log('='.repeat(70));
  
  const allVotes = await prisma.vote.findMany({
    where: { pollId: poll.id },
    include: {
      subdivision: {
        select: { subdivisionId: true }
      }
    }
  });
  
  const countryVotes: Record<string, number> = {};
  
  for (const vote of allVotes) {
    if (!vote.subdivision) continue;
    const countryIso = vote.subdivision.subdivisionId.split('.')[0];
    countryVotes[countryIso] = (countryVotes[countryIso] || 0) + 1;
  }
  
  if (countryVotes['ARE']) {
    console.log(`✅ ARE tiene ${countryVotes['ARE']} votos agregados`);
    console.log('   Debería aparecer en el endpoint /api/polls/${poll.id}/votes-by-country');
  } else {
    console.log(`❌ ARE NO aparece en agregación`);
    console.log('   Esto es por qué sale gris');
  }
  
  // 4. Verificar archivo mundial
  console.log('\n📊 ARCHIVO MUNDIAL:');
  console.log('='.repeat(70));
  
  const worldFile = path.join('static/maps/world.topojson.json');
  const worldData = JSON.parse(fs.readFileSync(worldFile, 'utf8'));
  
  const areFeatures = worldData.features.filter((f: any) => {
    const p = f.properties;
    return p.ISO_A3 === 'ARE' || p.ADM0_A3 === 'ARE' || p.SOV_A3 === 'ARE';
  });
  
  console.log(`Features de ARE en world.topojson.json: ${areFeatures.length}`);
  
  if (areFeatures.length > 0) {
    const f = areFeatures[0];
    console.log('\nPropiedades:');
    console.log(`   NAME: ${f.properties.NAME}`);
    console.log(`   ISO_A3: ${f.properties.ISO_A3}`);
    console.log(`   ADM0_A3: ${f.properties.ADM0_A3}`);
  }
  
  // 5. Test de matching simulado
  console.log('\n📊 TEST DE MATCHING:');
  console.log('='.repeat(70));
  
  const isoCode = areFeatures[0]?.properties?.ISO_A3 || 
                  areFeatures[0]?.properties?.ADM0_A3;
  
  console.log(`ISO extraído del mapa: "${isoCode}"`);
  console.log(`Votos para "${isoCode}": ${countryVotes[isoCode] || 0}`);
  
  if (isoCode === 'ARE' && countryVotes['ARE']) {
    console.log('\n✅ MATCHING CORRECTO');
    console.log('   El problema es de caché del navegador o API');
  } else {
    console.log('\n❌ PROBLEMA DE MATCHING');
    console.log(`   Mapa dice: "${isoCode}"`);
    console.log(`   BD tiene: "ARE"`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('💡 DIAGNÓSTICO:\n');
  
  if (votes.length === 0) {
    console.log('❌ ARE no tiene votos en la ENCUESTA ACTIVA actual');
    console.log('\n🔧 SOLUCIÓN:');
    console.log('   Cambiar a otra encuesta que sí tenga votos de ARE');
    console.log('   O agregar votos de ARE a esta encuesta específica');
  } else if (countryVotes['ARE']) {
    console.log('✅ ARE tiene datos correctos');
    console.log('\n🔧 SOLUCIÓN:');
    console.log('   1. Verificar endpoint: http://localhost:5173/api/polls/' + poll.id + '/votes-by-country');
    console.log('   2. Buscar "ARE" en la respuesta JSON');
    console.log('   3. Hard refresh + limpiar caché');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
