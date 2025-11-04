import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixINDVotes() {
  console.log('🔧 Corrigiendo votos de India (IND)...\n');
  
  // PASO 1: Eliminar TODOS los votos existentes de IND
  console.log('📋 PASO 1: Eliminando todos los votos existentes de India...');
  
  const deleted = await prisma.vote.deleteMany({
    where: {
      subdivision: {
        subdivisionId: { startsWith: 'IND' }
      }
    }
  });
  
  console.log(`   🗑️  Eliminados ${deleted.count} votos existentes\n`);
  
  // PASO 2: Obtener encuestas activas
  console.log('📋 PASO 2: Obteniendo encuestas para añadir votos...');
  
  const polls = await prisma.poll.findMany({
    where: {
      status: 'active'
    },
    include: {
      options: true
    },
    take: 3,
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`   📊 Encontradas ${polls.length} encuestas activas\n`);
  
  if (polls.length === 0) {
    console.log('⚠️  No hay encuestas activas. Abortando.');
    await prisma.$disconnect();
    return;
  }
  
  // PASO 3: Obtener subdivisiones de IND (DISTRIBUIR EN TODOS LOS 36 ESTADOS)
  console.log('📋 PASO 3: Obteniendo distritos de India (distribuidos en todos los estados)...');
  
  // Obtener AL MENOS 1 distrito de CADA estado
  const level2Subs: any[] = [];
  
  for (let stateNum = 1; stateNum <= 36; stateNum++) {
    const districtsForState = await prisma.subdivision.findMany({
      where: {
        subdivisionId: { startsWith: `IND.${stateNum}.` }
      },
      select: {
        id: true,
        subdivisionId: true,
        name: true,
        latitude: true,
        longitude: true
      },
      take: 5 // 5 distritos por estado = 36 estados × 5 = 180 distritos
    });
    
    level2Subs.push(...districtsForState);
  }
  
  console.log(`   🏘️  Nivel 2 (distritos): ${level2Subs.length}`);
  console.log(`   🗺️  Distribuidos en los 36 estados de India`);
  console.log(`   ℹ️   El sistema agregará automáticamente hacia nivel 1 (estados)\n`);
  
  // PASO 4: Crear votos en lotes (MUCHO MÁS RÁPIDO)
  console.log('📋 PASO 4: Creando nuevos votos en lotes...\n');
  
  let totalCreated = 0;
  const BATCH_SIZE = 1000; // Insertar 1000 votos a la vez
  
  for (const poll of polls) {
    const options = poll.options;
    if (options.length === 0) continue;
    
    console.log(`   📊 Poll ${poll.id}: "${poll.title}"`);
    
    // Preparar todos los votos para esta encuesta
    const votesToCreate: any[] = [];
    
    for (const sub of level2Subs) {
      const randomOption = options[Math.floor(Math.random() * options.length)];
      const voteCount = Math.floor(Math.random() * 8) + 3; // 3-10 votos por distrito
      
      for (let i = 0; i < voteCount; i++) {
        const uniqueIp = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
        const lat = sub.latitude + (Math.random() - 0.5) * 0.1;
        const lng = sub.longitude + (Math.random() - 0.5) * 0.1;
        
        votesToCreate.push({
          pollId: poll.id,
          subdivisionId: sub.id,
          optionId: randomOption.id,
          ipAddress: uniqueIp,
          latitude: lat,
          longitude: lng
        });
      }
    }
    
    // Insertar en lotes
    console.log(`   📦 Preparados ${votesToCreate.length} votos. Insertando en lotes...`);
    
    for (let i = 0; i < votesToCreate.length; i += BATCH_SIZE) {
      const batch = votesToCreate.slice(i, i + BATCH_SIZE);
      try {
        const result = await prisma.vote.createMany({
          data: batch,
          skipDuplicates: true
        });
        totalCreated += result.count;
        console.log(`   ✅ Insertados ${result.count} votos (lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(votesToCreate.length / BATCH_SIZE)})`);
      } catch (e: any) {
        console.log(`   ⚠️  Error en lote: ${e.message}`);
      }
    }
    
    console.log(`   ✅ Completado poll ${poll.id}\n`);
  }
  
  console.log(`\n✅ COMPLETADO: ${totalCreated} votos nuevos creados`);
  console.log(`\n🎨 Ahora India debería mostrarse con colores en el globo`);
  
  await prisma.$disconnect();
}

fixINDVotes().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
