/**
 * Agregar votos a territorios específicos
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const territories = ['ESH', 'ATF']; // Western Sahara, French Southern Territories

async function main() {
  console.log('🎲 Agregando votos a territorios...\n');
  
  const polls = await prisma.poll.findMany({
    where: { status: 'active' },
    include: { options: true }
  });
  
  const users = await prisma.user.findMany({ take: 100 });
  const userIds = users.map(u => u.id);
  
  console.log(`📊 Encuestas: ${polls.length}, Usuarios: ${users.length}\n`);
  
  let totalVotes = 0;
  
  for (const code of territories) {
    console.log(`🌍 ${code}:`);
    
    const subdivisions: any[] = await prisma.$queryRaw`
      SELECT id, subdivision_id, name, level, latitude, longitude
      FROM subdivisions
      WHERE subdivision_id LIKE ${code + '.%'}
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
    `;
    
    if (subdivisions.length === 0) {
      console.log(`   ⚠️ Sin subdivisiones\n`);
      continue;
    }
    
    console.log(`   Subdivisiones: ${subdivisions.length}`);
    
    const values: string[] = [];
    let territoryVotes = 0;
    
    for (const poll of polls) {
      if (poll.options.length === 0) continue;
      
      for (const sub of subdivisions) {
        const numVotes = Math.floor(Math.random() * 6) + 3; // 3-8 votos
        
        for (let i = 0; i < numVotes; i++) {
          const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
          const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)];
          
          values.push(`(${poll.id}, ${randomOption.id}, ${randomUserId}, ${sub.latitude}, ${sub.longitude}, ${sub.id}, NOW())`);
          territoryVotes++;
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
      
      console.log(`   ✅ ${territoryVotes} votos agregados\n`);
      totalVotes += territoryVotes;
    }
  }
  
  console.log('='.repeat(70));
  console.log(`✅ Total: ${totalVotes} votos agregados`);
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
