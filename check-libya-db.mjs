import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const subs = await prisma.subdivision.findMany({
    where: {
      subdivisionId: {
        startsWith: 'LBY.'
      }
    },
    select: {
      subdivisionId: true,
      name: true
    },
    orderBy: {
      subdivisionId: 'asc'
    }
  });
  
  console.log('Subdivisiones LBY en DB:', subs.length);
  subs.slice(0, 10).forEach(s => console.log('  ' + s.subdivisionId + ' - ' + s.name));
} finally {
  await prisma.$disconnect();
}
