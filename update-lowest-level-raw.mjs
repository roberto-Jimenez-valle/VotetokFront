import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const GEOJSON_DIR = 'static/geojson';

async function updateLowestLevel() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔄 ACTUALIZANDO CAMPO isLowestLevel CON RAW SQL');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // 1. Obtener TODAS las subdivisiones de nivel 2
    const level2Subdivisions = await prisma.$queryRaw`
      SELECT id, subdivision_id, name 
      FROM subdivisions 
      WHERE level = 2 
      ORDER BY subdivision_id
    `;
    
    console.log(`📊 Total subdivisiones nivel 2: ${level2Subdivisions.length}\n`);
    
    let withLevel3 = 0;
    let withoutLevel3 = 0;
    const toUpdate = [];
    
    // 2. Para cada subdivisión de nivel 2, verificar si tiene archivos de nivel 3
    for (const sub of level2Subdivisions) {
      const parts = sub.subdivision_id.split('.');
      const countryCode = parts[0];
      
      const level3File = path.join(GEOJSON_DIR, countryCode, `${sub.subdivision_id}.topojson`);
      const hasLevel3 = fs.existsSync(level3File);
      
      const isLowest = !hasLevel3;
      
      if (isLowest) {
        withoutLevel3++;
        toUpdate.push(sub.id);
        if (withoutLevel3 <= 20) { // Solo mostrar primeros 20
          console.log(`  ✅ ${sub.subdivision_id.padEnd(15)} - ${sub.name.padEnd(30)} - ÚLTIMO NIVEL`);
        }
      } else {
        withLevel3++;
      }
    }
    
    if (withoutLevel3 > 20) {
      console.log(`  ... y ${withoutLevel3 - 20} más`);
    }
    
    console.log(`\n📊 Resumen:`);
    console.log(`  Con nivel 3: ${withLevel3} subdivisiones`);
    console.log(`  Sin nivel 3 (último nivel): ${withoutLevel3} subdivisiones`);
    
    // 3. Actualizar en lote con RAW SQL
    if (toUpdate.length > 0) {
      console.log(`\n🔄 Actualizando ${toUpdate.length} subdivisiones...`);
      
      // Actualizar en lotes de 500
      const batchSize = 500;
      for (let i = 0; i < toUpdate.length; i += batchSize) {
        const batch = toUpdate.slice(i, i + batchSize);
        await prisma.$executeRawUnsafe(`
          UPDATE subdivisions 
          SET is_lowest_level = TRUE 
          WHERE id IN (${batch.join(',')})
        `);
        console.log(`  ✅ Actualizados ${Math.min(i + batchSize, toUpdate.length)}/${toUpdate.length}`);
      }
    }
    
    // 4. Verificar resultado
    const result = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count 
      FROM subdivisions 
      WHERE level = 2 AND is_lowest_level = TRUE
    `;
    
    console.log(`\n✅ Verificación: ${result[0].count} subdivisiones marcadas como último nivel`);
    
    // 5. Ejemplos
    const examples = await prisma.$queryRaw`
      SELECT subdivision_id, name 
      FROM subdivisions 
      WHERE level = 2 AND is_lowest_level = TRUE 
      LIMIT 10
    `;
    
    console.log(`\n📋 Ejemplos (primeros 10):`);
    examples.forEach(ex => {
      console.log(`  ${ex.subdivision_id.padEnd(15)} - ${ex.name}`);
    });
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ ACTUALIZACIÓN COMPLETADA');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n💡 Ahora puedes usar este campo para permitir votos directos');
    console.log('   en subdivisiones que no tienen subniveles (como BRA.7)');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateLowestLevel();
