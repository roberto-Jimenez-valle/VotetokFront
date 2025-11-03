/**
 * Verificar países específicos que faltan
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const missingCountries = [
  { code: 'ARE', name: 'United Arab Emirates' },
  { code: 'GRL', name: 'Greenland' }
];

async function main() {
  console.log('🔍 Verificando países faltantes...\n');
  
  for (const country of missingCountries) {
    console.log(`🌍 ${country.name} (${country.code}):`);
    
    // Verificar subdivisiones
    const subdivisions = await prisma.subdivision.findMany({
      where: {
        subdivisionId: { startsWith: `${country.code}.` }
      },
      orderBy: { level: 'asc' }
    });
    
    if (subdivisions.length === 0) {
      console.log(`   ❌ Sin subdivisiones en BD`);
    } else {
      const byLevel = subdivisions.reduce((acc, sub) => {
        acc[sub.level] = (acc[sub.level] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      
      console.log(`   ✅ Subdivisiones:`);
      Object.entries(byLevel).forEach(([level, count]) => {
        console.log(`      Nivel ${level}: ${count}`);
      });
    }
    
    // Verificar votos
    const votes = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM votes v
      JOIN subdivisions s ON v.subdivision_id = s.id
      WHERE s.subdivision_id LIKE ${country.code + '.%'}
    `;
    
    const voteCount = Number(votes[0]?.count || 0);
    console.log(`   Votos: ${voteCount}`);
    
    if (voteCount === 0) {
      console.log(`   ⚠️  Necesita votos\n`);
    } else {
      console.log(`   ✅ Tiene votos\n`);
    }
  }
  
  console.log('='.repeat(70));
  console.log('💡 SIGUIENTE PASO:\n');
  console.log('Descargar datos de GeoBoundaries para estos países');
  console.log('   npx tsx scripts/download-missing-countries.ts');
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
