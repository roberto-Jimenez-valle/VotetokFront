import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCoords() {
  const subs = await prisma.subdivision.findMany({
    where: {
      subdivisionId: { startsWith: 'ESP.1.' },
      level: 3
    },
    take: 10,
    orderBy: { subdivisionId: 'asc' }
  });
  
  console.log('\n📍 Coordenadas de provincias de Andalucía (ESP.1.*):\n');
  subs.forEach(s => {
    console.log(`${s.name.padEnd(20)} (${s.subdivisionId.padEnd(10)}) → lat: ${s.latitude}, lon: ${s.longitude}`);
  });
  
  await prisma.$disconnect();
}

checkCoords();
