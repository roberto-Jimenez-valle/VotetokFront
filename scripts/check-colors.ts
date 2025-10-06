import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkColors() {
  const optionsWithoutColor = await prisma.pollOption.findMany({
    where: {
      OR: [
        { color: { equals: '' } },
        { color: { equals: null } },
      ]
    },
    include: {
      poll: {
        select: {
          title: true,
        }
      }
    }
  });

    
  if (optionsWithoutColor.length > 0) {
        optionsWithoutColor.slice(0, 5).forEach(opt => {
          });
  }

  await prisma.$disconnect();
}

checkColors();
