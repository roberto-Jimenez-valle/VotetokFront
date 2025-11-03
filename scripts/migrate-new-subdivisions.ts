/**
 * Migrar subdivisiones nivel 3 de archivos TopoJSON descargados
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { feature } from 'topojson-client';

const prisma = new PrismaClient();

const newCountries = [
  'ARM', 'UKR', 'MKD', 'ISR', 'CYP', 'JAM', 'KWT', 'QAT', 
  'BHS', 'BLZ', 'LSO', 'PRI', 'LBY', 'MDA', 'MNE', 'TTO'
];

async function main() {
  console.log('🔄 Migrando subdivisiones nivel 3...\n');
  
  let totalAdded = 0;
  let totalUpdated = 0;
  
  for (const countryCode of newCountries) {
    console.log(`\n🌍 Procesando ${countryCode}...`);
    
    const countryDir = path.join('static', 'geojson', countryCode);
    
    if (!fs.existsSync(countryDir)) {
      console.log(`   ⚠️  Directorio no existe: ${countryDir}`);
      continue;
    }
    
    const files = fs.readdirSync(countryDir);
    console.log(`   Archivos encontrados: ${files.length}`);
    
    // Buscar archivos con nivel 3 (formato: ARM.1.topojson, etc.)
    const level3Files = files.filter(f => {
      const match = f.match(/^([A-Z]{3})\.(\d+)\.topojson$/);
      return match !== null;
    });
    
    if (level3Files.length === 0) {
      console.log(`   ℹ️  No hay archivos nivel 3 (solo nivel 2)`);
      continue;
    }
    
    console.log(`   Archivos nivel 3: ${level3Files.length}`);
    
    let countryAdded = 0;
    let countryUpdated = 0;
    
    // Procesar cada archivo nivel 3
    for (const file of level3Files) {
      const filePath = path.join(countryDir, file);
      const topoData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Obtener el objeto (debería ser uno solo por archivo)
      const objectKey = Object.keys(topoData.objects)[0];
      const geoData: any = feature(topoData, topoData.objects[objectKey]);
      
      // Procesar cada feature (subdivisión nivel 3)
      for (const feat of geoData.features) {
        const props = feat.properties;
        
        // Extraer IDs
        const subdivisionId = props.shapeID || props.GID_2 || props.ID_2;
        if (!subdivisionId || !subdivisionId.includes('.')) continue;
        
        const name = props.shapeName || props.NAME_2 || props.VARNAME_2 || 'Unknown';
        
        // Calcular centroide
        let latitude: number | null = null;
        let longitude: number | null = null;
        
        if (feat.geometry && feat.geometry.coordinates) {
          const coords = feat.geometry.coordinates;
          if (feat.geometry.type === 'Polygon' && coords[0]) {
            const ring = coords[0];
            const sum = ring.reduce((acc: any, coord: any) => {
              return { lng: acc.lng + coord[0], lat: acc.lat + coord[1] };
            }, { lng: 0, lat: 0 });
            longitude = sum.lng / ring.length;
            latitude = sum.lat / ring.length;
          } else if (feat.geometry.type === 'MultiPolygon' && coords[0] && coords[0][0]) {
            const ring = coords[0][0];
            const sum = ring.reduce((acc: any, coord: any) => {
              return { lng: acc.lng + coord[0], lat: acc.lat + coord[1] };
            }, { lng: 0, lat: 0 });
            longitude = sum.lng / ring.length;
            latitude = sum.lat / ring.length;
          }
        }
        
        // Verificar si ya existe
        const existing = await prisma.subdivision.findUnique({
          where: { subdivisionId }
        });
        
        if (existing) {
          // Actualizar si el nombre es diferente o no tiene coordenadas
          if (existing.name !== name || !existing.latitude) {
            await prisma.subdivision.update({
              where: { subdivisionId },
              data: {
                name,
                latitude,
                longitude
              }
            });
            countryUpdated++;
          }
        } else {
          // Insertar nueva subdivisión
          // Skip si no tiene coordenadas válidas
          if (latitude !== null && longitude !== null) {
            await prisma.subdivision.create({
              data: {
                subdivisionId,
                name,
                level: 3,
                latitude,
                longitude
              }
            });
            countryAdded++;
          } else {
            console.log(`     ⚠️  Skipping ${subdivisionId}: sin coordenadas`);
          }
        }
      }
    }
    
    console.log(`   ✅ Agregadas: ${countryAdded}, Actualizadas: ${countryUpdated}`);
    totalAdded += countryAdded;
    totalUpdated += countryUpdated;
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN FINAL\n');
  console.log(`✅ Total agregadas: ${totalAdded}`);
  console.log(`🔄 Total actualizadas: ${totalUpdated}`);
  
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
