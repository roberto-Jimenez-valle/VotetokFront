/**
 * Poblar tablas geográficas extrayendo properties de los archivos TopoJSON
 * Lee correctamente NAME_1, NAME_2, TYPE_1, TYPE_2, etc.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import * as topojson from 'topojson-client';

const prisma = new PrismaClient();

/**
 * Calcula centroide de una geometría GeoJSON
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

async function populateFromProperties() {
  console.log('🌍 Poblando tablas desde properties de TopoJSON...\n');

  try {
    // Limpiar tablas
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
          
          // Convertir a GeoJSON para obtener properties
          if (topoData.objects) {
            const objectName = Object.keys(topoData.objects)[0];
            const geoJson = topojson.feature(topoData, topoData.objects[objectName] as any);
            
            if (geoJson.properties) {
              countryName = geoJson.properties.NAME_0 || 
                           geoJson.properties.NAME || 
                           geoJson.properties.ADMIN || 
                           iso3;
            }

            const centroid = calculateCentroid(geoJson.geometry);
            lat = centroid.lat;
            lon = centroid.lon;
          }
        } catch (e) {
          console.error(`  ⚠️  Error leyendo ${iso3}:`, e.message);
        }
      }

      const files = fs.readdirSync(countryPath);
      const hasLevel1 = files.some(f => f.match(/^[A-Z]{3}\.\d+\.topojson$/));
      const hasLevel2 = files.some(f => f.match(/^[A-Z]{3}\.\d+\.\d+\.topojson$/));

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

    // FASE 2: Crear subdivisiones nivel 1
    console.log('🏛️  FASE 2: Creando subdivisiones nivel 1 (con properties)...\n');

    for (const iso3 of countryDirs) {
      const country = await prisma.country.findUnique({ where: { iso3 } });
      if (!country || !country.hasLevel1) continue;

      const countryPath = path.join(geojsonDir, iso3);
      const level1Files = fs.readdirSync(countryPath).filter(f => 
        f.match(/^[A-Z]{3}\.\d+\.topojson$/)
      );

      for (const file of level1Files) {
        try {
          const match = file.match(/^[A-Z]{3}\.(\d+)\.topojson$/);
          if (!match) continue;

          const level1Id = match[1];
          const subdivisionId = `${iso3}.${level1Id}`;
          const filePath = path.join(countryPath, file);
          const topoData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

          // Convertir TopoJSON a GeoJSON para extraer properties
          if (!topoData.objects) continue;
          
          const objectName = Object.keys(topoData.objects)[0];
          const geoJson = topojson.feature(topoData, topoData.objects[objectName] as any);
          const props = geoJson.properties || {};

          // Extraer nombre y tipo
          const name = props.NAME_1 || props.NAME || `${iso3} ${level1Id}`;
          const type = props.TYPE_1 || props.ENGTYPE_1 || null;
          const nameLocal = props.NL_NAME_1 || null;
          const nameVariant = props.VARNAME_1 || null;

          // Calcular centroide
          const centroid = calculateCentroid(geoJson.geometry);

          await prisma.subdivision.create({
            data: {
              countryId: country.id,
              subdivisionId,
              level: 1,
              level1Id,
              name,
              type,
              nameLocal,
              nameVariant,
              latitude: centroid.lat || country.latitude,
              longitude: centroid.lon || country.longitude
            }
          });

          totalLevel1++;
        } catch (e) {
          console.error(`  ⚠️  Error procesando ${file}:`, e.message);
        }
      }

      if (level1Files.length > 0) {
        console.log(`  ✅ ${iso3}: ${level1Files.length} subdivisiones nivel 1`);
      }
    }

    console.log(`\n✅ ${totalLevel1} subdivisiones nivel 1 creadas\n`);

    // FASE 3: Crear subdivisiones nivel 2
    console.log('🏙️  FASE 3: Creando subdivisiones nivel 2 (con properties)...\n');

    for (const iso3 of countryDirs) {
      const country = await prisma.country.findUnique({ where: { iso3 } });
      if (!country || !country.hasLevel2) continue;

      const countryPath = path.join(geojsonDir, iso3);
      const level2Files = fs.readdirSync(countryPath).filter(f => 
        f.match(/^[A-Z]{3}\.\d+\.\d+\.topojson$/)
      );

      for (const file of level2Files) {
        try {
          const match = file.match(/^[A-Z]{3}\.(\d+)\.(\d+)\.topojson$/);
          if (!match) continue;

          const level1Id = match[1];
          const level2Id = match[2];
          const subdivisionId = `${iso3}.${level1Id}.${level2Id}`;
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

          // Convertir TopoJSON a GeoJSON
          if (!topoData.objects) continue;
          
          const objectName = Object.keys(topoData.objects)[0];
          const geoJson = topojson.feature(topoData, topoData.objects[objectName] as any);
          const props = geoJson.properties || {};

          // Extraer nombre y tipo
          const name = props.NAME_2 || props.NAME || `${iso3} ${level1Id}.${level2Id}`;
          const type = props.TYPE_2 || props.ENGTYPE_2 || null;
          const nameLocal = props.NL_NAME_2 || null;
          const nameVariant = props.VARNAME_2 || null;

          // Calcular centroide
          const centroid = calculateCentroid(geoJson.geometry);

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
              latitude: centroid.lat || parent.latitude,
              longitude: centroid.lon || parent.longitude
            }
          });

          totalLevel2++;
        } catch (e) {
          console.error(`  ⚠️  Error procesando ${file}:`, e.message);
        }
      }

      if (level2Files.length > 0) {
        console.log(`  ✅ ${iso3}: ${level2Files.length} subdivisiones nivel 2`);
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

    // Mostrar España como ejemplo
    console.log('🇪🇸 ESPAÑA - Ejemplo detallado:\n');
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
      console.log(`País: ${esp.name}`);
      console.log(`\nComunidades Autónomas (${esp.subdivisions.length}):`);
      esp.subdivisions.forEach(sub => {
        console.log(`  ${sub.subdivisionId}: ${sub.name}${sub.type ? ` (${sub.type})` : ''}`);
      });

      // Mostrar subdivisiones nivel 2 de una comunidad
      const andalucia = esp.subdivisions.find(s => s.subdivisionId === 'ESP.1');
      if (andalucia) {
        const provincias = await prisma.subdivision.findMany({
          where: { parentId: andalucia.id },
          orderBy: { subdivisionId: 'asc' }
        });
        
        if (provincias.length > 0) {
          console.log(`\nProvincias de ${andalucia.name} (${provincias.length}):`);
          provincias.forEach(prov => {
            console.log(`  ${prov.subdivisionId}: ${prov.name}`);
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

populateFromProperties();
