import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const sub = await prisma.subdivision.findFirst({
    where: {
      subdivisionId: 'BRA.20.124'
    },
    select: {
      id: true,
      subdivisionId: true,
      name: true,
      level: true,
      isLowestLevel: true,
      _count: {
        select: {
          votes: true
        }
      }
    }
  });
  
  console.log('📊 Subdivisión BRA.20.124:');
  console.log(JSON.stringify(sub, null, 2));
  
  // Verificar cuántas subdivisiones de nivel 3 NO están marcadas como lowest level
  const level3NotLowest = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM subdivisions
    WHERE level = 3 AND is_lowest_level = FALSE
  `;
  
  console.log(`\n⚠️  Subdivisiones de nivel 3 que NO son último nivel: ${level3NotLowest[0].count}`);
  
  // Verificar cuántas tienen votos
  const level3NotLowestWithVotes = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT v.subdivision_id)::int as count
    FROM votes v
    INNER JOIN subdivisions s ON v.subdivision_id = s.id
    WHERE s.level = 3 AND s.is_lowest_level = FALSE
  `;
  
  console.log(`✅ De esas, con votos: ${level3NotLowestWithVotes[0].count}`);
  
  const level3NotLowestNoVotes = level3NotLowest[0].count - level3NotLowestWithVotes[0].count;
  console.log(`❌ De esas, sin votos: ${level3NotLowestNoVotes}`);
  
} finally {
  await prisma.$disconnect();
}
