/**
 * Script para buscar Francia en el archivo mundial
 */

import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🔍 Buscando Francia en archivo mundial...\n');

  const worldFile = path.join(process.cwd(), 'static/maps/countries-110m-iso.json');
  
  if (!fs.existsSync(worldFile)) {
    console.log('❌ Archivo mundial no existe:', worldFile);
    return;
  }

  const worldData = JSON.parse(fs.readFileSync(worldFile, 'utf8'));
  
  // Buscar Francia por nombre
  console.log('📋 Buscando por nombre "France"...\n');
  
  const franceFeatures = worldData.features.filter((f: any) => {
    const p = f.properties;
    const name = (p.NAME_ENGL || p.CNTR_NAME || p.NAME || p.ADMIN || '').toLowerCase();
    return name.includes('france') || name.includes('francia');
  });

  if (franceFeatures.length > 0) {
    console.log(`✅ Encontradas ${franceFeatures.length} geometrías de Francia:\n`);
    
    franceFeatures.forEach((f: any, i: number) => {
      console.log(`Geometría ${i + 1}:`);
      console.log(JSON.stringify(f.properties, null, 2));
      console.log('---\n');
    });
  } else {
    console.log('❌ Francia NO encontrada en el archivo mundial');
  }

  // Buscar también los otros países problemáticos
  console.log('\n' + '='.repeat(70));
  console.log('🔍 Buscando otros países problemáticos...\n');
  
  const problematicCountries = [
    { code: 'FRA', names: ['France', 'Francia'] },
    { code: 'NOR', names: ['Norway', 'Noruega'] },
    { code: 'MLT', names: ['Malta'] },
    { code: 'FRO', names: ['Faroe', 'Feroe'] },
    { code: 'FSM', names: ['Micronesia'] },
    { code: 'TON', names: ['Tonga'] },
    { code: 'WSM', names: ['Samoa'] },
    { code: 'GLP', names: ['Guadeloupe', 'Guadalupe'] },
    { code: 'REU', names: ['Réunion', 'Reunion'] }
  ];

  for (const country of problematicCountries) {
    const features = worldData.features.filter((f: any) => {
      const p = f.properties;
      const name = (p.NAME_ENGL || p.CNTR_NAME || p.NAME || p.ADMIN || '').toLowerCase();
      return country.names.some(n => name.includes(n.toLowerCase()));
    });

    if (features.length > 0) {
      console.log(`✅ ${country.code} encontrado como:`);
      features.forEach((f: any) => {
        const p = f.properties;
        console.log(`   ID: ${p.id || p.CNTR_ID || 'N/A'}`);
        console.log(`   ISO3_CODE: ${p.ISO3_CODE || 'N/A'}`);
        console.log(`   ISO_A3: ${p.ISO_A3 || 'N/A'}`);
        console.log(`   CNTR_ID: ${p.CNTR_ID || 'N/A'}`);
        console.log(`   NAME: ${p.NAME_ENGL || p.CNTR_NAME || p.NAME || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log(`❌ ${country.code} (${country.names.join(', ')}) NO encontrado\n`);
    }
  }
}

main().catch(console.error);
