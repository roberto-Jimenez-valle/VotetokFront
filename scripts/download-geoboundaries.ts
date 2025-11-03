/**
 * Descargar archivos de GeoBoundaries (nivel ADM2 = nivel 3)
 * API: https://www.geoboundaries.org/api.html
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
    
    const request = https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        // Seguir redirección
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
    
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function getGeoBoundariesURL(countryCode: string, level: string): Promise<string | null> {
  return new Promise((resolve) => {
    const apiUrl = `https://www.geoboundaries.org/api/current/gbOpen/${countryCode}/${level}/`;
    
    https.get(apiUrl, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          // GeoBoundaries API devuelve objeto con gjDownloadURL
          resolve(json.gjDownloadURL || null);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

async function main() {
  console.log('📥 Descargando desde GeoBoundaries...\n');
  console.log('Fuente: https://www.geoboundaries.org/\n');
  
  // Crear directorio temporal
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
  }
  
  let downloaded = 0;
  let failed = 0;
  
  for (const country of countries) {
    console.log(`🌍 ${country.code} - ${country.name}`);
    
    // Intentar ADM2 (nivel 3)
    console.log(`   Consultando API para ADM2 (nivel 3)...`);
    let downloadUrl = await getGeoBoundariesURL(country.code, 'ADM2');
    
    if (downloadUrl) {
      const dest = path.join(TEMP_DIR, `${country.code}_level3.json`);
      
      try {
        console.log(`   Descargando...`);
        await downloadFile(downloadUrl, dest);
        
        if (fs.existsSync(dest)) {
          const size = (fs.statSync(dest).size / 1024 / 1024).toFixed(2);
          console.log(`   ✅ Nivel 3 (ADM2) descargado: ${size} MB`);
          downloaded++;
        }
      } catch (error: any) {
        console.log(`   ❌ Error descargando: ${error.message}`);
        failed++;
      }
    } else {
      // Intentar ADM1 (nivel 2)
      console.log(`   ADM2 no disponible, intentando ADM1 (nivel 2)...`);
      downloadUrl = await getGeoBoundariesURL(country.code, 'ADM1');
      
      if (downloadUrl) {
        const dest = path.join(TEMP_DIR, `${country.code}_level2.json`);
        
        try {
          await downloadFile(downloadUrl, dest);
          
          if (fs.existsSync(dest)) {
            const size = (fs.statSync(dest).size / 1024 / 1024).toFixed(2);
            console.log(`   ✅ Nivel 2 (ADM1) descargado: ${size} MB`);
            downloaded++;
          }
        } catch (error: any) {
          console.log(`   ❌ Error: ${error.message}`);
          failed++;
        }
      } else {
        console.log(`   ❌ No disponible en GeoBoundaries`);
        failed++;
      }
    }
    
    console.log('');
  }
  
  console.log('='.repeat(70));
  console.log('📊 RESUMEN\n');
  console.log(`✅ Descargados: ${downloaded} / ${countries.length}`);
  console.log(`❌ Fallidos: ${failed}`);
  
  if (downloaded > 0) {
    console.log(`\n📁 Archivos en: ${TEMP_DIR}`);
    console.log('\n🔧 SIGUIENTE PASO:');
    console.log('   npx tsx scripts/process-gadm-files.ts');
  } else {
    console.log('\n⚠️  No se descargó ningún archivo.');
    console.log('   Considera usar la Opción 1: votos a nivel 2');
  }
}

main().catch(console.error);
