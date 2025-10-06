import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findMaria() {
  const maria = await prisma.user.findFirst({
    where: { username: 'maria_tech' },
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

        maria?.following.forEach(f => {
      });

  await prisma.$disconnect();
}

findMaria();
