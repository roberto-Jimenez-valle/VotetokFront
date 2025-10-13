/**
 * Poblar tablas maestras geográficas con 3 niveles
 * - Países
 * - Subdivisiones nivel 1 (Comunidades, Estados)
 * - Subdivisiones nivel 2 (Provincias, Condados)
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

/**
 * Calcula centroide aproximado desde arcs de TopoJSON
 */
function calculateCentroidFromArcs(arcs: any[]): { lat: number; lon: number } {
  let totalLat = 0;
  let totalLon = 0;
  let count = 0;

  for (const arc of arcs) {
    for (const point of arc) {
      if (Array.isArray(point) && point.length >= 2) {
        totalLon += point[0];
        totalLat += point[1];
        count++;
      }
    }
  }

  return {
    lat: count > 0 ? totalLat / count : 0,
    lon: count > 0 ? totalLon / count : 0
  };
}

async function populateGeographicTables() {
  console.log('🌍 Poblando tablas maestras geográficas...\n');

  try {
    // Limpiar tablas existentes
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

    console.log(`📂 Encontrados ${countryDirs.length} países\n`);

    // FASE 1: Crear registros de países
    console.log('🏳️  FASE 1: Creando países...\n');

    for (const iso3 of countryDirs) {
      const countryPath = path.join(geojsonDir, iso3);
      const countryFile = path.join(countryPath, `${iso3}.topojson`);

      let countryName = iso3;
      let lat = 0;
      let lon = 0;
      let hasLevel1 = false;
      let hasLevel2 = false;

      // Leer archivo principal del país
      if (fs.existsSync(countryFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(countryFile, 'utf-8'));
          
          // Extraer nombre del país
          if (data.objects) {
            const objName = Object.keys(data.objects)[0];
            const props = data.objects[objName]?.properties;
            if (props) {
              countryName = props.NAME_0 || props.NAME || props.COUNTRY || props.name || iso3;
            }
          }

          // Calcular centroide
          if (data.arcs && data.arcs.length > 0) {
            const centroid = calculateCentroidFromArcs(data.arcs.slice(0, 100)); // Primeros 100 arcs
            lat = centroid.lat;
            lon = centroid.lon;
          }
        } catch (e) {
          console.error(`  ⚠️  Error leyendo ${iso3}.topojson:`, e.message);
        }
      }

      // Verificar si tiene subdivisiones
      const files = fs.readdirSync(countryPath);
      hasLevel1 = files.some(f => f.match(/^[A-Z]{3}\.\d+\.topojson$/));
      hasLevel2 = files.some(f => f.match(/^[A-Z]{3}\.\d+\.\d+\.topojson$/));

      // Crear país
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
    console.log('🏛️  FASE 2: Creando subdivisiones nivel 1...\n');

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

          const data = JSON.parse(fs.readFileSync(path.join(countryPath, file), 'utf-8'));
          
          // Extraer nombre
          let name = `${iso3} ${level1Id}`;
          let type = null;
          if (data.objects) {
            const objName = Object.keys(data.objects)[0];
            const props = data.objects[objName]?.properties;
            if (props) {
              name = props.NAME_1 || props.NAME || props.name || name;
              type = props.TYPE_1 || props.ENGTYPE_1 || null;
            }
          }

          // Calcular centroide
          let lat = country.latitude;
          let lon = country.longitude;
          if (data.arcs && data.arcs.length > 0) {
            const centroid = calculateCentroidFromArcs(data.arcs.slice(0, 50));
            if (centroid.lat !== 0 && centroid.lon !== 0) {
              lat = centroid.lat;
              lon = centroid.lon;
            }
          }

          await prisma.subdivision.create({
            data: {
              countryId: country.id,
              subdivisionId,
              level: 1,
              level1Id,
              name,
              type,
              latitude: lat,
              longitude: lon
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
    console.log('🏙️  FASE 3: Creando subdivisiones nivel 2...\n');

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
            console.error(`  ⚠️  Padre no encontrado para ${subdivisionId}`);
            continue;
          }

          const data = JSON.parse(fs.readFileSync(path.join(countryPath, file), 'utf-8'));
          
          // Extraer nombre
          let name = `${iso3} ${level1Id}.${level2Id}`;
          let type = null;
          if (data.objects) {
            const objName = Object.keys(data.objects)[0];
            const props = data.objects[objName]?.properties;
            if (props) {
              name = props.NAME_2 || props.NAME || props.name || name;
              type = props.TYPE_2 || props.ENGTYPE_2 || null;
            }
          }

          // Calcular centroide
          let lat = parent.latitude;
          let lon = parent.longitude;
          if (data.arcs && data.arcs.length > 0) {
            const centroid = calculateCentroidFromArcs(data.arcs.slice(0, 30));
            if (centroid.lat !== 0 && centroid.lon !== 0) {
              lat = centroid.lat;
              lon = centroid.lon;
            }
          }

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
              latitude: lat,
              longitude: lon
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

    // RESUMEN FINAL
    console.log('═'.repeat(60));
    console.log('📊 RESUMEN FINAL');
    console.log('═'.repeat(60));
    console.log(`🏳️  Países: ${totalCountries}`);
    console.log(`🏛️  Subdivisiones nivel 1: ${totalLevel1}`);
    console.log(`🏙️  Subdivisiones nivel 2: ${totalLevel2}`);
    console.log(`📍 Total de registros geográficos: ${totalCountries + totalLevel1 + totalLevel2}`);

    // Ejemplo de España
    console.log('\n🇪🇸 Ejemplo: España');
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
      console.log(`   País: ${esp.name}`);
      console.log(`   Subdivisiones nivel 1: ${esp.subdivisions.length}`);
      esp.subdivisions.slice(0, 5).forEach(sub => {
        console.log(`     - ${sub.subdivisionId}: ${sub.name} (${sub.type || 'N/A'})`);
      });
      if (esp.subdivisions.length > 5) {
        console.log(`     ... y ${esp.subdivisions.length - 5} más`);
      }
    }

    console.log('\n✅ ¡Completado!');

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

populateGeographicTables();
