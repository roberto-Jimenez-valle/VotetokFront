import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserFollows() {
  const user = await prisma.user.findFirst({
    where: { id: 1 },
    include: {
      following: {
        include: {
          following: {
            select: {
              id: true,
              displayName: true,
              username: true,
            }
          }
        }
      }
    }
  });

      user?.following.forEach(f => {
      });

  await prisma.$disconnect();
}

checkUserFollows();
