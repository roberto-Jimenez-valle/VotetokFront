/**
 * Script para copiar subdivisiones de la base de datos LOCAL (SQLite) 
 * a la base de datos RAILWAY (PostgreSQL)
 */

import { PrismaClient } from '@prisma/client';

// Cliente para base de datos LOCAL (SQLite)
const prismaLocal = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/dev.db'
    }
  }
});

// Cliente para base de datos RAILWAY (PostgreSQL)
const prismaRailway = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL!
    }
  }
});

async function copySubdivisions() {
  try {
    console.log('📊 Leyendo subdivisiones de la base de datos LOCAL...');
    
    // Leer TODAS las subdivisiones de la DB local
    const localSubdivisions = await prismaLocal.subdivision.findMany({
      orderBy: { id: 'asc' }
    });
    
    console.log(`✅ ${localSubdivisions.length} subdivisiones encontradas en LOCAL`);
    console.log('\n📋 Muestra de datos:');
    console.log(JSON.stringify(localSubdivisions.slice(0, 3), null, 2));
    
    console.log('\n🧹 Limpiando subdivisiones en RAILWAY...');
    await prismaRailway.subdivision.deleteMany({});
    console.log('✅ Subdivisiones eliminadas de RAILWAY');
    
    console.log('\n📤 Copiando subdivisiones a RAILWAY...');
    let copied = 0;
    
    for (const subdivision of localSubdivisions) {
      // Extraer solo los campos que existen en el schema
      const data: any = {
        subdivisionId: subdivision.subdivisionId,
        level: subdivision.level,
        name: subdivision.name,
        latitude: subdivision.latitude,
        longitude: subdivision.longitude,
      };
      
      // Agregar campos opcionales solo si existen
      if (subdivision.level1Id) data.level1Id = subdivision.level1Id;
      if (subdivision.level2Id) data.level2Id = subdivision.level2Id;
      if (subdivision.level3Id) data.level3Id = subdivision.level3Id;
      if (subdivision.nameLocal) data.nameLocal = subdivision.nameLocal;
      if (subdivision.nameVariant) data.nameVariant = subdivision.nameVariant;
      if (subdivision.typeEnglish) data.typeEnglish = subdivision.typeEnglish;
      if (subdivision.hasc) data.hasc = subdivision.hasc;
      if (subdivision.iso) data.iso = subdivision.iso;
      if (subdivision.countryCode) data.countryCode = subdivision.countryCode;
      
      await prismaRailway.subdivision.create({ data });
      
      copied++;
      
      if (copied % 100 === 0) {
        console.log(`  📊 ${copied}/${localSubdivisions.length} copiadas...`);
      }
    }
    
    console.log(`\n✅ ${copied} subdivisiones copiadas correctamente a RAILWAY`);
    
    // Verificar
    const railwayCount = await prismaRailway.subdivision.count();
    console.log(`\n📊 Total en RAILWAY: ${railwayCount}`);
    
    // Mostrar algunas por nivel
    console.log('\n📊 Subdivisiones por nivel:');
    const byLevel = await prismaRailway.subdivision.groupBy({
      by: ['level'],
      _count: { id: true }
    });
    
    for (const stat of byLevel.sort((a, b) => a.level - b.level)) {
      console.log(`  Nivel ${stat.level}: ${stat._count.id} subdivisiones`);
    }
    
    // Mostrar algunas de España
    console.log('\n🇪🇸 Subdivisiones de España (muestra):');
    const spainSubs = await prismaRailway.subdivision.findMany({
      where: {
        subdivisionId: {
          startsWith: 'ESP.'
        }
      },
      take: 5
    });
    
    for (const sub of spainSubs) {
      console.log(`  ${sub.name} (${sub.subdivisionId}) - Nivel ${sub.level}`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prismaLocal.$disconnect();
    await prismaRailway.$disconnect();
  }
}

copySubdivisions();
