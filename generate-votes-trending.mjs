import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateTrendingVotes() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🎲 GENERANDO VOTOS PARA ENCUESTAS TRENDING');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // 1. Obtener las 20 trending polls (últimos 30 días, más activas)
    console.log('📊 1. Obteniendo encuestas trending...\n');
    
    const dateLimit = new Date();
    dateLimit.setHours(dateLimit.getHours() - 720); // 30 días
    
    const trendingPolls = await prisma.poll.findMany({
      where: {
        status: 'active',
        isRell: false,
        createdAt: {
          gte: dateLimit
        }
      },
      select: {
        id: true,
        title: true,
        options: {
          select: {
            id: true,
            optionKey: true
          }
        },
        _count: {
          select: {
            votes: true
          }
        }
      },
      orderBy: {
        votes: {
          _count: 'desc'
        }
      },
      take: 20
    });
    
    console.log(`   Trending polls: ${trendingPolls.length}\n`);
    trendingPolls.forEach(p => {
      console.log(`   - ${p.title} (${p._count.votes} votos)`);
    });
    
    // 2. Obtener todas las subdivisiones de último nivel
    console.log('\n📊 2. Obteniendo subdivisiones...\n');
    
    const allSubdivisions = await prisma.subdivision.findMany({
      where: {
        isLowestLevel: true
      },
      select: {
        id: true,
        subdivisionId: true,
        name: true,
        level: true,
        latitude: true,
        longitude: true
      }
    });
    
    console.log(`   Total subdivisiones: ${allSubdivisions.length}\n`);
    
    // 3. Obtener usuarios
    console.log('📊 3. Obteniendo usuarios...\n');
    
    const users = await prisma.user.findMany({
      select: {
        id: true
      },
      take: 100
    });
    
    console.log(`   Usuarios disponibles: ${users.length}\n`);
    
    // 4. Generar votos donde falten
    console.log('🎲 4. Generando votos...\n');
    console.log('   Esto puede tomar varios minutos...\n');
    
    let totalVotesCreated = 0;
    const batchSize = 500;
    let votesToCreate = [];
    
    for (let i = 0; i < allSubdivisions.length; i++) {
      const sub = allSubdivisions[i];
      
      // Para cada subdivisión, verificar qué trending polls NO tienen votos
      for (const poll of trendingPolls) {
        // Verificar si ya tiene votos en esta encuesta
        const existingVote = await prisma.vote.findFirst({
          where: {
            pollId: poll.id,
            subdivisionId: sub.id
          }
        });
        
        if (!existingVote && poll.options.length > 0) {
          // No tiene votos, generar 1-3 votos
          const numVotes = Math.floor(Math.random() * 3) + 1;
          
          for (let j = 0; j < numVotes; j++) {
            const option = poll.options[Math.floor(Math.random() * poll.options.length)];
            const user = users[Math.floor(Math.random() * users.length)];
            
            const latOffset = (Math.random() - 0.5) * 0.1;
            const lonOffset = (Math.random() - 0.5) * 0.1;
            
            votesToCreate.push({
              userId: user.id,
              pollId: poll.id,
              optionId: option.id,
              subdivisionId: sub.id,
              latitude: Number(sub.latitude) + latOffset,
              longitude: Number(sub.longitude) + lonOffset,
              createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
            });
          }
        }
      }
      
      // Insertar en lotes
      if (votesToCreate.length >= batchSize) {
        await prisma.vote.createMany({
          data: votesToCreate,
          skipDuplicates: true
        });
        
        totalVotesCreated += votesToCreate.length;
        console.log(`   ✅ Progreso: ${i + 1}/${allSubdivisions.length} subdivisiones (${totalVotesCreated} votos creados)`);
        votesToCreate = [];
      }
    }
    
    // Insertar votos restantes
    if (votesToCreate.length > 0) {
      await prisma.vote.createMany({
        data: votesToCreate,
        skipDuplicates: true
      });
      totalVotesCreated += votesToCreate.length;
    }
    
    console.log(`\n✅ Total de votos creados: ${totalVotesCreated}\n`);
    
    // 5. Estadísticas finales
    const totalVotes = await prisma.vote.count();
    
    console.log('📊 Estadísticas finales:');
    console.log(`   Total de votos en sistema: ${totalVotes.toLocaleString()}`);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ GENERACIÓN DE VOTOS TRENDING COMPLETADA');
    console.log('═══════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateTrendingVotes();
