import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {

  // Eliminar todas las encuestas que empiezan con 🧪 TEST
  const result = await prisma.poll.deleteMany({
    where: {
      title: {
        startsWith: '🧪 TEST'
      }
    }
  });

}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
