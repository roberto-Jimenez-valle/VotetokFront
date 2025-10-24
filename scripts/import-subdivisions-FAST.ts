/**
 * Importación RÁPIDA usando createMany en batches
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

async function importSubdivisionsFast() {
  try {
    const jsonPath = 'subdivisions-export.json';
    
    console.log(`📂 Leyendo ${jsonPath}...`);
    const subdivisions: SubdivisionData[] = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    
    console.log(`✅ ${subdivisions.length} subdivisiones cargadas del JSON`);
    
    console.log('\n🧹 Limpiando subdivisiones en RAILWAY...');
    await prisma.subdivision.deleteMany({});
    console.log('✅ Subdivisiones eliminadas');
    
    console.log('\n📤 Importando con createMany en batches...');
    
    const BATCH_SIZE = 1000;
    let imported = 0;
    
    for (let i = 0; i < subdivisions.length; i += BATCH_SIZE) {
      const batch = subdivisions.slice(i, i + BATCH_SIZE);
      
      // Preparar datos para createMany
      const data = batch.map(subdivision => {
        const record: any = {
          subdivisionId: subdivision.subdivision_id,
          level: subdivision.level,
          name: subdivision.name,
          latitude: subdivision.latitude,
          longitude: subdivision.longitude,
        };
        
        // Agregar campos opcionales
        if (subdivision.level1_id) record.level1Id = subdivision.level1_id;
        if (subdivision.level2_id) record.level2Id = subdivision.level2_id;
        if (subdivision.level3_id) record.level3Id = subdivision.level3_id;
        if (subdivision.name_local) record.nameLocal = subdivision.name_local;
        if (subdivision.name_variant) record.nameVariant = subdivision.name_variant;
        if (subdivision.type_english) record.typeEnglish = subdivision.type_english;
        if (subdivision.hasc) record.hasc = subdivision.hasc;
        if (subdivision.iso) record.iso = subdivision.iso;
        if (subdivision.country_code) record.countryCode = subdivision.country_code;
        
        return record;
      });
      
      // Insertar batch completo
      await prisma.subdivision.createMany({ data });
      
      imported += batch.length;
      console.log(`  📊 ${imported}/${subdivisions.length} importadas (${Math.round(imported/subdivisions.length*100)}%)`);
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
    
    // Muestra de España con level2_id
    console.log('\n🇪🇸 Subdivisiones de España nivel 3 con level2_id (muestra):');
    const spainLevel3 = await prisma.subdivision.findMany({
      where: {
        subdivisionId: {
          startsWith: 'ESP.'
        },
        level: 3,
        level2Id: {
          not: null
        }
      },
      orderBy: { subdivisionId: 'asc' },
      take: 10
    });
    
    for (const sub of spainLevel3) {
      console.log(`  ${sub.name} (${sub.subdivisionId}) - level2_id: ${sub.level2Id}`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

importSubdivisionsFast();
