/**
 * Verificar votos nivel 2 para drill-down de UKR y ARE
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando votos por nivel para drill-down...\n');
  
  const countries = ['UKR', 'ARE'];
  
  for (const code of countries) {
    console.log(`🌍 ${code}:`);
    console.log('='.repeat(70));
    
    // Contar subdivisiones por nivel
    const level1 = await prisma.subdivision.count({
      where: { subdivisionId: code, level: 1 }
    });
    
    const level2 = await prisma.subdivision.count({
      where: { 
        subdivisionId: { startsWith: `${code}.` },
        level: 2 
      }
    });
    
    const level3 = await prisma.subdivision.count({
      where: { 
        subdivisionId: { startsWith: `${code}.` },
        level: 3 
      }
    });
    
    console.log('\nSubdivisiones:');
    console.log(`   Nivel 1 (país): ${level1}`);
    console.log(`   Nivel 2: ${level2}`);
    console.log(`   Nivel 3: ${level3}`);
    
    // Contar votos por nivel
    const votesL1 = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM votes v
      JOIN subdivisions s ON v.subdivision_id = s.id
      WHERE s.subdivision_id = ${code}
        AND s.level = 1
    `;
    
    const votesL2 = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM votes v
      JOIN subdivisions s ON v.subdivision_id = s.id
      WHERE s.subdivision_id LIKE ${code + '.%'}
        AND s.level = 2
    `;
    
    const votesL3 = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM votes v
      JOIN subdivisions s ON v.subdivision_id = s.id
      WHERE s.subdivision_id LIKE ${code + '.%'}
        AND s.level = 3
    `;
    
    const v1 = Number(votesL1[0]?.count || 0);
    const v2 = Number(votesL2[0]?.count || 0);
    const v3 = Number(votesL3[0]?.count || 0);
    
    console.log('\nVotos:');
    console.log(`   Nivel 1: ${v1}`);
    console.log(`   Nivel 2: ${v2}`);
    console.log(`   Nivel 3: ${v3}`);
    
    // Diagnóstico
    console.log('\nDiagnóstico:');
    
    if (v1 === 0 && v2 === 0 && v3 > 0) {
      console.log('   ❌ PROBLEMA: Solo tiene votos en nivel 3');
      console.log('   ⚠️  Vista mundial: NO se colorea (necesita nivel 1 o nivel 2)');
      console.log('   ⚠️  Drill-down: NO muestra colores en nivel 2 (necesita votos nivel 2)');
    } else if (v1 === 0 && v2 > 0 && v3 === 0) {
      console.log('   ✅ Vista mundial: Debería colorearse (tiene nivel 2)');
      console.log('   ⚠️  Drill-down: No disponible (no tiene nivel 3)');
    } else if (v1 === 0 && v2 > 0 && v3 > 0) {
      console.log('   ✅ Vista mundial: Debería colorearse (tiene nivel 2)');
      console.log('   ✅ Drill-down: Debería funcionar (tiene nivel 2 y 3)');
    } else if (v1 > 0) {
      console.log('   ✅ Vista mundial: Debería colorearse (tiene nivel 1)');
      if (v2 > 0 && v3 > 0) {
        console.log('   ✅ Drill-down: Debería funcionar completo');
      }
    }
    
    console.log('\n');
  }
  
  console.log('='.repeat(70));
  console.log('💡 ACCIONES NECESARIAS:\n');
  
  // Verificar si UKR necesita votos nivel 2
  const ukrL2Votes = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM votes v
    JOIN subdivisions s ON v.subdivision_id = s.id
    WHERE s.subdivision_id LIKE 'UKR.%'
      AND s.level = 2
  `;
  
  if (Number(ukrL2Votes[0]?.count || 0) === 0) {
    console.log('1. UCRANIA: Agregar votos a nivel 2');
    console.log('   Para que se vea en el drill-down intermedio\n');
  }
  
  // Verificar si ARE necesita votos nivel 2
  const areL2Votes = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM votes v
    JOIN subdivisions s ON v.subdivision_id = s.id
    WHERE s.subdivision_id LIKE 'ARE.%'
      AND s.level = 2
  `;
  
  if (Number(areL2Votes[0]?.count || 0) === 0) {
    console.log('2. EMIRATOS ÁRABES: Agregar votos a nivel 2');
    console.log('   Para que se vea en vista mundial y drill-down\n');
  }
  
  console.log('🔧 EJECUTAR:');
  console.log('   npx tsx scripts/add-level2-votes-ukr-are.ts');
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
