import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkISLData() {
  try {
    // 1. Verificar subdivisiones ISL.1.X en la base de datos
    console.log('=== SUBDIVISIONES ISL.1.X EN BASE DE DATOS ===');
    const subs = await prisma.subdivision.findMany({
      where: {
        subdivisionId: {
          startsWith: 'ISL.1.'
        }
      },
      select: {
        id: true,
        subdivisionId: true,
        name: true,
        level: true
      },
      orderBy: {
        subdivisionId: 'asc'
      }
    });
    
    console.log(`\nTotal encontradas: ${subs.length}`);
    subs.forEach(s => {
      console.log(`  ${s.subdivisionId} - ${s.name} (level ${s.level}, id: ${s.id})`);
    });
    
    // 2. Verificar si hay VOTOS para estas subdivisiones
    console.log('\n=== VOTOS PARA ISL.1.X ===');
    const votes = await prisma.vote.findMany({
      where: {
        subdivisionId: {
          in: subs.map(s => s.id)
        }
      },
      include: {
        poll: {
          select: {
            id: true,
            title: true
          }
        }
      },
      take: 10
    });
    
    console.log(`\nTotal votos encontrados: ${votes.length}`);
    votes.slice(0, 5).forEach(v => {
      const sub = subs.find(s => s.id === v.subdivisionId);
      console.log(`  Voto en ${sub?.subdivisionId} (${sub?.name}) - Poll ${v.pollId}: "${v.poll.title}"`);
    });
    
    // 3. Verificar trending polls y sus votos en ISL.1.X
    console.log('\n=== TRENDING POLLS CON VOTOS EN ISL.1.X ===');
    const trendingPolls = await prisma.poll.findMany({
      where: {
        votes: {
          some: {
            subdivision: {
              subdivisionId: {
                startsWith: 'ISL.1.'
              }
            }
          }
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
      take: 5,
      orderBy: {
        votes: {
          _count: 'desc'
        }
      }
    });
    
    console.log(`\nPolls con votos en ISL.1.X: ${trendingPolls.length}`);
    trendingPolls.forEach(p => {
      console.log(`  Poll ${p.id}: "${p.title}" (${p._count.votes} votos)`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkISLData();
