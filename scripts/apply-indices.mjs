/**
 * Script para aplicar índices optimizados directamente a la BD
 * Ejecutar con: node scripts/apply-indices.mjs
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function applyIndices() {
  console.log('🔧 Aplicando índices optimizados...\n');

  const sql = fs.readFileSync('prisma/migrations/20251103_optimize_indices/migration.sql', 'utf-8');
  
  // Dividir por líneas y ejecutar comandos SQL
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const statement of statements) {
    // Saltar comentarios y comandos ANALYZE
    if (statement.startsWith('--') || statement.toUpperCase().includes('ANALYZE')) {
      continue;
    }

    try {
      await prisma.$executeRawUnsafe(statement + ';');
      
      // Extraer nombre del índice para logging
      const indexMatch = statement.match(/CREATE INDEX\s+(?:IF NOT EXISTS\s+)?"?([^"\s]+)"?/i);
      if (indexMatch) {
        console.log(`✅ Índice creado: ${indexMatch[1]}`);
        successCount++;
      }
    } catch (error) {
      // Si el índice ya existe, no es un error
      if (error.message?.includes('already exists')) {
        const indexMatch = statement.match(/CREATE INDEX\s+(?:IF NOT EXISTS\s+)?"?([^"\s]+)"?/i);
        if (indexMatch) {
          console.log(`⏭️  Índice ya existe: ${indexMatch[1]}`);
          skipCount++;
        }
      } else {
        console.error(`❌ Error:`, error.message);
        errorCount++;
      }
    }
  }

  console.log('\n📊 Resumen:');
  console.log(`   ✅ Índices creados: ${successCount}`);
  console.log(`   ⏭️  Índices existentes: ${skipCount}`);
  console.log(`   ❌ Errores: ${errorCount}`);

  // Actualizar estadísticas
  console.log('\n📈 Actualizando estadísticas de tablas...');
  try {
    await prisma.$executeRaw`ANALYZE votes`;
    await prisma.$executeRaw`ANALYZE subdivisions`;
    await prisma.$executeRaw`ANALYZE polls`;
    await prisma.$executeRaw`ANALYZE poll_options`;
    await prisma.$executeRaw`ANALYZE poll_interactions`;
    await prisma.$executeRaw`ANALYZE user_followers`;
    console.log('✅ Estadísticas actualizadas');
  } catch (error) {
    console.warn('⚠️  Error actualizando estadísticas:', error.message);
  }

  await prisma.$disconnect();
  console.log('\n🎉 ¡Optimización completada!');
}

applyIndices().catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});
