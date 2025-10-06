import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  
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
      totalViews: 15420,
      options: {
        create: [
          { 
            optionKey: 'economia', 
            optionLabel: 'Economía', 
            color: '#3b82f6', 
            displayOrder: 0,
            voteCount: 0
          },
          { 
            optionKey: 'sanidad', 
            optionLabel: 'Sanidad', 
            color: '#10b981', 
            displayOrder: 1,
            voteCount: 0
          },
          { 
            optionKey: 'educacion', 
            optionLabel: 'Educación', 
            color: '#f59e0b', 
            displayOrder: 2,
            voteCount: 0
          },
          { 
            optionKey: 'medio_ambiente', 
            optionLabel: 'Medio Ambiente', 
            color: '#22c55e', 
            displayOrder: 3,
            voteCount: 0
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
      totalViews: 8930,
      options: {
        create: [
          { 
            optionKey: 'si', 
            optionLabel: 'Sí, completamente', 
            color: '#10b981', 
            displayOrder: 0,
            voteCount: 0
          },
          { 
            optionKey: 'no', 
            optionLabel: 'No', 
            color: '#ef4444', 
            displayOrder: 1,
            voteCount: 0
          },
          { 
            optionKey: 'tal_vez', 
            optionLabel: 'Tal vez', 
            color: '#f59e0b', 
            displayOrder: 2,
            voteCount: 0
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
      totalViews: 12340,
      options: {
        create: [
          { 
            optionKey: 'full_remote', 
            optionLabel: 'Sí, 100% remoto', 
            color: '#8b5cf6', 
            displayOrder: 0,
            voteCount: 0
          },
          { 
            optionKey: 'hybrid', 
            optionLabel: 'Modelo híbrido', 
            color: '#06b6d4', 
            displayOrder: 1,
            voteCount: 0
          },
          { 
            optionKey: 'presencial', 
            optionLabel: 'Presencial', 
            color: '#f59e0b', 
            displayOrder: 2,
            voteCount: 0
          },
        ],
      },
    },
    include: { options: true },
  });

  
  // Crear votos geolocalizados para la primera encuesta
    
  const votesData = [
    // Madrid - Economía
    { pollId: poll1.id, optionId: poll1.options[0].id, lat: 40.4168, lng: -3.7038, iso3: 'ESP', country: 'España', city: 'Madrid' },
    { pollId: poll1.id, optionId: poll1.options[0].id, lat: 40.42, lng: -3.70, iso3: 'ESP', country: 'España', city: 'Madrid' },
    { pollId: poll1.id, optionId: poll1.options[0].id, lat: 40.41, lng: -3.71, iso3: 'ESP', country: 'España', city: 'Madrid' },
    
    // Madrid - Sanidad
    { pollId: poll1.id, optionId: poll1.options[1].id, lat: 40.418, lng: -3.69, iso3: 'ESP', country: 'España', city: 'Madrid' },
    { pollId: poll1.id, optionId: poll1.options[1].id, lat: 40.425, lng: -3.695, iso3: 'ESP', country: 'España', city: 'Madrid' },
    
    // Barcelona - Educación
    { pollId: poll1.id, optionId: poll1.options[2].id, lat: 41.3851, lng: 2.1734, iso3: 'ESP', country: 'España', city: 'Barcelona' },
    { pollId: poll1.id, optionId: poll1.options[2].id, lat: 41.39, lng: 2.17, iso3: 'ESP', country: 'España', city: 'Barcelona' },
    
    // Barcelona - Medio Ambiente
    { pollId: poll1.id, optionId: poll1.options[3].id, lat: 41.38, lng: 2.18, iso3: 'ESP', country: 'España', city: 'Barcelona' },
    { pollId: poll1.id, optionId: poll1.options[3].id, lat: 41.387, lng: 2.175, iso3: 'ESP', country: 'España', city: 'Barcelona' },
    { pollId: poll1.id, optionId: poll1.options[3].id, lat: 41.383, lng: 2.172, iso3: 'ESP', country: 'España', city: 'Barcelona' },
    
    // Valencia - Economía
    { pollId: poll1.id, optionId: poll1.options[0].id, lat: 39.4699, lng: -0.3763, iso3: 'ESP', country: 'España', city: 'Valencia' },
    
    // Sevilla - Sanidad
    { pollId: poll1.id, optionId: poll1.options[1].id, lat: 37.3891, lng: -5.9845, iso3: 'ESP', country: 'España', city: 'Sevilla' },
    
    // París - Medio Ambiente
    { pollId: poll1.id, optionId: poll1.options[3].id, lat: 48.8566, lng: 2.3522, iso3: 'FRA', country: 'Francia', city: 'París' },
    { pollId: poll1.id, optionId: poll1.options[3].id, lat: 48.86, lng: 2.35, iso3: 'FRA', country: 'Francia', city: 'París' },
    
    // Londres - Economía
    { pollId: poll1.id, optionId: poll1.options[0].id, lat: 51.5074, lng: -0.1278, iso3: 'GBR', country: 'Reino Unido', city: 'Londres' },
  ];

  for (const voteData of votesData) {
    await prisma.vote.create({
      data: {
        pollId: voteData.pollId,
        optionId: voteData.optionId,
        latitude: voteData.lat,
        longitude: voteData.lng,
        countryIso3: voteData.iso3,
        countryName: voteData.country,
        cityName: voteData.city,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      },
    });
  }

  // Actualizar contadores de votos
  for (const option of poll1.options) {
    const count = votesData.filter(v => v.optionId === option.id).length;
    await prisma.pollOption.update({
      where: { id: option.id },
      data: { voteCount: count },
    });
  }

  await prisma.poll.update({
    where: { id: poll1.id },
    data: { totalVotes: votesData.length },
  });

  
  // Crear hashtags
    const hashtags = await Promise.all([
    prisma.hashtag.create({ data: { tag: 'política', usageCount: 5 } }),
    prisma.hashtag.create({ data: { tag: 'economía', usageCount: 3 } }),
    prisma.hashtag.create({ data: { tag: 'medioambiente', usageCount: 4 } }),
    prisma.hashtag.create({ data: { tag: 'trabajo', usageCount: 2 } }),
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
      region: 'Global',
      options: {
        create: [
          { optionKey: 'js', optionLabel: 'JavaScript', color: '#F7DF1E', voteCount: 450 },
          { optionKey: 'py', optionLabel: 'Python', color: '#3776AB', voteCount: 380 },
          { optionKey: 'ts', optionLabel: 'TypeScript', color: '#3178C6', voteCount: 320 },
          { optionKey: 'java', optionLabel: 'Java', color: '#007396', voteCount: 290 },
          { optionKey: 'go', optionLabel: 'Go', color: '#00ADD8', voteCount: 250 },
          { optionKey: 'rust', optionLabel: 'Rust', color: '#CE422B', voteCount: 210 },
          { optionKey: 'cpp', optionLabel: 'C++', color: '#00599C', voteCount: 180 },
          { optionKey: 'ruby', optionLabel: 'Ruby', color: '#CC342D', voteCount: 150 },
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
      region: 'Global',
      options: {
        create: [
          { optionKey: 'react', optionLabel: 'React', color: '#61DAFB', voteCount: 520 },
          { optionKey: 'vue', optionLabel: 'Vue.js', color: '#4FC08D', voteCount: 480 },
          { optionKey: 'angular', optionLabel: 'Angular', color: '#DD0031', voteCount: 420 },
          { optionKey: 'svelte', optionLabel: 'Svelte', color: '#FF3E00', voteCount: 380 },
          { optionKey: 'next', optionLabel: 'Next.js', color: '#000000', voteCount: 350 },
          { optionKey: 'nuxt', optionLabel: 'Nuxt.js', color: '#00DC82', voteCount: 310 },
          { optionKey: 'remix', optionLabel: 'Remix', color: '#3992FF', voteCount: 270 },
          { optionKey: 'astro', optionLabel: 'Astro', color: '#FF5D01', voteCount: 240 },
          { optionKey: 'solid', optionLabel: 'Solid.js', color: '#2C4F7C', voteCount: 210 },
          { optionKey: 'qwik', optionLabel: 'Qwik', color: '#AC7EF4', voteCount: 180 },
          { optionKey: 'lit', optionLabel: 'Lit', color: '#324FFF', voteCount: 150 },
          { optionKey: 'alpine', optionLabel: 'Alpine.js', color: '#8BC0D0', voteCount: 120 },
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
