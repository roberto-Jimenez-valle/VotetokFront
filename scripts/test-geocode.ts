import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testGeocode() {
  console.log('\n🔍 Testing Geocode System\n');
  
  // Madrid coordinates
  const lat = 40.4168;
  const lon = -3.7038;
  
  console.log('📍 Coordinates:', { lat, lon });
  console.log('\n---\n');
  
  // Test nivel 2 (comunidades)
  const level2 = await prisma.$queryRaw<Array<{
    id: number;
    subdivision_id: string;
    name: string;
    level: number;
    latitude: number;
    longitude: number;
    distance: number;
  }>>`
    SELECT 
      id,
      subdivision_id,
      name,
      level,
      latitude,
      longitude,
      ((latitude - ${lat}) * (latitude - ${lat}) + 
       (longitude - ${lon}) * (longitude - ${lon})) as distance
    FROM subdivisions
    WHERE level = 2 AND subdivision_id LIKE 'ESP.%' AND latitude IS NOT NULL AND longitude IS NOT NULL
    ORDER BY distance
    LIMIT 5
  `;
  
  console.log('📊 Nivel 2 (Comunidades) - Top 5 más cercanas:');
  if (level2.length === 0) {
    console.log('❌ NO HAY SUBDIVISIONES NIVEL 2 PARA ESPAÑA');
  } else {
    level2.forEach((sub, i) => {
      const dist = Math.sqrt(sub.distance);
      console.log(`  ${i + 1}. ${sub.name} (${sub.subdivision_id}) - Lat: ${sub.latitude}, Lon: ${sub.longitude} - Distancia: ${dist.toFixed(4)}°`);
    });
    console.log(`\n✅ Más cercana: ID=${level2[0].id}, Nombre="${level2[0].name}"`);
  }
  
  console.log('\n---\n');
  
  // Contar subdivisiones por nivel
  const counts = await prisma.$queryRaw<Array<{ level: number; count: bigint }>>`
    SELECT level, COUNT(*) as count
    FROM subdivisions
    WHERE subdivision_id LIKE 'ESP.%'
    GROUP BY level
    ORDER BY level
  `;
  
  console.log('📈 Subdivisiones de España por nivel:');
  counts.forEach(c => {
    console.log(`  Nivel ${c.level}: ${c.count} subdivisiones`);
  });
  
  await prisma.$disconnect();
}

testGeocode().catch(console.error);
