/**
 * Script de Debug: Geocodificación
 * Verifica que el sistema de geocodificación funcione correctamente
 * Estructura: nivel 1=país, nivel 2=comunidad, nivel 3=provincia
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugGeocode() {
  console.log('\n🔍 DEBUG: Geocodificación\n');
  console.log('═'.repeat(60));

  try {
    // Coordenadas de ejemplo (Madrid aproximadamente)
    const lat = 40.4168;
    const lon = -3.7038;

    console.log(`\n📍 Probando con coordenadas: ${lat}, ${lon}\n`);

    // 1. Buscar país (nivel 1) más cercano
    console.log('1️⃣ Buscando país más cercano...\n');
    
    const countrySubdivision = await prisma.subdivision.findFirst({
      where: { level: 1 },
      orderBy: { subdivisionId: 'asc' }
    });

    if (!countrySubdivision) {
      console.error('❌ No hay países en la BD');
      process.exit(1);
    }

    const countryIso3 = countrySubdivision.subdivisionId;
    console.log(`   País encontrado: ${countrySubdivision.name} (${countryIso3})\n`);

    // 2. Contar subdivisiones por nivel en ese país
    console.log('2️⃣ Subdivisiones disponibles en', countrySubdivision.name, '\n');

    const level1Count = await prisma.subdivision.count({
      where: { 
        subdivisionId: countryIso3,
        level: 1 
      }
    });
    
    const level2Count = await prisma.subdivision.count({
      where: { 
        subdivisionId: { startsWith: `${countryIso3}.` },
        level: 2 
      }
    });
    
    const level3Count = await prisma.subdivision.count({
      where: { 
        subdivisionId: { startsWith: `${countryIso3}.` },
        level: 3 
      }
    });

    console.log(`   Nivel 1 (país): ${level1Count} subdivisión`);
    console.log(`   Nivel 2 (comunidades): ${level2Count} subdivisiones`);
    console.log(`   Nivel 3 (provincias): ${level3Count} subdivisiones\n`);

    if (level1Count === 0) {
      console.error(`❌ No hay datos para ${countryIso3}`);
      console.error('   Necesitas poblar la tabla subdivisions\n');
      process.exit(1);
    }

    // 3. Simular geocoding - buscar nivel más granular cercano
    console.log('3️⃣ Buscando subdivisión más cercana...\n');

    // Primero intentar nivel 3 (provincia)
    let subdivision = await prisma.subdivision.findFirst({
      where: {
        subdivisionId: { startsWith: `${countryIso3}.` },
        level: 3
      },
      orderBy: { id: 'asc' }
    });

    // Si no hay nivel 3, buscar nivel 2 (comunidad)
    if (!subdivision) {
      console.log('   ❌ No hay nivel 3, buscando nivel 2...\n');
      subdivision = await prisma.subdivision.findFirst({
        where: {
          subdivisionId: { startsWith: `${countryIso3}.` },
          level: 2
        },
        orderBy: { id: 'asc' }
      });
    }

    // Si no hay nivel 2, usar el país (nivel 1)
    if (!subdivision) {
      console.log('   ❌ No hay nivel 2, usando nivel 1 (país)...\n');
      subdivision = countrySubdivision;
    }

    if (subdivision) {
      console.log(`   ✅ Subdivisión encontrada:`);
      console.log(`      subdivisionId: ${subdivision.subdivisionId}`);
      console.log(`      name: ${subdivision.name}`);
      console.log(`      level: ${subdivision.level}\n`);
    }

    // 4. Mostrar ejemplos de subdivisiones disponibles
    console.log('4️⃣ Ejemplos de subdivisiones en BD:\n');

    const examples = await prisma.subdivision.findMany({
      where: { 
        subdivisionId: { startsWith: countryIso3 }
      },
      orderBy: { subdivisionId: 'asc' },
      take: 10
    });

    if (examples.length === 0) {
      console.log('   ❌ No hay subdivisiones para mostrar\n');
    } else {
      examples.forEach(sub => {
        const levelName = sub.level === 1 ? 'país' : sub.level === 2 ? 'comunidad' : 'provincia';
        console.log(`   ${sub.subdivisionId} → ${sub.name} (${levelName})`);
      });
    }

    console.log('\n' + '═'.repeat(60));
    console.log('\n💡 Conclusiones:\n');
    
    if (level3Count > 0) {
      console.log('✅ Tienes datos de nivel 3 (provincias), el geocoding funcionará con máxima granularidad');
    } else if (level2Count > 0) {
      console.log('⚠️  Solo tienes nivel 2 (comunidades), el geocoding retornará máximo nivel 2');
      console.log('   Considera añadir datos de nivel 3 para mayor granularidad');
    } else if (level1Count > 0) {
      console.log('⚠️  Solo tienes nivel 1 (país), el geocoding retornará solo el país');
      console.log('   Necesitas añadir datos de nivel 2 y 3 para mayor granularidad');
    }

    console.log('\n📚 Para poblar subdivisiones, ejecuta: npm run db:populate-subdivisions\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
debugGeocode();
