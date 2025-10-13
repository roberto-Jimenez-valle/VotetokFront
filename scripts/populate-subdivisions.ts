/**
 * Script para poblar la tabla de subdivisiones desde los GeoJSON
 * Uso: npx tsx scripts/populate-subdivisions.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface Centroid {
  lat: number;
  lon: number;
}

/**
 * Calcula el centroide de un polígono
 */
function calculateCentroid(geometry: any): Centroid {
  let totalLat = 0;
  let totalLon = 0;
  let pointCount = 0;

  const processCoordinates = (coords: any[]) => {
    for (const coord of coords) {
      if (Array.isArray(coord[0])) {
        processCoordinates(coord);
      } else {
        totalLon += coord[0];
        totalLat += coord[1];
        pointCount++;
      }
    }
  };

  if (geometry.type === 'Polygon') {
    processCoordinates(geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      processCoordinates(polygon);
    }
  }

  return {
    lat: totalLat / pointCount,
    lon: totalLon / pointCount
  };
}

async function populateSubdivisions() {
  console.log('🌍 Poblando tabla de subdivisiones...\n');

  try {
    // Limpiar tabla existente
    await prisma.subdivision.deleteMany({});
    console.log('✅ Tabla limpiada\n');

    const geojsonDir = path.join(process.cwd(), 'static', 'geojson');
    const countries = fs.readdirSync(geojsonDir);

    let totalSubdivisions = 0;

    for (const countryIso3 of countries) {
      const countryPath = path.join(geojsonDir, countryIso3);
      
      if (!fs.statSync(countryPath).isDirectory()) continue;

      console.log(`📍 Procesando ${countryIso3}...`);

      // Buscar archivos nivel 1: subdivisiones principales (ej: ESP.1, ESP.13)
      const files = fs.readdirSync(countryPath).filter(f => 
        f.endsWith('.topojson') && f.match(/^[A-Z]{3}\.\d+\.topojson$/)
      );
      
      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(countryPath, file), 'utf-8'));
          
          // El nombre del objeto puede variar, tomamos el primero
          const objectName = Object.keys(data.objects)[0];
          const topoFeature = data.objects[objectName];
          
          if (!topoFeature) continue;
          
          // Extraer el ID de subdivisión del nombre del archivo
          const match = file.match(/^([A-Z]{3})\.(\d+)\.topojson$/);
          if (!match) continue;
          
          const [, , subdivId] = match;
          const subdivisionId = `${countryIso3}.${subdivId}`;
          
          // Obtener propiedades
          const props = topoFeature.properties || {};
          const subdivisionName = props.NAME_1 || props.NAME || `${countryIso3} ${subdivId}`;
          const countryName = props.COUNTRY || countryIso3;
          
          // Calcular centroide aproximado desde arcs
          let lat = 0;
          let lon = 0;
          let count = 0;
          
          if (data.arcs && data.arcs.length > 0) {
            for (const arc of data.arcs) {
              for (const point of arc) {
                lon += point[0];
                lat += point[1];
                count++;
              }
            }
            if (count > 0) {
              lat /= count;
              lon /= count;
            }
          }
          
          // Si no hay arcs o el cálculo falló, usar valores por defecto basados en país
          if (count === 0) {
            // Valores aproximados por región
            lat = 40;  // Por defecto Europa
            lon = 0;
          }
          
          await prisma.subdivision.create({
            data: {
              countryIso3,
              countryName,
              subdivisionId,
              subdivisionName,
              level: 1,
              latitude: lat,
              longitude: lon,
              parentId: null
            }
          });
          
          totalSubdivisions++;
        } catch (error) {
          console.error(`    ❌ Error procesando ${file}:`, error);
        }
      }

      console.log(`  ✅ ${countryIso3} completado`);
    }

    console.log(`\n🎉 ¡Completado! Total de subdivisiones: ${totalSubdivisions}`);

    // Mostrar estadísticas
    const stats = await prisma.subdivision.groupBy({
      by: ['countryIso3'],
      _count: { id: true }
    });

    console.log('\n📊 Subdivisiones por país:');
    for (const stat of stats.sort((a, b) => b._count.id - a._count.id).slice(0, 10)) {
      console.log(`  ${stat.countryIso3}: ${stat._count.id}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

populateSubdivisions();
