/**
 * Agregar votos nivel 3 a países que no tienen votos
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const grayCountries = [
  'LBY', 'UKR', 'ARM', 'MDA', 'MKD', 'MNE', 'ISR', 'CYP', 
  'JAM', 'KWT', 'QAT', 'BHS', 'BLZ', 'GRL', 'LSO', 'PRI', 
  'ESH', 'TTO', 'ATF'
];

async function main() {
  console.log('🎲 Agregando votos a países grises...\n');
  
  // 1. Obtener todas las encuestas activas
  const polls = await prisma.poll.findMany({
    where: { status: 'active' },
    include: { options: true }
  });
  
  console.log(`📊 Encuestas activas: ${polls.length}\n`);
  
  if (polls.length === 0) {
    console.log('❌ No hay encuestas activas');
    return;
  }
  
  // 2. Obtener usuarios para asignar votos
  const users = await prisma.user.findMany({
    take: 100
  });
  
  console.log(`👥 Usuarios disponibles: ${users.length}\n`);
  
  if (users.length === 0) {
    console.log('❌ No hay usuarios en la BD');
    return;
  }
  
  let totalVotesAdded = 0;
  
  // 3. Para cada país gris
  for (const countryCode of grayCountries) {
    console.log(`\n🌍 Procesando ${countryCode}...`);
    
    // Obtener subdivisiones nivel 3 de este país
    const subdivisions = await prisma.subdivision.findMany({
      where: {
        subdivisionId: {
          startsWith: `${countryCode}.`
        },
        level: 3
      }
    });
    
    if (subdivisions.length === 0) {
      console.log(`   ⚠️  No tiene subdivisiones nivel 3 en BD`);
      continue;
    }
    
    console.log(`   Subdivisiones nivel 3: ${subdivisions.length}`);
    
    // Agregar votos para cada encuesta
    let countryVotes = 0;
    const votesToInsert: any[] = [];
    
    for (const poll of polls) {
      if (poll.options.length === 0) continue;
      
      // Para cada subdivisión, agregar 1-3 votos aleatorios
      for (const subdivision of subdivisions) {
        const numVotes = Math.floor(Math.random() * 3) + 1; // 1-3 votos
        
        for (let i = 0; i < numVotes; i++) {
          const randomUser = users[Math.floor(Math.random() * users.length)];
          const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)];
          
          votesToInsert.push({
            pollId: poll.id,
            optionId: randomOption.id,
            userId: randomUser.id,
            subdivisionId: subdivision.id,
            createdAt: new Date()
          });
          
          countryVotes++;
        }
      }
    }
    
    // Insertar todos los votos en batch
    if (votesToInsert.length > 0) {
      await prisma.vote.createMany({
        data: votesToInsert,
        skipDuplicates: true
      });
      
      console.log(`   ✅ ${countryVotes} votos agregados`);
      totalVotesAdded += countryVotes;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN:\n');
  console.log(`✅ Total de votos agregados: ${totalVotesAdded}`);
  console.log(`📍 Países procesados: ${grayCountries.length}`);
  
  // Verificar países que ahora tienen votos
  console.log('\n🔍 Verificando países que ahora tienen votos...\n');
  
  for (const code of grayCountries) {
    const count = await prisma.vote.count({
      where: {
        subdivision: {
          subdivisionId: {
            startsWith: `${code}.`
          }
        }
      }
    });
    
    if (count > 0) {
      console.log(`✅ ${code}: ${count} votos`);
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('\n✨ Listo! Refresca la página para ver los cambios.');
  })
  .catch(async (e) => {
    console.error('❌ Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
