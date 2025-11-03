/**
 * Verificar que los votos estén asociados al nivel correcto
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const newCountries = [
  'ARM', 'UKR', 'MKD', 'ISR', 'CYP', 'JAM', 'KWT', 'QAT', 
  'BHS', 'BLZ', 'LSO', 'PRI', 'LBY', 'MDA', 'MNE', 'TTO'
];

async function main() {
  console.log('🔍 Verificando niveles de votos en BD...\n');
  
  for (const countryCode of newCountries) {
    console.log(`🌍 ${countryCode}:`);
    
    // Contar subdivisiones por nivel
    const level2Count = await prisma.subdivision.count({
      where: {
        subdivisionId: { startsWith: `${countryCode}.` },
        level: 2
      }
    });
    
    const level3Count = await prisma.subdivision.count({
      where: {
        subdivisionId: { startsWith: `${countryCode}.` },
        level: 3
      }
    });
    
    console.log(`   Subdivisiones - Nivel 2: ${level2Count}, Nivel 3: ${level3Count}`);
    
    // Contar votos por nivel
    const votesLevel2 = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM votes v
      JOIN subdivisions s ON v.subdivision_id = s.id
      WHERE s.subdivision_id LIKE ${countryCode + '.%'}
        AND s.level = 2
    `;
    
    const votesLevel3 = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM votes v
      JOIN subdivisions s ON v.subdivision_id = s.id
      WHERE s.subdivision_id LIKE ${countryCode + '.%'}
        AND s.level = 3
    `;
    
    const level2Votes = Number(votesLevel2[0]?.count || 0);
    const level3Votes = Number(votesLevel3[0]?.count || 0);
    
    console.log(`   Votos - Nivel 2: ${level2Votes}, Nivel 3: ${level3Votes}`);
    
    // Verificar lógica
    if (level3Count > 0 && level3Votes === 0) {
      console.log(`   ⚠️  PROBLEMA: Tiene nivel 3 pero votos en nivel 2`);
      console.log(`   ❌ ACCIÓN: Mover votos de nivel 2 a nivel 3`);
    } else if (level3Count > 0 && level3Votes > 0) {
      console.log(`   ✅ Correcto: Votos en nivel 3`);
    } else if (level3Count === 0 && level2Votes > 0) {
      console.log(`   ✅ Correcto: No tiene nivel 3, votos en nivel 2`);
    }
    
    console.log('');
  }
  
  console.log('='.repeat(70));
  console.log('📊 DIAGNÓSTICO COMPLETO\n');
  
  // Países que necesitan corrección
  const problematic: string[] = [];
  
  for (const countryCode of newCountries) {
    const level3Count = await prisma.subdivision.count({
      where: {
        subdivisionId: { startsWith: `${countryCode}.` },
        level: 3
      }
    });
    
    const votesLevel3 = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM votes v
      JOIN subdivisions s ON v.subdivision_id = s.id
      WHERE s.subdivision_id LIKE ${countryCode + '.%'}
        AND s.level = 3
    `;
    
    const level3Votes = Number(votesLevel3[0]?.count || 0);
    
    if (level3Count > 0 && level3Votes === 0) {
      problematic.push(countryCode);
    }
  }
  
  if (problematic.length > 0) {
    console.log(`❌ Países con votos en nivel incorrecto: ${problematic.length}`);
    console.log(`   ${problematic.join(', ')}`);
    console.log('\n💡 SOLUCIÓN:');
    console.log('   Ejecutar: npx tsx scripts/fix-votes-levels.ts');
  } else {
    console.log('✅ Todos los países tienen votos en el nivel correcto');
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
