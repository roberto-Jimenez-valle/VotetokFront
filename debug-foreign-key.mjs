import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debug() {
  console.log('🔍 Verificando claves foráneas...\n');
  
  // 1. Verificar usuarios
  const users = await prisma.user.findMany({
    select: { id: true, username: true }
  });
  console.log('✅ Usuarios en BD:', users.length);
  users.forEach(u => console.log(`   - ID: ${u.id}, Username: ${u.username}`));
  
  // 2. Verificar Poll #5
  const poll = await prisma.poll.findUnique({
    where: { id: 5 },
    include: { options: true }
  });
  
  if (poll) {
    console.log(`\n✅ Poll #5 existe`);
    console.log(`   Opciones: ${poll.options.length}`);
  } else {
    console.log('\n❌ Poll #5 NO existe');
  }
  
  // 3. Probar crear un voto de prueba
  console.log('\n🧪 Intentando crear voto de prueba...');
  
  try {
    const testVote = await prisma.vote.create({
      data: {
        pollId: 5,
        optionId: 19, // Primera opción de Poll #5
        userId: null, // VOTO ANÓNIMO - no debería violar FK
        latitude: 40.4168,
        longitude: -3.7038,
        countryIso3: 'ESP',
        countryName: 'España',
        subdivisionId: null,
        subdivisionName: null,
        cityName: 'Madrid',
        ipAddress: '127.0.0.1',
        userAgent: 'Debug Script'
      }
    });
    
    console.log('✅ Voto de prueba creado:', testVote.id);
    
    // Limpiar
    await prisma.vote.delete({ where: { id: testVote.id } });
    console.log('✅ Voto de prueba eliminado');
    
  } catch (error) {
    console.error('❌ ERROR al crear voto:', error.message);
    console.error('Código:', error.code);
    console.error('Meta:', error.meta);
  }
  
  await prisma.$disconnect();
}

debug();
