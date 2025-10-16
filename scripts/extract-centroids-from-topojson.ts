import { PrismaClient } from '@prisma/client';
import fs from 'fs';
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

async function extractCentroids() {
  console.log('\n🗺️  Extrayendo centroides desde TopoJSON...\n');

  // Leer ESP.topojson (nivel 2 - comunidades autónomas)
  const topoPath = 'static/geojson/ESP/ESP.topojson';
  const topoData = JSON.parse(fs.readFileSync(topoPath, 'utf-8'));
  
  // Convertir TopoJSON a GeoJSON
  const geoJSON: any = topojson.feature(topoData, topoData.objects[Object.keys(topoData.objects)[0]]);

  console.log(`📂 Procesando ${geoJSON.features.length} comunidades autónomas...\n`);

  // Debug: mostrar propiedades del primer feature
  if (geoJSON.features.length > 0) {
    console.log('🔍 Propiedades del primer feature:', JSON.stringify(geoJSON.features[0].properties, null, 2));
    console.log('');
  }

  let updated = 0;

  for (const feature of geoJSON.features) {
    const props = feature.properties;
    
    // Obtener ID de la comunidad (ID_1 ya tiene formato "ESP.1")
    const subdivisionId = props.ID_1 || props.id_1 || props.GID_1 || props.gid_1;
    if (!subdivisionId) continue;
    
    const name = props.NAME_1 || props.name_1 || 'Desconocido';

    // Calcular centroide según tipo de geometría
    let centroid: { lat: number; lon: number };
    
    if (feature.geometry.type === 'Polygon') {
      centroid = calculatePolygonCentroid(feature.geometry.coordinates);
    } else if (feature.geometry.type === 'MultiPolygon') {
      centroid = calculateMultiPolygonCentroid(feature.geometry.coordinates);
    } else {
      console.log(`  ⚠️  Tipo de geometría desconocido: ${feature.geometry.type}`);
      continue;
    }

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

      console.log(`  ✅ ${name.padEnd(25)} (${subdivisionId}): lat ${centroid.lat.toFixed(4)}, lon ${centroid.lon.toFixed(4)}`);
      updated++;
    } else {
      console.log(`  ⚠️  No encontrado en BD: ${subdivisionId} (${name})`);
    }
  }

  console.log(`\n✅ Actualizadas ${updated} comunidades autónomas con centroides reales\n`);
  await prisma.$disconnect();
}

extractCentroids().catch(console.error);
