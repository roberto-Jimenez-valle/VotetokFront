import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFollows() {
  
  try {
    // Encontrar a María
    const maria = await prisma.user.findFirst({
      where: { username: 'maria_tech' }
    });

    if (!maria) {
      console.error('❌ No se encontró a María');
      return;
    }

    
    // Encontrar usuarios a seguir
    const carlos = await prisma.user.findFirst({ where: { username: 'carlos_eco' } });
    const ana = await prisma.user.findFirst({ where: { username: 'ana_music' } });
    const laura = await prisma.user.findFirst({ where: { username: 'laura_food' } });
    const sofia = await prisma.user.findFirst({ where: { username: 'sofia_gamer' } });
    const carmen = await prisma.user.findFirst({ where: { username: 'carmen_health' } });

    const toFollow = [carlos, ana, laura, sofia, carmen].filter(u => u !== null);

    
    // Eliminar follows existentes de María
    await prisma.userFollower.deleteMany({
      where: { followerId: maria.id }
    });

    // Crear nuevos follows
    for (const user of toFollow) {
      if (user) {
        await prisma.userFollower.create({
          data: {
            followerId: maria.id,
            followingId: user.id,
          },
        });
              }
    }

    
    // Verificar
    const follows = await prisma.userFollower.findMany({
      where: { followerId: maria.id },
      include: {
        following: {
          select: {
            displayName: true,
            username: true,
          }
        }
      }
    });

        follows.forEach(f => {
          });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixFollows();
