import { renameSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

console.log('🔐 Ofuscando archivos TopoJSON...\n');

// Mapeo de archivos principales
const fileRenames = {
  'static/maps/world.topojson.json': 'static/maps/a7f9d2c1b5e8.json',
  'static/data/WORLD.json': 'static/data/f3e9a2d7b1c8.json',
  'static/data/WORLD3.json': 'static/data/c8b1d7a2e9f3.json',
  'static/maps/countries-110m-iso.json': 'static/maps/d5c7a9f2e4b1.json',
  'static/maps/countries-110m-iso-geojson-fixed.json': 'static/maps/b4e2f7a9c5d1.json'
};

// Renombrar archivos principales
for (const [oldPath, newPath] of Object.entries(fileRenames)) {
  const fullOldPath = join(rootDir, oldPath);
  const fullNewPath = join(rootDir, newPath);
  
  if (existsSync(fullOldPath)) {
    renameSync(fullOldPath, fullNewPath);
    console.log(`✅ ${oldPath} → ${newPath}`);
  } else {
    console.log(`⏭️  ${oldPath} (ya renombrado o no existe)`);
  }
}

// Ofuscar archivos de países en geojson/
console.log('\n🌍 Ofuscando archivos de países...\n');

const geojsonDir = join(rootDir, 'static/geojson');

function btoa(str) {
  return Buffer.from(str).toString('base64');
}

function getCountryFileName(countryCode) {
  const hash = btoa(countryCode).replace(/=/g, '').substring(0, 12);
  return `${hash}.json`;
}

if (existsSync(geojsonDir)) {
  const countries = readdirSync(geojsonDir);
  let renamedCount = 0;
  
  for (const countryCode of countries) {
    const countryDir = join(geojsonDir, countryCode);
    
    if (statSync(countryDir).isDirectory()) {
      const oldFile = join(countryDir, `${countryCode}.topojson`);
      
      if (existsSync(oldFile)) {
        const newFileName = getCountryFileName(countryCode);
        const newFile = join(countryDir, newFileName);
        
        renameSync(oldFile, newFile);
        renamedCount++;
        
        if (renamedCount <= 5) {
          console.log(`✅ ${countryCode}/${countryCode}.topojson → ${countryCode}/${newFileName}`);
        }
      }
    }
  }
  
  console.log(`\n✅ ${renamedCount} archivos de países ofuscados`);
} else {
  console.log('⚠️  Directorio geojson/ no encontrado');
}

console.log('\n🎉 Ofuscación completada!\n');
console.log('⚠️  NOTA: Este script modifica archivos en static/');
console.log('⚠️  Normalmente NO deberías ejecutarlo manualmente.');
console.log('⚠️  La ofuscación se hace automáticamente en el build.\n');
console.log('💡 Para desarrollo normal, usa archivos originales en static/');
console.log('💡 El sistema detecta automáticamente el entorno\n');
