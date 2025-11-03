/**
 * Buscar los países restantes que no se encontraron
 */

import * as fs from 'fs';
import * as path from 'path';

const remainingCountries = [
  { code: 'FSM', names: ['Micronesia', 'Federated States of Micronesia'], iso2: 'FM' },
  { code: 'REU', names: ['Réunion', 'Reunion'], iso2: 'RE' },
  { code: 'WSM', names: ['Samoa', 'Western Samoa'], iso2: 'WS' },
  { code: 'GUF', names: ['French Guiana', 'Guiana', 'Guyane'], iso2: 'GF' },
  { code: 'BLM', names: ['Saint Barthélemy', 'St. Barthélemy', 'Barthelemy'], iso2: 'BL' },
  { code: 'FRO', names: ['Faroe', 'Faeroe', 'Færøerne'], iso2: 'FO' },
  { code: 'SHN', names: ['Saint Helena', 'St. Helena'], iso2: 'SH' },
  { code: 'MTQ', names: ['Martinique'], iso2: 'MQ' },
  { code: 'VIR', names: ['Virgin Islands', 'U.S. Virgin Islands', 'USVI'], iso2: 'VI' },
  { code: 'STP', names: ['São Tomé', 'Sao Tome', 'Principe'], iso2: 'ST' },
  { code: 'WLF', names: ['Wallis', 'Futuna', 'Wallis and Futuna'], iso2: 'WF' }
];

async function main() {
  const worldFile = path.join(process.cwd(), 'static/maps/world.topojson.json');
  const worldData = JSON.parse(fs.readFileSync(worldFile, 'utf8'));
  
  console.log('🔍 Buscando países restantes por múltiples métodos...\n');
  console.log(`Total features en archivo: ${worldData.features.length}\n`);
  console.log('='.repeat(70) + '\n');
  
  for (const country of remainingCountries) {
    console.log(`🔎 Buscando ${country.code} (${country.names[0]})...`);
    
    // Buscar por TODOS los métodos posibles
    const matches = worldData.features.filter((f: any) => {
      const p = f.properties;
      
      // Buscar por códigos ISO
      if (p.ISO_A3 === country.code || 
          p.ADM0_A3 === country.code || 
          p.SOV_A3 === country.code ||
          p.ISO_A2 === country.iso2) {
        return true;
      }
      
      // Buscar por nombres
      const names = [
        p.NAME, p.NAME_LONG, p.ADMIN, 
        p.SOVEREIGNT, p.GEOUNIT, p.SUBUNIT,
        p.BRK_NAME, p.NAME_SORT
      ].filter(Boolean).map((n: string) => n.toLowerCase());
      
      for (const searchName of country.names) {
        for (const propName of names) {
          if (propName.includes(searchName.toLowerCase())) {
            return true;
          }
        }
      }
      
      return false;
    });
    
    if (matches.length > 0) {
      console.log(`   ✅ Encontrado ${matches.length} match(es):`);
      matches.forEach((f: any, i: number) => {
        const p = f.properties;
        console.log(`   Match ${i + 1}:`);
        console.log(`      ISO_A3: ${p.ISO_A3}`);
        console.log(`      ADM0_A3: ${p.ADM0_A3}`);
        console.log(`      SOV_A3: ${p.SOV_A3}`);
        console.log(`      NAME: ${p.NAME}`);
        console.log(`      NAME_LONG: ${p.NAME_LONG}`);
        console.log(`      ADMIN: ${p.ADMIN}`);
      });
    } else {
      console.log(`   ❌ NO encontrado en el archivo mundial`);
    }
    console.log('');
  }
  
  // Resumen
  console.log('='.repeat(70));
  console.log('📊 RESUMEN:\n');
  
  const found = remainingCountries.filter(country => {
    return worldData.features.some((f: any) => {
      const p = f.properties;
      const names = [p.NAME, p.NAME_LONG, p.ADMIN].filter(Boolean).map((n: string) => n.toLowerCase());
      return country.names.some(searchName => 
        names.some(propName => propName.includes(searchName.toLowerCase()))
      );
    });
  });
  
  const notFound = remainingCountries.filter(c => !found.includes(c));
  
  console.log(`✅ Encontrados: ${found.length}`);
  if (found.length > 0) {
    found.forEach(c => console.log(`   - ${c.code} (${c.names[0]})`));
  }
  
  console.log(`\n❌ NO encontrados: ${notFound.length}`);
  if (notFound.length > 0) {
    notFound.forEach(c => console.log(`   - ${c.code} (${c.names[0]})`));
  }
  
  if (notFound.length > 0) {
    console.log('\n💡 SOLUCIÓN para los NO encontrados:');
    console.log('   Estos territorios probablemente son:');
    console.log('   - Territorios de ultramar franceses (REU, GUF, MTQ, BLM, WLF)');
    console.log('   - Territorios pequeños/dependientes (FSM, SHN, VIR, FRO, STP)');
    console.log('   - NO están en el archivo mundial de resolución baja');
    console.log('   - Necesitarías un archivo mundial de mayor resolución');
    console.log('   - O filtrarlos del backend para que no aparezcan en answersData');
  }
}

main().catch(console.error);
