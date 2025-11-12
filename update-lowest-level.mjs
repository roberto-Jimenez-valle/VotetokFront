import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const GEOJSON_DIR = 'static/geojson';

async function updateLowestLevel() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔄 ACTUALIZANDO CAMPO isLowestLevel EN SUBDIVISIONS');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // 1. Obtener TODAS las subdivisiones de nivel 2
    const level2Subdivisions = await prisma.subdivision.findMany({
      where: {
        level: 2
      },
      select: {
        id: true,
        subdivisionId: true,
        name: true
      },
      orderBy: {
        subdivisionId: 'asc'
      }
    });
    
    console.log(`📊 Total subdivisiones nivel 2: ${level2Subdivisions.length}\n`);
    
    let withLevel3 = 0;
    let withoutLevel3 = 0;
    const updates = [];
    
    // 2. Para cada subdivisión de nivel 2, verificar si tiene archivos de nivel 3
    for (const sub of level2Subdivisions) {
      const parts = sub.subdivisionId.split('.');
      const countryCode = parts[0]; // ESP, USA, BRA, etc.
      
      // Construir ruta del archivo TopoJSON de nivel 3
      // Ejemplo: static/geojson/ESP/ESP.1.topojson
      const level3File = path.join(GEOJSON_DIR, countryCode, `${sub.subdivisionId}.topojson`);
      const hasLevel3 = fs.existsSync(level3File);
      
      // isLowestLevel = true si NO tiene nivel 3
      const isLowest = !hasLevel3;
      
      if (isLowest) {
        withoutLevel3++;
        console.log(`  ✅ ${sub.subdivisionId.padEnd(15)} - ${sub.name.padEnd(30)} - ÚLTIMO NIVEL (sin nivel 3)`);
      } else {
        withLevel3++;
      }
      
      updates.push({
        id: sub.id,
        isLowestLevel: isLowest
      });
    }
    
    console.log(`\n📊 Resumen:`);
    console.log(`  Con nivel 3: ${withLevel3} subdivisiones`);
    console.log(`  Sin nivel 3 (último nivel): ${withoutLevel3} subdivisiones`);
    
    // 3. Actualizar base de datos en lote
    console.log(`\n🔄 Actualizando base de datos...`);
    
    for (const update of updates) {
      await prisma.subdivision.update({
        where: { id: update.id },
        data: { isLowestLevel: update.isLowestLevel }
      });
    }
    
    console.log(`✅ ${updates.length} subdivisiones actualizadas`);
    
    // 4. Verificar resultado
    const lowestLevelCount = await prisma.subdivision.count({
      where: {
        level: 2,
        isLowestLevel: true
      }
    });
    
    console.log(`\n✅ Verificación: ${lowestLevelCount} subdivisiones marcadas como último nivel`);
    
    // 5. Mostrar algunos ejemplos
    const examples = await prisma.subdivision.findMany({
      where: {
        level: 2,
        isLowestLevel: true
      },
      select: {
        subdivisionId: true,
        name: true
      },
      take: 10
    });
    
    console.log(`\n📋 Ejemplos de subdivisiones que son último nivel (primeras 10):`);
    examples.forEach(ex => {
      console.log(`  ${ex.subdivisionId.padEnd(15)} - ${ex.name}`);
    });
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ ACTUALIZACIÓN COMPLETADA');
    console.log('═══════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateLowestLevel();
