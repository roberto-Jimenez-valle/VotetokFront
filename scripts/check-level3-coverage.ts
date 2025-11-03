/**
 * Script para verificar cobertura de votos en subdivisiones nivel 3
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando cobertura de votos nivel 3...\n');

  // Total de subdivisiones nivel 3
  const totalLevel3 = await prisma.subdivision.count({
    where: { level: 3 }
  });

  // Subdivisiones con al menos 1 voto
  const subdivsWithVotes = await prisma.subdivision.count({
    where: {
      level: 3,
      votes: {
        some: {}
      }
    }
  });

  // Subdivisiones SIN votos
  const subdivsWithoutVotes = totalLevel3 - subdivsWithVotes;

  console.log('📊 RESULTADOS:\n');
  console.log(`   Total subdivisiones nivel 3: ${totalLevel3.toLocaleString()}`);
  console.log(`   ✅ Con votos: ${subdivsWithVotes.toLocaleString()} (${(subdivsWithVotes / totalLevel3 * 100).toFixed(1)}%)`);
  console.log(`   ❌ Sin votos: ${subdivsWithoutVotes.toLocaleString()} (${(subdivsWithoutVotes / totalLevel3 * 100).toFixed(1)}%)`);

  // Desglose por país (top 10 con menos cobertura)
  console.log('\n📍 Top 10 países con MENOS cobertura:\n');
  
  const coverageByCountry = await prisma.$queryRaw<Array<{
    country: string;
    total: bigint;
    with_votes: bigint;
    without_votes: bigint;
    coverage_pct: number;
  }>>`
    SELECT 
      SUBSTRING(s.subdivision_id, 1, 3) as country,
      COUNT(s.id)::bigint as total,
      COUNT(CASE WHEN v.id IS NOT NULL THEN 1 END)::bigint as with_votes,
      COUNT(CASE WHEN v.id IS NULL THEN 1 END)::bigint as without_votes,
      ROUND(COUNT(CASE WHEN v.id IS NOT NULL THEN 1 END)::numeric / COUNT(s.id) * 100, 1) as coverage_pct
    FROM subdivisions s
    LEFT JOIN (
      SELECT DISTINCT subdivision_id
      FROM votes
    ) v ON s.id = v.subdivision_id
    WHERE s.level = 3
    GROUP BY SUBSTRING(s.subdivision_id, 1, 3)
    HAVING COUNT(s.id) > 100
    ORDER BY coverage_pct ASC, total DESC
    LIMIT 10
  `;

  for (const row of coverageByCountry) {
    console.log(`   ${row.country}: ${row.coverage_pct}% cobertura (${Number(row.with_votes)}/${Number(row.total)} subdivisiones)`);
  }

  if (subdivsWithoutVotes > 0) {
    console.log(`\n⚠️  HAY ${subdivsWithoutVotes.toLocaleString()} SUBDIVISIONES SIN VOTOS`);
    console.log('💡 Ejecuta: npx tsx scripts/seed-all-level3-votes.ts');
  } else {
    console.log('\n✅ ¡TODAS las subdivisiones nivel 3 tienen votos!');
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
