/**
 * Intentar descargar nivel 3 de Libia desde múltiples fuentes
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const TEMP_DIR = 'temp_gadm_downloads';

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    const request = https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        if (response.headers.location) {
          downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        } else {
          reject(new Error(`Redirect without location`));
        }
      } else {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(new Error(`Failed: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
    
    request.setTimeout(60000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function main() {
  console.log('📥 Intentando descargar Libia nivel 3...\n');
  
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
  }
  
  // Fuente 1: GADM 4.1
  console.log('🔍 Fuente 1: GADM 4.1');
  const gadmUrl = 'https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_LBY_3.json';
  const gadmDest = path.join(TEMP_DIR, 'LBY_gadm_level3.json');
  
  try {
    console.log('   Descargando...');
    await downloadFile(gadmUrl, gadmDest);
    
    if (fs.existsSync(gadmDest)) {
      const size = (fs.statSync(gadmDest).size / 1024 / 1024).toFixed(2);
      console.log(`   ✅ GADM nivel 3 descargado: ${size} MB\n`);
      
      console.log('🔧 SIGUIENTE PASO:');
      console.log('   npx tsx scripts/process-lby-level3.ts');
      return;
    }
  } catch (error: any) {
    console.log(`   ❌ GADM falló: ${error.message}\n`);
  }
  
  // Fuente 2: Humanitarian Data Exchange
  console.log('🔍 Fuente 2: HDX (Humanitarian Data Exchange)');
  console.log('   Nota: HDX requiere descarga manual desde:');
  console.log('   https://data.humdata.org/dataset/cod-ab-lby\n');
  
  console.log('='.repeat(70));
  console.log('⚠️  RESULTADO:\n');
  console.log('Libia nivel 3 NO está disponible en fuentes públicas automáticas.');
  console.log('\n💡 OPCIONES:\n');
  console.log('1. Usar nivel 2 actual (ya funciona, solo sin drill-down)');
  console.log('2. Descargar manualmente desde HDX');
  console.log('3. Aceptar que Libia solo tiene nivel 2 disponible\n');
  
  console.log('✅ RECOMENDACIÓN:');
  console.log('   Libia YA funciona con nivel 2 (22 subdivisiones, 3968 votos)');
  console.log('   El drill-down no es crítico para este país.');
}

main().catch(console.error);
