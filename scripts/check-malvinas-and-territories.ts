/**
 * Verificar Islas Malvinas y otros territorios pequeños
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const territories = [
  { code: 'FLK', name: 'Falkland Islands / Islas Malvinas' },
  { code: 'GUF', name: 'French Guiana' },
  { code: 'REU', name: 'Réunion' },
  { code: 'MTQ', name: 'Martinique' },
  { code: 'GLP', name: 'Guadeloupe' },
  { code: 'BLM', name: 'Saint Barthélemy' },
  { code: 'MAF', name: 'Saint Martin' },
  { code: 'ESH', name: 'Western Sahara' },
  { code: 'ATF', name: 'French Southern Territories' }
];

async function main() {
  console.log('🔍 Verificando territorios que pueden faltar...\n');
  
  const needVotes: string[] = [];
  const needSubdivisions: string[] = [];
  
  for (const territory of territories) {
    console.log(`🌍 ${territory.name} (${territory.code}):`);
    
    // Verificar subdivisiones
    const subdivisions = await prisma.subdivision.findMany({
      where: {
        subdivisionId: { startsWith: `${territory.code}.` }
      }
    });
    
    if (subdivisions.length === 0) {
      console.log(`   ❌ Sin subdivisiones en BD`);
      needSubdivisions.push(territory.code);
    } else {
      const byLevel = subdivisions.reduce((acc, sub) => {
        acc[sub.level] = (acc[sub.level] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      
      console.log(`   ✅ Subdivisiones:`);
      Object.entries(byLevel).forEach(([level, count]) => {
        console.log(`      Nivel ${level}: ${count}`);
      });
      
      // Verificar votos
      const votes = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM votes v
        JOIN subdivisions s ON v.subdivision_id = s.id
        WHERE s.subdivision_id LIKE ${territory.code + '.%'}
      `;
      
      const voteCount = Number(votes[0]?.count || 0);
      console.log(`   Votos: ${voteCount}`);
      
      if (voteCount === 0) {
        console.log(`   ⚠️  Necesita votos`);
        needVotes.push(territory.code);
      }
    }
    
    console.log('');
  }
  
  console.log('='.repeat(70));
  console.log('📊 RESUMEN:\n');
  
  if (needSubdivisions.length > 0) {
    console.log(`❌ Sin subdivisiones (${needSubdivisions.length}):`);
    console.log(`   ${needSubdivisions.join(', ')}\n`);
  }
  
  if (needVotes.length > 0) {
    console.log(`⚠️  Con subdivisiones pero sin votos (${needVotes.length}):`);
    console.log(`   ${needVotes.join(', ')}\n`);
  }
  
  if (needSubdivisions.length === 0 && needVotes.length === 0) {
    console.log('✅ Todos los territorios tienen subdivisiones y votos\n');
  }
  
  if (needSubdivisions.length > 0) {
    console.log('💡 SIGUIENTE PASO PARA LOS QUE FALTAN:');
    console.log('   1. Descargar desde GeoBoundaries');
    console.log('   2. Procesar a TopoJSON');
    console.log('   3. Migrar a BD');
    console.log('   4. Agregar votos\n');
  }
  
  if (needVotes.length > 0) {
    console.log('💡 AGREGAR VOTOS A:');
    console.log(`   npx tsx scripts/add-votes-to-territories.ts ${needVotes.join(' ')}`);
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
