import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n📊 ESP Level 2 subdivisions in DB:\n');
  
  const subs = await prisma.subdivision.findMany({
    where: { level: 2, subdivisionId: { startsWith: 'ESP' } },
    select: { id: true, subdivisionId: true, name: true },
    orderBy: { subdivisionId: 'asc' }
  });
  
  subs.forEach(s => console.log(`  ${s.id} | ${s.subdivisionId} | ${s.name}`));
  
  console.log('\n📊 ESP Level 3 subdivisions (sample):\n');
  
  const subs3 = await prisma.subdivision.findMany({
    where: { level: 3, subdivisionId: { startsWith: 'ESP.8' } },
    select: { id: true, subdivisionId: true, name: true },
    orderBy: { subdivisionId: 'asc' },
    take: 10
  });
  
  subs3.forEach(s => console.log(`  ${s.id} | ${s.subdivisionId} | ${s.name}`));
  
  await prisma.$disconnect();
}

main();
