import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteVotes() {
  console.log('\n🗑️  Eliminando todos los votos...\n');
  
  const result = await prisma.vote.deleteMany({});
  
  console.log(`✅ Eliminados ${result.count} votos\n`);
  
  await prisma.$disconnect();
}

deleteVotes();
