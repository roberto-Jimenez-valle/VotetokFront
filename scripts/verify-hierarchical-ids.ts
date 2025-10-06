import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyHierarchicalIds() {
  
  try {
    // 1. Contar votos por nivel
    const allVotes = await prisma.vote.findMany({
      where: {
        subdivisionId: { not: null }
      },
      select: {
        subdivisionId: true,
        subdivisionName: true,
        cityName: true
      }
    });

    const level1 = allVotes.filter(v => v.subdivisionId?.split('.').length === 2);
    const level2 = allVotes.filter(v => v.subdivisionId?.split('.').length === 3);
    const level3 = allVotes.filter(v => v.subdivisionId?.split('.').length === 4);
    const other = allVotes.filter(v => {
      const parts = v.subdivisionId?.split('.').length || 0;
      return parts !== 2 && parts !== 3 && parts !== 4;
    });

                        
    // 2. Mostrar ejemplos de cada nivel
    
    if (level1.length > 0) {
            level1.slice(0, 5).forEach(v => {
              });
          }

    if (level2.length > 0) {
            level2.slice(0, 5).forEach(v => {
              });
          }

    // 3. Verificar que podemos hacer consultas LIKE
    
    // Buscar todas las sub-subdivisiones de Andalucía (ESP.1)
    const andaluciaLevel2 = await prisma.$queryRaw<Array<{ subdivisionId: string; count: number }>>`
      SELECT subdivision_id as subdivisionId, COUNT(*) as count
      FROM votes
      WHERE subdivision_id LIKE 'ESP.1.%'
      GROUP BY subdivision_id
      ORDER BY count DESC
    `;

    if (andaluciaLevel2.length > 0) {
            andaluciaLevel2.forEach(item => {
              });
    } else {
                }
    
    // 4. Verificar agrupación por subdivisión nivel 1
    
    const level1Summary = await prisma.$queryRaw<Array<{ level1: string; count: number }>>`
      SELECT 
        SUBSTR(subdivision_id, 1, 
          CASE 
            WHEN INSTR(SUBSTR(subdivision_id, 5), '.') > 0 
            THEN INSTR(SUBSTR(subdivision_id, 5), '.') + 3
            ELSE LENGTH(subdivision_id)
          END
        ) as level1,
        COUNT(*) as count
      FROM votes
      WHERE subdivision_id LIKE 'ESP.%'
      GROUP BY level1
      ORDER BY count DESC
      LIMIT 10
    `;

    level1Summary.forEach(item => {
          });

    // 5. Estado final
        
    if (level2.length > 0) {
          } else {
                }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyHierarchicalIds();
