import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Creando relaciones de seguimiento entre usuarios...\n');

  // Obtener todos los usuarios
  const users = await prisma.user.findMany({
    select: { id: true, username: true, displayName: true },
    orderBy: { id: 'asc' }
  });

  if (users.length < 2) {
    console.log('❌ Se necesitan al menos 2 usuarios para crear relaciones de seguimiento');
    return;
  }

  console.log(`✅ Encontrados ${users.length} usuarios:\n`);
  users.forEach(u => console.log(`   - ID ${u.id}: ${u.displayName} (@${u.username})`));
  console.log('');

  // Relaciones de seguimiento a crear
  // Usuario 1 sigue a todos los demás
  // Usuario 2 sigue a usuario 1, 3, 4
  // Usuario 3 sigue a usuario 1, 2
  // Usuario 4 sigue a usuario 1
  // etc.

  const followRelations: Array<{ followerId: number; followingId: number }> = [];

  // Usuario 1 sigue a todos los demás
  if (users.length > 1) {
    for (let i = 1; i < users.length; i++) {
      followRelations.push({
        followerId: users[0].id,
        followingId: users[i].id
      });
    }
  }

  // Usuario 2 sigue a varios
  if (users.length >= 2) {
    followRelations.push({ followerId: users[1].id, followingId: users[0].id });
    if (users.length >= 3) {
      followRelations.push({ followerId: users[1].id, followingId: users[2].id });
    }
    if (users.length >= 4) {
      followRelations.push({ followerId: users[1].id, followingId: users[3].id });
    }
  }

  // Usuario 3 sigue a usuario 1 y 2
  if (users.length >= 3) {
    followRelations.push({ followerId: users[2].id, followingId: users[0].id });
    followRelations.push({ followerId: users[2].id, followingId: users[1].id });
  }

  // Usuario 4 sigue a usuario 1, 2 y 3
  if (users.length >= 4) {
    followRelations.push({ followerId: users[3].id, followingId: users[0].id });
    followRelations.push({ followerId: users[3].id, followingId: users[1].id });
    followRelations.push({ followerId: users[3].id, followingId: users[2].id });
  }

  // Resto de usuarios siguen a los primeros 3
  for (let i = 4; i < users.length; i++) {
    followRelations.push({ followerId: users[i].id, followingId: users[0].id });
    if (users.length >= 2) {
      followRelations.push({ followerId: users[i].id, followingId: users[1].id });
    }
  }

  console.log(`📊 Creando ${followRelations.length} relaciones de seguimiento...\n`);

  let created = 0;
  let skipped = 0;

  for (const relation of followRelations) {
    try {
      await prisma.userFollower.create({
        data: relation
      });

      const follower = users.find(u => u.id === relation.followerId);
      const following = users.find(u => u.id === relation.followingId);
      
      console.log(`   ✅ ${follower?.displayName} (@${follower?.username}) ahora sigue a ${following?.displayName} (@${following?.username})`);
      created++;
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Relación ya existe
        skipped++;
      } else {
        console.error(`   ❌ Error creando relación:`, error.message);
      }
    }
  }

  console.log(`\n📈 Resumen:`);
  console.log(`   ✅ ${created} relaciones creadas`);
  console.log(`   ⏭️  ${skipped} relaciones ya existían\n`);

  // Mostrar estadísticas finales de cada usuario
  console.log('👥 Estadísticas de seguidores:\n');
  
  for (const user of users) {
    const followersCount = await prisma.userFollower.count({
      where: { followingId: user.id }
    });
    
    const followingCount = await prisma.userFollower.count({
      where: { followerId: user.id }
    });

    console.log(`   ${user.displayName} (@${user.username}):`);
    console.log(`      - ${followersCount} seguidores`);
    console.log(`      - ${followingCount} siguiendo\n`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
