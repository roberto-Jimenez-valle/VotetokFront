/**
 * Verifica qué tablas existen en la base de datos
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTables() {
  console.log('🔍 Verificando tablas en la base de datos...\n');

  try {
    // Listar todas las tablas
    const tables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name;
    `;

    console.log('📋 Tablas encontradas:');
    tables.forEach(table => {
      console.log(`  - ${table.name}`);
    });

    console.log('\n🔍 Verificando tabla countries...');
    try {
      const countryCount = await prisma.country.count();
      console.log(`✅ Tabla 'countries' existe con ${countryCount} registros`);
      
      // Mostrar algunos países
      const sampleCountries = await prisma.country.findMany({
        take: 5,
        orderBy: { name: 'asc' }
      });
      console.log('   Ejemplos:');
      sampleCountries.forEach(c => {
        console.log(`     - ${c.iso3}: ${c.name}`);
      });
    } catch (e) {
      console.error('❌ Tabla countries no existe o está vacía:', e.message);
    }

    console.log('\n🔍 Verificando tabla subdivisions...');
    try {
      const subdivisionCount = await prisma.subdivision.count();
      console.log(`✅ Tabla 'subdivisions' existe con ${subdivisionCount} registros`);
      
      // Mostrar algunas subdivisiones de España
      const espSubdivisions = await prisma.subdivision.findMany({
        where: { 
          country: { iso3: 'ESP' },
          level: 1
        },
        include: { country: true },
        take: 5
      });
      console.log('   Subdivisiones de España:');
      espSubdivisions.forEach(s => {
        console.log(`     - ${s.subdivisionId}: ${s.name}`);
      });
    } catch (e) {
      console.error('❌ Tabla subdivisions no existe o está vacía:', e.message);
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();
