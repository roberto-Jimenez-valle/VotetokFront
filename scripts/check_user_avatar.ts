
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { displayName: { contains: 'Roberto' } },
        { username: { contains: 'roberto' } }
      ]
    }
  });

  console.log('Users found:', users.map(u => ({ id: u.id, username: u.username, name: u.displayName })));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
