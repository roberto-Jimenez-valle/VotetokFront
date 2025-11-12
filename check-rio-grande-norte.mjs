import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  // Obtener todos los municipios de Rio Grande do Norte
  const municipalities = await prisma.subdivision.findMany({
    where: {
      subdivisionId: {
        startsWith: 'BRA.20.'
      }
    },
    select: {
      subdivisionId: true,
      name: true,
      _count: {
        select: {
          votes: true
        }
      }
    },
    orderBy: {
      subdivisionId: 'asc'
    }
  });
  
  const withVotes = municipalities.filter(m => m._count.votes > 0);
  const withoutVotes = municipalities.filter(m => m._count.votes === 0);
  
  console.log('📊 Municipios de Rio Grande do Norte (BRA.20):');
  console.log(`Total: ${municipalities.length}`);
  console.log(`Con votos: ${withVotes.length}`);
  console.log(`Sin votos: ${withoutVotes.length}\n`);
  
  if (withoutVotes.length > 0) {
    console.log('❌ Municipios SIN votos (aparecerán grises):');
    withoutVotes.slice(0, 10).forEach(m => {
      console.log(`  ${m.subdivisionId.padEnd(15)} - ${m.name}`);
    });
    
    if (withoutVotes.length > 10) {
      console.log(`  ... y ${withoutVotes.length - 10} más`);
    }
  }
  
  console.log('\n💡 Solución: Generar votos para estos municipios vacíos');
  
} finally {
  await prisma.$disconnect();
}
