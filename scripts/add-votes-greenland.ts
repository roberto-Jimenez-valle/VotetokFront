/**
 * Agregar votos a Groenlandia
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎲 Agregando votos a Groenlandia...\n');
  
  // Obtener encuestas activas
  const polls = await prisma.poll.findMany({
    where: { status: 'active' },
    include: { options: true }
  });
  
  console.log(`📊 Encuestas activas: ${polls.length}`);
  
  // Obtener usuarios
  const users = await prisma.user.findMany({ take: 100 });
  console.log(`👥 Usuarios: ${users.length}\n`);
  
  const userIds = users.map(u => u.id);
  
  // Obtener subdivisiones de Groenlandia con coordenadas
  const subdivisions: any[] = await prisma.$queryRaw`
    SELECT id, subdivision_id, name, level, latitude, longitude
    FROM subdivisions
    WHERE subdivision_id LIKE 'GRL.%'
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
  `;
  
  console.log(`🌍 Groenlandia:`);
  console.log(`   Subdivisiones: ${subdivisions.length}\n`);
  
  if (subdivisions.length === 0) {
    console.log('❌ No hay subdivisiones con coordenadas');
    return;
  }
  
  // Generar votos
  const values: string[] = [];
  let totalVotes = 0;
  
  for (const poll of polls) {
    if (poll.options.length === 0) continue;
    
    for (const sub of subdivisions) {
      const numVotes = Math.floor(Math.random() * 6) + 3; // 3-8 votos
      
      for (let i = 0; i < numVotes; i++) {
        const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
        const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)];
        
        values.push(`(${poll.id}, ${randomOption.id}, ${randomUserId}, ${sub.latitude}, ${sub.longitude}, ${sub.id}, NOW())`);
        totalVotes++;
      }
    }
  }
  
  if (values.length > 0) {
    // Insertar en chunks
    const chunkSize = 1000;
    for (let i = 0; i < values.length; i += chunkSize) {
      const chunk = values.slice(i, i + chunkSize);
      await prisma.$executeRawUnsafe(`
        INSERT INTO votes (poll_id, option_id, user_id, latitude, longitude, subdivision_id, created_at)
        VALUES ${chunk.join(', ')}
        ON CONFLICT DO NOTHING
      `);
    }
    
    console.log(`✅ ${totalVotes} votos agregados a Groenlandia\n`);
  }
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
