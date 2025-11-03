/**
 * Script para diagnosticar por qué algunos países salen grises
 * Verifica si tienen subdivisiones nivel 3 con votos
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Diagnosticando países grises...\n');

  // 1. Obtener TODOS los países con subdivisiones nivel 3
  console.log('📊 Paso 1: Analizando TODOS los países...\n');
  
  const allCountries = await prisma.$queryRaw<Array<{
    country: string;
    total_subdivs_level3: bigint;
    subdivs_with_votes: bigint;
    total_votes: bigint;
    polls_with_votes: bigint;
  }>>`
    SELECT 
      SUBSTRING(s.subdivision_id, 1, 3) as country,
      COUNT(DISTINCT s.id) as total_subdivs_level3,
      COUNT(DISTINCT CASE WHEN v.id IS NOT NULL THEN s.id END) as subdivs_with_votes,
      COUNT(v.id) as total_votes,
      COUNT(DISTINCT v.poll_id) as polls_with_votes
    FROM subdivisions s
    LEFT JOIN votes v ON s.id = v.subdivision_id
    WHERE s.level = 3
    GROUP BY SUBSTRING(s.subdivision_id, 1, 3)
    ORDER BY total_votes DESC
  `;

  console.log(`Total de países con subdivisiones nivel 3: ${allCountries.length}\n`);

  // 2. Clasificar países
  const countriesWithVotes = allCountries.filter(c => Number(c.total_votes) > 0);
  const countriesWithoutVotes = allCountries.filter(c => Number(c.total_votes) === 0);

  console.log('✅ Países CON votos nivel 3:');
  console.log(`   Total: ${countriesWithVotes.length} países\n`);
  
  console.log('📊 Top 20 países con MÁS votos:\n');
  for (const country of countriesWithVotes.slice(0, 20)) {
    const coverage = (Number(country.subdivs_with_votes) / Number(country.total_subdivs_level3) * 100).toFixed(1);
    console.log(`   ${country.country}: ${Number(country.total_votes).toLocaleString()} votos | ${Number(country.subdivs_with_votes)}/${Number(country.total_subdivs_level3)} subdivs (${coverage}%) | ${Number(country.polls_with_votes)} encuestas`);
  }

  console.log('\n❌ Países SIN votos nivel 3:');
  console.log(`   Total: ${countriesWithoutVotes.length} países (deberían salir GRISES)\n`);
  
  if (countriesWithoutVotes.length > 0) {
    console.log('📋 Lista de países sin votos:\n');
    for (const country of countriesWithoutVotes.slice(0, 30)) {
      console.log(`   ${country.country}: ${Number(country.total_subdivs_level3)} subdivisiones nivel 3 (0 votos)`);
    }
  }

  // 3. Verificar si hay encuestas con votos en esos países grises
  console.log('\n🔍 Verificando encuestas específicas...\n');
  
  // Tomar una encuesta trending
  const trendingPoll = await prisma.poll.findFirst({
    where: { status: 'active' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true }
  });

  if (trendingPoll) {
    console.log(`📊 Encuesta de prueba: #${trendingPoll.id} - ${trendingPoll.title}\n`);

    // Ver qué países tienen votos en esta encuesta
    const pollCountries = await prisma.$queryRaw<Array<{
      country: string;
      votes: bigint;
    }>>`
      SELECT 
        SUBSTRING(s.subdivision_id, 1, 3) as country,
        COUNT(v.id) as votes
      FROM votes v
      JOIN subdivisions s ON v.subdivision_id = s.id
      WHERE v.poll_id = ${trendingPoll.id}
        AND s.level = 3
      GROUP BY SUBSTRING(s.subdivision_id, 1, 3)
      ORDER BY votes DESC
      LIMIT 20
    `;

    console.log('📍 Países con votos en esta encuesta:\n');
    for (const pc of pollCountries) {
      console.log(`   ${pc.country}: ${Number(pc.votes)} votos`);
    }
  }

  // 4. CONCLUSIÓN
  console.log('\n' + '='.repeat(70));
  console.log('📊 CONCLUSIÓN\n');
  
  if (countriesWithoutVotes.length > 0) {
    console.log(`❌ Hay ${countriesWithoutVotes.length} países SIN votos nivel 3`);
    console.log(`   Estos países DEBERÍAN aparecer GRISES (correcto)`);
    console.log(`\n✅ Hay ${countriesWithVotes.length} países CON votos nivel 3`);
    console.log(`   Estos países DEBERÍAN aparecer COLOREADOS`);
    console.log(`\n💡 Si ves países coloreados que aparecen grises:`);
    console.log(`   - Verifica que el frontend esté usando /api/polls/{id}/votes-by-country`);
    console.log(`   - Verifica que el código ISO3 coincida exactamente`);
    console.log(`   - Revisa la consola del navegador para errores`);
  } else {
    console.log(`✅ ¡TODOS los ${countriesWithVotes.length} países tienen votos!`);
    console.log(`   Si aún ves países grises, el problema está en el frontend`);
  }
  console.log('='.repeat(70));
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
