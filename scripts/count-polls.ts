import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function countPolls() {
  const total = await prisma.poll.count();
    
  const recent = await prisma.poll.findMany({
    orderBy: { id: 'desc' },
    take: 5,
    select: {
      title: true,
      createdAt: true,
    },
  });

    recent.forEach(p => {
      });

  await prisma.$disconnect();
}

countPolls();
