import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Agregando votos ficticios a encuestas de hoy...\n');

  // Obtener todas las encuestas creadas hoy
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const polls = await prisma.poll.findMany({
    where: {
      createdAt: {
        gte: today
      },
      status: 'active'
    },
    include: { 
      options: true,
      _count: {
        select: { votes: true }
      }
    }
  });

  if (polls.length === 0) {
    console.log('❌ No hay encuestas creadas hoy');
    return;
  }

  console.log(`📊 Encontradas ${polls.length} encuestas de hoy\n`);

  // Obtener subdivisiones para distribuir votos
  const subdivisions = await prisma.subdivision.findMany({
    where: { level: 3 },
    take: 50
  });

  if (subdivisions.length === 0) {
    console.log('❌ No hay subdivisiones');
    return;
  }

  let totalVotesCreated = 0;

  // Para cada encuesta
  for (const poll of polls) {
    console.log(`\n📋 "${poll.title}" (${poll.options.length} opciones)`);
    console.log(`   Votos actuales: ${poll._count.votes}`);

    // Generar entre 100 y 300 votos por encuesta
    const votesToCreate = Math.floor(Math.random() * 200) + 100;
    const votes = [];

    for (let i = 0; i < votesToCreate; i++) {
      // Opción aleatoria (con distribución no uniforme)
      const rand = Math.random();
      let optionIndex;
      
      // Distribución: primera opción más popular
      if (rand < 0.4) {
        optionIndex = 0;
      } else if (rand < 0.7) {
        optionIndex = 1 % poll.options.length;
      } else if (rand < 0.85) {
        optionIndex = 2 % poll.options.length;
      } else {
        optionIndex = Math.floor(Math.random() * poll.options.length);
      }

      const option = poll.options[optionIndex];
      
      // Subdivisión aleatoria
      const subdivision = subdivisions[Math.floor(Math.random() * subdivisions.length)];

      // Fecha aleatoria de hoy
      const now = new Date();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const randomTime = todayStart.getTime() + Math.random() * (now.getTime() - todayStart.getTime());
      const createdAt = new Date(randomTime);

      votes.push({
        pollId: poll.id,
        optionId: option.id,
        userId: null,
        subdivisionId: subdivision.id,
        latitude: subdivision.latitude + (Math.random() - 0.5) * 0.1,
        longitude: subdivision.longitude + (Math.random() - 0.5) * 0.1,
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        createdAt: createdAt
      });
    }

    // Insertar votos
    await prisma.vote.createMany({
      data: votes,
      skipDuplicates: true
    });

    totalVotesCreated += votes.length;

    // Mostrar distribución
    const distribution = {};
    votes.forEach(v => {
      const opt = poll.options.find(o => o.id === v.optionId);
      distribution[opt.optionLabel] = (distribution[opt.optionLabel] || 0) + 1;
    });

    console.log('   📈 Distribución:');
    Object.entries(distribution).forEach(([label, count]) => {
      const percentage = ((count / votes.length) * 100).toFixed(1);
      console.log(`      ${label}: ${count} votos (${percentage}%)`);
    });
  }

  console.log(`\n✅ ¡${totalVotesCreated} votos creados en total!`);
  console.log(`📅 Fecha: ${today.toISOString().split('T')[0]}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
