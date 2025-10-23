import { cpSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

console.log('📦 Copiando archivos estáticos...');

const sourceDir = 'static';
const targetDir = 'build/client';

// Asegurar que existe el directorio de destino
if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
}

// Copiar recursivamente
try {
  cpSync(sourceDir, targetDir, { recursive: true });
  console.log('✅ Archivos estáticos copiados correctamente');
  console.log(`   Desde: ${sourceDir}`);
  console.log(`   Hacia: ${targetDir}`);
} catch (error) {
  console.error('❌ Error copiando archivos:', error.message);
  process.exit(1);
}
