/**
 * Agregar votos a nivel 2 de UKR y ARE para que se vean en vista mundial y drill-down
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎲 Agregando votos a nivel 2 de UKR y ARE...\n');
  
  const polls = await prisma.poll.findMany({
    where: { status: 'active' },
    include: { options: true }
  });
  
  const users = await prisma.user.findMany({ take: 100 });
  const userIds = users.map(u => u.id);
  
  console.log(`📊 Encuestas: ${polls.length}, Usuarios: ${userIds.length}\n`);
  
  // === EMIRATOS ÁRABES ===
  console.log('🇦🇪 EMIRATOS ÁRABES:');
  console.log('='.repeat(70));
  
  const areLevel2: any[] = await prisma.$queryRaw`
    SELECT id, subdivision_id, name, level, latitude, longitude
    FROM subdivisions
    WHERE subdivision_id LIKE 'ARE.%'
      AND level = 2
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
  `;
  
  console.log(`   Subdivisiones nivel 2: ${areLevel2.length}`);
  
  if (areLevel2.length > 0) {
    const values: string[] = [];
    let areVotes = 0;
    
    for (const poll of polls) {
      if (poll.options.length === 0) continue;
      
      for (const sub of areLevel2) {
        const numVotes = Math.floor(Math.random() * 6) + 3; // 3-8 votos
        
        for (let i = 0; i < numVotes; i++) {
          const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
          const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)];
          
          values.push(`(${poll.id}, ${randomOption.id}, ${randomUserId}, ${sub.latitude}, ${sub.longitude}, ${sub.id}, NOW())`);
          areVotes++;
        }
      }
    }
    
    if (values.length > 0) {
      const chunkSize = 1000;
      for (let i = 0; i < values.length; i += chunkSize) {
        const chunk = values.slice(i, i + chunkSize);
        await prisma.$executeRawUnsafe(`
          INSERT INTO votes (poll_id, option_id, user_id, latitude, longitude, subdivision_id, created_at)
          VALUES ${chunk.join(', ')}
          ON CONFLICT DO NOTHING
        `);
      }
      
      console.log(`   ✅ ${areVotes} votos agregados\n`);
    }
  } else {
    console.log(`   ⚠️  Sin subdivisiones nivel 2\n`);
  }
  
  // === UCRANIA ===
  console.log('🇺🇦 UCRANIA:');
  console.log('='.repeat(70));
  
  // Ucrania NO tiene subdivisiones nivel 2 en BD, solo nivel 3
  // Necesitamos crear nivel 2 artificialmente o agregar votos al nivel 1 (país)
  
  const ukrCountry = await prisma.subdivision.findUnique({
    where: { subdivisionId: 'UKR' }
  });
  
  if (ukrCountry) {
    console.log(`   Agregando votos a nivel 1 (país completo)`);
    
    const values: string[] = [];
    let ukrVotes = 0;
    
    // Usar las coordenadas de Kiev como referencia
    const lat = 50.4501;
    const lon = 30.5234;
    
    for (const poll of polls) {
      if (poll.options.length === 0) continue;
      
      const numVotes = Math.floor(Math.random() * 20) + 10; // 10-30 votos por encuesta
      
      for (let i = 0; i < numVotes; i++) {
        const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
        const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)];
        
        values.push(`(${poll.id}, ${randomOption.id}, ${randomUserId}, ${lat}, ${lon}, ${ukrCountry.id}, NOW())`);
        ukrVotes++;
      }
    }
    
    if (values.length > 0) {
      const chunkSize = 1000;
      for (let i = 0; i < values.length; i += chunkSize) {
        const chunk = values.slice(i, i + chunkSize);
        await prisma.$executeRawUnsafe(`
          INSERT INTO votes (poll_id, option_id, user_id, latitude, longitude, subdivision_id, created_at)
          VALUES ${chunk.join(', ')}
          ON CONFLICT DO NOTHING
        `);
      }
      
      console.log(`   ✅ ${ukrVotes} votos agregados a nivel 1\n`);
    }
  } else {
    console.log(`   ❌ No existe subdivisión nivel 1\n`);
  }
  
  console.log('='.repeat(70));
  console.log('✅ Votos agregados completamente\n');
  
  console.log('🔧 AHORA:');
  console.log('   1. Hard refresh (Ctrl + Shift + R)');
  console.log('   2. Emiratos Árabes debería colorearse en vista mundial');
  console.log('   3. Ucrania debería colorearse en vista mundial');
  console.log('   4. Al hacer drill-down, deberían verse los colores');
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
