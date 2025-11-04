import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAREVotes() {
  console.log('🔧 Corrigiendo votos de Emiratos Árabes Unidos (ARE)...\n');
  
  // PASO 1: Eliminar TODOS los votos existentes de ARE para empezar limpio
  console.log('📋 PASO 1: Eliminando todos los votos existentes de ARE...');
  
  const deleted = await prisma.vote.deleteMany({
    where: {
      subdivision: {
        subdivisionId: { startsWith: 'ARE' }
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
  
  // PASO 3: Obtener subdivisiones de ARE (SOLO NIVEL MÁS GRANULAR)
  console.log('📋 PASO 3: Obteniendo subdivisiones de ARE...');
  
  // Solo Nivel 2 (más granular): Regiones (ARE.1.1, ARE.2.8, etc.)
  const level2Subs = await prisma.subdivision.findMany({
    where: {
      subdivisionId: { startsWith: 'ARE.' },
      subdivisionId: { contains: '.' },
      OR: [
        { subdivisionId: { startsWith: 'ARE.1.' } },
        { subdivisionId: { startsWith: 'ARE.2.' } },
        { subdivisionId: { startsWith: 'ARE.3.' } },
        { subdivisionId: { startsWith: 'ARE.4.' } },
        { subdivisionId: { startsWith: 'ARE.5.' } },
        { subdivisionId: { startsWith: 'ARE.6.' } },
        { subdivisionId: { startsWith: 'ARE.7.' } }
      ]
    },
    select: {
      id: true,
      subdivisionId: true,
      name: true,
      latitude: true,
      longitude: true
    }
  });
  
  console.log(`   🏘️  Nivel 2 (granular): ${level2Subs.length} regiones`);
  console.log(`   ℹ️   El sistema agregará automáticamente hacia nivel 1 (emiratos)\n`);
  
  // PASO 4: Crear votos distribuidos
  console.log('📋 PASO 4: Creando nuevos votos...\n');
  
  let totalCreated = 0;
  
  for (const poll of polls) {
    const options = poll.options;
    if (options.length === 0) continue;
    
    console.log(`   📊 Poll ${poll.id}: "${poll.title}"`);
    
    // Solo votos en nivel 2 (regiones - nivel más granular)
    for (const sub of level2Subs) {
      const randomOption = options[Math.floor(Math.random() * options.length)];
      const voteCount = Math.floor(Math.random() * 10) + 5; // 5-15 votos por región
      
      for (let i = 0; i < voteCount; i++) {
        try {
          // Generar IP única para cada voto
          const uniqueIp = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
          
          // Usar coordenadas de la subdivisión con pequeña variación aleatoria
          const lat = sub.latitude + (Math.random() - 0.5) * 0.1;
          const lng = sub.longitude + (Math.random() - 0.5) * 0.1;
          
          await prisma.vote.create({
            data: {
              pollId: poll.id,
              subdivisionId: sub.id,
              optionId: randomOption.id,
              ipAddress: uniqueIp,
              latitude: lat,
              longitude: lng
            }
          });
          totalCreated++;
        } catch (e: any) {
          // Log del primer error para debug
          if (totalCreated === 0) {
            console.log(`   ⚠️  Error creando voto: ${e.message}`);
          }
        }
      }
    }
    
    console.log(`   ✅ Votos creados para poll ${poll.id}\n`);
  }
  
  console.log(`\n✅ COMPLETADO: ${totalCreated} votos nuevos creados`);
  console.log(`\n🎨 Ahora ARE debería mostrarse con colores en el globo`);
  
  await prisma.$disconnect();
}

fixAREVotes().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
