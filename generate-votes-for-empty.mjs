import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateVotes() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🎲 GENERANDO VOTOS PARA SUBDIVISIONES VACÍAS');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // 1. Obtener subdivisiones sin votos
    console.log('📊 1. Obteniendo subdivisiones sin votos...\n');
    
    const emptySubdivisions = await prisma.$queryRaw`
      SELECT s.id, s.subdivision_id, s.name, s.level, s.latitude, s.longitude
      FROM subdivisions s
      LEFT JOIN votes v ON s.id = v.subdivision_id
      WHERE s.is_lowest_level = TRUE
      GROUP BY s.id, s.subdivision_id, s.name, s.level, s.latitude, s.longitude
      HAVING COUNT(v.id) = 0
      ORDER BY RANDOM()
    `;
    
    console.log(`   Total sin votos: ${emptySubdivisions.length}\n`);
    
    // 2. Obtener encuestas activas
    console.log('📊 2. Obteniendo encuestas activas...\n');
    
    const activePolls = await prisma.poll.findMany({
      where: {
        status: 'active'
      },
      select: {
        id: true,
        title: true,
        options: {
          select: {
            id: true,
            optionKey: true
          }
        }
      },
      take: 50 // Usar top 50 encuestas
    });
    
    console.log(`   Encuestas activas: ${activePolls.length}\n`);
    
    if (activePolls.length === 0) {
      console.log('❌ No hay encuestas activas para generar votos');
      return;
    }
    
    // 3. Obtener usuarios para asignar votos
    console.log('📊 3. Obteniendo usuarios...\n');
    
    const users = await prisma.user.findMany({
      select: {
        id: true
      },
      take: 100
    });
    
    console.log(`   Usuarios disponibles: ${users.length}\n`);
    
    if (users.length === 0) {
      console.log('❌ No hay usuarios para asignar votos');
      return;
    }
    
    // 4. Generar votos
    console.log('🎲 4. Generando votos...\n');
    console.log('   Esto puede tomar varios minutos...\n');
    
    let totalVotesCreated = 0;
    const batchSize = 100;
    
    for (let i = 0; i < emptySubdivisions.length; i += batchSize) {
      const batch = emptySubdivisions.slice(i, i + batchSize);
      const votesToCreate = [];
      
      for (const sub of batch) {
        // Generar entre 1 y 5 votos por subdivisión
        const numVotes = Math.floor(Math.random() * 5) + 1;
        
        for (let j = 0; j < numVotes; j++) {
          // Seleccionar encuesta aleatoria
          const poll = activePolls[Math.floor(Math.random() * activePolls.length)];
          
          if (poll.options.length === 0) continue;
          
          // Seleccionar opción aleatoria
          const option = poll.options[Math.floor(Math.random() * poll.options.length)];
          
          // Seleccionar usuario aleatorio
          const user = users[Math.floor(Math.random() * users.length)];
          
          // Usar coordenadas de la subdivisión con pequeña variación aleatoria
          // para simular votos desde diferentes ubicaciones dentro de la subdivisión
          const latOffset = (Math.random() - 0.5) * 0.1; // ±0.05 grados
          const lonOffset = (Math.random() - 0.5) * 0.1;
          
          votesToCreate.push({
            userId: user.id,
            pollId: poll.id,
            optionId: option.id,
            subdivisionId: sub.id,
            latitude: Number(sub.latitude) + latOffset,
            longitude: Number(sub.longitude) + lonOffset,
            createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
          });
        }
      }
      
      // Insertar en lote
      if (votesToCreate.length > 0) {
        await prisma.vote.createMany({
          data: votesToCreate,
          skipDuplicates: true
        });
        
        totalVotesCreated += votesToCreate.length;
        
        const progress = Math.min(i + batchSize, emptySubdivisions.length);
        console.log(`   ✅ Progreso: ${progress}/${emptySubdivisions.length} subdivisiones (${totalVotesCreated} votos creados)`);
      }
    }
    
    console.log(`\n✅ Total de votos creados: ${totalVotesCreated}\n`);
    
    // 5. Verificar resultado
    console.log('📊 5. Verificando resultado...\n');
    
    const stillEmpty = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count
      FROM subdivisions s
      LEFT JOIN votes v ON s.id = v.subdivision_id
      WHERE s.is_lowest_level = TRUE
      GROUP BY s.id
      HAVING COUNT(v.id) = 0
    `;
    
    const emptyCount = stillEmpty.length || 0;
    
    console.log(`   Subdivisiones que aún no tienen votos: ${emptyCount}`);
    console.log(`   Subdivisiones con votos generados: ${emptySubdivisions.length - emptyCount}`);
    
    // Estadísticas finales
    const totalVotes = await prisma.vote.count();
    const subsWithVotes = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT subdivision_id)::int as count 
      FROM votes
    `;
    
    console.log(`\n📊 Estadísticas finales:`);
    console.log(`   Total de votos en sistema: ${totalVotes.toLocaleString()}`);
    console.log(`   Subdivisiones con votos: ${subsWithVotes[0].count}`);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ GENERACIÓN DE VOTOS COMPLETADA');
    console.log('═══════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateVotes();
