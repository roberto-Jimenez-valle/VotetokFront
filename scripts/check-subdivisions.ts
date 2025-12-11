import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Contar subdivisiones por nivel
  const counts = await prisma.subdivision.groupBy({
    by: ['level'],
    _count: { id: true },
    orderBy: { level: 'asc' }
  });
  
  console.log('=== Subdivisiones por nivel ===');
  counts.forEach(c => {
    console.log(`Nivel ${c.level}: ${c._count.id} subdivisiones`);
  });
  
  // Verificar subdivisiones sin nombre
  const withoutName = await prisma.subdivision.count({
    where: { name: null }
  });
  console.log(`\nSubdivisiones sin nombre: ${withoutName}`);
  
  // Verificar subdivisiones sin coordenadas
  const withoutCoords = await prisma.subdivision.count({
    where: {
      OR: [
        { latitude: null },
        { longitude: null }
      ]
    }
  });
  console.log(`Subdivisiones sin coordenadas: ${withoutCoords}`);
  
  // Mostrar algunos ejemplos de subdivisiones
  const examples = await prisma.subdivision.findMany({
    take: 10,
    select: {
      id: true,
      subdivisionId: true,
      name: true,
      level: true,
      latitude: true,
      longitude: true
    },
    orderBy: { id: 'asc' }
  });
  
  console.log('\n=== Primeras 10 subdivisiones ===');
  examples.forEach(s => {
    console.log(`${s.subdivisionId}: ${s.name} (nivel ${s.level}) - lat: ${s.latitude}, lng: ${s.longitude}`);
  });
  
  await prisma.$disconnect();
}

main().catch(console.error);
