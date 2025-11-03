/**
 * Script para diagnosticar por qué Francia y otros países salen grises
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Diagnosticando Francia y países grises...\n');

  // 1. Verificar votos de Francia en BD
  console.log('📊 Paso 1: Verificando votos de Francia en BD...\n');
  
  const franceVotes = await prisma.vote.count({
    where: {
      subdivision: {
        subdivisionId: {
          startsWith: 'FRA'
        },
        level: 3
      }
    }
  });

  console.log(`   Francia (FRA) - Votos nivel 3: ${franceVotes}`);

  // Verificar subdivisiones de Francia
  const franceSubdivisions = await prisma.subdivision.count({
    where: {
      subdivisionId: {
        startsWith: 'FRA'
      },
      level: 3
    }
  });

  console.log(`   Francia (FRA) - Subdivisiones nivel 3: ${franceSubdivisions}\n`);

  // 2. Verificar datos en API para una encuesta
  console.log('📊 Paso 2: Verificando API votes-by-country...\n');
  
  const poll = await prisma.poll.findFirst({
    where: { status: 'active' },
    orderBy: { createdAt: 'desc' }
  });

  if (!poll) {
    console.log('❌ No hay encuestas activas');
    return;
  }

  console.log(`   Encuesta: #${poll.id} - ${poll.title}\n`);

  // Simular endpoint votes-by-country
  const pollOptions = await prisma.pollOption.findMany({
    where: { pollId: poll.id },
    select: { id: true, optionKey: true }
  });

  const votes = await prisma.vote.findMany({
    where: { pollId: poll.id },
    select: {
      optionId: true,
      subdivision: {
        select: { subdivisionId: true }
      }
    }
  });

  const optionIdToKey = new Map(pollOptions.map(opt => [opt.id, opt.optionKey]));
  const countryVotes: Record<string, Record<string, number>> = {};

  for (const vote of votes) {
    const countryIso = vote.subdivision.subdivisionId.split('.')[0];
    const optionKey = optionIdToKey.get(vote.optionId);
    if (!optionKey) continue;

    if (!countryVotes[countryIso]) {
      countryVotes[countryIso] = {};
    }
    countryVotes[countryIso][optionKey] = (countryVotes[countryIso][optionKey] || 0) + 1;
  }

  // Verificar Francia en los datos
  if (countryVotes['FRA']) {
    const totalVotes = Object.values(countryVotes['FRA']).reduce((sum, count) => sum + count, 0);
    console.log(`   ✅ FRA en API: ${totalVotes} votos`);
    console.log(`   Opciones:`, countryVotes['FRA']);
  } else {
    console.log(`   ❌ FRA NO está en los datos de la API`);
  }

  // Mostrar otros países que SÍ tienen datos
  console.log(`\n   Otros países en API (muestra):`);
  Object.entries(countryVotes)
    .slice(0, 10)
    .forEach(([iso, votes]) => {
      const total = Object.values(votes).reduce((sum, count) => sum + count, 0);
      console.log(`      ${iso}: ${total} votos`);
    });

  // 3. Verificar archivo TopoJSON mundial
  console.log('\n📊 Paso 3: Verificando archivo TopoJSON mundial...\n');
  
  const worldFile = path.join(process.cwd(), 'static/maps/countries-110m-iso.json');
  
  if (!fs.existsSync(worldFile)) {
    console.log('   ❌ Archivo mundial no existe:', worldFile);
    return;
  }

  const worldData = JSON.parse(fs.readFileSync(worldFile, 'utf8'));
  
  // Buscar Francia en el archivo
  const franceFeature = worldData.features?.find((f: any) => {
    const p = f.properties;
    return p?.ISO3_CODE === 'FRA' || 
           p?.ISO_A3 === 'FRA' || 
           p?.CNTR_ID === 'FR' ||
           p?.NAME_ENGL?.toLowerCase().includes('france');
  });

  if (franceFeature) {
    console.log('   ✅ Francia encontrada en archivo mundial:');
    console.log('      Propiedades:', JSON.stringify(franceFeature.properties, null, 2));
  } else {
    console.log('   ❌ Francia NO encontrada en archivo mundial');
    
    // Mostrar algunos países que SÍ están
    console.log('\n   Países en archivo mundial (muestra):');
    worldData.features.slice(0, 10).forEach((f: any) => {
      const p = f.properties;
      console.log(`      ${p.CNTR_ID}: ISO3_CODE=${p.ISO3_CODE}, ISO_A3=${p.ISO_A3}, NAME=${p.NAME_ENGL}`);
    });
  }

  // 4. Verificar todos los países que deberían tener datos pero podrían salir grises
  console.log('\n📊 Paso 4: Verificando países con votos vs archivo mundial...\n');
  
  const countriesWithVotes = Object.keys(countryVotes);
  console.log(`   Países con votos en BD: ${countriesWithVotes.length}`);
  console.log(`   Países en archivo mundial: ${worldData.features.length}\n`);

  // Verificar cada país con votos
  const missingInFile = [];
  const wrongProperty = [];

  for (const iso of countriesWithVotes) {
    const feature = worldData.features?.find((f: any) => {
      const p = f.properties;
      return p?.ISO3_CODE === iso || p?.ISO_A3 === iso;
    });

    if (!feature) {
      missingInFile.push(iso);
    } else if (!feature.properties?.ISO3_CODE && !feature.properties?.ISO_A3) {
      wrongProperty.push({
        iso,
        props: feature.properties
      });
    }
  }

  if (missingInFile.length > 0) {
    console.log(`   ❌ Países con votos pero NO en archivo mundial: ${missingInFile.length}`);
    console.log(`      ${missingInFile.slice(0, 20).join(', ')}`);
    if (missingInFile.length > 20) {
      console.log(`      ... y ${missingInFile.length - 20} más`);
    }
  }

  if (wrongProperty.length > 0) {
    console.log(`\n   ⚠️  Países con propiedades incorrectas: ${wrongProperty.length}`);
    wrongProperty.slice(0, 5).forEach(item => {
      console.log(`      ${item.iso}:`, JSON.stringify(item.props, null, 2));
    });
  }

  // 5. RESUMEN
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN\n');
  
  if (franceFeature && countryVotes['FRA']) {
    console.log('✅ Francia DEBERÍA aparecer coloreada:');
    console.log(`   - Tiene ${franceVotes} votos nivel 3`);
    console.log(`   - API retorna datos: ${Object.values(countryVotes['FRA']).reduce((s, c) => s + c, 0)} votos`);
    console.log(`   - Archivo mundial tiene el país`);
    console.log(`   - Propiedades: ISO3_CODE=${franceFeature.properties.ISO3_CODE}, ISO_A3=${franceFeature.properties.ISO_A3}`);
  } else if (!franceFeature) {
    console.log('❌ Francia NO está en el archivo mundial');
  } else if (!countryVotes['FRA']) {
    console.log('❌ Francia NO tiene votos en la BD');
  }

  console.log(`\n💡 Posibles causas de países grises:`);
  console.log(`   1. País no está en archivo mundial: ${missingInFile.length} países`);
  console.log(`   2. Propiedades incorrectas: ${wrongProperty.length} países`);
  console.log(`   3. Problema de matching en frontend (verificar console.log)`);
  
  console.log('='.repeat(70));
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
