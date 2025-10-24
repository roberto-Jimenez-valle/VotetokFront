import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedHistoricalVotes() {
  console.log('🌱 Iniciando seed de votos históricos...');

  try {
    // Obtener algunas encuestas activas para agregar votos
    const polls = await prisma.poll.findMany({
      where: {
        status: 'active'
      },
      include: {
        options: true
      },
      take: 5 // Agregar votos a las primeras 5 encuestas (más rápido)
    });

    if (polls.length === 0) {
      console.log('❌ No hay encuestas activas para agregar votos');
      return;
    }

    console.log(`📊 Agregando votos históricos a ${polls.length} encuestas`);

    // Obtener algunas subdivisiones nivel 3 para hacer los votos más realistas
    const subdivisions = await prisma.subdivision.findMany({
      where: {
        level: 3
      },
      take: 50
    });

    if (subdivisions.length === 0) {
      console.log('⚠️ No hay subdivisiones nivel 3, usando nivel 2...');
      const subdivisions = await prisma.subdivision.findMany({
        where: {
          level: 2
        },
        take: 50
      });
    }

    console.log(`📍 Usando ${subdivisions.length} ubicaciones para distribuir votos`);

    // Fecha de inicio: hace 1 año
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    let totalVotesInserted = 0;

    // Para cada encuesta
    for (const poll of polls) {
      console.log(`\n🗳️  Procesando encuesta: "${poll.title}" (ID: ${poll.id})`);
      
      // Número de votos a generar para esta encuesta (entre 200 y 500 para ser más rápido)
      const numVotes = Math.floor(Math.random() * 300) + 200;
      
      console.log(`   Generando ${numVotes} votos distribuidos en el último año...`);

      const votes = [];

      for (let i = 0; i < numVotes; i++) {
        // Generar fecha aleatoria en el último año
        const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
        const createdAt = new Date(randomTime);

        // Seleccionar opción aleatoria (con distribución no uniforme para hacer más realista)
        const randomValue = Math.random();
        let selectedOptionIndex;
        
        if (poll.options.length === 2) {
          // Para encuestas binarias, hacer una opción más popular (60-40)
          selectedOptionIndex = randomValue < 0.6 ? 0 : 1;
        } else if (poll.options.length === 3) {
          // Para 3 opciones: 50%, 30%, 20%
          if (randomValue < 0.5) selectedOptionIndex = 0;
          else if (randomValue < 0.8) selectedOptionIndex = 1;
          else selectedOptionIndex = 2;
        } else {
          // Para más opciones, distribución más uniforme pero con sesgo hacia las primeras
          selectedOptionIndex = Math.floor(Math.random() * poll.options.length);
        }

        const selectedOption = poll.options[selectedOptionIndex];

        // Seleccionar subdivisión aleatoria
        const subdivision = subdivisions[Math.floor(Math.random() * subdivisions.length)];
        
        // Extraer countryIso3 del subdivisionId (ej: "ESP.1.2" -> "ESP")
        const countryIso3 = subdivision.subdivisionId.split('.')[0];

        votes.push({
          pollId: poll.id,
          optionId: selectedOption.id,
          userId: null, // Votos anónimos
          countryIso3: countryIso3,
          subdivisionId: subdivision.subdivisionId, // Usar subdivisionId completo (ESP.1.2)
          createdAt: createdAt
        });
      }

      // Insertar votos en batches de 100 para Railway (más estable)
      const batchSize = 100;
      for (let i = 0; i < votes.length; i += batchSize) {
        const batch = votes.slice(i, i + batchSize);
        const progress = Math.round((i / votes.length) * 100);
        console.log(`   Insertando batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(votes.length/batchSize)} (${progress}%)...`);
        
        await prisma.vote.createMany({
          data: batch,
          skipDuplicates: true
        });
      }

      totalVotesInserted += votes.length;
      console.log(`   ✅ Insertados ${votes.length} votos`);
      
      // Mostrar distribución por opción
      const distribution = votes.reduce((acc, vote) => {
        const optionId = vote.optionId;
        acc[optionId] = (acc[optionId] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      console.log('   📈 Distribución por opción:');
      poll.options.forEach(option => {
        const count = distribution[option.id] || 0;
        const percentage = ((count / votes.length) * 100).toFixed(1);
        console.log(`      ${option.optionLabel}: ${count} votos (${percentage}%)`);
      });
    }

    console.log(`\n✅ Seed completado exitosamente!`);
    console.log(`📊 Total de votos insertados: ${totalVotesInserted}`);
    console.log(`📅 Rango de fechas: ${startDate.toISOString()} a ${endDate.toISOString()}`);

  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el seed
seedHistoricalVotes()
  .then(() => {
    console.log('\n🎉 Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
