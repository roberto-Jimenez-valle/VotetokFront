import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  // 1. Obtener trending polls (últimos 30 días)
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
  
  console.log(`📊 Top 20 Trending Polls (últimos 30 días):`);
  console.log(`Total: ${trendingPolls.length} polls\n`);
  
  // 2. Para cada poll, verificar qué estados de Brasil tienen votos
  for (const poll of trendingPolls.slice(0, 5)) { // Solo top 5 para no saturar
    console.log(`\n📋 Poll ${poll.id}: "${poll.title}"`);
    console.log(`   Total votos: ${poll._count.votes}`);
    
    // Obtener votos de Brasil
    const votes = await prisma.vote.findMany({
      where: {
        pollId: poll.id,
        subdivision: {
          subdivisionId: {
            startsWith: 'BRA.'
          }
        }
      },
      select: {
        subdivision: {
          select: {
            subdivisionId: true
          }
        }
      }
    });
    
    // Agregar a nivel 2 (estados)
    const stateVotes = new Map();
    
    for (const vote of votes) {
      const parts = vote.subdivision.subdivisionId.split('.');
      const stateId = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : vote.subdivision.subdivisionId;
      stateVotes.set(stateId, (stateVotes.get(stateId) || 0) + 1);
    }
    
    console.log(`   Votos en Brasil: ${votes.length} (en ${stateVotes.size} estados)`);
    
    // Verificar si Mato Grosso do Sul tiene votos
    const msVotes = stateVotes.get('BRA.11') || 0;
    console.log(`   ├─ BRA.11 (Mato Grosso do Sul): ${msVotes} votos ${msVotes === 0 ? '⚠️ GRIS' : '✅'}`);
    
    // Mostrar algunos estados con votos
    const topStates = [...stateVotes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    if (topStates.length > 0) {
      console.log(`   └─ Top 3 estados:`);
      topStates.forEach(([id, count]) => {
        console.log(`      ${id}: ${count} votos`);
      });
    }
  }
  
  // 3. Verificar TOTAL de votos en cada estado en todas las trending
  console.log(`\n\n📊 RESUMEN TOTAL (todas las trending):`);
  
  const allVotes = await prisma.vote.findMany({
    where: {
      pollId: {
        in: trendingPolls.map(p => p.id)
      },
      subdivision: {
        subdivisionId: {
          startsWith: 'BRA.'
        }
      }
    },
    select: {
      subdivision: {
        select: {
          subdivisionId: true
        }
      }
    }
  });
  
  const totalStateVotes = new Map();
  
  for (const vote of allVotes) {
    const parts = vote.subdivision.subdivisionId.split('.');
    const stateId = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : vote.subdivision.subdivisionId;
    totalStateVotes.set(stateId, (totalStateVotes.get(stateId) || 0) + 1);
  }
  
  console.log(`\nEstados con votos en trending polls:`);
  const sortedStates = [...totalStateVotes.entries()]
    .sort((a, b) => b[1] - a[1]);
  
  sortedStates.forEach(([id, count]) => {
    const emoji = id === 'BRA.11' ? '🔴' : '✅';
    console.log(`  ${emoji} ${id}: ${count} votos`);
  });
  
  const msTotal = totalStateVotes.get('BRA.11') || 0;
  console.log(`\n🎯 Mato Grosso do Sul (BRA.11): ${msTotal} votos en trending polls`);
  
  if (msTotal === 0) {
    console.log(`\n❌ PROBLEMA: Mato Grosso do Sul NO tiene votos en ninguna trending poll`);
    console.log(`   Por eso aparece GRIS en el mapa`);
  } else {
    console.log(`\n✅ Mato Grosso do Sul SÍ tiene ${msTotal} votos en trending`);
  }
  
} finally {
  await prisma.$disconnect();
}
