/**
 * Prueba directa del sistema de geocoding sin pasar por HTTP
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testGeocodingDirect() {
  console.log('🧪 Probando geocoding directamente en BD...\n');

  // Coordenadas de prueba
  const testCases = [
    { name: 'Madrid', lat: 40.4168, lon: -3.7038 },
    { name: 'Barcelona', lat: 41.3851, lon: 2.1734 },
    { name: 'Sevilla', lat: 37.3891, lon: -5.9845 },
  ];

  for (const test of testCases) {
    console.log(`📍 Probando: ${test.name} (${test.lat}, ${test.lon})`);

    try {
      // Misma query que usa el endpoint
      const subdivisions = await prisma.$queryRaw<Array<{
        id: number;
        subdivision_id: string;
        name: string;
        level: number;
        country_id: number;
        latitude: number;
        longitude: number;
        distance: number;
      }>>`
        SELECT 
          id,
          subdivision_id,
          name,
          level,
          country_id,
          latitude,
          longitude,
          ((latitude - ${test.lat}) * (latitude - ${test.lat}) + 
           (longitude - ${test.lon}) * (longitude - ${test.lon})) as distance
        FROM subdivisions
        WHERE level = 1
        ORDER BY distance
        LIMIT 1
      `;

      if (subdivisions.length === 0) {
        console.log('  ❌ No se encontró ninguna subdivisión');
        continue;
      }

      const nearest = subdivisions[0];

      // Obtener país
      const country = await prisma.country.findUnique({
        where: { id: nearest.country_id }
      });

      const distance = Math.sqrt(nearest.distance);

      console.log('  ✅ Resultado:');
      console.log(`     País: ${country?.name || 'N/A'} (${country?.iso3 || 'N/A'})`);
      console.log(`     Subdivisión: ${nearest.name}`);
      console.log(`     SubdivisionId: ${nearest.subdivision_id}`);
      console.log(`     Distancia: ${distance.toFixed(4)}°`);
      console.log();

    } catch (error) {
      console.error(`  ❌ Error:`, error.message);
    }
  }

  // Verificar cantidad de subdivisiones en BD
  console.log('═'.repeat(60));
  const totalSubdivisions = await prisma.subdivision.count();
  const level1Count = await prisma.subdivision.count({ where: { level: 1 } });
  const level2Count = await prisma.subdivision.count({ where: { level: 2 } });

  console.log('📊 Estado de la base de datos:');
  console.log(`   Total subdivisiones: ${totalSubdivisions}`);
  console.log(`   Nivel 1: ${level1Count}`);
  console.log(`   Nivel 2: ${level2Count}`);

  // Verificar España específicamente
  const espSubdivisions = await prisma.subdivision.findMany({
    where: { 
      country: { iso3: 'ESP' },
      level: 1
    },
    include: { country: true },
    orderBy: { subdivisionId: 'asc' },
    take: 5
  });

  console.log('\n🇪🇸 Subdivisiones de España (primeras 5):');
  espSubdivisions.forEach(sub => {
    console.log(`   ${sub.subdivisionId}: ${sub.name} @ (${sub.latitude.toFixed(2)}, ${sub.longitude.toFixed(2)})`);
  });

  await prisma.$disconnect();
}

testGeocodingDirect();
