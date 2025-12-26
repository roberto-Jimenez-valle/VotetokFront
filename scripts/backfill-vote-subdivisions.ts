import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import * as topojson from 'topojson-client';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

const prisma = new PrismaClient();

// Cache para TopoJSON cargados
const topoCache: Map<string, any> = new Map();
const worldGeoJSON: any = loadWorldGeoJSON();

function loadWorldGeoJSON() {
  const worldPath = path.join(process.cwd(), 'static', 'maps', 'countries-110m-iso.json');
  if (fs.existsSync(worldPath)) {
    const data = JSON.parse(fs.readFileSync(worldPath, 'utf-8'));
    return data.type === 'FeatureCollection' ? data : null;
  }
  return null;
}

function getCountryTopoJSON(countryCode: string): any {
  if (topoCache.has(countryCode)) {
    return topoCache.get(countryCode);
  }
  
  const topoPath = path.join(process.cwd(), 'static', 'geojson', countryCode, `${countryCode}.topojson`);
  if (fs.existsSync(topoPath)) {
    const topoData = JSON.parse(fs.readFileSync(topoPath, 'utf-8'));
    const geoJSON = topojson.feature(topoData, topoData.objects[Object.keys(topoData.objects)[0]]);
    topoCache.set(countryCode, geoJSON);
    return geoJSON;
  }
  
  return null;
}

let debugMode = true;

async function findSubdivisionForCoords(lat: number, lon: number): Promise<number | null> {
  const testPoint = point([lon, lat]);
  
  // Paso 1: Detectar país con point-in-polygon
  let countryCode: string | null = null;
  
  if (!worldGeoJSON) {
    if (debugMode) console.log('  ❌ worldGeoJSON no cargado');
    return null;
  }
  
  for (const feature of worldGeoJSON.features) {
    if (booleanPointInPolygon(testPoint, feature)) {
      const props = feature.properties;
      countryCode = props.ISO3_CODE || props.ISO_A3 || props.iso_a3 || props.ADM0_A3 || props.adm0_a3 || props.ISO_A3_EH;
      if (debugMode) console.log(`  🌍 País detectado: ${countryCode}`);
      break;
    }
  }
  
  if (!countryCode) {
    if (debugMode) console.log('  ❌ No se encontró país');
    return null;
  }
  
  // Paso 2: Buscar subdivisión en el país
  const countryGeoJSON = getCountryTopoJSON(countryCode);
  if (!countryGeoJSON) {
    if (debugMode) console.log(`  ❌ No se encontró TopoJSON para ${countryCode}`);
    return null;
  }
  
  if (debugMode) console.log(`  📂 Probando ${countryGeoJSON.features.length} polígonos de ${countryCode}...`);
  
  for (const feature of countryGeoJSON.features) {
    if (booleanPointInPolygon(testPoint, feature)) {
      const props = feature.properties;
      const subdivisionId = props.ID_1 || props.id_1;
      
      if (debugMode) console.log(`  🎯 Punto dentro de: ${props.name_1 || props.NAME_1} (${subdivisionId})`);
      
      if (subdivisionId) {
        // Buscar nivel 2
        let subdivision = await prisma.subdivision.findFirst({
          where: { subdivisionId, level: 2 }
        });
        
        // Fallback a nivel 3
        if (!subdivision) {
          if (debugMode) console.log(`  ⚠️ Nivel 2 no encontrado, buscando nivel 3...`);
          subdivision = await prisma.subdivision.findFirst({
            where: { 
              subdivisionId: { startsWith: subdivisionId + '.' },
              level: 3 
            }
          });
        }
        
        // Fallback a cualquier nivel
        if (!subdivision) {
          subdivision = await prisma.subdivision.findFirst({
            where: { subdivisionId }
          });
        }
        
        if (subdivision) {
          if (debugMode) console.log(`  ✅ Encontrado: ID=${subdivision.id}, ${subdivision.name}`);
        } else {
          if (debugMode) console.log(`  ❌ No se encontró subdivisión en DB para ${subdivisionId}`);
        }
        
        return subdivision?.id || null;
      }
    }
  }
  
  if (debugMode) console.log(`  ❌ Punto no está dentro de ningún polígono de ${countryCode}`);
  return null;
}

async function backfillVotes() {
  console.log('\n🔄 Backfill de votos sin subdivisionId\n');
  
  // Obtener votos sin subdivisionId pero con coordenadas
  const votesWithoutSubdiv = await prisma.vote.findMany({
    where: { 
      subdivisionId: null,
      NOT: [
        { latitude: 0 },
        { longitude: 0 }
      ]
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      pollId: true
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`📊 Votos sin subdivisión: ${votesWithoutSubdiv.length}`);
  
  // Mostrar muestra de votos para debug
  console.log('\n📍 Muestra de votos a procesar:');
  votesWithoutSubdiv.slice(0, 5).forEach(v => {
    console.log(`  Vote ${v.id}: lat=${v.latitude}, lon=${v.longitude}, pollId=${v.pollId}`);
  });
  
  if (votesWithoutSubdiv.length === 0) {
    console.log('✅ No hay votos que actualizar');
    await prisma.$disconnect();
    return;
  }
  
  let updated = 0;
  let failed = 0;
  const failedCoords: Array<{lat: number, lon: number}> = [];
  const pollsAffected = new Set<number>();
  
  // Solo debug el primer voto
  debugMode = true;
  
  for (let i = 0; i < votesWithoutSubdiv.length; i++) {
    const vote = votesWithoutSubdiv[i];
    if (i === 1) debugMode = false; // Solo debug el primero
    
    const subdivisionId = await findSubdivisionForCoords(vote.latitude, vote.longitude);
    
    if (subdivisionId) {
      await prisma.vote.update({
        where: { id: vote.id },
        data: { subdivisionId }
      });
      updated++;
      pollsAffected.add(vote.pollId);
      
      if (updated % 100 === 0) {
        console.log(`  ✅ Actualizados: ${updated}/${votesWithoutSubdiv.length}`);
      }
    } else {
      failed++;
      if (failedCoords.length < 5) {
        failedCoords.push({ lat: vote.latitude, lon: vote.longitude });
      }
    }
  }
  
  // Mostrar coordenadas que fallaron
  if (failedCoords.length > 0) {
    console.log('\n❌ Ejemplos de coordenadas que fallaron:');
    for (const coord of failedCoords) {
      console.log(`  lat=${coord.lat}, lon=${coord.lon}`);
    }
  }
  
  console.log('\n--- Resultado ---');
  console.log(`✅ Votos actualizados: ${updated}`);
  console.log(`❌ No se pudo geocodificar: ${failed}`);
  console.log(`📊 Encuestas afectadas: ${pollsAffected.size}`);
  
  // Mostrar IDs de encuestas afectadas
  if (pollsAffected.size > 0 && pollsAffected.size <= 20) {
    console.log('Encuestas:', Array.from(pollsAffected).join(', '));
  }
  
  await prisma.$disconnect();
}

backfillVotes().catch(console.error);
