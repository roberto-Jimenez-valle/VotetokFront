/**
 * Extrae información detallada de subdivisiones desde TopoJSON
 * y crea una tabla maestra completa
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import * as topojson from 'topojson-client';

const prisma = new PrismaClient();

interface SubdivisionData {
  countryIso3: string;
  countryName: string;
  subdivisionId: string;
  subdivisionName: string;
  level: number;
  latitude: float;
  longitude: float;
  parentId: string | null;
  properties: any; // Todas las propiedades originales
}

/**
 * Calcula el centroide de un GeoJSON geometry
 */
function calculateCentroid(geometry: any): { lat: number; lon: number } {
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
    lat: pointCount > 0 ? totalLat / pointCount : 0,
    lon: pointCount > 0 ? totalLon / pointCount : 0
  };
}

async function extractSubdivisionData() {
  console.log('🌍 Extrayendo datos detallados de subdivisiones...\n');

  try {
    // Limpiar tabla existente
    await prisma.subdivision.deleteMany({});
    console.log('✅ Tabla limpiada\n');

    const geojsonDir = path.join(process.cwd(), 'static', 'geojson');
    const countries = fs.readdirSync(geojsonDir).filter(f => 
      fs.statSync(path.join(geojsonDir, f)).isDirectory()
    );

    let totalSubdivisions = 0;
    let totalWithProperties = 0;

    // Procesar países prioritarios primero (para testing)
    const priorityCountries = ['ESP', 'USA', 'FRA', 'DEU', 'GBR', 'ITA', 'MEX'];
    const otherCountries = countries.filter(c => !priorityCountries.includes(c));
    const allCountries = [...priorityCountries, ...otherCountries];

    for (const countryIso3 of allCountries) {
      const countryPath = path.join(geojsonDir, countryIso3);
      
      if (!fs.statSync(countryPath).isDirectory()) continue;

      console.log(`📍 Procesando ${countryIso3}...`);

      // Buscar archivo principal del país (ESP.topojson)
      const countryFile = path.join(countryPath, `${countryIso3}.topojson`);
      let countryName = countryIso3;

      if (fs.existsSync(countryFile)) {
        try {
          const countryData = JSON.parse(fs.readFileSync(countryFile, 'utf-8'));
          const objectName = Object.keys(countryData.objects)[0];
          const countryProps = countryData.objects[objectName]?.properties;
          countryName = countryProps?.NAME_0 || countryProps?.COUNTRY || countryProps?.name || countryIso3;
        } catch (e) {
          // Ignorar errores, usar ISO3 como nombre
        }
      }

      // Procesar subdivisiones (ESP.1.topojson, ESP.13.topojson, etc.)
      const subdivFiles = fs.readdirSync(countryPath).filter(f => 
        f.endsWith('.topojson') && f.match(/^[A-Z]{3}\.\d+\.topojson$/)
      );

      for (const file of subdivFiles) {
        try {
          const filePath = path.join(countryPath, file);
          const topoData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

          // Convertir TopoJSON a GeoJSON
          const objectName = Object.keys(topoData.objects)[0];
          const geoJson = topojson.feature(topoData, topoData.objects[objectName] as any);

          // Extraer ID de subdivisión del nombre del archivo
          const match = file.match(/^([A-Z]{3})\.(\d+)\.topojson$/);
          if (!match) continue;

          const [, , subdivId] = match;
          const subdivisionId = `${countryIso3}.${subdivId}`;

          // Obtener propiedades
          const properties = geoJson.properties || {};
          const subdivisionName = properties.NAME_1 || 
                                  properties.NAME || 
                                  properties.name ||
                                  `${countryIso3} ${subdivId}`;

          // Calcular centroide
          const centroid = calculateCentroid(geoJson.geometry);

          // Guardar en BD
          await prisma.subdivision.create({
            data: {
              countryIso3,
              countryName,
              subdivisionId,
              subdivisionName,
              level: 1,
              latitude: centroid.lat,
              longitude: centroid.lon,
              parentId: null
            }
          });

          totalSubdivisions++;
          if (Object.keys(properties).length > 0) {
            totalWithProperties++;
          }

        } catch (error) {
          console.error(`    ❌ Error procesando ${file}:`, error.message);
        }
      }

      console.log(`  ✅ ${countryIso3} completado - ${subdivFiles.length} subdivisiones`);
    }

    console.log(`\n🎉 ¡Completado!`);
    console.log(`   Total de subdivisiones: ${totalSubdivisions}`);
    console.log(`   Con propiedades: ${totalWithProperties}`);

    // Estadísticas
    const stats = await prisma.subdivision.groupBy({
      by: ['countryIso3'],
      _count: { id: true }
    });

    console.log('\n📊 Top 15 países por subdivisiones:');
    stats
      .sort((a, b) => b._count.id - a._count.id)
      .slice(0, 15)
      .forEach(stat => {
        console.log(`  ${stat.countryIso3}: ${stat._count.id}`);
      });

    // Verificar España específicamente
    const espSubdivisions = await prisma.subdivision.findMany({
      where: { countryIso3: 'ESP' },
      orderBy: { subdivisionId: 'asc' }
    });

    console.log(`\n🇪🇸 Subdivisiones de España (${espSubdivisions.length}):`);
    espSubdivisions.forEach(sub => {
      console.log(`  ${sub.subdivisionId}: ${sub.subdivisionName} (${sub.latitude.toFixed(2)}, ${sub.longitude.toFixed(2)})`);
    });

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

extractSubdivisionData();
