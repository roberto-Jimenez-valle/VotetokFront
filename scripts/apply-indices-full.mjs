/**
 * Script para aplicar TODOS los índices optimizados de una vez
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyAllIndices() {
  console.log('🔧 Aplicando TODOS los índices optimizados...\n');

  const indices = [
    // TABLA: votes
    { name: 'idx_votes_poll_subdivision', sql: 'CREATE INDEX IF NOT EXISTS "idx_votes_poll_subdivision" ON "votes"("poll_id", "subdivision_id")' },
    { name: 'idx_votes_poll_created_desc', sql: 'CREATE INDEX IF NOT EXISTS "idx_votes_poll_created_desc" ON "votes"("poll_id", "created_at" DESC)' },
    { name: 'idx_votes_option_subdivision', sql: 'CREATE INDEX IF NOT EXISTS "idx_votes_option_subdivision" ON "votes"("option_id", "subdivision_id")' },
    { name: 'idx_votes_user_poll_created', sql: 'CREATE INDEX IF NOT EXISTS "idx_votes_user_poll_created" ON "votes"("user_id", "poll_id", "created_at" DESC) WHERE "user_id" IS NOT NULL' },
    { name: 'idx_votes_ip_poll_created', sql: 'CREATE INDEX IF NOT EXISTS "idx_votes_ip_poll_created" ON "votes"("ip_address", "poll_id", "created_at" DESC) WHERE "ip_address" IS NOT NULL' },
    
    // TABLA: subdivisions
    { name: 'idx_subdivisions_level1_id', sql: 'CREATE INDEX IF NOT EXISTS "idx_subdivisions_level1_id" ON "subdivisions"("level1_id") WHERE "level1_id" IS NOT NULL' },
    { name: 'idx_subdivisions_level2_id', sql: 'CREATE INDEX IF NOT EXISTS "idx_subdivisions_level2_id" ON "subdivisions"("level2_id") WHERE "level2_id" IS NOT NULL' },
    { name: 'idx_subdivisions_country_level', sql: 'CREATE INDEX IF NOT EXISTS "idx_subdivisions_country_level" ON "subdivisions"("subdivision_id", "level")' },
    { name: 'idx_subdivisions_level_lat_lon', sql: 'CREATE INDEX IF NOT EXISTS "idx_subdivisions_level_lat_lon" ON "subdivisions"("level", "latitude", "longitude") WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL' },
    
    // TABLA: polls
    { name: 'idx_polls_user_status_created', sql: 'CREATE INDEX IF NOT EXISTS "idx_polls_user_status_created" ON "polls"("user_id", "status", "created_at" DESC)' },
    { name: 'idx_polls_category_status_created', sql: 'CREATE INDEX IF NOT EXISTS "idx_polls_category_status_created" ON "polls"("category", "status", "created_at" DESC) WHERE "status" = \'active\'' },
    { name: 'idx_polls_isrell_status', sql: 'CREATE INDEX IF NOT EXISTS "idx_polls_isrell_status" ON "polls"("is_rell", "status", "created_at" DESC)' },
    
    // TABLA: poll_options
    { name: 'idx_poll_options_poll_display', sql: 'CREATE INDEX IF NOT EXISTS "idx_poll_options_poll_display" ON "poll_options"("poll_id", "display_order")' },
    
    // TABLA: poll_interactions
    { name: 'idx_interactions_user_poll_type', sql: 'CREATE INDEX IF NOT EXISTS "idx_interactions_user_poll_type" ON "poll_interactions"("user_id", "poll_id", "interaction_type")' },
    { name: 'idx_interactions_poll_type_created', sql: 'CREATE INDEX IF NOT EXISTS "idx_interactions_poll_type_created" ON "poll_interactions"("poll_id", "interaction_type", "created_at" DESC)' },
    
    // TABLA: user_followers
    { name: 'idx_followers_following_follower', sql: 'CREATE INDEX IF NOT EXISTS "idx_followers_following_follower" ON "user_followers"("following_id", "follower_id")' },
    { name: 'idx_followers_follower_following', sql: 'CREATE INDEX IF NOT EXISTS "idx_followers_follower_following" ON "user_followers"("follower_id", "following_id")' }
  ];

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const index of indices) {
    try {
      await prisma.$executeRawUnsafe(index.sql);
      console.log(`✅ ${index.name}`);
      successCount++;
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log(`⏭️  ${index.name} (ya existe)`);
        skipCount++;
      } else {
        console.error(`❌ ${index.name}: ${error.message}`);
        errorCount++;
      }
    }
  }

  console.log('\n📊 Resumen:');
  console.log(`   ✅ Índices creados: ${successCount}`);
  console.log(`   ⏭️  Índices ya existían: ${skipCount}`);
  console.log(`   ❌ Errores: ${errorCount}`);
  console.log(`   📈 Total procesados: ${indices.length}`);

  // Actualizar estadísticas
  console.log('\n📈 Actualizando estadísticas de tablas...');
  try {
    await prisma.$executeRaw`ANALYZE votes`;
    await prisma.$executeRaw`ANALYZE subdivisions`;
    await prisma.$executeRaw`ANALYZE polls`;
    await prisma.$executeRaw`ANALYZE poll_options`;
    await prisma.$executeRaw`ANALYZE poll_interactions`;
    await prisma.$executeRaw`ANALYZE user_followers`;
    console.log('✅ Estadísticas actualizadas');
  } catch (error) {
    console.warn('⚠️  Error actualizando estadísticas:', error.message);
  }

  await prisma.$disconnect();
  console.log('\n🎉 ¡Todos los índices aplicados correctamente!');
}

applyAllIndices().catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});
