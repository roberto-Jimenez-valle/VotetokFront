import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const subs = await prisma.subdivision.findMany({
    where: { subdivisionId: { startsWith: 'ESP' } },
    select: { subdivisionId: true, name: true },
    take: 20
  });
  
  console.log('Subdivisiones de España:');
  subs.forEach(s => console.log(`  ${s.subdivisionId}: ${s.name}`));
  
  await prisma.$disconnect();
}

main();
