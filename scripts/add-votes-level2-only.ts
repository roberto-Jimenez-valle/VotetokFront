/**
 * Agregar votos a subdivisiones nivel 2 de países que NO tienen nivel 3
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎲 Agregando votos a países con solo nivel 2...\n');
  
  // 1. Encontrar países que tienen nivel 2 pero NO tienen nivel 3
  console.log('📊 Identificando países con solo nivel 2...\n');
  
  const allCountries = await prisma.subdivision.findMany({
    where: { level: 1 },
    select: { subdivisionId: true, name: true }
  });
  
  const level2OnlyCountries: Array<{ code: string; name: string }> = [];
  
  for (const country of allCountries) {
    const countryCode = country.subdivisionId;
    
    const hasLevel3 = await prisma.subdivision.count({
      where: {
        subdivisionId: { startsWith: `${countryCode}.` },
        level: 3
      }
    });
    
    const hasLevel2 = await prisma.subdivision.count({
      where: {
        subdivisionId: { startsWith: `${countryCode}.` },
        level: 2
      }
    });
    
    if (hasLevel2 > 0 && hasLevel3 === 0) {
      level2OnlyCountries.push({
        code: countryCode,
        name: country.name
      });
    }
  }
  
  console.log(`✅ Países con solo nivel 2: ${level2OnlyCountries.length}\n`);
  level2OnlyCountries.forEach(c => console.log(`   ${c.code}: ${c.name}`));
  console.log('');
  
  // 2. Obtener encuestas activas
  const polls = await prisma.poll.findMany({
    where: { status: 'active' },
    include: { options: true }
  });
  
  console.log(`📊 Encuestas activas: ${polls.length}\n`);
  
  if (polls.length === 0) {
    console.log('❌ No hay encuestas activas');
    return;
  }
  
  // 3. Obtener usuarios
  const users = await prisma.user.findMany({ take: 100 });
  console.log(`👥 Usuarios disponibles: ${users.length}\n`);
  
  if (users.length === 0) {
    console.log('❌ No hay usuarios');
    return;
  }
  
  console.log('='.repeat(70));
  console.log('🎯 Agregando votos...\n');
  
  let totalVotesAdded = 0;
  let countriesProcessed = 0;
  
  // 4. Para cada país con solo nivel 2
  for (const country of level2OnlyCountries) {
    console.log(`🌍 ${country.code} - ${country.name}`);
    
    // Obtener subdivisiones nivel 2
    const subdivisions = await prisma.subdivision.findMany({
      where: {
        subdivisionId: { startsWith: `${country.code}.` },
        level: 2
      }
    });
    
    if (subdivisions.length === 0) {
      console.log(`   ⚠️  No tiene subdivisiones nivel 2`);
      continue;
    }
    
    console.log(`   Subdivisiones nivel 2: ${subdivisions.length}`);
    
    let countryVotes = 0;
    const votesToInsert: any[] = [];
    
    // Para cada encuesta
    for (const poll of polls) {
      if (poll.options.length === 0) continue;
      
      // Para cada subdivisión nivel 2, agregar 3-8 votos aleatorios
      for (const subdivision of subdivisions) {
        const numVotes = Math.floor(Math.random() * 6) + 3; // 3-8 votos
        
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
      countriesProcessed++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN FINAL:\n');
  console.log(`✅ Países procesados: ${countriesProcessed} / ${level2OnlyCountries.length}`);
  console.log(`🎲 Total de votos agregados: ${totalVotesAdded.toLocaleString()}`);
  console.log(`📈 Promedio por país: ${Math.round(totalVotesAdded / Math.max(countriesProcessed, 1)).toLocaleString()} votos`);
  
  // Verificar algunos países
  console.log('\n🔍 Verificando votos agregados...\n');
  
  const samplesToCheck = level2OnlyCountries.slice(0, 5);
  for (const country of samplesToCheck) {
    const count = await prisma.vote.count({
      where: {
        subdivision: {
          subdivisionId: { startsWith: `${country.code}.` }
        }
      }
    });
    
    console.log(`${country.code} (${country.name}): ${count} votos`);
  }
  
  console.log('\n✨ Listo! Refresca la página para ver los países coloreados.');
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
