import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOptionCreators() {
  
  const options = await prisma.pollOption.findMany({
    include: {
      poll: {
        select: {
          title: true,
        }
      },
      user: {
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
        }
      }
    },
    take: 10,
  });

  
  options.forEach(opt => {
            if (opt.user) {
                } else {
          }
      });

  // Contar opciones sin creador
  const withoutCreator = await prisma.pollOption.count({
    where: { userId: null }
  });

  
  await prisma.$disconnect();
}

checkOptionCreators();
