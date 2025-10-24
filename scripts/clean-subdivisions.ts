import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanSubdivisions() {
  console.log('🧹 Limpiando subdivisiones...');
  await prisma.subdivision.deleteMany({});
  console.log('✅ Subdivisiones eliminadas');
  await prisma.$disconnect();
}

cleanSubdivisions();
