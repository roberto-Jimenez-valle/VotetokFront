import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listLevel3() {
  const subs = await prisma.subdivision.findMany({
    where: {
      subdivisionId: { startsWith: 'ESP.' },
      level: 3
    },
    orderBy: { subdivisionId: 'asc' },
    take: 20
  });
  
  console.log('\n📋 Primeras 20 subdivisiones nivel 3 de España:\n');
  subs.forEach(s => {
    console.log(`${s.subdivisionId.padEnd(15)} → ${s.name}`);
  });
  
  await prisma.$disconnect();
}

listLevel3();
