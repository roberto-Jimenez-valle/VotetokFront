/**
 * Verificar las propiedades exactas de Francia y otros países problemáticos
 */

import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const worldFile = path.join(process.cwd(), 'static/maps/world.topojson.json');
  const worldData = JSON.parse(fs.readFileSync(worldFile, 'utf8'));
  
  console.log('🔍 Verificando propiedades de países problemáticos...\n');
  console.log(`Total features: ${worldData.features.length}\n`);
  
  // Países problemáticos según el log
  const problematic = ['FSM', 'REU', 'WSM', 'NOR', 'MLT', 'GUF', 'FRA', 'GLP', 'BLM', 'ALA', 
                       'ASM', 'XKO', 'FRO', 'SHN', 'MTQ', 'VIR', 'STP', 'TON', 'WLF'];
  
  console.log('Buscando por ISO_A3, ISO3_CODE, ADM0_A3, SOV_A3...\n');
  console.log('='.repeat(70) + '\n');
  
  for (const code of problematic) {
    const feature = worldData.features.find((f: any) => {
      const p = f.properties;
      return p.ISO_A3 === code || 
             p.ISO3_CODE === code ||
             p.ADM0_A3 === code ||
             p.SOV_A3 === code ||
             p.ISO_A2 === code.substring(0, 2) ||
             (p.NAME && p.NAME.toUpperCase().includes(code));
    });
    
    if (feature) {
      const p = feature.properties;
      console.log(`✅ ${code} encontrado:`);
      console.log(`   ISO_A3: "${p.ISO_A3}" (${typeof p.ISO_A3})`);
      console.log(`   ISO3_CODE: "${p.ISO3_CODE}" (${typeof p.ISO3_CODE})`);
      console.log(`   ADM0_A3: "${p.ADM0_A3}"`);
      console.log(`   SOV_A3: "${p.SOV_A3}"`);
      console.log(`   NAME: "${p.NAME}"`);
      console.log(`   NAME_LONG: "${p.NAME_LONG}"`);
      
      // Simular getFeatureId
      const result = p.ISO_A3 || p.ISO3_CODE || p.iso_a3 || '';
      console.log(`   getFeatureId() → "${result}"`);
      console.log('');
    } else {
      console.log(`❌ ${code} NO encontrado en el archivo\n`);
    }
  }
  
  // Verificar también todos los países y ver cuáles usan ISO3_CODE vs ISO_A3
  console.log('\n' + '='.repeat(70));
  console.log('📊 Análisis de propiedades ISO en TODO el archivo:\n');
  
  let withISO_A3 = 0;
  let withISO3_CODE = 0;
  let withBoth = 0;
  let withNeither = 0;
  const onlyISO3_CODE: string[] = [];
  
  for (const f of worldData.features) {
    const p = f.properties;
    const hasA3 = p.ISO_A3 && p.ISO_A3 !== '-99' && p.ISO_A3 !== '';
    const has3Code = p.ISO3_CODE && p.ISO3_CODE !== '-99' && p.ISO3_CODE !== '';
    
    if (hasA3 && has3Code) withBoth++;
    else if (hasA3) withISO_A3++;
    else if (has3Code) {
      withISO3_CODE++;
      onlyISO3_CODE.push(p.NAME || p.ISO3_CODE);
    }
    else withNeither++;
  }
  
  console.log(`Con ISO_A3 solamente: ${withISO_A3}`);
  console.log(`Con ISO3_CODE solamente: ${withISO3_CODE}`);
  console.log(`Con ambos: ${withBoth}`);
  console.log(`Sin ninguno: ${withNeither}`);
  
  if (onlyISO3_CODE.length > 0) {
    console.log(`\nPaíses que solo tienen ISO3_CODE (${onlyISO3_CODE.length}):`);
    onlyISO3_CODE.forEach(name => console.log(`  - ${name}`));
  }
}

main().catch(console.error);
