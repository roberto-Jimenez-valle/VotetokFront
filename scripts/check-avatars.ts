import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAvatars() {
  const options = await prisma.pollOption.findMany({
    take: 10,
    select: {
      optionLabel: true,
      avatarUrl: true,
    }
  });

    options.forEach(o => {
      });

  const withoutAvatar = await prisma.pollOption.count({
    where: {
      OR: [
        { avatarUrl: null },
        { avatarUrl: '' }
      ]
    }
  });

  
  await prisma.$disconnect();
}

checkAvatars();
