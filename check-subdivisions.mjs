import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSubdivisions() {
  console.log('🔍 Verificando subdivisiones en la base de datos...\n');
  
  const total = await prisma.subdivision.count();
  console.log(`📊 Total de subdivisiones: ${total}`);
  
  if (total === 0) {
    console.log('\n❌ NO HAY SUBDIVISIONES EN LA BASE DE DATOS');
    console.log('   Ese es el problema: el geocoding no puede encontrar subdivisiones');
    console.log('\n💡 Solución: Necesitas importar datos de subdivisiones');
  } else {
    console.log('\n✅ Hay subdivisiones en la BD');
    
    // Mostrar algunas subdivisiones de ejemplo
    const samples = await prisma.subdivision.findMany({
      take: 10,
      include: {
        country: { select: { name: true, iso3: true } }
      }
    });
    
    console.log('\n📋 Ejemplos de subdivisiones:');
    samples.forEach(s => {
      console.log(`   - ${s.name} (${s.country.name}) - Level ${s.level} - ID: ${s.subdivision_id}`);
    });
    
    // Contar por país
    const byCountry = await prisma.subdivision.groupBy({
      by: ['countryId'],
      _count: { id: true }
    });
    
    console.log(`\n📊 Países con subdivisiones: ${byCountry.length}`);
  }
  
  await prisma.$disconnect();
}

checkSubdivisions();
