import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addVotesForSaraSaez() {
  console.log('🌱 Agregando votos para Sara Sáez Serrano...');

  try {
    // Buscar usuario Sara Sáez Serrano
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { contains: 'sara', mode: 'insensitive' } },
          { displayName: { contains: 'Sara Sáez', mode: 'insensitive' } },
          { displayName: { contains: 'Sara Saez', mode: 'insensitive' } }
        ]
      }
    });

    if (!user) {
      console.log('❌ Usuario Sara Sáez Serrano no encontrado');
      console.log('Buscando todos los usuarios para referencia...');
      
      const allUsers = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          displayName: true
        },
        take: 10
      });
      
      console.log('Usuarios disponibles:');
      allUsers.forEach(u => {
        console.log(`  - ${u.displayName} (@${u.username}) - ID: ${u.id}`);
      });
      
      return;
    }

    console.log(`✅ Usuario encontrado: ${user.displayName} (@${user.username}) - ID: ${user.id}`);

    // Obtener todas las encuestas
    const polls = await prisma.poll.findMany({
      include: {
        options: true
      }
    });

    if (polls.length === 0) {
      console.log('❌ No hay encuestas en la base de datos');
      return;
    }

    console.log(`📊 Encontradas ${polls.length} encuestas`);

    // Obtener subdivisión del usuario o una por defecto
    let subdivisionIdNumeric: number | null = user.subdivisionId;
    let latitude = 40.4168; // Madrid por defecto
    let longitude = -3.7038;

    if (subdivisionIdNumeric) {
      const subdivision = await prisma.subdivision.findUnique({
        where: { id: subdivisionIdNumeric }
      });

      if (subdivision) {
        latitude = subdivision.latitude;
        longitude = subdivision.longitude;
        console.log(`📍 Usando ubicación: ${subdivision.subdivisionId}`);
      }
    } else {
      // Buscar una subdivisión de España
      const espSubdivision = await prisma.subdivision.findFirst({
        where: {
          subdivisionId: {
            startsWith: 'ESP'
          }
        }
      });

      if (espSubdivision) {
        subdivisionIdNumeric = espSubdivision.id;
        latitude = espSubdivision.latitude;
        longitude = espSubdivision.longitude;
        console.log(`📍 Usando ubicación por defecto: ${espSubdivision.subdivisionId} (ID: ${espSubdivision.id})`);
      }
    }

    let votosCreados = 0;
    let votosYaExistentes = 0;

    // Votar en todas las encuestas
    for (const poll of polls) {
      // Verificar si ya votó
      const existingVote = await prisma.vote.findFirst({
        where: {
          pollId: poll.id,
          userId: user.id
        }
      });

      if (existingVote) {
        votosYaExistentes++;
        continue;
      }

      // Seleccionar opción aleatoria con distribución realista
      const randomValue = Math.random();
      let selectedOptionIndex;
      
      if (poll.options.length === 2) {
        selectedOptionIndex = randomValue < 0.6 ? 0 : 1;
      } else if (poll.options.length === 3) {
        if (randomValue < 0.5) selectedOptionIndex = 0;
        else if (randomValue < 0.8) selectedOptionIndex = 1;
        else selectedOptionIndex = 2;
      } else {
        selectedOptionIndex = Math.floor(Math.random() * poll.options.length);
      }

      const selectedOption = poll.options[selectedOptionIndex];

      // Fecha aleatoria en últimos 30 días
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const randomTime = thirtyDaysAgo.getTime() + Math.random() * (now.getTime() - thirtyDaysAgo.getTime());
      const createdAt = new Date(randomTime);

      try {
        await prisma.vote.create({
          data: {
            pollId: poll.id,
            optionId: selectedOption.id,
            userId: user.id,
            latitude: latitude,
            longitude: longitude,
            subdivisionId: subdivisionIdNumeric,
            ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            createdAt: createdAt
          }
        });

        votosCreados++;
        
        if (votosCreados % 10 === 0) {
          console.log(`   Progreso: ${votosCreados} votos creados...`);
        }
      } catch (error) {
        console.error(`   ❌ Error en encuesta ${poll.id}:`, error);
      }
    }

    console.log('\n📈 Resumen:');
    console.log(`   Usuario: ${user.displayName} (@${user.username})`);
    console.log(`   Total de encuestas: ${polls.length}`);
    console.log(`   Votos creados: ${votosCreados}`);
    console.log(`   Votos ya existentes: ${votosYaExistentes}`);
    console.log('✅ Proceso completado!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addVotesForSaraSaez();
