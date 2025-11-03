/**
 * Migrar subdivisiones desde archivos GeoBoundaries descargados
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const TEMP_DIR = 'temp_gadm_downloads';

async function main() {
  console.log('🔄 Migrando subdivisiones desde GeoBoundaries...\n');
  
  if (!fs.existsSync(TEMP_DIR)) {
    console.log(`❌ Directorio ${TEMP_DIR} no existe`);
    return;
  }
  
  const files = fs.readdirSync(TEMP_DIR).filter(f => f.endsWith('.json'));
  
  console.log(`📁 Archivos encontrados: ${files.length}\n`);
  
  let totalAdded = 0;
  let totalSkipped = 0;
  
  for (const file of files) {
    const match = file.match(/^([A-Z]{3})_level(\d)\.json$/);
    if (!match) continue;
    
    const countryCode = match[1];
    const level = parseInt(match[2]);
    
    console.log(`🌍 ${countryCode} (nivel ${level})`);
    
    const filePath = path.join(TEMP_DIR, file);
    const geoData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!geoData.features || geoData.features.length === 0) {
      console.log(`   ⚠️  Sin features\n`);
      continue;
    }
    
    console.log(`   Features: ${geoData.features.length}`);
    
    let added = 0;
    let skipped = 0;
    
    for (const feature of geoData.features) {
      const props = feature.properties;
      
      // Extraer ID y nombre según el nivel
      let subdivisionId: string;
      let name: string;
      let dbLevel: number;
      
      if (level === 3) {
        // Nivel 3 = ADM2 en GeoBoundaries
        subdivisionId = props.shapeID || props.shapeGroup || '';
        name = props.shapeName || props.NAME_2 || props.VARNAME_2 || 'Unknown';
        dbLevel = 3;
      } else if (level === 2) {
        // Nivel 2 = ADM1 en GeoBoundaries
        subdivisionId = props.shapeID || props.shapeGroup || '';
        name = props.shapeName || props.NAME_1 || props.VARNAME_1 || 'Unknown';
        dbLevel = 2;
      } else {
        continue;
      }
      
      if (!subdivisionId) {
        skipped++;
        continue;
      }
      
      // Calcular centroide
      let latitude: number | null = null;
      let longitude: number | null = null;
      
      if (feature.geometry && feature.geometry.coordinates) {
        const coords = feature.geometry.coordinates;
        
        try {
          if (feature.geometry.type === 'Polygon' && coords[0] && coords[0].length > 0) {
            const ring = coords[0];
            const sum = ring.reduce((acc: any, coord: any) => {
              return { lng: acc.lng + coord[0], lat: acc.lat + coord[1] };
            }, { lng: 0, lat: 0 });
            longitude = sum.lng / ring.length;
            latitude = sum.lat / ring.length;
          } else if (feature.geometry.type === 'MultiPolygon' && coords[0] && coords[0][0] && coords[0][0].length > 0) {
            const ring = coords[0][0];
            const sum = ring.reduce((acc: any, coord: any) => {
              return { lng: acc.lng + coord[0], lat: acc.lat + coord[1] };
            }, { lng: 0, lat: 0 });
            longitude = sum.lng / ring.length;
            latitude = sum.lat / ring.length;
          }
        } catch (e) {
          // Skip si hay error calculando centroide
        }
      }
      
      // Validar coordenadas
      if (latitude === null || longitude === null || isNaN(latitude) || isNaN(longitude)) {
        skipped++;
        continue;
      }
      
      // Verificar si ya existe
      const existing = await prisma.subdivision.findUnique({
        where: { subdivisionId }
      });
      
      if (existing) {
        skipped++;
        continue;
      }
      
      // Insertar
      try {
        await prisma.subdivision.create({
          data: {
            subdivisionId,
            name,
            level: dbLevel,
            latitude,
            longitude
          }
        });
        added++;
      } catch (error: any) {
        console.log(`     ⚠️  Error insertando ${subdivisionId}: ${error.message}`);
        skipped++;
      }
    }
    
    console.log(`   ✅ Agregadas: ${added}, Skipped: ${skipped}\n`);
    totalAdded += added;
    totalSkipped += skipped;
  }
  
  console.log('='.repeat(70));
  console.log('📊 RESUMEN FINAL\n');
  console.log(`✅ Total agregadas: ${totalAdded}`);
  console.log(`⚠️  Total skipped: ${totalSkipped}`);
  
  console.log('\n✨ Migración completa!');
  console.log('\n🔧 SIGUIENTE PASO:');
  console.log('   npx tsx scripts/add-votes-to-new-countries.ts');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
