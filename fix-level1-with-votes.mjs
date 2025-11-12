import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixLevel1() {
  try {
    console.log('🔧 Marcando países de nivel 1 con votos como último nivel...\n');
    
    // Marcar países de nivel 1 que tienen votos
    const result = await prisma.$executeRaw`
      UPDATE subdivisions 
      SET is_lowest_level = TRUE 
      WHERE level = 1 
      AND id IN (
        SELECT DISTINCT subdivision_id 
        FROM votes 
        WHERE subdivision_id IN (
          SELECT id FROM subdivisions WHERE level = 1
        )
      )
    `;
    
    console.log(`✅ ${result} países de nivel 1 marcados\n`);
    
    // Verificar resultado final
    const check = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count 
      FROM votes v 
      INNER JOIN subdivisions s ON v.subdivision_id = s.id 
      WHERE s.is_lowest_level = FALSE
    `;
    
    console.log(`📊 Votos restantes en niveles intermedios: ${check[0].count}`);
    
    if (check[0].count === 0) {
      console.log('\n🎉 ¡PERFECTO! Todos los votos están en el nivel correcto\n');
    }
    
  } finally {
    await prisma.$disconnect();
  }
}

fixLevel1();
