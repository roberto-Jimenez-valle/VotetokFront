import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteUkraineLevel1Votes() {
  try {
    console.log('🇺🇦 Eliminando votos de nivel 1 de Ucrania...\n');
    
    // 1. Obtener subdivisión de nivel 1 de Ucrania
    const ukraineLevel1 = await prisma.subdivision.findFirst({
      where: {
        subdivisionId: 'UKR',
        level: 1
      }
    });
    
    if (!ukraineLevel1) {
      console.log('❌ No se encontró la subdivisión de nivel 1 de Ucrania');
      return;
    }
    
    console.log(`📍 Subdivisión encontrada: ${ukraineLevel1.name} (ID: ${ukraineLevel1.id})`);
    
    // 2. Contar votos actuales
    const voteCount = await prisma.vote.count({
      where: {
        subdivisionId: ukraineLevel1.id
      }
    });
    
    console.log(`📊 Votos encontrados en nivel 1: ${voteCount}\n`);
    
    if (voteCount === 0) {
      console.log('✅ No hay votos que eliminar');
      return;
    }
    
    // 3. Eliminar votos
    console.log('🗑️  Eliminando votos...');
    
    const result = await prisma.vote.deleteMany({
      where: {
        subdivisionId: ukraineLevel1.id
      }
    });
    
    console.log(`\n✅ Votos eliminados: ${result.count}`);
    
    // 4. Verificar que no queden votos
    const remainingVotes = await prisma.vote.count({
      where: {
        subdivisionId: ukraineLevel1.id
      }
    });
    
    console.log(`\n📊 Verificación final:`);
    console.log(`   - Votos restantes en nivel 1: ${remainingVotes}`);
    
    // 5. Mostrar estadísticas finales de Ucrania
    const allUkraineSubdivisions = await prisma.subdivision.findMany({
      where: {
        subdivisionId: {
          startsWith: 'UKR'
        }
      }
    });
    
    const subdivisionIds = allUkraineSubdivisions.map(s => s.id);
    
    const votesByLevel = await prisma.$queryRaw<Array<{ level: number, count: bigint }>>`
      SELECT s.level, COUNT(v.id)::bigint as count
      FROM votes v
      INNER JOIN subdivisions s ON v.subdivision_id = s.id
      WHERE s.id = ANY(${subdivisionIds}::int[])
      GROUP BY s.level
      ORDER BY s.level
    `;
    
    console.log(`\n🇺🇦 Estadísticas finales de Ucrania:`);
    for (const row of votesByLevel) {
      console.log(`   - Nivel ${row.level}: ${row.count} votos`);
    }
    
    console.log('\n✅ Proceso completado exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteUkraineLevel1Votes();
