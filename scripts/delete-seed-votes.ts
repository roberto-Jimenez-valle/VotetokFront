import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️ Eliminando votos del script seed...');
  
  const result = await prisma.vote.deleteMany({
    where: {
      userAgent: 'Mozilla/5.0 (Seed Script)'
    }
  });
  
  console.log(`✅ Eliminados ${result.count} votos`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
