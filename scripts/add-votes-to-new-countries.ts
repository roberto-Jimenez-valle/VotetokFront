/**
 * Agregar votos a las subdivisiones recién agregadas
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const newCountries = [
  'ARM', 'UKR', 'MKD', 'ISR', 'CYP', 'JAM', 'KWT', 'QAT', 
  'BHS', 'BLZ', 'LSO', 'PRI', 'LBY', 'MDA', 'MNE', 'TTO'
];

async function main() {
  console.log('🎲 Agregando votos a países recién procesados...\n');
  
  // Obtener encuestas activas
  const polls = await prisma.poll.findMany({
    where: { status: 'active' },
    include: { options: true }
  });
  
  console.log(`📊 Encuestas activas: ${polls.length}\n`);
  
  if (polls.length === 0) {
    console.log('❌ No hay encuestas activas');
    return;
  }
  
  // Obtener usuarios
  const users = await prisma.user.findMany({ take: 100 });
  console.log(`👥 Usuarios disponibles: ${users.length}\n`);
  
  if (users.length === 0) {
    console.log('❌ No hay usuarios');
    return;
  }
  
  console.log('='.repeat(70));
  console.log('🎯 Procesando países...\n');
  
  let totalVotes = 0;
  let countriesProcessed = 0;
  
  for (const countryCode of newCountries) {
    console.log(`🌍 ${countryCode}`);
    
    // Obtener subdivisiones nivel 3 del país
    const allSubdivisions = await prisma.subdivision.findMany({
      where: {
        subdivisionId: { startsWith: `${countryCode}.` },
        level: 3
      }
    });
    
    // Filtrar solo las que tienen coordenadas válidas
    const subdivisions = allSubdivisions.filter(sub => 
      sub.latitude !== null && sub.longitude !== null
    );
    
    if (subdivisions.length === 0) {
      // Intentar nivel 2
      const allLevel2 = await prisma.subdivision.findMany({
        where: {
          subdivisionId: { startsWith: `${countryCode}.` },
          level: 2
        }
      });
      
      // Filtrar solo las que tienen coordenadas válidas
      const subLevel2 = allLevel2.filter(sub =>
        sub.latitude !== null && sub.longitude !== null
      );
      
      if (subLevel2.length === 0) {
        console.log(`   ⚠️  Sin subdivisiones\n`);
        continue;
      }
      
      console.log(`   Usando nivel 2: ${subLevel2.length} subdivisiones`);
      
      // Agregar votos a nivel 2
      let countryVotes = 0;
      const votesToInsert: any[] = [];
      
      for (const poll of polls) {
        if (poll.options.length === 0) continue;
        
        for (const sub of subLevel2) {
          const numVotes = Math.floor(Math.random() * 6) + 3; // 3-8 votos
          
          for (let i = 0; i < numVotes; i++) {
            const randomUser = users[Math.floor(Math.random() * users.length)];
            const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)];
            
            votesToInsert.push({
              pollId: poll.id,
              optionId: randomOption.id,
              userId: randomUser.id,
              subdivisionId: sub.id,
              createdAt: new Date()
            });
            countryVotes++;
          }
        }
      }
      
      if (votesToInsert.length > 0) {
        await prisma.vote.createMany({
          data: votesToInsert,
          skipDuplicates: true
        });
        console.log(`   ✅ ${countryVotes} votos (nivel 2)\n`);
        totalVotes += countryVotes;
        countriesProcessed++;
      }
      
      continue;
    }
    
    console.log(`   Subdivisiones nivel 3: ${subdivisions.length}`);
    
    let countryVotes = 0;
    const votesToInsert: any[] = [];
    
    // Agregar votos a nivel 3
    for (const poll of polls) {
      if (poll.options.length === 0) continue;
      
      for (const sub of subdivisions) {
        const numVotes = Math.floor(Math.random() * 3) + 1; // 1-3 votos
        
        for (let i = 0; i < numVotes; i++) {
          const randomUser = users[Math.floor(Math.random() * users.length)];
          const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)];
          
          votesToInsert.push({
            pollId: poll.id,
            optionId: randomOption.id,
            userId: randomUser.id,
            subdivisionId: sub.id,
            createdAt: new Date()
          });
          countryVotes++;
        }
      }
    }
    
    if (votesToInsert.length > 0) {
      await prisma.vote.createMany({
        data: votesToInsert,
        skipDuplicates: true
      });
      console.log(`   ✅ ${countryVotes} votos (nivel 3)\n`);
      totalVotes += countryVotes;
      countriesProcessed++;
    }
  }
  
  console.log('='.repeat(70));
  console.log('📊 RESUMEN FINAL\n');
  console.log(`✅ Países procesados: ${countriesProcessed}`);
  console.log(`🎲 Total de votos: ${totalVotes.toLocaleString()}`);
  
  console.log('\n✨ ¡Listo! Refresca la página para ver los países coloreados.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
