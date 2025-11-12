import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyIntegrity() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 VERIFICACIÓN DE INTEGRIDAD DE VOTOS');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // 1. Verificar subdivisiones que SON último nivel pero NO tienen votos
    console.log('📊 1. Verificando subdivisiones de ÚLTIMO NIVEL sin votos...\n');
    
    const lowestLevelNoVotes = await prisma.$queryRaw`
      SELECT s.subdivision_id, s.name, s.level,
             COUNT(v.id) as vote_count
      FROM subdivisions s
      LEFT JOIN votes v ON s.id = v.subdivision_id
      WHERE s.is_lowest_level = TRUE
      GROUP BY s.id, s.subdivision_id, s.name, s.level
      HAVING COUNT(v.id) = 0
      ORDER BY s.subdivision_id
    `;
    
    console.log(`   Total sin votos: ${lowestLevelNoVotes.length}`);
    
    if (lowestLevelNoVotes.length > 0) {
      console.log(`\n   Primeros 20 ejemplos:`);
      lowestLevelNoVotes.slice(0, 20).forEach(sub => {
        console.log(`   ⚠️  ${sub.subdivision_id.padEnd(15)} (nivel ${sub.level}) - ${sub.name}`);
      });
      if (lowestLevelNoVotes.length > 20) {
        console.log(`   ... y ${lowestLevelNoVotes.length - 20} más`);
      }
    } else {
      console.log(`   ✅ Todos los niveles mínimos tienen votos`);
    }
    
    // 2. Verificar subdivisiones que NO son último nivel pero SÍ tienen votos
    console.log(`\n\n📊 2. Verificando subdivisiones que NO son último nivel pero tienen votos...\n`);
    
    const notLowestLevelWithVotes = await prisma.$queryRaw`
      SELECT s.subdivision_id, s.name, s.level,
             COUNT(v.id)::int as vote_count
      FROM subdivisions s
      INNER JOIN votes v ON s.id = v.subdivision_id
      WHERE s.is_lowest_level = FALSE
      GROUP BY s.id, s.subdivision_id, s.name, s.level
      HAVING COUNT(v.id) > 0
      ORDER BY COUNT(v.id) DESC
    `;
    
    console.log(`   Total con votos: ${notLowestLevelWithVotes.length}`);
    
    if (notLowestLevelWithVotes.length > 0) {
      console.log(`\n   ❌ PROBLEMA: Hay subdivisiones con nivel intermedio que tienen votos:`);
      console.log(`   (Estos votos deberían estar en el nivel inferior)\n`);
      
      notLowestLevelWithVotes.slice(0, 20).forEach(sub => {
        console.log(`   ❌ ${sub.subdivision_id.padEnd(15)} (nivel ${sub.level}) - ${sub.name.padEnd(30)} - ${sub.vote_count} votos`);
      });
      
      if (notLowestLevelWithVotes.length > 20) {
        console.log(`   ... y ${notLowestLevelWithVotes.length - 20} más`);
      }
      
      // Estadísticas por nivel
      const byLevel = {};
      notLowestLevelWithVotes.forEach(sub => {
        byLevel[sub.level] = (byLevel[sub.level] || 0) + 1;
      });
      
      console.log(`\n   📊 Distribución por nivel:`);
      Object.entries(byLevel).forEach(([level, count]) => {
        console.log(`      Nivel ${level}: ${count} subdivisiones`);
      });
      
    } else {
      console.log(`   ✅ No hay votos en niveles intermedios`);
    }
    
    // 3. Estadísticas generales
    console.log(`\n\n📊 3. Estadísticas generales...\n`);
    
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT s.id) as total_subdivisions,
        COUNT(DISTINCT CASE WHEN s.is_lowest_level = TRUE THEN s.id END) as lowest_level_count,
        COUNT(DISTINCT CASE WHEN s.is_lowest_level = FALSE THEN s.id END) as not_lowest_level_count,
        COUNT(v.id)::int as total_votes,
        COUNT(DISTINCT CASE WHEN s.is_lowest_level = TRUE THEN v.id END)::int as votes_in_lowest_level,
        COUNT(DISTINCT CASE WHEN s.is_lowest_level = FALSE THEN v.id END)::int as votes_not_in_lowest_level
      FROM subdivisions s
      LEFT JOIN votes v ON s.id = v.subdivision_id
    `;
    
    const stat = stats[0];
    
    console.log(`   Total subdivisiones: ${stat.total_subdivisions}`);
    console.log(`   - Último nivel: ${stat.lowest_level_count}`);
    console.log(`   - Nivel intermedio: ${stat.not_lowest_level_count}`);
    console.log(`\n   Total votos: ${stat.total_votes}`);
    console.log(`   - En último nivel: ${stat.votes_in_lowest_level} (${(stat.votes_in_lowest_level / stat.total_votes * 100).toFixed(1)}%)`);
    console.log(`   - En nivel intermedio: ${stat.votes_not_in_lowest_level} (${(stat.votes_not_in_lowest_level / stat.total_votes * 100).toFixed(1)}%)`);
    
    // 4. RESUMEN FINAL
    console.log(`\n\n═══════════════════════════════════════════════════════`);
    console.log(`📊 RESUMEN FINAL`);
    console.log(`═══════════════════════════════════════════════════════\n`);
    
    const hasIssues = notLowestLevelWithVotes.length > 0;
    
    if (hasIssues) {
      console.log(`❌ PROBLEMAS ENCONTRADOS:`);
      console.log(`\n   ${notLowestLevelWithVotes.length} subdivisiones de nivel intermedio tienen votos`);
      console.log(`   Estos votos deberían estar en el nivel más bajo disponible`);
      console.log(`\n💡 RECOMENDACIÓN:`);
      console.log(`   Ejecutar un script de migración para mover votos al nivel correcto`);
    } else {
      console.log(`✅ TODO CORRECTO:`);
      console.log(`\n   ✅ No hay votos en niveles intermedios`);
      console.log(`   ✅ Todos los votos están en el nivel más bajo disponible`);
    }
    
    // Subdivisiones sin votos es normal (no todas las regiones tienen actividad)
    if (lowestLevelNoVotes.length > 0) {
      console.log(`\n⚠️  NOTA: ${lowestLevelNoVotes.length} subdivisiones de último nivel no tienen votos`);
      console.log(`   Esto es normal - no todas las regiones tienen actividad todavía`);
    }
    
    console.log(`\n═══════════════════════════════════════════════════════`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyIntegrity();
