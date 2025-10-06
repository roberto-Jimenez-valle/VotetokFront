import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPollTitle() {
  const poll = await prisma.poll.findFirst({
    select: {
      id: true,
      title: true,
    }
  });

  
  await prisma.$disconnect();
}

testPollTitle();
