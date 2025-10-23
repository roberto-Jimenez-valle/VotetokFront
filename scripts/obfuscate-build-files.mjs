import { renameSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const buildDir = join(rootDir, 'build', 'client');

console.log('🔐 Ofuscando archivos TopoJSON en build...\n');

// Mapeo de archivos principales
const fileRenames = {
  'maps/world.topojson.json': 'maps/a7f9d2c1b5e8.json',
  'data/WORLD.json': 'data/f3e9a2d7b1c8.json',
  'data/WORLD3.json': 'data/c8b1d7a2e9f3.json',
  'maps/countries-110m-iso.json': 'maps/d5c7a9f2e4b1.json',
  'maps/countries-110m-iso-geojson-fixed.json': 'maps/b4e2f7a9c5d1.json'
};

if (!existsSync(buildDir)) {
  console.log('⚠️  Directorio build/client no encontrado. Asegúrate de ejecutar esto después de npm run build.');
  process.exit(0);
}

// Renombrar archivos principales
let renamedMain = 0;
for (const [oldPath, newPath] of Object.entries(fileRenames)) {
  const fullOldPath = join(buildDir, oldPath);
  const fullNewPath = join(buildDir, newPath);
  
  if (existsSync(fullOldPath)) {
    renameSync(fullOldPath, fullNewPath);
    renamedMain++;
    console.log(`✅ ${oldPath} → ${newPath}`);
  }
}

console.log(`\n✅ ${renamedMain} archivos principales ofuscados`);

// Ofuscar archivos de países en geojson/
console.log('\n🌍 Ofuscando archivos de países...\n');

const geojsonDir = join(buildDir, 'geojson');

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
      const files = readdirSync(countryDir);
      
      for (const file of files) {
        if (file.endsWith('.topojson')) {
          const oldFile = join(countryDir, file);
          // Extraer el identificador del archivo (ESP, ESP.1, etc)
          const identifier = file.replace('.topojson', '');
          const newFileName = getCountryFileName(identifier);
          const newFile = join(countryDir, newFileName);
          
          renameSync(oldFile, newFile);
          renamedCount++;
          
          if (renamedCount <= 5) {
            console.log(`✅ ${countryCode}/${file} → ${countryCode}/${newFileName}`);
          }
        }
      }
    }
  }
  
  console.log(`\n✅ ${renamedCount} archivos de países ofuscados`);
} else {
  console.log('⏭️  Directorio geojson/ no encontrado en build');
}

console.log('\n🎉 Ofuscación de build completada!\n');
console.log('💡 Los archivos en build/client/ ahora tienen nombres hash');
console.log('💡 Los archivos en static/ mantienen sus nombres originales para desarrollo\n');
