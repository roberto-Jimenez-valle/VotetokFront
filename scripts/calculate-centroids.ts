import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Función para calcular el centroide de un polígono
function calculateCentroid(coordinates: any[]): { lat: number; lon: number } {
  let totalLat = 0;
  let totalLon = 0;
  let totalPoints = 0;

  function processRing(ring: number[][]) {
    for (const [lon, lat] of ring) {
      totalLat += lat;
      totalLon += lon;
      totalPoints++;
    }
  }

  function processCoordinates(coords: any, type: string) {
    if (type === 'Polygon') {
      coords.forEach(processRing);
    } else if (type === 'MultiPolygon') {
      coords.forEach((polygon: any) => {
        polygon.forEach(processRing);
      });
    }
  }

  processCoordinates(coordinates, 'Polygon');

  return {
    lat: totalLat / totalPoints,
    lon: totalLon / totalPoints
  };
}

async function updateCentroidsFromGeoJSON() {
  console.log('\n🗺️  Calculando centroides desde archivos GeoJSON...\n');

  // Leer archivos GeoJSON de nivel 2 (comunidades)
  const level2Files = [
    'public/geojson/world-level2/ESP.geojson',
    'public/geojson/world-level2/FRA.geojson',
    'public/geojson/world-level2/GBR.geojson',
  ];

  let updated = 0;

  for (const filePath of level2Files) {
    const fullPath = path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Archivo no encontrado: ${filePath}`);
      continue;
    }

    const geoJSON = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    const countryCode = path.basename(filePath, '.geojson');

    console.log(`📂 Procesando ${countryCode}...`);

    for (const feature of geoJSON.features) {
      const props = feature.properties;
      
      // Construir subdivisionId nivel 2: ESP.1, ESP.2, etc.
      const id1 = props.ID_1 || props.id_1 || props.GID_1?.split('.')[1];
      if (!id1) continue;
      
      const subdivisionId = `${countryCode}.${id1}`;
      
      // Calcular centroide
      const centroid = calculateCentroid(feature.geometry.coordinates);
      
      // Buscar en BD
      const subdivision = await prisma.subdivision.findFirst({
        where: {
          subdivisionId,
          level: 2
        }
      });

      if (subdivision) {
        await prisma.subdivision.update({
          where: { id: subdivision.id },
          data: {
            latitude: centroid.lat,
            longitude: centroid.lon
          }
        });

        console.log(`  ✅ ${subdivision.name} (${subdivisionId}): ${centroid.lat.toFixed(4)}, ${centroid.lon.toFixed(4)}`);
        updated++;
      }
    }
  }

  console.log(`\n✅ Actualizadas ${updated} subdivisiones con centroides\n`);
  await prisma.$disconnect();
}

updateCentroidsFromGeoJSON().catch(console.error);
