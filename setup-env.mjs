import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';

console.log('🔧 Configurando archivo .env...\n');

// Generar secrets aleatorios
const jwtSecret = randomBytes(32).toString('hex');
const appSecret = randomBytes(64).toString('hex');

console.log('✅ Secrets generados:');
console.log(`   JWT_SECRET: ${jwtSecret.substring(0, 20)}...`);
console.log(`   APP_SECRET: ${appSecret.substring(0, 20)}...\n`);

// Leer .env.example como plantilla
const envExample = readFileSync('.env.example', 'utf8');

// Reemplazar valores por defecto con los nuevos secrets
let envContent = envExample
  .replace(
    'JWT_SECRET=change-this-secret-in-production-use-random-32-chars-minimum',
    `JWT_SECRET=${jwtSecret}`
  )
  .replace(
    'APP_SECRET=change-this-app-secret-in-production-random-64-chars-minimum',
    `APP_SECRET=${appSecret}`
  )
  .replace(
    'VITE_APP_SECRET=change-this-app-secret-in-production-random-64-chars-minimum',
    `VITE_APP_SECRET=${appSecret}`
  );

// Guardar archivo .env
if (existsSync('.env')) {
  console.log('⚠️  Archivo .env existente encontrado');
  console.log('   Creando backup como .env.backup...');
  const currentEnv = readFileSync('.env', 'utf8');
  writeFileSync('.env.backup', currentEnv);
}

writeFileSync('.env', envContent);

console.log('✅ Archivo .env creado/actualizado correctamente\n');
console.log('📋 Configuración aplicada:');
console.log('   - JWT_SECRET: generado (32 bytes)');
console.log('   - APP_SECRET: generado (64 bytes)');
console.log('   - VITE_APP_SECRET: sincronizado con APP_SECRET');
console.log('   - VITE_APP_ID: voutop-web-v1\n');
console.log('⚡ Siguiente paso: Reinicia el servidor de desarrollo');
console.log('   npm run dev\n');
