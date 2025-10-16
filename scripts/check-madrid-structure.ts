import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMadrid() {
  // Nivel 2 (Comunidad de Madrid)
  const level2 = await prisma.subdivision.findMany({
    where: {
      subdivisionId: 'ESP.13',
      level: 2
    }
  });
  
  console.log('\n📊 Comunidad de Madrid (Nivel 2):');
  level2.forEach(s => {
    console.log(`  ${s.subdivisionId} → ${s.name} (lat: ${s.latitude}, lon: ${s.longitude})`);
  });
  
  // Nivel 3 (Provincias/Municipios de Madrid)
  const level3 = await prisma.subdivision.findMany({
    where: {
      subdivisionId: { startsWith: 'ESP.13.' },
      level: 3
    }
  });
  
  console.log(`\n📊 Provincias de Madrid (Nivel 3): ${level3.length} encontradas`);
  level3.forEach(s => {
    console.log(`  ${s.subdivisionId} → ${s.name} (lat: ${s.latitude}, lon: ${s.longitude})`);
  });
  
  await prisma.$disconnect();
}

checkMadrid();
