/**
 * Verificar el archivo mundial que realmente se está usando
 */

import * as fs from 'fs';
import * as path from 'path';
import { feature } from 'topojson-client';

async function main() {
  console.log('🔍 Verificando archivo mundial usado por la API...\n');

  const worldFile = path.join(process.cwd(), 'static/maps/world.topojson.json');
  
  if (!fs.existsSync(worldFile)) {
    console.log('❌ world.topojson.json no existe');
    return;
  }

  const topoData = JSON.parse(fs.readFileSync(worldFile, 'utf8'));
  
  // Convertir TopoJSON a GeoJSON
  const objectKey = Object.keys(topoData.objects)[0];
  const geoData: any = feature(topoData, topoData.objects[objectKey]);
  
  console.log(`📊 Archivo: world.topojson.json`);
  console.log(`   Features totales: ${geoData.features.length}\n`);
  
  // Buscar Francia
  const france = geoData.features.find((f: any) => {
    const p = f.properties;
    const name = (p.NAME_ENGL || p.CNTR_NAME || p.NAME || p.ADMIN || p.name || '').toLowerCase();
    return name.includes('france') || name.includes('francia');
  });

  if (france) {
    console.log('✅ Francia encontrada:');
    console.log(JSON.stringify(france.properties, null, 2));
    console.log('');
    
    // Probar getFeatureId
    const p = france.properties;
    const id = (p.ISO_A3 || p.ISO3_CODE || p.iso_a3 || '').toString().toUpperCase();
    console.log(`🧪 getFeatureId() debería devolver: "${id}"`);
  } else {
    console.log('❌ Francia NO encontrada');
  }

  // Verificar muestra de países
  console.log('\n' + '='.repeat(70));
  console.log('📋 Muestra de propiedades de países:\n');
  
  const sample = geoData.features.slice(0, 5);
  for (const feat of sample) {
    const p = feat.properties;
    const name = p.NAME_ENGL || p.CNTR_NAME || p.NAME || p.ADMIN || p.name || 'Unknown';
    const iso3 = p.ISO3_CODE || p.ISO_A3 || 'N/A';
    console.log(`${name}:`);
    console.log(`  ISO3_CODE: ${p.ISO3_CODE}`);
    console.log(`  ISO_A3: ${p.ISO_A3}`);
    console.log(`  Propiedades disponibles:`, Object.keys(p).slice(0, 10).join(', '));
    console.log('');
  }
}

main().catch(console.error);
