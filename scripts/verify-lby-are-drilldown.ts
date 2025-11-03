/**
 * Verificar drill-down de Libia y Emiratos Árabes
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando drill-down de LBY y ARE...\n');
  
  // === LIBIA ===
  console.log('🇱🇾 LIBIA:');
  console.log('='.repeat(70));
  
  const lbyLevel2 = await prisma.subdivision.count({
    where: { subdivisionId: { startsWith: 'LBY.' }, level: 2 }
  });
  
  const lbyLevel3 = await prisma.subdivision.count({
    where: { subdivisionId: { startsWith: 'LBY.' }, level: 3 }
  });
  
  console.log(`   Nivel 2: ${lbyLevel2} subdivisiones`);
  console.log(`   Nivel 3: ${lbyLevel3} subdivisiones`);
  
  if (lbyLevel3 === 0) {
    console.log(`   ⚠️  Sin nivel 3 - NO HAY DRILL-DOWN\n`);
    console.log('   💡 Necesita descargar nivel 3 desde GADM o GeoBoundaries\n');
  } else {
    console.log(`   ✅ Tiene nivel 3 - drill-down disponible\n`);
  }
  
  // Verificar archivos TopoJSON
  const lbyDir = path.join('static/geojson/LBY');
  if (fs.existsSync(lbyDir)) {
    const files = fs.readdirSync(lbyDir).filter(f => f.endsWith('.topojson'));
    console.log(`   📁 Archivos TopoJSON: ${files.length}`);
    files.forEach(f => console.log(`      ${f}`));
  } else {
    console.log(`   ❌ Directorio no existe: ${lbyDir}`);
  }
  
  console.log('\n' + '='.repeat(70));
  
  // === EMIRATOS ÁRABES ===
  console.log('🇦🇪 EMIRATOS ÁRABES UNIDOS:');
  console.log('='.repeat(70));
  
  const areLevel2 = await prisma.subdivision.count({
    where: { subdivisionId: { startsWith: 'ARE.' }, level: 2 }
  });
  
  const areLevel3 = await prisma.subdivision.count({
    where: { subdivisionId: { startsWith: 'ARE.' }, level: 3 }
  });
  
  console.log(`   Nivel 2: ${areLevel2} subdivisiones`);
  console.log(`   Nivel 3: ${areLevel3} subdivisiones`);
  
  if (areLevel3 === 0) {
    console.log(`   ⚠️  Sin nivel 3 - NO HAY DRILL-DOWN\n`);
  } else {
    console.log(`   ✅ Tiene nivel 3 - drill-down disponible\n`);
    
    // Verificar votos
    const votesLevel3 = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM votes v
      JOIN subdivisions s ON v.subdivision_id = s.id
      WHERE s.subdivision_id LIKE 'ARE.%'
        AND s.level = 3
    `;
    
    const level3Votes = Number(votesLevel3[0]?.count || 0);
    console.log(`   Votos nivel 3: ${level3Votes}`);
    
    if (level3Votes === 0) {
      console.log(`   ⚠️  Tiene subdivisiones nivel 3 pero sin votos\n`);
    }
  }
  
  // Verificar archivos TopoJSON
  const areDir = path.join('static/geojson/ARE');
  if (fs.existsSync(areDir)) {
    const files = fs.readdirSync(areDir).filter(f => f.endsWith('.topojson'));
    console.log(`   📁 Archivos TopoJSON: ${files.length}`);
    
    if (files.length === 0) {
      console.log(`   ❌ Sin archivos TopoJSON - NO FUNCIONARÁ EL DRILL-DOWN`);
    } else if (files.length === 1) {
      console.log(`      ${files[0]}`);
      console.log(`   ⚠️  Solo archivo principal - faltan archivos de subdivisiones`);
    } else {
      console.log(`   ✅ Múltiples archivos - drill-down OK`);
      files.slice(0, 5).forEach(f => console.log(`      ${f}`));
      if (files.length > 5) console.log(`      ... y ${files.length - 5} más`);
    }
  } else {
    console.log(`   ❌ Directorio no existe: ${areDir}`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('💡 ACCIONES NECESARIAS:\n');
  
  if (lbyLevel3 === 0) {
    console.log('1. LIBIA: Descargar nivel 3');
    console.log('   - Ejecutar: npx tsx scripts/download-lby-level3.ts\n');
  }
  
  if (!fs.existsSync(areDir) || fs.readdirSync(areDir).filter(f => f.endsWith('.topojson')).length <= 1) {
    console.log('2. EMIRATOS ÁRABES: Crear archivos TopoJSON');
    console.log('   - Ejecutar: npx tsx scripts/create-are-topojson.ts\n');
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
