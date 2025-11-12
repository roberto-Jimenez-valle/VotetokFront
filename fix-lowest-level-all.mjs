import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixLowestLevel() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔧 CORRIGIENDO CAMPO isLowestLevel');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // 1. Marcar TODAS las subdivisiones de nivel 3 como último nivel
    console.log('📊 1. Marcando todas las subdivisiones de NIVEL 3...\n');
    
    const level3Result = await prisma.$executeRaw`
      UPDATE subdivisions 
      SET is_lowest_level = TRUE 
      WHERE level = 3
    `;
    
    console.log(`   ✅ ${level3Result} subdivisiones de nivel 3 marcadas como último nivel`);
    
    // 2. Verificar resultado final
    console.log('\n📊 2. Verificando resultado...\n');
    
    const stats = await prisma.$queryRaw`
      SELECT 
        level,
        COUNT(*)::int as total,
        COUNT(CASE WHEN is_lowest_level = TRUE THEN 1 END)::int as is_lowest
      FROM subdivisions
      GROUP BY level
      ORDER BY level
    `;
    
    console.log('   Distribución por nivel:');
    stats.forEach(s => {
      console.log(`     Nivel ${s.level}: ${s.is_lowest}/${s.total} son último nivel (${(s.is_lowest/s.total*100).toFixed(1)}%)`);
    });
    
    // 3. Verificar votos
    console.log('\n📊 3. Verificando integridad de votos...\n');
    
    const voteStats = await prisma.$queryRaw`
      SELECT 
        COUNT(v.id)::int as total_votes,
        COUNT(CASE WHEN s.is_lowest_level = TRUE THEN v.id END)::int as votes_in_lowest_level,
        COUNT(CASE WHEN s.is_lowest_level = FALSE THEN v.id END)::int as votes_not_in_lowest_level
      FROM votes v
      INNER JOIN subdivisions s ON v.subdivision_id = s.id
    `;
    
    const vs = voteStats[0];
    const pct_correct = (vs.votes_in_lowest_level / vs.total_votes * 100).toFixed(1);
    const pct_incorrect = (vs.votes_not_in_lowest_level / vs.total_votes * 100).toFixed(1);
    
    console.log(`   Total votos: ${vs.total_votes}`);
    console.log(`   ✅ En último nivel: ${vs.votes_in_lowest_level} (${pct_correct}%)`);
    console.log(`   ❌ En nivel intermedio: ${vs.votes_not_in_lowest_level} (${pct_incorrect}%)`);
    
    // 4. Si todavía hay votos en niveles intermedios, listarlos
    if (vs.votes_not_in_lowest_level > 0) {
      console.log('\n📊 4. Subdivisiones de nivel intermedio con votos:\n');
      
      const problematic = await prisma.$queryRaw`
        SELECT s.subdivision_id, s.name, s.level,
               COUNT(v.id)::int as vote_count
        FROM subdivisions s
        INNER JOIN votes v ON s.id = v.subdivision_id
        WHERE s.is_lowest_level = FALSE
        GROUP BY s.id, s.subdivision_id, s.name, s.level
        ORDER BY COUNT(v.id) DESC
        LIMIT 10
      `;
      
      problematic.forEach(p => {
        console.log(`   ❌ ${p.subdivision_id.padEnd(15)} (nivel ${p.level}) - ${p.vote_count} votos`);
      });
      
      console.log(`   ... (total: ${vs.votes_not_in_lowest_level} votos en nivel intermedio)`);
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ CORRECCIÓN COMPLETADA');
    console.log('═══════════════════════════════════════════════════════');
    
    if (vs.votes_not_in_lowest_level === 0) {
      console.log('\n🎉 ¡PERFECTO! Todos los votos están en el nivel correcto');
    } else {
      console.log(`\n⚠️  Todavía hay ${vs.votes_not_in_lowest_level} votos en niveles intermedios`);
      console.log('   Estos son votos antiguos en nivel 1 o 2 que deberían migrarse');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixLowestLevel();
