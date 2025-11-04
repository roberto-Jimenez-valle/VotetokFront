import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Calcula el centroide de un polígono o multipolígono
 */
function calculateCentroid(geometry: any): Coordinates {
  let totalLat = 0;
  let totalLng = 0;
  let totalPoints = 0;
  
  function processRing(ring: number[][]) {
    for (const [lng, lat] of ring) {
      totalLat += lat;
      totalLng += lng;
      totalPoints++;
    }
  }
  
  if (geometry.type === 'Polygon') {
    // Polygon tiene un array de rings (exterior + huecos)
    for (const ring of geometry.coordinates) {
      processRing(ring);
    }
  } else if (geometry.type === 'MultiPolygon') {
    // MultiPolygon tiene un array de polígonos
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        processRing(ring);
      }
    }
  }
  
  return {
    lat: totalLat / totalPoints,
    lng: totalLng / totalPoints
  };
}

async function addMissingCountries() {
  try {
    console.log('🌍 Agregando países faltantes a la base de datos...\n');
    
    // 1. Leer archivo GeoJSON del mundo
    const geojsonPath = join(process.cwd(), 'static', 'maps', 'countries-110m-iso-geojson-fixed.json');
    const geojsonContent = readFileSync(geojsonPath, 'utf-8');
    const geojson = JSON.parse(geojsonContent);
    
    console.log(`📊 Features en GeoJSON: ${geojson.features.length}\n`);
    
    // 2. Lista de países faltantes (del reporte anterior)
    const missingCountries = [
      'ATA', 'ABW', 'BVT', 'CCK', 'SGS', 'HKG', 'HMD', 'CPT', 'CUW', 'CXR',
      'FLK', 'GIB', 'NFK', 'NIU', 'KIR', 'MCO', 'MAC', 'MDV', 'SXM', 'PCN',
      'VAT', 'XA', 'XB', 'XC', 'XD', 'XE', 'XF', 'XG', 'XH', 'XI',
      'XJL', 'XL', 'XM', 'XN', 'XO', 'XU', 'XV', 'XXR', 'XXS'
    ];
    
    console.log(`📋 Países a agregar: ${missingCountries.length}\n`);
    
    // 3. Procesar cada país faltante
    const countriesAdded: string[] = [];
    const countriesSkipped: string[] = [];
    
    for (const iso3 of missingCountries) {
      // Buscar feature en el GeoJSON
      const feature = geojson.features.find((f: any) => {
        const featureIso3 = f.properties?.ISO3_CODE || f.properties?.ISO_A3;
        return featureIso3 === iso3;
      });
      
      if (!feature) {
        console.log(`⚠️  ${iso3}: No encontrado en GeoJSON`);
        countriesSkipped.push(iso3);
        continue;
      }
      
      // Verificar si ya existe
      const existing = await prisma.subdivision.findFirst({
        where: {
          subdivisionId: iso3,
          level: 1
        }
      });
      
      if (existing) {
        console.log(`⏭️  ${iso3}: Ya existe en DB`);
        countriesSkipped.push(iso3);
        continue;
      }
      
      // Extraer datos del feature
      const name = feature.properties?.NAME_ENGL || 
                   feature.properties?.CNTR_NAME || 
                   feature.properties?.ADMIN ||
                   feature.id;
      
      const nameLocal = feature.properties?.CNTR_NAME;
      const typeEnglish = 'Country';
      
      // Calcular centroide
      const centroid = calculateCentroid(feature.geometry);
      
      // Insertar en la base de datos
      await prisma.subdivision.create({
        data: {
          subdivisionId: iso3,
          level: 1,
          level1Id: null,
          level2Id: null,
          level3Id: null,
          name: name,
          nameLocal: nameLocal !== name ? nameLocal : null,
          nameVariant: null,
          typeEnglish: typeEnglish,
          hasc: null,
          iso: iso3,
          countryCode: null,
          latitude: centroid.lat,
          longitude: centroid.lng
        }
      });
      
      console.log(`✅ ${iso3}: ${name} (${centroid.lat.toFixed(4)}, ${centroid.lng.toFixed(4)})`);
      countriesAdded.push(iso3);
    }
    
    // 4. Resumen
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`✅ Países agregados: ${countriesAdded.length}`);
    console.log(`⏭️  Países omitidos: ${countriesSkipped.length}`);
    
    if (countriesAdded.length > 0) {
      console.log('\n✅ Países agregados:');
      countriesAdded.forEach(iso => console.log(`   - ${iso}`));
    }
    
    if (countriesSkipped.length > 0) {
      console.log('\n⏭️  Países omitidos:');
      countriesSkipped.forEach(iso => console.log(`   - ${iso}`));
    }
    
    // 5. Verificar total de países ahora
    const totalCountries = await prisma.subdivision.count({
      where: {
        level: 1
      }
    });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`\n🌍 Total de países en DB: ${totalCountries}`);
    console.log('\n✅ Proceso completado exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingCountries();
