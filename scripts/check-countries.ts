import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Contar por nivel
  const counts = await prisma.subdivision.groupBy({
    by: ['level'],
    _count: { id: true },
    orderBy: { level: 'asc' }
  });
  
  console.log('=== Subdivisiones por nivel ===');
  counts.forEach(c => {
    const levelName = c.level === 1 ? 'Países' : c.level === 2 ? 'Estados/Comunidades' : 'Provincias/Ciudades';
    console.log(`Nivel ${c.level} (${levelName}): ${c._count.id}`);
  });
  
  // Buscar España y Japón
  const countries = await prisma.subdivision.findMany({
    where: {
      OR: [
        { name: { contains: 'Spain', mode: 'insensitive' } },
        { name: { contains: 'Japan', mode: 'insensitive' } },
        { name: { contains: 'España', mode: 'insensitive' } },
        { subdivisionId: 'ESP' },
        { subdivisionId: 'JPN' }
      ]
    },
    select: { subdivisionId: true, name: true, level: true }
  });
  
  console.log('\n=== España y Japón ===');
  countries.forEach(c => console.log(`${c.subdivisionId}: ${c.name} (nivel ${c.level})`));
  
  await prisma.$disconnect();
}

main();
