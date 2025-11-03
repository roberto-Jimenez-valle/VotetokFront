/**
 * Script para verificar los valores exactos de ISO_A3
 */

import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const worldFile = path.join(process.cwd(), 'static/maps/countries-110m-iso.json');
  const worldData = JSON.parse(fs.readFileSync(worldFile, 'utf8'));
  
  console.log('🔍 Verificando valores de ISO_A3 en Francia...\n');
  
  const france = worldData.features.find((f: any) => {
    const p = f.properties;
    return p.ISO3_CODE === 'FRA';
  });

  if (france) {
    const p = france.properties;
    console.log('Francia encontrada:');
    console.log('  ISO_A3 value:', p.ISO_A3);
    console.log('  ISO_A3 type:', typeof p.ISO_A3);
    console.log('  ISO_A3 === undefined:', p.ISO_A3 === undefined);
    console.log('  ISO_A3 === null:', p.ISO_A3 === null);
    console.log('  ISO_A3 === "N/A":', p.ISO_A3 === 'N/A');
    console.log('  !p.ISO_A3:', !p.ISO_A3);
    console.log('  ISO3_CODE:', p.ISO3_CODE);
    
    console.log('\n🧪 Simulando getFeatureId():');
    const isoCode = p.ISO_A3 || p.ISO3_CODE || p.iso_a3;
    console.log('  Resultado:', isoCode);
    console.log('  Resultado type:', typeof isoCode);
  }

  // Verificar varios países
  console.log('\n' + '='.repeat(70));
  console.log('🔍 Verificando muestra de países:\n');
  
  const sample = ['FRA', 'NOR', 'MLT', 'ESP', 'USA', 'DEU'];
  
  for (const code of sample) {
    const country = worldData.features.find((f: any) => f.properties.ISO3_CODE === code);
    if (country) {
      const p = country.properties;
      const result = p.ISO_A3 || p.ISO3_CODE || p.iso_a3;
      console.log(`${code}:`);
      console.log(`  ISO_A3: "${p.ISO_A3}" (${typeof p.ISO_A3})`);
      console.log(`  ISO3_CODE: "${p.ISO3_CODE}"`);
      console.log(`  getFeatureId() → "${result}"`);
      console.log('');
    }
  }
}

main().catch(console.error);
