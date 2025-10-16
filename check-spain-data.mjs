import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSpain() {
  console.log('🇪🇸 Verificando datos de España...\n');
  
  // Buscar España
  const spain = await prisma.country.findUnique({
    where: { iso3: 'ESP' },
    include: {
      subdivisions: {
        where: { level: 1 },
        orderBy: { subdivisionId: 'asc' }
      }
    }
  });
  
  if (!spain) {
    console.log('❌ España no existe en la BD!');
    return;
  }
  
  console.log('✅ España encontrada:');
  console.log(`   ID: ${spain.id}`);
  console.log(`   Nombre: ${spain.name}`);
  console.log(`   ISO3: ${spain.iso3}`);
  console.log(`   Coordenadas: ${spain.latitude}, ${spain.longitude}`);
  console.log(`   Subdivisiones nivel 1: ${spain.subdivisions.length}\n`);
  
  // Coordenadas reales de España (centro aproximado)
  const realSpainLat = 40.4168;
  const realSpainLon = -3.7038;
  
  console.log(`📍 Coordenadas reales de Madrid: ${realSpainLat}, ${realSpainLon}`);
  console.log(`📍 Coordenadas en BD: ${spain.latitude}, ${spain.longitude}\n`);
  
  // Calcular distancia
  const distance = Math.sqrt(
    Math.pow(spain.latitude - realSpainLat, 2) + 
    Math.pow(spain.longitude - realSpainLon, 2)
  );
  console.log(`📏 Distancia: ${distance.toFixed(4)}°\n`);
  
  // Mostrar subdivisiones
  console.log('📋 Comunidades Autónomas:');
  spain.subdivisions.forEach(sub => {
    console.log(`   - ${sub.subdivisionId}: ${sub.name} (${sub.latitude}, ${sub.longitude})`);
  });
  
  // Buscar cual es el país más cercano a Madrid
  console.log('\n🔍 ¿Qué país está más cerca de Madrid según la BD?');
  const countries = await prisma.$queryRaw`
    SELECT 
      iso3,
      name,
      latitude,
      longitude,
      ((latitude - ${realSpainLat}) * (latitude - ${realSpainLat}) + 
       (longitude - ${realSpainLon}) * (longitude - ${realSpainLon})) as distance
    FROM countries
    ORDER BY distance
    LIMIT 5
  `;
  
  console.log('Top 5 países más cercanos a Madrid (40.4168, -3.7038):');
  countries.forEach((c, i) => {
    const dist = Math.sqrt(c.distance);
    console.log(`   ${i + 1}. ${c.iso3} (${c.name}): ${dist.toFixed(4)}° - Coords: (${c.latitude}, ${c.longitude})`);
  });
  
  await prisma.$disconnect();
}

checkSpain();
