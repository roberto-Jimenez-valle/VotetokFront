import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Insertando 100 votos con fechas diferentes...\n');

  // Obtener una encuesta
  const poll = await prisma.poll.findFirst({
    where: { status: 'active' },
    include: { options: true }
  });

  if (!poll || poll.options.length === 0) {
    console.log('❌ No hay encuestas activas');
    return;
  }

  console.log(`📊 Encuesta: "${poll.title}" (ID: ${poll.id})`);
  console.log(`   Opciones: ${poll.options.length}\n`);

  // Obtener una subdivisión
  const subdivision = await prisma.subdivision.findFirst({
    where: { level: 3 }
  });

  if (!subdivision) {
    console.log('❌ No hay subdivisiones');
    return;
  }

  // Crear 100 votos distribuidos en el último mes
  const votes = [];
  const now = new Date();
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  for (let i = 0; i < 100; i++) {
    // Fecha aleatoria en el último mes
    const randomTime = monthAgo.getTime() + Math.random() * (now.getTime() - monthAgo.getTime());
    const createdAt = new Date(randomTime);

    // Opción aleatoria
    const option = poll.options[Math.floor(Math.random() * poll.options.length)];

    votes.push({
      pollId: poll.id,
      optionId: option.id,
      userId: null,
      subdivisionId: subdivision.id,
      latitude: subdivision.latitude,
      longitude: subdivision.longitude,
      ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      userAgent: 'Mozilla/5.0 (seed script)',
      createdAt: createdAt
    });
  }

  // Insertar todos los votos
  console.log('📥 Insertando 100 votos...');
  await prisma.vote.createMany({
    data: votes,
    skipDuplicates: true
  });

  console.log('✅ ¡100 votos insertados!\n');
  
  // Mostrar distribución
  const distribution = {};
  votes.forEach(v => {
    const opt = poll.options.find(o => o.id === v.optionId);
    distribution[opt.optionLabel] = (distribution[opt.optionLabel] || 0) + 1;
  });

  console.log('📈 Distribución:');
  Object.entries(distribution).forEach(([label, count]) => {
    console.log(`   ${label}: ${count} votos`);
  });

  console.log(`\n📅 Rango de fechas: ${monthAgo.toISOString().split('T')[0]} a ${now.toISOString().split('T')[0]}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
