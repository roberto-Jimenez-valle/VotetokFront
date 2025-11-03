/**
 * Verificar países GRANDES que salen grises
 */

import * as fs from 'fs';
import * as path from 'path';

const largeGrayCountries = [
  { code: 'LBY', names: ['Libya', 'Libia'] },
  { code: 'UKR', names: ['Ukraine', 'Ucrania'] },
  { code: 'ARM', names: ['Armenia'] },
  { code: 'MDA', names: ['Moldova', 'Moldavia'] },
  { code: 'MKD', names: ['Macedonia', 'North Macedonia'] },
  { code: 'MNE', names: ['Montenegro'] },
  { code: 'ISR', names: ['Israel'] },
  { code: 'CYP', names: ['Cyprus', 'Chipre'] },
  { code: 'JAM', names: ['Jamaica'] },
  { code: 'KWT', names: ['Kuwait'] },
  { code: 'QAT', names: ['Qatar'] },
  { code: 'BHS', names: ['Bahamas'] },
  { code: 'BLZ', names: ['Belize', 'Belice'] },
  { code: 'GRL', names: ['Greenland', 'Groenlandia'] },
  { code: 'LSO', names: ['Lesotho'] },
  { code: 'PRI', names: ['Puerto Rico'] },
  { code: 'ESH', names: ['Western Sahara', 'Sahara'] },
  { code: 'TTO', names: ['Trinidad', 'Tobago'] }
];

async function main() {
  const worldFile = path.join(process.cwd(), 'static/maps/world.topojson.json');
  const worldData = JSON.parse(fs.readFileSync(worldFile, 'utf8'));
  
  console.log('🔍 Verificando países GRANDES que salen grises...\n');
  console.log('='.repeat(70) + '\n');
  
  for (const country of largeGrayCountries) {
    console.log(`🔎 ${country.code} (${country.names[0]}):`);
    
    // Buscar por todos los métodos
    const feature = worldData.features.find((f: any) => {
      const p = f.properties;
      
      // Por códigos
      if (p.ISO_A3 === country.code || 
          p.ADM0_A3 === country.code || 
          p.SOV_A3 === country.code) {
        return true;
      }
      
      // Por nombres
      const names = [p.NAME, p.NAME_LONG, p.ADMIN, p.SOVEREIGNT]
        .filter(Boolean)
        .map((n: string) => n.toLowerCase());
      
      return country.names.some(searchName => 
        names.some(propName => propName.includes(searchName.toLowerCase()))
      );
    });
    
    if (feature) {
      const p = feature.properties;
      console.log(`   ✅ ENCONTRADO en archivo:`);
      console.log(`      ISO_A3: "${p.ISO_A3}"`);
      console.log(`      ADM0_A3: "${p.ADM0_A3}"`);
      console.log(`      SOV_A3: "${p.SOV_A3}"`);
      console.log(`      NAME: "${p.NAME}"`);
      
      // Simular getFeatureId con el nuevo código
      const iso_a3 = p.ISO_A3;
      const adm0_a3 = p.ADM0_A3;
      let result = '';
      
      if (iso_a3 && iso_a3 !== '-99') {
        result = iso_a3;
      } else if (adm0_a3 && adm0_a3 !== '-99') {
        result = adm0_a3;
      }
      
      console.log(`      getFeatureId() → "${result}"`);
      
      if (result !== country.code) {
        console.log(`      ⚠️  PROBLEMA: getFeatureId devuelve "${result}" pero esperamos "${country.code}"`);
      } else {
        console.log(`      ✅ getFeatureId correcto`);
      }
    } else {
      console.log(`   ❌ NO ENCONTRADO en archivo`);
    }
    console.log('');
  }
  
  // Contar problemas
  console.log('='.repeat(70));
  console.log('📊 ANÁLISIS:\n');
  
  let found = 0;
  let notFound = 0;
  let wrongCode = 0;
  
  for (const country of largeGrayCountries) {
    const feature = worldData.features.find((f: any) => {
      const p = f.properties;
      const names = [p.NAME, p.NAME_LONG, p.ADMIN].filter(Boolean).map((n: string) => n.toLowerCase());
      return country.names.some(searchName => 
        names.some(propName => propName.includes(searchName.toLowerCase()))
      );
    });
    
    if (feature) {
      found++;
      const p = feature.properties;
      const iso_a3 = p.ISO_A3;
      const adm0_a3 = p.ADM0_A3;
      let result = '';
      
      if (iso_a3 && iso_a3 !== '-99') {
        result = iso_a3;
      } else if (adm0_a3 && adm0_a3 !== '-99') {
        result = adm0_a3;
      }
      
      if (result !== country.code) {
        wrongCode++;
      }
    } else {
      notFound++;
    }
  }
  
  console.log(`✅ Encontrados en archivo: ${found}`);
  console.log(`❌ NO encontrados: ${notFound}`);
  console.log(`⚠️  Con código incorrecto: ${wrongCode}`);
}

main().catch(console.error);
