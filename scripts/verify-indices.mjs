/**
 * Verificar que los índices estén activos
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyIndices() {
  console.log('🔍 Verificando índices aplicados...\n');

  const result = await prisma.$queryRaw`
    SELECT 
      tablename,
      indexname,
      pg_size_pretty(pg_relation_size(schemaname||'.'||indexname::text)) as size
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname LIKE 'idx_%'
    ORDER BY tablename, indexname
  `;

  console.log('📊 Índices encontrados:\n');
  
  const byTable = {};
  for (const row of result) {
    if (!byTable[row.tablename]) {
      byTable[row.tablename] = [];
    }
    byTable[row.tablename].push(row);
  }

  for (const [table, indices] of Object.entries(byTable)) {
    console.log(`📋 ${table} (${indices.length} índices)`);
    for (const idx of indices) {
      console.log(`   ✅ ${idx.indexname} - ${idx.size}`);
    }
    console.log('');
  }

  console.log(`\n✅ Total: ${result.length} índices optimizados activos`);

  await prisma.$disconnect();
}

verifyIndices().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
