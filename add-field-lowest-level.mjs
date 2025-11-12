import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addField() {
  console.log('🔄 Agregando campo isLowestLevel a la tabla subdivisions...\n');
  
  try {
    // Agregar columna
    await prisma.$executeRawUnsafe(`
      ALTER TABLE subdivisions 
      ADD COLUMN IF NOT EXISTS is_lowest_level BOOLEAN DEFAULT FALSE;
    `);
    
    console.log('✅ Campo is_lowest_level agregado');
    
    // Agregar índice
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_subdivisions_is_lowest_level 
      ON subdivisions(is_lowest_level) 
      WHERE is_lowest_level = true;
    `);
    
    console.log('✅ Índice agregado');
    
    console.log('\n✅ Migración completada exitosamente');
    console.log('\nAhora ejecuta: node update-lowest-level.mjs');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addField();
