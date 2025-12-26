import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import * as topojson from 'topojson-client';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

const prisma = new PrismaClient();

async function testGeocode() {
  console.log('\n🔍 Testing Geocode System\n');
  
  // Madrid coordinates
  const lat = 40.4168;
  const lon = -3.7038;
  
  console.log('📍 Coordinates:', { lat, lon });
  console.log('\n---\n');
  
  // Test country level first
  const countries = await prisma.$queryRaw<Array<{
    id: number;
    subdivision_id: string;
    name: string;
    latitude: number;
    longitude: number;
    distance: number;
  }>>`
    SELECT 
      id,
      subdivision_id,
      name,
      latitude,
      longitude,
      ((latitude - ${lat}) * (latitude - ${lat}) + 
       (longitude - ${lon}) * (longitude - ${lon})) as distance
    FROM subdivisions
    WHERE level = 1 AND latitude IS NOT NULL AND longitude IS NOT NULL
    ORDER BY distance
    LIMIT 5
  `;
  
  console.log('🌍 Nearest countries (level 1):');
  countries.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name} (${c.subdivision_id}) - Lat: ${c.latitude.toFixed(2)}, Lon: ${c.longitude.toFixed(2)}`);
  });
  
  const centroidCountry = countries[0]?.subdivision_id || 'ESP';
  console.log(`\n⚠️ Centroid detection (corrupted data): ${centroidCountry}`);
  
  // Test world point-in-polygon for country detection
  console.log('\n--- World Point-in-Polygon Test ---\n');
  const worldTopoPath = path.join(process.cwd(), 'static', 'maps', 'countries-110m-iso.json');
  console.log('World TopoJSON path:', worldTopoPath);
  console.log('Exists:', fs.existsSync(worldTopoPath));
  
  const testPoint = point([lon, lat]);
  let detectedCountry = 'ESP';
  
  if (fs.existsSync(worldTopoPath)) {
    const worldData = JSON.parse(fs.readFileSync(worldTopoPath, 'utf-8'));
    // Handle both GeoJSON and TopoJSON formats
    const worldGeoJSON: any = worldData.type === 'FeatureCollection' 
      ? worldData 
      : topojson.feature(worldData, worldData.objects[Object.keys(worldData.objects)[0]]);
    
    for (const feature of worldGeoJSON.features) {
      if (booleanPointInPolygon(testPoint, feature)) {
        const props = feature.properties;
        detectedCountry = props.ISO3_CODE || props.ISO_A3 || props.iso_a3 || props.ADM0_A3 || props.adm0_a3 || 'ESP';
        console.log('✅ Country detected:', detectedCountry, '-', props.NAME_ENGL || props.NAME || props.name);
        break;
      }
    }
  }
  
  // Test point-in-polygon with detected country
  console.log('\n--- Country Subdivision Test ---\n');
  const topoPath = path.join(process.cwd(), 'static', 'geojson', detectedCountry, `${detectedCountry}.topojson`);
  console.log('Country TopoJSON path:', topoPath);
  console.log('Exists:', fs.existsSync(topoPath));
  
  if (fs.existsSync(topoPath)) {
    const topoData = JSON.parse(fs.readFileSync(topoPath, 'utf-8'));
    const geoJSON: any = topojson.feature(topoData, topoData.objects[Object.keys(topoData.objects)[0]]);
    
    console.log(`Testing ${geoJSON.features.length} polygons...`);
    
    let found = false;
    for (const feature of geoJSON.features) {
      if (booleanPointInPolygon(testPoint, feature)) {
        const props = feature.properties;
        const subdivisionId = props.ID_1 || props.id_1;
        console.log('✅ Point inside:', props.name_1 || props.NAME_1, `(ID_1: ${subdivisionId})`);
        
        // Check level 2 first
        let sub = await prisma.subdivision.findFirst({
          where: { subdivisionId, level: 2 }
        });
        
        if (sub) {
          console.log('✅ Level 2 found:', `ID=${sub.id}, Name="${sub.name}"`);
        } else {
          console.log('⚠️ Level 2 not found, trying level 3...');
          sub = await prisma.subdivision.findFirst({
            where: { 
              subdivisionId: { startsWith: subdivisionId + '.' },
              level: 3 
            }
          });
          if (sub) {
            console.log('✅ Level 3 found:', `ID=${sub.id}, Name="${sub.name}", SubdivisionId="${sub.subdivisionId}"`);
          } else {
            console.log('❌ No subdivision found in DB for', subdivisionId);
          }
        }
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log('❌ Point not inside any polygon!');
    }
  }
  
  console.log('\n---\n');
  
  // Test nivel 2 (comunidades)
  const level2 = await prisma.$queryRaw<Array<{
    id: number;
    subdivision_id: string;
    name: string;
    level: number;
    latitude: number;
    longitude: number;
    distance: number;
  }>>`
    SELECT 
      id,
      subdivision_id,
      name,
      level,
      latitude,
      longitude,
      ((latitude - ${lat}) * (latitude - ${lat}) + 
       (longitude - ${lon}) * (longitude - ${lon})) as distance
    FROM subdivisions
    WHERE level = 2 AND subdivision_id LIKE 'ESP.%' AND latitude IS NOT NULL AND longitude IS NOT NULL
    ORDER BY distance
    LIMIT 5
  `;
  
  console.log('📊 Nivel 2 (Comunidades) - Top 5 más cercanas:');
  if (level2.length === 0) {
    console.log('❌ NO HAY SUBDIVISIONES NIVEL 2 PARA ESPAÑA');
  } else {
    level2.forEach((sub, i) => {
      const dist = Math.sqrt(sub.distance);
      console.log(`  ${i + 1}. ${sub.name} (${sub.subdivision_id}) - Lat: ${sub.latitude}, Lon: ${sub.longitude} - Distancia: ${dist.toFixed(4)}°`);
    });
    console.log(`\n✅ Más cercana: ID=${level2[0].id}, Nombre="${level2[0].name}"`);
  }
  
  console.log('\n---\n');
  
  // Contar subdivisiones por nivel
  const counts = await prisma.$queryRaw<Array<{ level: number; count: bigint }>>`
    SELECT level, COUNT(*) as count
    FROM subdivisions
    WHERE subdivision_id LIKE 'ESP.%'
    GROUP BY level
    ORDER BY level
  `;
  
  console.log('📈 Subdivisiones de España por nivel:');
  counts.forEach(c => {
    console.log(`  Nivel ${c.level}: ${c.count} subdivisiones`);
  });
  
  await prisma.$disconnect();
}

testGeocode().catch(console.error);
