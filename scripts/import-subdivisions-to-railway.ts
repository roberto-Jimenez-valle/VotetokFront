/**
 * Paso 2: Importar subdivisiones de JSON a RAILWAY
 * Este script escribe en Railway PostgreSQL
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

interface SubdivisionData {
  id: number;
  subdivision_id: string;
  level: number;
  level1_id: string | null;
  level2_id: string | null;
  level3_id: string | null;
  name: string;
  name_local: string | null;
  name_variant: string | null;
  type_english: string | null;
  hasc: string | null;
  iso: string | null;
  country_code: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
}

async function importSubdivisions() {
  try {
    const jsonPath = 'subdivisions-export.json';
    
    console.log(`📂 Leyendo ${jsonPath}...`);
    const subdivisions: SubdivisionData[] = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    
    console.log(`✅ ${subdivisions.length} subdivisiones cargadas del JSON`);
    
    console.log('\n🧹 Limpiando subdivisiones en RAILWAY...');
    await prisma.subdivision.deleteMany({});
    console.log('✅ Subdivisiones eliminadas');
    
    console.log('\n📤 Importando a RAILWAY...');
    let imported = 0;
    
    for (const subdivision of subdivisions) {
      // Crear el objeto con solo los campos necesarios
      const data: any = {
        subdivisionId: subdivision.subdivision_id,
        level: subdivision.level,
        name: subdivision.name,
        latitude: subdivision.latitude,
        longitude: subdivision.longitude,
      };
      
      // Agregar campos opcionales solo si tienen valor
      if (subdivision.level1_id) data.level1Id = subdivision.level1_id;
      if (subdivision.level2_id) data.level2Id = subdivision.level2_id;
      if (subdivision.level3_id) data.level3Id = subdivision.level3_id;
      if (subdivision.name_local) data.nameLocal = subdivision.name_local;
      if (subdivision.name_variant) data.nameVariant = subdivision.name_variant;
      if (subdivision.type_english) data.typeEnglish = subdivision.type_english;
      if (subdivision.hasc) data.hasc = subdivision.hasc;
      if (subdivision.iso) data.iso = subdivision.iso;
      if (subdivision.country_code) data.countryCode = subdivision.country_code;
      
      await prisma.subdivision.create({ data });
      
      imported++;
      
      if (imported % 500 === 0) {
        console.log(`  📊 ${imported}/${subdivisions.length} importadas...`);
      }
    }
    
    console.log(`\n✅ ${imported} subdivisiones importadas a RAILWAY`);
    
    // Verificar
    const count = await prisma.subdivision.count();
    console.log(`\n📊 Total en RAILWAY: ${count}`);
    
    // Estadísticas por nivel
    console.log('\n📊 Subdivisiones por nivel:');
    const byLevel = await prisma.subdivision.groupBy({
      by: ['level'],
      _count: { id: true }
    });
    
    for (const stat of byLevel.sort((a, b) => a.level - b.level)) {
      console.log(`  Nivel ${stat.level}: ${stat._count.id} subdivisiones`);
    }
    
    // Muestra de España
    console.log('\n🇪🇸 Subdivisiones de España (muestra):');
    const spain = await prisma.subdivision.findMany({
      where: {
        subdivisionId: {
          startsWith: 'ESP.'
        }
      },
      orderBy: { level: 'asc' },
      take: 10
    });
    
    for (const sub of spain) {
      console.log(`  ${sub.name} (${sub.subdivisionId}) - Nivel ${sub.level}`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

importSubdivisions();
