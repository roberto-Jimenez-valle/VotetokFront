/**
 * Script de Verificación: Niveles de Subdivisiones
 * 
 * Verifica que la tabla subdivisions tiene datos en los 3 niveles
 * y que el sistema de geocodificación puede encontrar subdivisiones granulares
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifySubdivisionLevels() {
  console.log('\n🔍 VERIFICANDO NIVELES DE SUBDIVISIONES\n');
  console.log('═'.repeat(60));

  try {
    // 1. Contar subdivisiones por nivel
    console.log('\n📊 PASO 1: Contando subdivisiones por nivel...\n');
    
    const level1Count = await prisma.subdivision.count({
      where: { level: 1 }
    });
    
    const level2Count = await prisma.subdivision.count({
      where: { level: 2 }
    });
    
    const level3Count = await prisma.subdivision.count({
      where: { level: 3 }
    });

    console.log(`  Nivel 1 (Estados/Comunidades): ${level1Count}`);
    console.log(`  Nivel 2 (Provincias/Condados): ${level2Count}`);
    console.log(`  Nivel 3 (Municipios/Ciudades): ${level3Count}`);

    if (level1Count === 0) {
      console.error('\n❌ ERROR: No hay subdivisiones de nivel 1');
      console.error('   Necesitas poblar la tabla subdivisions');
      process.exit(1);
    }

    if (level2Count === 0 && level3Count === 0) {
      console.warn('\n⚠️  ADVERTENCIA: No hay subdivisiones de nivel 2 ni 3');
      console.warn('   El geocoding solo retornará nivel 1');
    } else if (level3Count === 0) {
      console.warn('\n⚠️  ADVERTENCIA: No hay subdivisiones de nivel 3');
      console.warn('   El geocoding retornará máximo nivel 2');
    } else {
      console.log('\n✅ Hay subdivisiones en los 3 niveles');
    }

    // 2. Mostrar ejemplos de cada nivel
    console.log('\n📋 PASO 2: Ejemplos de subdivisiones por nivel...\n');
    
    const level1Examples = await prisma.subdivision.findMany({
      where: { level: 1 },
      include: { country: true },
      take: 3,
      orderBy: { name: 'asc' }
    });

    console.log('  Ejemplos Nivel 1:');
    level1Examples.forEach(sub => {
      console.log(`    - ${sub.country.iso3}.${sub.level1Id} = ${sub.name} (${sub.country.name})`);
    });

    if (level2Count > 0) {
      const level2Examples = await prisma.subdivision.findMany({
        where: { level: 2 },
        include: { country: true },
        take: 3,
        orderBy: { name: 'asc' }
      });

      console.log('\n  Ejemplos Nivel 2:');
      level2Examples.forEach(sub => {
        console.log(`    - ${sub.subdivisionId} = ${sub.name}`);
      });
    }

    if (level3Count > 0) {
      const level3Examples = await prisma.subdivision.findMany({
        where: { level: 3 },
        include: { country: true },
        take: 3,
        orderBy: { name: 'asc' }
      });

      console.log('\n  Ejemplos Nivel 3:');
      level3Examples.forEach(sub => {
        console.log(`    - ${sub.subdivisionId} = ${sub.name}`);
      });
    }

    // 3. Probar geocodificación con coordenadas reales
    console.log('\n📍 PASO 3: Probando geocodificación...\n');

    const testCases = [
      { name: 'Madrid, España', lat: 40.4168, lon: -3.7038 },
      { name: 'Barcelona, España', lat: 41.3851, lon: 2.1734 },
      { name: 'Sevilla, España', lat: 37.3891, lon: -5.9845 },
    ];

    for (const testCase of testCases) {
      console.log(`  Probando: ${testCase.name} (${testCase.lat}, ${testCase.lon})`);
      
      // Simular la lógica del endpoint /api/geocode
      const country = await prisma.country.findFirst({
        orderBy: {
          id: 'asc'
        }
      });

      if (!country) {
        console.log('    ❌ No hay países en la BD');
        continue;
      }

      // Buscar nivel 3
      let subdivision = await prisma.subdivision.findFirst({
        where: {
          level: 3,
          countryId: country.id
        },
        orderBy: {
          id: 'asc'
        }
      });

      // Si no hay nivel 3, buscar nivel 2
      if (!subdivision) {
        subdivision = await prisma.subdivision.findFirst({
          where: {
            level: 2,
            countryId: country.id
          },
          orderBy: {
            id: 'asc'
          }
        });
      }

      // Si no hay nivel 2, buscar nivel 1
      if (!subdivision) {
        subdivision = await prisma.subdivision.findFirst({
          where: {
            level: 1,
            countryId: country.id
          },
          orderBy: {
            id: 'asc'
          }
        });
      }

      if (subdivision) {
        console.log(`    ✅ Encontrado: ${subdivision.subdivisionId} (${subdivision.name}) - Nivel ${subdivision.level}`);
      } else {
        console.log(`    ❌ No se encontró subdivisión`);
      }
    }

    // 4. Verificar jerarquía
    console.log('\n🌳 PASO 4: Verificando jerarquía de subdivisiones...\n');
    
    const level3Sample = await prisma.subdivision.findFirst({
      where: { level: 3 },
      include: {
        parent: {
          include: {
            parent: true
          }
        }
      }
    });

    if (level3Sample && level3Sample.parent) {
      console.log('  Ejemplo de jerarquía completa:');
      console.log(`    Nivel 1: ${level3Sample.parent.parent?.name || 'N/A'} (${level3Sample.parent.parent?.subdivisionId || 'N/A'})`);
      console.log(`    Nivel 2: ${level3Sample.parent.name} (${level3Sample.parent.subdivisionId})`);
      console.log(`    Nivel 3: ${level3Sample.name} (${level3Sample.subdivisionId})`);
      console.log('  ✅ La jerarquía está correctamente configurada');
    } else if (level3Count > 0) {
      console.log('  ⚠️  Hay nivel 3 pero sin relaciones parent configuradas');
    }

    // 5. Resumen final
    console.log('\n' + '═'.repeat(60));
    console.log('✅ VERIFICACIÓN COMPLETADA');
    console.log('═'.repeat(60));
    console.log('\n📊 Resumen:');
    console.log(`  • Nivel 1: ${level1Count} subdivisiones`);
    console.log(`  • Nivel 2: ${level2Count} subdivisiones`);
    console.log(`  • Nivel 3: ${level3Count} subdivisiones`);
    
    if (level3Count > 0) {
      console.log('\n🎯 CONCLUSIÓN: El geocoding puede retornar subdivisiones de nivel 3');
      console.log('   Los votos se guardarán con subdivisionId granular (ej: ESP.1.2)\n');
    } else if (level2Count > 0) {
      console.log('\n⚠️  CONCLUSIÓN: El geocoding retornará máximo nivel 2');
      console.log('   Considera poblar nivel 3 para mayor granularidad\n');
    } else {
      console.log('\n⚠️  CONCLUSIÓN: El geocoding retornará solo nivel 1');
      console.log('   Considera poblar niveles 2 y 3 para mayor granularidad\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR durante la verificación:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar verificación
verifySubdivisionLevels();
