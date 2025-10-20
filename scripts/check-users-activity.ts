import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando usuarios con actividad...\n');

  // 1. Verificar usuarios con rells
  const usersWithRells = await prisma.user.findMany({
    where: {
      polls: {
        some: {
          isRell: true,
          status: 'active'
        }
      }
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      polls: {
        where: {
          isRell: true,
          status: 'active'
        },
        select: {
          id: true,
          title: true,
          originalPollId: true
        }
      }
    }
  });

  console.log(`✅ Usuarios con RELLS: ${usersWithRells.length}`);
  usersWithRells.forEach(user => {
    console.log(`  - ${user.displayName || user.username} (ID: ${user.id})`);
    console.log(`    Avatar: ${user.avatarUrl || 'NO TIENE'}`);
    console.log(`    Rells: ${user.polls.length}`);
    user.polls.forEach(poll => {
      console.log(`      * Poll ${poll.id}: "${poll.title}" (original: ${poll.originalPollId})`);
    });
  });

  console.log('');

  // 2. Verificar usuarios con saves
  const usersWithSaves = await prisma.user.findMany({
    where: {
      interactions: {
        some: {
          interactionType: 'save'
        }
      }
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      interactions: {
        where: {
          interactionType: 'save'
        },
        select: {
          pollId: true
        }
      }
    }
  });

  console.log(`💾 Usuarios con SAVES: ${usersWithSaves.length}`);
  usersWithSaves.forEach(user => {
    console.log(`  - ${user.displayName || user.username} (ID: ${user.id})`);
    console.log(`    Avatar: ${user.avatarUrl || 'NO TIENE'}`);
    console.log(`    Saves: ${user.interactions.length} encuestas`);
  });

  console.log('');

  // 3. Verificar todos los usuarios
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true
    }
  });

  console.log(`👥 TOTAL DE USUARIOS: ${allUsers.length}`);
  allUsers.forEach(user => {
    console.log(`  - ${user.displayName || user.username} (ID: ${user.id})`);
    console.log(`    Avatar: ${user.avatarUrl || 'NO TIENE'}`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
