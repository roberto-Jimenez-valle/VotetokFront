import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpiando base de datos...');
  
  // Eliminar datos existentes en orden (respetando foreign keys)
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

  
  // Crear votos geolocalizados para la primera encuesta
  // Buscar subdivisiones NIVEL 3 (provincias) más cercanas a las coordenadas
  console.log('🔍 Buscando subdivisiones nivel 3 para votos de ejemplo...');
  
  // Helper function para buscar subdivisión nivel 3 más cercana
  async function findNearestLevel3(lat: number, lon: number, iso3: string) {
    const result = await prisma.$queryRaw<Array<{
      id: number;
      subdivision_id: string;
      name: string;
      level: number;
    }>>`
      SELECT id, subdivision_id, name, level
      FROM subdivisions
      WHERE level = 3 
        AND subdivision_id LIKE ${iso3 + '.%'}
      ORDER BY 
        ((latitude - ${lat}) * (latitude - ${lat}) + 
         (longitude - ${lon}) * (longitude - ${lon}))
      LIMIT 1
    `;
    return result[0];
  }

  // Buscar provincias nivel 3
  const madridProvince = await findNearestLevel3(40.4168, -3.7038, 'ESP'); // Madrid provincia
  const barcelonaProvince = await findNearestLevel3(41.3851, 2.1734, 'ESP'); // Barcelona provincia
  const sevillaProvince = await findNearestLevel3(37.3891, -5.9845, 'ESP'); // Sevilla provincia
  const parisProvince = await findNearestLevel3(48.8566, 2.3522, 'FRA'); // París provincia
  const londonProvince = await findNearestLevel3(51.5074, -0.1278, 'GBR'); // Londres provincia

  if (!madridProvince || !barcelonaProvince || !sevillaProvince || !parisProvince || !londonProvince) {
    console.warn('⚠️ No se encontraron subdivisiones nivel 3. Ejecuta: npm run db:populate-subdivisions');
    console.log('⏭️ Saltando creación de votos de ejemplo');
  } else {
    console.log(`✅ Subdivisiones nivel 3 encontradas:`);
    console.log(`   Madrid: ${madridProvince.name} (${madridProvince.subdivision_id})`);
    console.log(`   Barcelona: ${barcelonaProvince.name} (${barcelonaProvince.subdivision_id})`);
    console.log(`   Sevilla: ${sevillaProvince.name} (${sevillaProvince.subdivision_id})`);
    console.log(`   París: ${parisProvince.name} (${parisProvince.subdivision_id})`);
    console.log(`   Londres: ${londonProvince.name} (${londonProvince.subdivision_id})`);

    const votesData = [
      // Madrid - Economía
      { pollId: poll1.id, optionId: poll1.options[0].id, lat: 40.4168, lng: -3.7038, subdivisionId: madridProvince.id },
      { pollId: poll1.id, optionId: poll1.options[0].id, lat: 40.42, lng: -3.70, subdivisionId: madridProvince.id },
      { pollId: poll1.id, optionId: poll1.options[0].id, lat: 40.41, lng: -3.71, subdivisionId: madridProvince.id },
      
      // Barcelona - Sanidad
      { pollId: poll1.id, optionId: poll1.options[1].id, lat: 41.3851, lng: 2.1734, subdivisionId: barcelonaProvince.id },
      { pollId: poll1.id, optionId: poll1.options[1].id, lat: 41.38, lng: 2.17, subdivisionId: barcelonaProvince.id },
      
      // Sevilla - Sanidad
      { pollId: poll1.id, optionId: poll1.options[1].id, lat: 37.3891, lng: -5.9845, subdivisionId: sevillaProvince.id },
      
      // París - Medio Ambiente
      { pollId: poll1.id, optionId: poll1.options[3].id, lat: 48.8566, lng: 2.3522, subdivisionId: parisProvince.id },
      { pollId: poll1.id, optionId: poll1.options[3].id, lat: 48.86, lng: 2.35, subdivisionId: parisProvince.id },
      
      // Londres - Economía
      { pollId: poll1.id, optionId: poll1.options[0].id, lat: 51.5074, lng: -0.1278, subdivisionId: londonProvince.id },
    ];

    for (const voteData of votesData) {
      await prisma.vote.create({
        data: {
          pollId: voteData.pollId,
          optionId: voteData.optionId,
          latitude: voteData.lat,
          longitude: voteData.lng,
          subdivisionId: voteData.subdivisionId,
        },
      });
    }
    
    console.log('✅ Votos de ejemplo creados con subdivisiones NIVEL 3');
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

  
  // Crear historial de votos para gráficos
    const now = new Date();
  for (let i = 0; i < 30; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    for (const option of poll1.options) {
      const baseVotes = Math.floor(Math.random() * 100) + 50;
      const totalVotes = poll1.options.reduce((sum, opt) => sum + baseVotes, 0);
      await prisma.voteHistory.create({
        data: {
          pollId: poll1.id,
          optionId: option.id,
          voteCount: baseVotes,
          percentage: (baseVotes / totalVotes) * 100,
          recordedAt: date,
        },
      });
    }
  }

  
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
