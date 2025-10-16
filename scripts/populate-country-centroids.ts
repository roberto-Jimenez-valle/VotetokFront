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

async function populateCountryCentroids() {
  console.log('\n🌍 Poblando centroides de países (nivel 1)...\n');

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

      // Calcular centroide global de todo el país (todas las subdivisiones juntas)
      let totalLat = 0;
      let totalLon = 0;
      let totalPoints = 0;

      for (const feature of geoJSON.features) {
        if (feature.geometry.type === 'Polygon') {
          for (const ring of feature.geometry.coordinates) {
            for (const [lon, lat] of ring) {
              totalLat += lat;
              totalLon += lon;
              totalPoints++;
            }
          }
        } else if (feature.geometry.type === 'MultiPolygon') {
          for (const polygon of feature.geometry.coordinates) {
            for (const ring of polygon) {
              for (const [lon, lat] of ring) {
                totalLat += lat;
                totalLon += lon;
                totalPoints++;
              }
            }
          }
        }
      }

      if (totalPoints > 0) {
        const countryLat = totalLat / totalPoints;
        const countryLon = totalLon / totalPoints;

        // Actualizar en BD
        const country = await prisma.subdivision.findFirst({
          where: {
            subdivisionId: countryCode,
            level: 1
          }
        });

        if (country) {
          await prisma.subdivision.update({
            where: { id: country.id },
            data: {
              latitude: countryLat,
              longitude: countryLon
            }
          });

          console.log(`✅ ${countryCode.padEnd(5)} → ${country.name.padEnd(25)} lat: ${countryLat.toFixed(4)}, lon: ${countryLon.toFixed(4)}`);
          totalUpdated++;
        }
      }
    } catch (error) {
      console.log(`⚠️  Error procesando ${countryCode}:`, (error as Error).message);
    }
  }

  console.log(`\n✅ Total actualizado: ${totalUpdated} países nivel 1\n`);
  await prisma.$disconnect();
}

populateCountryCentroids().catch(console.error);
