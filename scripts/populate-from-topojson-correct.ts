/**
 * Poblar tablas geográficas leyendo correctamente los TopoJSON
 * - ESP.topojson = Comunidades Autónomas (nivel 1)
 * - ESP.1.topojson = Provincias de Andalucía (nivel 2)
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import * as topojson from 'topojson-client';

const prisma = new PrismaClient();

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

async function populateCorrect() {
  console.log('🌍 Poblando tablas desde TopoJSON (estructura correcta)...\n');

  try {
    console.log('🧹 Limpiando tablas...');
    await prisma.subdivision.deleteMany({});
    await prisma.country.deleteMany({});
    console.log('✅ Tablas limpiadas\n');

    const geojsonDir = path.join(process.cwd(), 'static', 'geojson');
    const countryDirs = fs.readdirSync(geojsonDir).filter(f => 
      fs.statSync(path.join(geojsonDir, f)).isDirectory()
    );

    let totalCountries = 0;
    let totalLevel1 = 0;
    let totalLevel2 = 0;

    // FASE 1: Crear países
    console.log('🏳️  FASE 1: Creando países...\n');

    for (const iso3 of countryDirs) {
      const countryPath = path.join(geojsonDir, iso3);
      const countryFile = path.join(countryPath, `${iso3}.topojson`);

      let countryName = iso3;
      let lat = 0;
      let lon = 0;

      if (fs.existsSync(countryFile)) {
        try {
          const topoData = JSON.parse(fs.readFileSync(countryFile, 'utf-8'));
          
          if (topoData.objects) {
            const objectName = Object.keys(topoData.objects)[0];
            const topoObject = topoData.objects[objectName];
            
            // Convertir primer geometry para sacar centroide general
            if (topoObject.geometries && topoObject.geometries.length > 0) {
              const firstFeature = topojson.feature(topoData, {
                type: 'GeometryCollection',
                geometries: [topoObject.geometries[0]]
              } as any);
              
              if (firstFeature.features && firstFeature.features.length > 0) {
                const props = firstFeature.features[0].properties;
                countryName = props?.NAME_0 || props?.name || props?.CountryNew || iso3;
                
                const centroid = calculateCentroid(firstFeature.features[0].geometry);
                lat = centroid.lat;
                lon = centroid.lon;
              }
            }
          }
        } catch (e) {
          // Ignorar errores
        }
      }

      const files = fs.readdirSync(countryPath);
      const hasLevel1 = fs.existsSync(countryFile);  // Si existe el archivo principal
      const hasLevel2 = files.some(f => f.match(/^[A-Z]{3}\.\d+\.topojson$/));

      await prisma.country.create({
        data: {
          iso3,
          name: countryName,
          latitude: lat || 0,
          longitude: lon || 0,
          hasLevel1,
          hasLevel2
        }
      });

      totalCountries++;
      if (totalCountries % 50 === 0) {
        console.log(`  ✅ ${totalCountries} países procesados...`);
      }
    }

    console.log(`\n✅ ${totalCountries} países creados\n`);

    // FASE 2: Crear subdivisiones nivel 1 desde archivos principales
    console.log('🏛️  FASE 2: Creando subdivisiones nivel 1...\n');

    for (const iso3 of countryDirs) {
      const country = await prisma.country.findUnique({ where: { iso3 } });
      if (!country) continue;

      const countryPath = path.join(geojsonDir, iso3);
      const countryFile = path.join(countryPath, `${iso3}.topojson`);

      if (!fs.existsSync(countryFile)) continue;

      try {
        const topoData = JSON.parse(fs.readFileSync(countryFile, 'utf-8'));
        
        if (!topoData.objects) continue;
        
        const objectName = Object.keys(topoData.objects)[0];
        const topoObject = topoData.objects[objectName];
        
        if (!topoObject.geometries) continue;

        // Cada geometry es una subdivisión nivel 1
        for (const geometry of topoObject.geometries) {
          try {
            const props = geometry.properties;
            if (!props || !props.ID_1) continue;

            const subdivisionId = props.ID_1;
            const name = props.name_1 || props.NAME_1 || props.name || subdivisionId;
            const type = props.type_1 || props.TYPE_1 || props.engtype_1 || null;
            const nameLocal = props.nl_name_1 || null;
            
            // Convertir geometry para calcular centroide
            const geoJson = topojson.feature(topoData, {
              type: 'GeometryCollection',
              geometries: [geometry]
            } as any);

            let lat = country.latitude;
            let lon = country.longitude;
            
            if (geoJson.features && geoJson.features.length > 0) {
              const centroid = calculateCentroid(geoJson.features[0].geometry);
              if (centroid.lat !== 0 && centroid.lon !== 0) {
                lat = centroid.lat;
                lon = centroid.lon;
              }
            }

            // Extraer level1Id del subdivisionId (ej: ESP.13 -> 13)
            const level1Id = subdivisionId.split('.')[1];

            await prisma.subdivision.create({
              data: {
                countryId: country.id,
                subdivisionId,
                level: 1,
                level1Id,
                name,
                type,
                nameLocal,
                latitude: lat,
                longitude: lon
              }
            });

            totalLevel1++;
          } catch (e) {
            console.error(`  ⚠️  Error procesando geometry en ${iso3}:`, e.message);
          }
        }

        console.log(`  ✅ ${iso3}: ${topoObject.geometries.length} subdivisiones nivel 1`);
      } catch (e) {
        console.error(`  ⚠️  Error procesando ${iso3}.topojson:`, e.message);
      }
    }

    console.log(`\n✅ ${totalLevel1} subdivisiones nivel 1 creadas\n`);

    // FASE 3: Crear subdivisiones nivel 2 desde archivos ESP.1.topojson, etc.
    console.log('🏙️  FASE 3: Creando subdivisiones nivel 2...\n');

    for (const iso3 of countryDirs) {
      const country = await prisma.country.findUnique({ where: { iso3 } });
      if (!country) continue;

      const countryPath = path.join(geojsonDir, iso3);
      const level2Files = fs.readdirSync(countryPath).filter(f => 
        f.match(/^[A-Z]{3}\.\d+\.topojson$/)
      );

      for (const file of level2Files) {
        try {
          const match = file.match(/^[A-Z]{3}\.(\d+)\.topojson$/);
          if (!match) continue;

          const level1Id = match[1];
          const parentSubdivisionId = `${iso3}.${level1Id}`;

          // Buscar padre
          const parent = await prisma.subdivision.findUnique({
            where: { subdivisionId: parentSubdivisionId }
          });

          if (!parent) {
            console.error(`  ⚠️  Padre no encontrado: ${parentSubdivisionId}`);
            continue;
          }

          const filePath = path.join(countryPath, file);
          const topoData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

          if (!topoData.objects) continue;

          const objectName = Object.keys(topoData.objects)[0];
          const topoObject = topoData.objects[objectName];

          if (!topoObject.geometries) continue;

          // Cada geometry es una provincia/condado (nivel 2)
          for (const geometry of topoObject.geometries) {
            try {
              const props = geometry.properties;
              if (!props || !props.ID_2) continue;

              const subdivisionId = props.ID_2;
              const name = props.name_2 || props.NAME_2 || props.name || subdivisionId;
              const type = props.type_2 || props.TYPE_2 || props.engtype_2 || null;
              const nameLocal = props.nl_name_2 || null;
              const nameVariant = props.varname_2 || null;

              // Convertir geometry para calcular centroide
              const geoJson = topojson.feature(topoData, {
                type: 'GeometryCollection',
                geometries: [geometry]
              } as any);

              let lat = parent.latitude;
              let lon = parent.longitude;

              if (geoJson.features && geoJson.features.length > 0) {
                const centroid = calculateCentroid(geoJson.features[0].geometry);
                if (centroid.lat !== 0 && centroid.lon !== 0) {
                  lat = centroid.lat;
                  lon = centroid.lon;
                }
              }

              // Extraer level2Id (ej: ESP.1.2 -> 2)
              const parts = subdivisionId.split('.');
              const level2Id = parts[2];

              await prisma.subdivision.create({
                data: {
                  countryId: country.id,
                  subdivisionId,
                  level: 2,
                  parentId: parent.id,
                  level1Id,
                  level2Id,
                  name,
                  type,
                  nameLocal,
                  nameVariant,
                  latitude: lat,
                  longitude: lon
                }
              });

              totalLevel2++;
            } catch (e) {
              console.error(`  ⚠️  Error procesando geometry en ${file}:`, e.message);
            }
          }

          console.log(`  ✅ ${file}: ${topoObject.geometries.length} provincias`);
        } catch (e) {
          console.error(`  ⚠️  Error procesando ${file}:`, e.message);
        }
      }
    }

    console.log(`\n✅ ${totalLevel2} subdivisiones nivel 2 creadas\n`);

    // RESUMEN
    console.log('═'.repeat(60));
    console.log('📊 RESUMEN FINAL');
    console.log('═'.repeat(60));
    console.log(`🏳️  Países: ${totalCountries}`);
    console.log(`🏛️  Subdivisiones nivel 1: ${totalLevel1}`);
    console.log(`🏙️  Subdivisiones nivel 2: ${totalLevel2}`);
    console.log(`📍 Total: ${totalCountries + totalLevel1 + totalLevel2}\n`);

    // Ejemplo España
    console.log('🇪🇸 ESPAÑA - Estructura completa:\n');
    const esp = await prisma.country.findUnique({
      where: { iso3: 'ESP' },
      include: {
        subdivisions: {
          where: { level: 1 },
          orderBy: { subdivisionId: 'asc' }
        }
      }
    });

    if (esp) {
      console.log(`País: ${esp.name}\n`);
      console.log(`Comunidades Autónomas (${esp.subdivisions.length}):`);
      
      for (const comunidad of esp.subdivisions) {
        console.log(`\n  ${comunidad.subdivisionId}: ${comunidad.name} (${comunidad.type || 'N/A'})`);
        
        // Mostrar provincias de esta comunidad
        const provincias = await prisma.subdivision.findMany({
          where: { parentId: comunidad.id },
          orderBy: { subdivisionId: 'asc' }
        });

        if (provincias.length > 0) {
          provincias.forEach(prov => {
            console.log(`     └─ ${prov.subdivisionId}: ${prov.name}`);
          });
        }
      }
    }

    console.log('\n✅ ¡Completado!');

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

populateCorrect();
