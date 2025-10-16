import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCountries() {
  console.log('\n🌍 Verificando coordenadas de países nivel 1:\n');
  
  const countries = await prisma.subdivision.findMany({
    where: {
      subdivisionId: { in: ['ESP', 'AFG'] },
      level: 1
    }
  });
  
  countries.forEach(c => {
    console.log(`${c.subdivisionId.padEnd(5)} - ${c.name.padEnd(20)} → lat: ${c.latitude}, lon: ${c.longitude}`);
  });
  
  console.log('\n🎯 Madrid está en: lat: 40.39, lon: -3.66');
  console.log('🎯 España debería estar cerca de esas coordenadas\n');
  
  await prisma.$disconnect();
}

checkCountries();
