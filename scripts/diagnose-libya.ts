/**
 * Diagnóstico completo de por qué Libia sale gris
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 DIAGNÓSTICO COMPLETO: ¿Por qué Libia está gris?\n');
  console.log('='.repeat(70) + '\n');

  // 1. Verificar subdivisiones de Libia en BD
  console.log('📊 PASO 1: Subdivisiones de Libia en BD\n');
  
  const subdivisions = await prisma.subdivision.findMany({
    where: {
      subdivisionId: {
        startsWith: 'LBY'
      }
    },
    orderBy: { level: 'asc' }
  });

  console.log(`Total subdivisiones de Libia: ${subdivisions.length}`);
  
  const byLevel = subdivisions.reduce((acc, sub) => {
    acc[sub.level] = (acc[sub.level] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  Object.entries(byLevel).forEach(([level, count]) => {
    console.log(`  Nivel ${level}: ${count} subdivisiones`);
  });

  if (subdivisions.length === 0) {
    console.log('\n❌ PROBLEMA: Libia NO tiene subdivisiones en la BD');
    console.log('   → Sin subdivisiones = sin votos = país gris');
    return;
  }

  // 2. Verificar votos de Libia
  console.log('\n📊 PASO 2: Votos de Libia en BD\n');
  
  const votes = await prisma.vote.count({
    where: {
      subdivision: {
        subdivisionId: {
          startsWith: 'LBY'
        }
      }
    }
  });

  console.log(`Total votos de Libia: ${votes}`);

  if (votes === 0) {
    console.log('\n❌ PROBLEMA: Libia NO tiene votos en la BD');
    console.log('   → Sin votos = país gris');
    
    // Verificar si tiene subdivisiones pero sin votos
    if (subdivisions.length > 0) {
      console.log('\n⚠️  Libia tiene subdivisiones pero NO tiene votos');
      console.log('   Subdivisiones de ejemplo:');
      subdivisions.slice(0, 5).forEach(sub => {
        console.log(`   - ${sub.subdivisionId}: ${sub.name} (nivel ${sub.level})`);
      });
    }
    return;
  }

  // 3. Verificar API /api/polls/[id]/votes-by-country
  console.log('\n📊 PASO 3: Datos en API votes-by-country\n');
  
  const poll = await prisma.poll.findFirst({
    where: { status: 'active' },
    orderBy: { createdAt: 'desc' },
    include: { options: true }
  });

  if (!poll) {
    console.log('❌ No hay encuestas activas');
    return;
  }

  console.log(`Encuesta: #${poll.id} - ${poll.title}\n`);

  // Simular lo que hace el endpoint
  const pollVotes = await prisma.vote.findMany({
    where: { pollId: poll.id },
    select: {
      optionId: true,
      subdivision: {
        select: { subdivisionId: true }
      }
    }
  });

  const optionIdToKey = new Map(poll.options.map(opt => [opt.id, opt.optionKey]));
  const countryVotes: Record<string, Record<string, number>> = {};

  for (const vote of pollVotes) {
    const countryIso = vote.subdivision.subdivisionId.split('.')[0];
    const optionKey = optionIdToKey.get(vote.optionId);
    if (!optionKey) continue;

    if (!countryVotes[countryIso]) {
      countryVotes[countryIso] = {};
    }
    countryVotes[countryIso][optionKey] = (countryVotes[countryIso][optionKey] || 0) + 1;
  }

  if (countryVotes['LBY']) {
    console.log('✅ LBY está en la respuesta de la API:');
    console.log('   Votos por opción:', countryVotes['LBY']);
    const totalVotes = Object.values(countryVotes['LBY']).reduce((sum, count) => sum + count, 0);
    console.log(`   Total: ${totalVotes} votos`);
  } else {
    console.log('❌ LBY NO está en la respuesta de la API');
    console.log('   Esto significa que la encuesta actual no tiene votos de Libia');
  }

  // 4. Verificar archivo mundial
  console.log('\n📊 PASO 4: Libia en archivo mundial\n');
  
  const worldFile = path.join(process.cwd(), 'static/maps/world.topojson.json');
  const worldData = JSON.parse(fs.readFileSync(worldFile, 'utf8'));

  const libya = worldData.features.find((f: any) => {
    const p = f.properties;
    return p.ISO_A3 === 'LBY' || 
           p.ADM0_A3 === 'LBY' || 
           p.NAME === 'Libya' ||
           p.ADMIN === 'Libya';
  });

  if (libya) {
    console.log('✅ Libia encontrada en archivo mundial:');
    console.log('   ISO_A3:', libya.properties.ISO_A3);
    console.log('   ADM0_A3:', libya.properties.ADM0_A3);
    console.log('   NAME:', libya.properties.NAME);
    
    // Simular getFeatureId
    const p = libya.properties;
    const iso_a3 = p.ISO_A3;
    const adm0_a3 = p.ADM0_A3;
    
    let result = '';
    if (iso_a3 && iso_a3 !== '-99') {
      result = iso_a3;
    } else if (adm0_a3 && adm0_a3 !== '-99') {
      result = adm0_a3;
    }
    
    console.log(`   getFeatureId() devuelve: "${result}"`);
    
    if (result === 'LBY') {
      console.log('   ✅ El código coincide con la BD');
    } else {
      console.log(`   ❌ El código NO coincide (esperaba "LBY", obtuvo "${result}")`);
    }
  } else {
    console.log('❌ Libia NO encontrada en archivo mundial');
  }

  // CONCLUSIÓN
  console.log('\n' + '='.repeat(70));
  console.log('📊 CONCLUSIÓN\n');

  const hasSubdivisions = subdivisions.length > 0;
  const hasVotes = votes > 0;
  const inAPI = countryVotes['LBY'] !== undefined;
  const inWorld = libya !== undefined;

  console.log(`Subdivisiones en BD: ${hasSubdivisions ? '✅' : '❌'}`);
  console.log(`Votos en BD: ${hasVotes ? '✅' : '❌'}`);
  console.log(`En API (encuesta actual): ${inAPI ? '✅' : '❌'}`);
  console.log(`En archivo mundial: ${inWorld ? '✅' : '❌'}`);

  console.log('\n💡 CAUSA del problema:');
  
  if (!hasSubdivisions) {
    console.log('   ❌ Libia NO tiene subdivisiones en la BD');
    console.log('   → Solución: Agregar subdivisiones de Libia a la BD');
  } else if (!hasVotes) {
    console.log('   ❌ Libia tiene subdivisiones pero NO tiene votos');
    console.log('   → Solución: Ejecutar script de seeding para Libia');
  } else if (!inAPI) {
    console.log('   ❌ Libia tiene votos pero NO en la encuesta actual');
    console.log('   → Esto es normal si la encuesta específica no tiene votos de Libia');
  } else if (!inWorld) {
    console.log('   ❌ Libia NO está en el archivo mundial');
    console.log('   → Solución: Verificar archivo world.topojson.json');
  } else {
    console.log('   ⚠️  Todos los componentes están bien');
    console.log('   → Verificar que el frontend esté recibiendo los datos correctamente');
    console.log('   → Hacer hard refresh del navegador (Ctrl+Shift+R)');
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
