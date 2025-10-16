import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import * as topojson from 'topojson-client';

const prisma = new PrismaClient();

// Calcular centroide de un polígono
function calculatePolygonCentroid(coordinates: number[][][]): { lat: number; lon: number } {
  let totalLat = 0;
  let totalLon = 0;
  let totalPoints = 0;

  for (const ring of coordinates) {
    for (const [lon, lat] of ring) {
      totalLat += lat;
      totalLon += lon;
      totalPoints++;
    }
  }

  return {
    lat: totalLat / totalPoints,
    lon: totalLon / totalPoints
  };
}

// Calcular centroide de MultiPolygon
function calculateMultiPolygonCentroid(coordinates: number[][][][]): { lat: number; lon: number } {
  let totalLat = 0;
  let totalLon = 0;
  let totalPoints = 0;

  for (const polygon of coordinates) {
    for (const ring of polygon) {
      for (const [lon, lat] of ring) {
        totalLat += lat;
        totalLon += lon;
        totalPoints++;
      }
    }
  }

  return {
    lat: totalLat / totalPoints,
    lon: totalLon / totalPoints
  };
}

async function extractAllCentroids() {
  console.log('\n🗺️  Extrayendo centroides de TODOS los países...\n');

  const geoDir = 'static/geojson';
  const countries = fs.readdirSync(geoDir).filter(f => {
    const stat = fs.statSync(path.join(geoDir, f));
    return stat.isDirectory();
  });

  console.log(`📂 Encontrados ${countries.length} países\n`);

  let totalUpdated = 0;

  for (const countryCode of countries) {
    const countryPath = path.join(geoDir, countryCode);
    const countryFile = path.join(countryPath, `${countryCode}.topojson`);

    if (!fs.existsSync(countryFile)) {
      continue;
    }

    try {
      const topoData = JSON.parse(fs.readFileSync(countryFile, 'utf-8'));
      const geoJSON: any = topojson.feature(topoData, topoData.objects[Object.keys(topoData.objects)[0]]);

      console.log(`\n📍 ${countryCode}: ${geoJSON.features.length} subdivisiones`);

      for (const feature of geoJSON.features) {
        const props = feature.properties;
        
        // Obtener subdivisionId (formato: ESP.1, FRA.1, etc.)
        const subdivisionId = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1;
        if (!subdivisionId) continue;
        
        const name = props.NAME_1 || props.name_1 || 'Unknown';

        // Calcular centroide
        let centroid: { lat: number; lon: number };
        
        if (feature.geometry.type === 'Polygon') {
          centroid = calculatePolygonCentroid(feature.geometry.coordinates);
        } else if (feature.geometry.type === 'MultiPolygon') {
          centroid = calculateMultiPolygonCentroid(feature.geometry.coordinates);
        } else {
          continue;
        }

        // Actualizar en BD
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

          console.log(`  ✅ ${name} (${subdivisionId}): ${centroid.lat.toFixed(4)}, ${centroid.lon.toFixed(4)}`);
          totalUpdated++;
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Error procesando ${countryCode}:`, (error as Error).message);
    }
  }

  console.log(`\n✅ Total actualizado: ${totalUpdated} subdivisiones nivel 2\n`);
  await prisma.$disconnect();
}

extractAllCentroids().catch(console.error);
