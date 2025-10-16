import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkIds() {
  const subs = await prisma.subdivision.findMany({
    where: {
      subdivisionId: { startsWith: 'ESP' },
      level: 2
    },
    orderBy: { subdivisionId: 'asc' }
  });
  
  console.log('\n📊 Subdivisiones nivel 2 de España:\n');
  subs.forEach(s => {
    console.log(`  ${s.subdivisionId.padEnd(10)} → ${s.name}`);
  });
  
  await prisma.$disconnect();
}

checkIds();
