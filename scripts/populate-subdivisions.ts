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
  console.log('🌍 Poblando tabla de subdivisiones (upsert)...\n');

  try {
    // NO eliminar - usar upsert para preservar referencias de votos
    console.log('ℹ️  Usando upsert para preservar datos existentes\n');

    const geojsonDir = path.join(process.cwd(), 'static', 'geojson');
    const countries = fs.readdirSync(geojsonDir);

    let totalSubdivisions = 0;

    for (const countryIso3 of countries) {
      const countryPath = path.join(geojsonDir, countryIso3);
      
      if (!fs.statSync(countryPath).isDirectory()) continue;

      console.log(`📍 Procesando ${countryIso3}...`);

      // NIVEL 1: Agregar el país principal
      const countryFile = path.join(countryPath, `${countryIso3}.topojson`);
      if (fs.existsSync(countryFile)) {
        try {
          const countryData = JSON.parse(fs.readFileSync(countryFile, 'utf-8'));
          const objectName = Object.keys(countryData.objects)[0];
          const topoFeature = countryData.objects[objectName];
          
          // Obtener nombre del país desde las geometrías
          let countryName = countryIso3;
          if (topoFeature?.geometries?.[0]?.properties) {
            const props = topoFeature.geometries[0].properties;
            countryName = props.CountryNew || props.country || props.COUNTRY || props.name_0 || props.NAME_0 || countryIso3;
          }
          
          // Calcular centroide
          let lat = 0, lon = 0, count = 0;
          if (countryData.arcs?.length > 0) {
            for (const arc of countryData.arcs) {
              for (const point of arc) {
                lon += point[0]; lat += point[1]; count++;
              }
            }
            if (count > 0) { lat /= count; lon /= count; }
          }
          
          await prisma.subdivision.upsert({
            where: { subdivisionId: countryIso3 },
            update: { name: countryName, level: 1, latitude: lat || 0, longitude: lon || 0 },
            create: { subdivisionId: countryIso3, name: countryName, level: 1, latitude: lat || 0, longitude: lon || 0 }
          });
          totalSubdivisions++;
        } catch (e) {
          console.error(`    ❌ Error procesando país ${countryIso3}:`, e);
        }
      }

      // Buscar archivos nivel 2: subdivisiones principales (ej: ESP.1, ESP.13)
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
          const level2Id = `${countryIso3}.${subdivId}`;
          
          // Calcular centroide aproximado desde arcs para nivel 2
          let lat = 0, lon = 0, count = 0;
          if (data.arcs && data.arcs.length > 0) {
            for (const arc of data.arcs) {
              for (const point of arc) {
                lon += point[0];
                lat += point[1];
                count++;
              }
            }
            if (count > 0) { lat /= count; lon /= count; }
          }
          if (count === 0) { lat = 40; lon = 0; }
          
          // Si es un GeometryCollection, procesar cada geometría (nivel 3: provincias)
          if (topoFeature.type === 'GeometryCollection' && topoFeature.geometries?.length > 0) {
            // Crear entrada nivel 2 (comunidad/estado)
            const firstGeom = topoFeature.geometries[0];
            const level2Name = firstGeom.properties?.name_1 || firstGeom.properties?.NAME_1 || 
                               firstGeom.properties?.name || `${countryIso3} ${subdivId}`;
            
            await prisma.subdivision.upsert({
              where: { subdivisionId: level2Id },
              update: { name: level2Name, level: 2, latitude: lat, longitude: lon },
              create: { subdivisionId: level2Id, name: level2Name, level: 2, latitude: lat, longitude: lon }
            });
            totalSubdivisions++;
            
            // Procesar cada geometría como nivel 3 (provincia/ciudad)
            for (const geom of topoFeature.geometries) {
              const props = geom.properties || {};
              const level3Name = props.name_2 || props.NAME_2 || props.Name_2 ||
                                 props.name || props.NAME || null;
              const level3Id = props.ID_2 || props.id_2 || props.GID_2 || null;
              
              if (level3Name && level3Id) {
                await prisma.subdivision.upsert({
                  where: { subdivisionId: level3Id },
                  update: { name: level3Name, level: 3, latitude: lat, longitude: lon },
                  create: { subdivisionId: level3Id, name: level3Name, level: 3, latitude: lat, longitude: lon }
                });
                totalSubdivisions++;
              }
            }
          } else {
            // No es GeometryCollection, crear solo nivel 2
            const props = topoFeature.properties || {};
            const subdivisionName = props.name_1 || props.NAME_1 || props.name || `${countryIso3} ${subdivId}`;
            
            await prisma.subdivision.upsert({
              where: { subdivisionId: level2Id },
              update: { name: subdivisionName, level: 2, latitude: lat, longitude: lon },
              create: { subdivisionId: level2Id, name: subdivisionName, level: 2, latitude: lat, longitude: lon }
            });
            totalSubdivisions++;
          }
        } catch (error) {
          console.error(`    ❌ Error procesando ${file}:`, error);
        }
      }

      console.log(`  ✅ ${countryIso3} completado`);
    }

    console.log(`\n🎉 ¡Completado! Total de subdivisiones: ${totalSubdivisions}`);

    // Mostrar estadísticas
    const totalCount = await prisma.subdivision.count();
    console.log(`\n📊 Total de subdivisiones en base de datos: ${totalCount}`);

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

populateSubdivisions();
