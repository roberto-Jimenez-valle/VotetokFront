import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpiando base de datos...');
  
  // Eliminar datos existentes en orden (respetando foreign keys)
  await prisma.pollHashtag.deleteMany({});
  await prisma.hashtag.deleteMany({});
  await prisma.voteHistory.deleteMany({});
  await prisma.vote.deleteMany({});
  await prisma.pollOption.deleteMany({});
  await prisma.poll.deleteMany({});
  await prisma.featuredUser.deleteMany({});
  await prisma.userFollower.deleteMany({});
  await prisma.user.deleteMany({});
  
  console.log('✅ Base de datos limpiada');
  
  // Crear usuarios de ejemplo
    const users = await Promise.all([
    prisma.user.create({
      data: {
        username: 'maria_gonzalez',
        email: 'maria@votetok.com',
        displayName: 'María González',
        avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
        verified: true,
        bio: 'Activista social y política',
      },
    }),
    prisma.user.create({
      data: {
        username: 'carlos_lopez',
        email: 'carlos@votetok.com',
        displayName: 'Carlos López',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
        verified: true,
        bio: 'Analista político',
      },
    }),
    prisma.user.create({
      data: {
        username: 'laura_sanchez',
        email: 'laura@votetok.com',
        displayName: 'Laura Sánchez',
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop',
        verified: false,
        bio: 'Periodista independiente',
      },
    }),
    prisma.user.create({
      data: {
        username: 'juan_martin',
        email: 'juan@votetok.com',
        displayName: 'Juan Martín',
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
        verified: true,
        bio: 'Economista',
      },
    }),
    prisma.user.create({
      data: {
        username: 'sofia_herrera',
        email: 'sofia@votetok.com',
        displayName: 'Sofía Herrera',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop',
        verified: false,
        bio: 'Estudiante de ciencias políticas',
      },
    }),
  ]);

  
  // Crear usuarios destacados
    await Promise.all([
    prisma.featuredUser.create({
      data: {
        userId: users[0].id,
        roleTitle: 'Activista Social',
        citationsCount: 312,
        displaySize: 55,
        highlightColor: '#ec4899',
        featuredOrder: 1,
      },
    }),
    prisma.featuredUser.create({
      data: {
        userId: users[1].id,
        roleTitle: 'Analista Político',
        citationsCount: 189,
        displaySize: 35,
        highlightColor: '#3b82f6',
        featuredOrder: 2,
      },
    }),
    prisma.featuredUser.create({
      data: {
        userId: users[3].id,
        roleTitle: 'Economista',
        citationsCount: 156,
        displaySize: 30,
        highlightColor: '#10b981',
        featuredOrder: 3,
      },
    }),
  ]);

  
  // Crear encuestas
    
  const poll1 = await prisma.poll.create({
    data: {
      userId: users[0].id,
      title: '¿Cuál debería ser la prioridad del gobierno para 2024?',
      description: 'Encuesta sobre las prioridades políticas para el próximo año',
      category: 'Politics',
      type: 'poll',
      options: {
        create: [
          { 
            optionKey: 'economia', 
            optionLabel: 'Economía', 
            color: '#3b82f6', 
            displayOrder: 0,
          },
          { 
            optionKey: 'sanidad', 
            optionLabel: 'Sanidad', 
            color: '#10b981', 
            displayOrder: 1,
          },
          { 
            optionKey: 'educacion', 
            optionLabel: 'Educación', 
            color: '#f59e0b', 
            displayOrder: 2,
          },
          { 
            optionKey: 'medio_ambiente', 
            optionLabel: 'Medio Ambiente', 
            color: '#22c55e', 
            displayOrder: 3,
          },
        ],
      },
    },
    include: { options: true },
  });

  const poll2 = await prisma.poll.create({
    data: {
      userId: users[1].id,
      title: '¿Apoyas las energías renovables?',
      description: 'Tu opinión sobre la transición energética',
      category: 'Environment',
      type: 'poll',
      options: {
        create: [
          { 
            optionKey: 'si', 
            optionLabel: 'Sí, completamente', 
            color: '#10b981', 
            displayOrder: 0,
          },
          { 
            optionKey: 'no', 
            optionLabel: 'No', 
            color: '#ef4444', 
            displayOrder: 1,
          },
          { 
            optionKey: 'tal_vez', 
            optionLabel: 'Tal vez', 
            color: '#f59e0b', 
            displayOrder: 2,
          },
        ],
      },
    },
    include: { options: true },
  });

  const poll3 = await prisma.poll.create({
    data: {
      userId: users[2].id,
      title: '¿El trabajo remoto debería ser el estándar?',
      description: 'Debate sobre el futuro del trabajo',
      category: 'Work',
      type: 'poll',
      options: {
        create: [
          { 
            optionKey: 'full_remote', 
            optionLabel: 'Sí, 100% remoto', 
            color: '#8b5cf6', 
            displayOrder: 0,
          },
          { 
            optionKey: 'hybrid', 
            optionLabel: 'Modelo híbrido', 
            color: '#06b6d4', 
            displayOrder: 1,
          },
          { 
            optionKey: 'presencial', 
            optionLabel: 'Presencial', 
            color: '#f59e0b', 
            displayOrder: 2,
          },
        ],
      },
    },
    include: { options: true },
  });

  
  // Crear votos geolocalizados REALISTAS
  console.log('🔍 Generando votos con subdivisiones...');
  
  // Helper para buscar MÚLTIPLES subdivisiones NIVEL 3 con level2_id
  async function findMultipleSubdivisionsLevel3WithLevel2(iso3: string, limit: number = 50) {
    const result = await prisma.$queryRaw<Array<{
      id: number;
      subdivision_id: string;
      name: string;
      level: number;
      level1_id: string;
      level2_id: string;
      latitude: number;
      longitude: number;
    }>>`
      SELECT id, subdivision_id, name, level, level1_id, level2_id, latitude, longitude
      FROM subdivisions
      WHERE level = 3
        AND subdivision_id LIKE ${iso3 + '.%'}
        AND level2_id IS NOT NULL
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      LIMIT ${limit}
    `;
    return result;
  }

  // Buscar subdivisiones NIVEL 3 con level2_id (municipios/quarters/counties)
  console.log('🔍 Buscando subdivisiones nivel 3 con level2_id (municipios/quarters)...');
  
  const spainMunicipalities = await findMultipleSubdivisionsLevel3WithLevel2('ESP', 100);
  const usaCounties = await findMultipleSubdivisionsLevel3WithLevel2('USA', 100);
  const franceCommunes = await findMultipleSubdivisionsLevel3WithLevel2('FRA', 100);
  const ukDistricts = await findMultipleSubdivisionsLevel3WithLevel2('GBR', 100);

  if (!spainMunicipalities.length) {
    console.warn('⚠️ No se encontraron subdivisiones nivel 3 con level2_id.');
    console.log('⏭️ Saltando creación de votos de ejemplo');
  } else {
    console.log(`✅ Subdivisiones nivel 3 encontradas:`);
    console.log(`   España: ${spainMunicipalities.length} municipios/quarters`);
    console.log(`   USA: ${usaCounties.length} counties`);
    console.log(`   Francia: ${franceCommunes.length} communes`);
    console.log(`   UK: ${ukDistricts.length} districts`);
    
    console.log('\n📋 Muestra de subdivisiones España:');
    spainMunicipalities.slice(0, 5).forEach(p => console.log(`   - ${p.name} (${p.subdivision_id}) level2_id: ${p.level2_id}`));

    // Helper para distribuir votos entre municipios NIVEL 3 con coordenadas
    function distributeVotes(
      municipalities: Array<{id: number; latitude: number; longitude: number}>, 
      count: number, 
      pollId: number, 
      optionId: number,
      userProbability: number = 0.7
    ) {
      const votes = [];
      for (let i = 0; i < count; i++) {
        const municipality = municipalities[i % municipalities.length];
        // Generar coordenadas con variación aleatoria pequeña
        const latVariation = (Math.random() - 0.5) * 0.1; // ±0.05 grados
        const lngVariation = (Math.random() - 0.5) * 0.1;
        
        votes.push({
          pollId,
          userId: Math.random() < userProbability ? users[Math.floor(Math.random() * users.length)].id : null,
          optionId,
          latitude: municipality.latitude + latVariation,
          longitude: municipality.longitude + lngVariation,
          subdivisionId: municipality.id,
        });
      }
      return votes;
    }
    
    // Generar votos REALISTAS distribuidos en NIVEL 3 (municipios con level2_id)
    const votesData = [
      // POLL 1: Prioridades del gobierno
      // España - distribuir entre municipios
      ...distributeVotes(spainMunicipalities, 120, poll1.id, poll1.options[0].id, 0.8),
      ...distributeVotes(spainMunicipalities, 150, poll1.id, poll1.options[1].id, 0.7),
      ...distributeVotes(spainMunicipalities, 90, poll1.id, poll1.options[2].id, 0.6),
      ...distributeVotes(spainMunicipalities, 50, poll1.id, poll1.options[3].id, 0.5),
      
      // POLL 2: Energías renovables
      ...distributeVotes(spainMunicipalities, 200, poll2.id, poll2.options[0].id, 0.75),
      ...distributeVotes(spainMunicipalities, 70, poll2.id, poll2.options[2].id, 0.6),
      ...distributeVotes(spainMunicipalities, 30, poll2.id, poll2.options[1].id, 0.5),
      
      // POLL 3: Trabajo remoto
      ...distributeVotes(spainMunicipalities, 130, poll3.id, poll3.options[1].id, 0.85),
      ...distributeVotes(spainMunicipalities, 100, poll3.id, poll3.options[0].id, 0.75),
      ...distributeVotes(spainMunicipalities, 60, poll3.id, poll3.options[2].id, 0.7),
    ];

    // Agregar votos internacionales si existen subdivisiones
    if (usaCounties.length) {
      votesData.push(...distributeVotes(usaCounties, 120, poll1.id, poll1.options[0].id, 0.5));
      votesData.push(...distributeVotes(usaCounties, 80, poll2.id, poll2.options[0].id, 0.6));
      votesData.push(...distributeVotes(usaCounties, 50, poll3.id, poll3.options[1].id, 0.6));
    }
    if (franceCommunes.length) {
      votesData.push(...distributeVotes(franceCommunes, 80, poll2.id, poll2.options[0].id, 0.6));
      votesData.push(...distributeVotes(franceCommunes, 40, poll3.id, poll3.options[0].id, 0.7));
    }
    if (ukDistricts.length) {
      votesData.push(...distributeVotes(ukDistricts, 50, poll2.id, poll2.options[1].id, 0.6));
      votesData.push(...distributeVotes(ukDistricts, 30, poll1.id, poll1.options[2].id, 0.5));
    }

    console.log(`📊 Generando ${votesData.length} votos...`);
    
    for (const voteData of votesData) {
      await prisma.vote.create({
        data: {
          pollId: voteData.pollId,
          userId: voteData.userId,
          optionId: voteData.optionId,
          latitude: voteData.latitude,
          longitude: voteData.longitude,
          subdivisionId: voteData.subdivisionId,
        },
      });
    }
    
    console.log(`✅ ${votesData.length} votos creados con subdivisiones reales`);
  }

  // Los contadores se auto-calculan desde los votos

  // ...
  
  // Crear hashtags
    const hashtags = await Promise.all([
    prisma.hashtag.create({ data: { tag: 'política' } }),
    prisma.hashtag.create({ data: { tag: 'economía' } }),
    prisma.hashtag.create({ data: { tag: 'medioambiente' } }),
    prisma.hashtag.create({ data: { tag: 'trabajo' } }),
  ]);

  // Asociar hashtags a encuestas
  await prisma.pollHashtag.createMany({
    data: [
      { pollId: poll1.id, hashtagId: hashtags[0].id },
      { pollId: poll1.id, hashtagId: hashtags[1].id },
      { pollId: poll2.id, hashtagId: hashtags[2].id },
      { pollId: poll3.id, hashtagId: hashtags[3].id },
    ],
  });

  
  // Crear historial de votos REALISTA (últimos 30 días)
  console.log('📈 Generando historial de votos...');
  const now = new Date();
  const polls = [poll1, poll2, poll3];
  
  for (const poll of polls) {
    for (let day = 0; day < 30; day++) {
      const date = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
      
      // Simular crecimiento orgánico (más votos recientes)
      const growthFactor = 1 + (30 - day) / 30;
      
      for (let hour = 0; hour < 24; hour += 6) {
        const recordDate = new Date(date);
        recordDate.setHours(hour);
        
        const optionVotes = poll.options.map((option, idx) => {
          // Variar votos por opción con tendencia
          const base = 10 + idx * 5;
          const variance = Math.floor(Math.random() * 20);
          return Math.floor((base + variance) * growthFactor);
        });
        
        const totalVotes = optionVotes.reduce((sum, v) => sum + v, 0);
        
        for (let i = 0; i < poll.options.length; i++) {
          await prisma.voteHistory.create({
            data: {
              pollId: poll.id,
              optionId: poll.options[i].id,
              voteCount: optionVotes[i],
              percentage: (optionVotes[i] / totalVotes) * 100,
              recordedAt: recordDate,
            },
          });
        }
      }
    }
  }
  
  console.log('✅ Historial de votos generado (30 días, 4 registros/día)');

  
  // Crear encuestas de prueba con 8 y 12 opciones
    
  // Obtener un usuario existente
  const existingUser = await prisma.user.findFirst();
  if (!existingUser) {
        return;
  }
  
  const testPoll8 = await prisma.poll.create({
    data: {
      title: '🧪 TEST: ¿Cuál es tu lenguaje de programación favorito?',
      type: 'poll',
      userId: existingUser.id,
      options: {
        create: [
          { optionKey: 'js', optionLabel: 'JavaScript', color: '#F7DF1E' },
          { optionKey: 'py', optionLabel: 'Python', color: '#3776AB' },
          { optionKey: 'ts', optionLabel: 'TypeScript', color: '#3178C6' },
          { optionKey: 'java', optionLabel: 'Java', color: '#007396' },
          { optionKey: 'go', optionLabel: 'Go', color: '#00ADD8' },
          { optionKey: 'rust', optionLabel: 'Rust', color: '#CE422B' },
          { optionKey: 'cpp', optionLabel: 'C++', color: '#00599C' },
          { optionKey: 'ruby', optionLabel: 'Ruby', color: '#CC342D' },
        ],
      },
    },
    include: { options: true },
  });

  const testPoll12 = await prisma.poll.create({
    data: {
      title: '🧪 TEST: ¿Cuál es tu framework web favorito?',
      type: 'poll',
      userId: existingUser.id,
      options: {
        create: [
          { optionKey: 'react', optionLabel: 'React', color: '#61DAFB' },
          { optionKey: 'vue', optionLabel: 'Vue.js', color: '#4FC08D' },
          { optionKey: 'angular', optionLabel: 'Angular', color: '#DD0031' },
          { optionKey: 'svelte', optionLabel: 'Svelte', color: '#FF3E00' },
          { optionKey: 'next', optionLabel: 'Next.js', color: '#000000' },
          { optionKey: 'nuxt', optionLabel: 'Nuxt.js', color: '#00DC82' },
          { optionKey: 'remix', optionLabel: 'Remix', color: '#3992FF' },
          { optionKey: 'astro', optionLabel: 'Astro', color: '#FF5D01' },
          { optionKey: 'solid', optionLabel: 'Solid.js', color: '#2C4F7C' },
          { optionKey: 'qwik', optionLabel: 'Qwik', color: '#AC7EF4' },
          { optionKey: 'lit', optionLabel: 'Lit', color: '#324FFF' },
          { optionKey: 'alpine', optionLabel: 'Alpine.js', color: '#8BC0D0' },
        ],
      },
    },
    include: { options: true },
  });

  
                }

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
