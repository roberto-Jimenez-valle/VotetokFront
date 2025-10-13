/**
 * Script para crear un usuario de prueba con intereses predefinidos
 * para testing del sistema de recomendaciones "Para ti"
 * 
 * Uso: npx tsx scripts/seed-test-user-with-interests.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creando usuario de prueba con intereses...\n');

  // 1. Crear usuario de prueba
  const testUser = await prisma.user.upsert({
    where: { email: 'testuser@votetok.com' },
    update: {},
    create: {
      username: 'testuser',
      email: 'testuser@votetok.com',
      displayName: 'Usuario de Prueba',
      bio: 'Usuario de prueba para sistema de recomendaciones',
      avatarUrl: 'https://i.pravatar.cc/150?u=testuser',
      verified: false,
      role: 'user',
      countryIso3: 'ESP',
      subdivisionId: '1', // Andalucía
    },
  });

  console.log('✅ Usuario creado:', testUser.username, `(ID: ${testUser.id})`);

  // 2. Crear intereses del usuario (categorías)
  const interests = [
    { category: 'tecnologia', score: 8.5 },
    { category: 'deportes', score: 6.0 },
    { category: 'politica', score: 4.5 },
    { category: 'entretenimiento', score: 7.0 },
    { category: 'ciencia', score: 5.5 },
  ];

  console.log('\n📊 Creando intereses del usuario...');
  for (const interest of interests) {
    const created = await prisma.userInterest.upsert({
      where: {
        userId_category: {
          userId: testUser.id,
          category: interest.category,
        },
      },
      update: { score: interest.score },
      create: {
        userId: testUser.id,
        category: interest.category,
        score: interest.score,
      },
    });
    console.log(`  ✓ ${interest.category} (score: ${interest.score})`);
  }

  // 3. Crear algunos hashtags y asociarlos al usuario
  const hashtags = [
    'javascript',
    'futbol',
    'ia',
    'series',
    'espacial',
  ];

  console.log('\n🏷️  Creando hashtags seguidos...');
  for (const tag of hashtags) {
    const hashtag = await prisma.hashtag.upsert({
      where: { tag },
      update: {},
      create: {
        tag,
        usageCount: 0,
      },
    });

    await prisma.userHashtagFollow.upsert({
      where: {
        userId_hashtagId: {
          userId: testUser.id,
          hashtagId: hashtag.id,
        },
      },
      update: {},
      create: {
        userId: testUser.id,
        hashtagId: hashtag.id,
      },
    });
    console.log(`  ✓ #${tag}`);
  }

  // 4. Crear un segundo usuario para que el primero pueda seguir
  const otherUser = await prisma.user.upsert({
    where: { email: 'creator@votetok.com' },
    update: {},
    create: {
      username: 'creator',
      email: 'creator@votetok.com',
      displayName: 'Creador Popular',
      bio: 'Creador de encuestas interesantes',
      avatarUrl: 'https://i.pravatar.cc/150?u=creator',
      verified: true,
      role: 'user',
    },
  });

  // 5. Crear relación de seguimiento
  await prisma.userFollower.upsert({
    where: {
      followerId_followingId: {
        followerId: testUser.id,
        followingId: otherUser.id,
      },
    },
    update: {},
    create: {
      followerId: testUser.id,
      followingId: otherUser.id,
    },
  });

  console.log(`\n👥 Usuario siguiendo a: ${otherUser.username}`);

  // 6. Resumen
  console.log('\n' + '='.repeat(60));
  console.log('✅ Usuario de prueba creado exitosamente');
  console.log('='.repeat(60));
  console.log(`\n📋 Resumen:`);
  console.log(`   ID: ${testUser.id}`);
  console.log(`   Username: ${testUser.username}`);
  console.log(`   Email: ${testUser.email}`);
  console.log(`   Ubicación: ${testUser.countryIso3} - ${testUser.subdivisionId}`);
  console.log(`   Intereses: ${interests.length} categorías`);
  console.log(`   Hashtags seguidos: ${hashtags.length}`);
  console.log(`   Siguiendo a: 1 usuario (${otherUser.username})`);

  console.log('\n🧪 Para usar en el frontend:');
  console.log(`
import { setCurrentUser } from '$lib/stores';

setCurrentUser({
  id: ${testUser.id},
  username: '${testUser.username}',
  displayName: '${testUser.displayName}',
  email: '${testUser.email}',
  avatarUrl: '${testUser.avatarUrl}',
  verified: ${testUser.verified},
  countryIso3: '${testUser.countryIso3}',
  subdivisionId: '${testUser.subdivisionId}',
  role: '${testUser.role}'
});
  `);

  console.log('\n🔍 Probar recomendaciones:');
  console.log(`   GET /api/polls/for-you?userId=${testUser.id}&limit=10`);
  console.log('\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
