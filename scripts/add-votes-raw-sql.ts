/**
 * Agregar votos directamente con SQL raw (más rápido y sin validaciones)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const newCountries = [
  'ARM', 'UKR', 'MKD', 'ISR', 'CYP', 'JAM', 'KWT', 'QAT', 
  'BHS', 'BLZ', 'LSO', 'PRI', 'LBY', 'MDA', 'MNE', 'TTO'
];

async function main() {
  console.log('🎲 Agregando votos directamente con SQL...\n');
  
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
  
  const userIds = users.map(u => u.id);
  
  console.log('='.repeat(70));
  console.log('🎯 Procesando países...\n');
  
  let totalVotes = 0;
  
  for (const countryCode of newCountries) {
    console.log(`🌍 ${countryCode}`);
    
    // Obtener subdivisiones nivel 3 con coordenadas válidas usando SQL
    const subdivisions: any[] = await prisma.$queryRaw`
      SELECT id, subdivision_id, name, level, latitude, longitude
      FROM subdivisions
      WHERE subdivision_id LIKE ${countryCode + '.%'}
        AND level = 3
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
    `;
    
    if (subdivisions.length === 0) {
      // Intentar nivel 2
      const subLevel2: any[] = await prisma.$queryRaw`
        SELECT id, subdivision_id, name, level, latitude, longitude
        FROM subdivisions
        WHERE subdivision_id LIKE ${countryCode + '.%'}
          AND level = 2
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
      `;
      
      if (subLevel2.length === 0) {
        console.log(`   ⚠️  Sin subdivisiones\n`);
        continue;
      }
      
      console.log(`   Usando nivel 2: ${subLevel2.length} subdivisiones`);
      
      // Generar votos para nivel 2
      const values: string[] = [];
      let countryVotes = 0;
      
      for (const poll of polls) {
        if (poll.options.length === 0) continue;
        
        for (const sub of subLevel2) {
          const numVotes = Math.floor(Math.random() * 6) + 3; // 3-8 votos
          
          for (let i = 0; i < numVotes; i++) {
            const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
            const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)];
            
            values.push(`(${poll.id}, ${randomOption.id}, ${randomUserId}, ${sub.latitude}, ${sub.longitude}, ${sub.id}, NOW())`);
            countryVotes++;
          }
        }
      }
      
      if (values.length > 0) {
        // Insertar en chunks de 1000
        const chunkSize = 1000;
        for (let i = 0; i < values.length; i += chunkSize) {
          const chunk = values.slice(i, i + chunkSize);
          await prisma.$executeRawUnsafe(`
            INSERT INTO votes (poll_id, option_id, user_id, latitude, longitude, subdivision_id, created_at)
            VALUES ${chunk.join(', ')}
            ON CONFLICT DO NOTHING
          `);
        }
        
        console.log(`   ✅ ${countryVotes} votos (nivel 2)\n`);
        totalVotes += countryVotes;
      }
      
      continue;
    }
    
    console.log(`   Subdivisiones nivel 3: ${subdivisions.length}`);
    
    // Generar votos para nivel 3
    const values: string[] = [];
    let countryVotes = 0;
    
    for (const poll of polls) {
      if (poll.options.length === 0) continue;
      
      for (const sub of subdivisions) {
        const numVotes = Math.floor(Math.random() * 3) + 1; // 1-3 votos
        
        for (let i = 0; i < numVotes; i++) {
          const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
          const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)];
          
          values.push(`(${poll.id}, ${randomOption.id}, ${randomUserId}, ${sub.latitude}, ${sub.longitude}, ${sub.id}, NOW())`);
          countryVotes++;
        }
      }
    }
    
    if (values.length > 0) {
      // Insertar en chunks de 1000
      const chunkSize = 1000;
      for (let i = 0; i < values.length; i += chunkSize) {
        const chunk = values.slice(i, i + chunkSize);
        await prisma.$executeRawUnsafe(`
          INSERT INTO votes (poll_id, option_id, user_id, latitude, longitude, subdivision_id, created_at)
          VALUES ${chunk.join(', ')}
          ON CONFLICT DO NOTHING
        `);
      }
      
      console.log(`   ✅ ${countryVotes} votos (nivel 3)\n`);
      totalVotes += countryVotes;
    }
  }
  
  console.log('='.repeat(70));
  console.log('📊 RESUMEN FINAL\n');
  console.log(`🎲 Total de votos agregados: ${totalVotes.toLocaleString()}`);
  
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
