/**
 * Descargar archivos GADM nivel 3 para países sin nivel 3
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const TEMP_DIR = 'temp_gadm_downloads';

const countries = [
  { code: 'LBY', name: 'Libya' },
  { code: 'ARM', name: 'Armenia' },
  { code: 'UKR', name: 'Ukraine' },
  { code: 'MDA', name: 'Moldova' },
  { code: 'MKD', name: 'North Macedonia' },
  { code: 'MNE', name: 'Montenegro' },
  { code: 'ISR', name: 'Israel' },
  { code: 'CYP', name: 'Cyprus' },
  { code: 'JAM', name: 'Jamaica' },
  { code: 'KWT', name: 'Kuwait' },
  { code: 'QAT', name: 'Qatar' },
  { code: 'BHS', name: 'Bahamas' },
  { code: 'BLZ', name: 'Belize' },
  { code: 'LSO', name: 'Lesotho' },
  { code: 'PRI', name: 'Puerto Rico' },
  { code: 'TTO', name: 'Trinidad and Tobago' }
];

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        // Seguir redirección
        file.close();
        fs.unlinkSync(dest);
        if (response.headers.location) {
          downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        } else {
          reject(new Error(`Redirect without location for ${url}`));
        }
      } else {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function main() {
  console.log('📥 Descargando archivos GADM nivel 3...\n');
  
  // Crear directorio temporal
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
  }
  
  let downloaded = 0;
  let failed = 0;
  
  for (const country of countries) {
    console.log(`🌍 ${country.code} - ${country.name}`);
    
    // Intentar nivel 3
    const url3 = `https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_${country.code}_3.json`;
    const dest3 = path.join(TEMP_DIR, `${country.code}_level3.json`);
    
    try {
      console.log(`   Descargando nivel 3...`);
      await downloadFile(url3, dest3);
      const size = (fs.statSync(dest3).size / 1024 / 1024).toFixed(2);
      console.log(`   ✅ Nivel 3 descargado: ${size} MB`);
      downloaded++;
    } catch (error: any) {
      console.log(`   ⚠️  Nivel 3 no disponible`);
      
      // Intentar nivel 2
      const url2 = `https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_${country.code}_2.json`;
      const dest2 = path.join(TEMP_DIR, `${country.code}_level2.json`);
      
      try {
        console.log(`   Intentando nivel 2...`);
        await downloadFile(url2, dest2);
        const size = (fs.statSync(dest2).size / 1024 / 1024).toFixed(2);
        console.log(`   ✅ Nivel 2 descargado: ${size} MB`);
        downloaded++;
      } catch (error2: any) {
        console.log(`   ❌ No disponible: ${error2.message}`);
        failed++;
      }
    }
    
    console.log('');
  }
  
  console.log('='.repeat(70));
  console.log('📊 RESUMEN\n');
  console.log(`✅ Descargados: ${downloaded} / ${countries.length}`);
  console.log(`❌ Fallidos: ${failed}`);
  
  console.log(`\n📁 Archivos en: ${TEMP_DIR}`);
  
  console.log('\n🔧 SIGUIENTE PASO:');
  console.log('   npx tsx scripts/process-gadm-files.ts');
}

main().catch(console.error);
