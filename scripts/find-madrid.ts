import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findMadrid() {
  const madrid = await prisma.subdivision.findMany({
    where: {
      subdivisionId: { startsWith: 'ESP.13' },
      level: 3
    },
    orderBy: { subdivisionId: 'asc' }
  });
  
  console.log('\n🔍 Subdivisiones de Madrid (ESP.13.X):\n');
  madrid.forEach(s => {
    console.log(`${s.subdivisionId.padEnd(15)} → ${s.name.padEnd(30)} (lat: ${s.latitude}, lon: ${s.longitude})`);
  });
  
  await prisma.$disconnect();
}

findMadrid();
