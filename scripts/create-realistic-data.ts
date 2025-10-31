import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createRealisticData() {
  
  try {
    // 1. Limpiar datos existentes
        await prisma.voteHistory.deleteMany({});
    await prisma.vote.deleteMany({});
    await prisma.pollOption.deleteMany({});
    await prisma.poll.deleteMany({});
    await prisma.userFollower.deleteMany({});
    
    // 2. Crear usuarios realistas con avatares
        
    const usersData = [
      { 
        username: 'maria_tech', 
        displayName: 'María González', 
        email: 'maria@voutop.com', 
        bio: 'Apasionada de la tecnología y la innovación 🚀', 
        verified: true,
        avatarUrl: 'https://i.pravatar.cc/150?img=1'
      },
      { 
        username: 'carlos_eco', 
        displayName: 'Carlos López', 
        email: 'carlos@voutop.com', 
        bio: 'Activista ambiental 🌱', 
        verified: true,
        avatarUrl: 'https://i.pravatar.cc/150?img=12'
      },
      { 
        username: 'ana_music', 
        displayName: 'Ana Martínez', 
        email: 'ana@voutop.com', 
        bio: 'Melómana empedernida 🎵', 
        verified: false,
        avatarUrl: 'https://i.pravatar.cc/150?img=5'
      },
      { 
        username: 'david_sports', 
        displayName: 'David Ruiz', 
        email: 'david@voutop.com', 
        bio: 'Fanático del deporte ⚽', 
        verified: false,
        avatarUrl: 'https://i.pravatar.cc/150?img=13'
      },
      { 
        username: 'laura_food', 
        displayName: 'Laura Sánchez', 
        email: 'laura@voutop.com', 
        bio: 'Chef y amante de la comida 🍳', 
        verified: true,
        avatarUrl: 'https://i.pravatar.cc/150?img=9'
      },
      { 
        username: 'pedro_cinema', 
        displayName: 'Pedro García', 
        email: 'pedro@voutop.com', 
        bio: 'Cinéfilo profesional 🎬', 
        verified: false,
        avatarUrl: 'https://i.pravatar.cc/150?img=14'
      },
      { 
        username: 'sofia_gamer', 
        displayName: 'Sofía Torres', 
        email: 'sofia@voutop.com', 
        bio: 'Gamer profesional 🎮', 
        verified: true,
        avatarUrl: 'https://i.pravatar.cc/150?img=10'
      },
      { 
        username: 'luis_books', 
        displayName: 'Luis Fernández', 
        email: 'luis@voutop.com', 
        bio: 'Lector empedernido 📚', 
        verified: false,
        avatarUrl: 'https://i.pravatar.cc/150?img=15'
      },
      { 
        username: 'carmen_health', 
        displayName: 'Carmen Díaz', 
        email: 'carmen@voutop.com', 
        bio: 'Médica y promotora de vida saludable 🏥', 
        verified: true,
        avatarUrl: 'https://i.pravatar.cc/150?img=47'
      },
      { 
        username: 'roberto_work', 
        displayName: 'Roberto Jiménez', 
        email: 'roberto@voutop.com', 
        bio: 'Consultor de recursos humanos 💼', 
        verified: false,
        avatarUrl: 'https://i.pravatar.cc/150?img=33'
      },
    ];

    const users = [];
    for (const userData of usersData) {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: userData,
        create: userData,
      });
      users.push(user);
    }

    
    // 3. Crear relaciones de seguimiento (usuario 0 sigue a algunos otros)
        
    const mainUser = users[0]; // María
    const followingUsers = [users[1], users[2], users[4], users[6], users[8]]; // Carlos, Ana, Laura, Sofía, Carmen

    for (const followedUser of followingUsers) {
      await prisma.userFollower.create({
        data: {
          followerId: mainUser.id,
          followingId: followedUser.id,
        },
      });
    }

    
    // 4. Crear encuestas con opciones lógicas
    
    const pollsData = [
      {
        title: '¿Cuál es tu red social favorita en 2025?',
        category: 'tecnología',
        userId: users[0].id, // María (tech)
        options: [
          { key: 'tiktok', label: 'TikTok', color: '#000000' },
          { key: 'instagram', label: 'Instagram', color: '#E4405F' },
          { key: 'twitter', label: 'X (Twitter)', color: '#1DA1F2' },
          { key: 'youtube', label: 'YouTube', color: '#FF0000' },
        ],
        votesDistribution: [1250, 980, 756, 1420], // Total: 4406
        views: 4500,
        votersFromFollowed: [users[1], users[2]], // Carlos y Ana votaron
      },
      {
        title: '¿Prefieres trabajar desde casa o en la oficina?',
        category: 'trabajo',
        userId: users[9].id, // Roberto (work)
        options: [
          { key: 'remoto', label: '100% remoto', color: '#10b981' },
          { key: 'hibrido', label: 'Modelo híbrido', color: '#3b82f6' },
          { key: 'oficina', label: 'Presencial', color: '#ef4444' },
        ],
        votesDistribution: [2340, 3120, 890],
        views: 6500,
        votersFromFollowed: [users[4]], // Laura votó
      },
      {
        title: '¿Qué tipo de música escuchas más?',
        category: 'entretenimiento',
        userId: users[2].id, // Ana (music)
        options: [
          { key: 'reggaeton', label: 'Reggaetón', color: '#ef4444' },
          { key: 'pop', label: 'Pop', color: '#ec4899' },
          { key: 'rock', label: 'Rock', color: '#6366f1' },
          { key: 'electronica', label: 'Electrónica', color: '#8b5cf6' },
          { key: 'clasica', label: 'Clásica', color: '#f59e0b' },
        ],
        votesDistribution: [1890, 1450, 980, 1120, 340],
        views: 5800,
        votersFromFollowed: [], // Nadie que sigues votó
      },
      {
        title: '¿Cuántas horas duermes normalmente?',
        category: 'salud',
        userId: users[8].id, // Carmen (health)
        options: [
          { key: 'menos5', label: 'Menos de 5 horas', color: '#ef4444' },
          { key: '5a6', label: '5-6 horas', color: '#f59e0b' },
          { key: '7a8', label: '7-8 horas', color: '#10b981' },
          { key: 'mas8', label: 'Más de 8 horas', color: '#3b82f6' },
        ],
        votesDistribution: [450, 1230, 2890, 780],
        views: 5400,
        votersFromFollowed: [users[8], users[6]], // Carmen y Sofía votaron
      },
      {
        title: '¿Piña en la pizza? 🍕🍍',
        category: 'comida',
        userId: users[4].id, // Laura (food)
        options: [
          { key: 'si', label: 'Sí, me encanta', color: '#10b981' },
          { key: 'no', label: 'No, es un crimen', color: '#ef4444' },
          { key: 'depende', label: 'Depende del día', color: '#f59e0b' },
        ],
        votesDistribution: [1890, 2340, 670],
        views: 4900,
        votersFromFollowed: [users[1], users[4], users[2]], // Carlos, Laura y Ana votaron
      },
      {
        title: '¿Cuál es tu serie favorita del momento?',
        category: 'entretenimiento',
        userId: users[5].id, // Pedro (cinema)
        options: [
          { key: 'succession', label: 'Succession', color: '#6366f1' },
          { key: 'thelastofus', label: 'The Last of Us', color: '#10b981' },
          { key: 'wednesday', label: 'Wednesday', color: '#8b5cf6' },
          { key: 'stranger', label: 'Stranger Things', color: '#ef4444' },
          { key: 'otra', label: 'Otra', color: '#f59e0b' },
        ],
        votesDistribution: [890, 1450, 1120, 980, 560],
        views: 5000,
        votersFromFollowed: [users[6]], // Sofía votó
      },
      {
        title: '¿Apoyas la semana laboral de 4 días?',
        category: 'trabajo',
        userId: users[9].id, // Roberto (work)
        options: [
          { key: 'si', label: 'Sí, totalmente', color: '#10b981' },
          { key: 'no', label: 'No, prefiero 5 días', color: '#ef4444' },
          { key: 'prueba', label: 'Habría que probarlo', color: '#f59e0b' },
        ],
        votesDistribution: [3450, 560, 1230],
        views: 5300,
        votersFromFollowed: [users[1], users[4]], // Carlos y Laura votaron
      },
      {
        title: '¿Qué prefieres para desayunar?',
        category: 'comida',
        userId: users[4].id, // Laura (food)
        options: [
          { key: 'dulce', label: 'Dulce (tostadas, cereales)', color: '#ec4899' },
          { key: 'salado', label: 'Salado (huevos, bacon)', color: '#f59e0b' },
          { key: 'cafe', label: 'Solo café', color: '#6366f1' },
          { key: 'nada', label: 'No desayuno', color: '#ef4444' },
        ],
        votesDistribution: [1890, 1450, 980, 670],
        views: 5000,
        votersFromFollowed: [], // Nadie que sigues votó
      },
      {
        title: '¿Crees que la IA reemplazará tu trabajo?',
        category: 'tecnología',
        userId: users[0].id, // María (tech)
        options: [
          { key: 'si', label: 'Sí, en menos de 5 años', color: '#ef4444' },
          { key: 'parcial', label: 'Parcialmente', color: '#f59e0b' },
          { key: 'no', label: 'No, mi trabajo es seguro', color: '#10b981' },
          { key: 'nosé', label: 'No estoy seguro/a', color: '#6366f1' },
        ],
        votesDistribution: [890, 2340, 1560, 780],
        views: 5700,
        votersFromFollowed: [users[2], users[6]], // Ana y Sofía votaron
      },
      {
        title: '¿Cuál es tu deporte favorito?',
        category: 'deportes',
        userId: users[3].id, // David (sports)
        options: [
          { key: 'futbol', label: 'Fútbol', color: '#10b981' },
          { key: 'baloncesto', label: 'Baloncesto', color: '#f59e0b' },
          { key: 'tenis', label: 'Tenis', color: '#3b82f6' },
          { key: 'otro', label: 'Otro', color: '#8b5cf6' },
        ],
        votesDistribution: [2890, 1120, 670, 890],
        views: 5600,
        votersFromFollowed: [], // Nadie que sigues votó
      },
      {
        title: '¿Usas ChatGPT o IA generativa?',
        category: 'tecnología',
        userId: users[0].id, // María (tech)
        options: [
          { key: 'diario', label: 'Todos los días', color: '#10b981' },
          { key: 'aveces', label: 'A veces', color: '#3b82f6' },
          { key: 'rara', label: 'Rara vez', color: '#f59e0b' },
          { key: 'nunca', label: 'Nunca', color: '#ef4444' },
        ],
        votesDistribution: [1890, 2340, 780, 450],
        views: 5500,
        votersFromFollowed: [users[1], users[4], users[6]], // Carlos, Laura y Sofía votaron
      },
      {
        title: '¿Prefieres perros o gatos?',
        category: 'mascotas',
        userId: users[7].id, // Luis
        options: [
          { key: 'perros', label: '🐕 Perros', color: '#f59e0b' },
          { key: 'gatos', label: '🐈 Gatos', color: '#8b5cf6' },
          { key: 'ambos', label: 'Ambos', color: '#10b981' },
          { key: 'ninguno', label: 'Ninguno', color: '#6366f1' },
        ],
        votesDistribution: [2560, 2120, 890, 340],
        views: 5900,
        votersFromFollowed: [users[2]], // Ana votó
      },
      {
        title: '¿Cuánto tiempo pasas en redes sociales al día?',
        category: 'tecnología',
        userId: users[0].id, // María (tech)
        options: [
          { key: 'menos1', label: 'Menos de 1 hora', color: '#10b981' },
          { key: '1a2', label: '1-2 horas', color: '#3b82f6' },
          { key: '3a4', label: '3-4 horas', color: '#f59e0b' },
          { key: 'mas4', label: 'Más de 4 horas', color: '#ef4444' },
        ],
        votesDistribution: [450, 1230, 2340, 1560],
        views: 5600,
        votersFromFollowed: [], // Nadie que sigues votó
      },
      {
        title: '¿Qué opinas del cambio climático?',
        category: 'medioambiente',
        userId: users[1].id, // Carlos (eco)
        options: [
          { key: 'urgente', label: 'Es urgente actuar ya', color: '#10b981' },
          { key: 'importante', label: 'Es importante pero no urgente', color: '#f59e0b' },
          { key: 'exagerado', label: 'Está exagerado', color: '#ef4444' },
          { key: 'nosé', label: 'No tengo opinión', color: '#6366f1' },
        ],
        votesDistribution: [3450, 890, 340, 230],
        views: 4900,
        votersFromFollowed: [users[1], users[8]], // Carlos y Carmen votaron
      },
      {
        title: '¿Cuál es tu plataforma de streaming favorita?',
        category: 'entretenimiento',
        userId: users[5].id, // Pedro (cinema)
        options: [
          { key: 'netflix', label: 'Netflix', color: '#ef4444' },
          { key: 'disney', label: 'Disney+', color: '#3b82f6' },
          { key: 'prime', label: 'Prime Video', color: '#00a8e1' },
          { key: 'hbo', label: 'HBO Max', color: '#8b5cf6' },
          { key: 'otra', label: 'Otra', color: '#f59e0b' },
        ],
        votesDistribution: [2340, 1120, 890, 780, 450],
        views: 5600,
        votersFromFollowed: [users[6]], // Sofía votó
      },
    ];

    for (const pollData of pollsData) {
      
      // Crear la encuesta
      const poll = await prisma.poll.create({
        data: {
          userId: pollData.userId,
          title: pollData.title,
          description: `Encuesta sobre ${pollData.category}`,
          category: pollData.category,
          type: 'poll',
          status: 'active',
          totalVotes: pollData.votesDistribution.reduce((a, b) => a + b, 0),
          totalViews: pollData.views,
        },
      });

      // Crear opciones
      const createdOptions = [];
      for (let i = 0; i < pollData.options.length; i++) {
        const opt = pollData.options[i];
        const option = await prisma.pollOption.create({
          data: {
            pollId: poll.id,
            optionKey: opt.key,
            optionLabel: opt.label,
            color: opt.color,
            voteCount: pollData.votesDistribution[i],
            displayOrder: i,
          },
        });
        createdOptions.push(option);
      }

      // Crear votos de usuarios seguidos (si los hay)
      if (pollData.votersFromFollowed && pollData.votersFromFollowed.length > 0) {
        for (const voter of pollData.votersFromFollowed) {
          // Seleccionar una opción aleatoria para este usuario
          const randomOptionIndex = Math.floor(Math.random() * createdOptions.length);
          const selectedOption = createdOptions[randomOptionIndex];

          await prisma.vote.create({
            data: {
              userId: voter.id,
              pollId: poll.id,
              optionId: selectedOption.id,
              countryIso3: 'ESP',
              countryName: 'España',
              latitude: 40.4168 + (Math.random() - 0.5) * 0.2,
              longitude: -3.7038 + (Math.random() - 0.5) * 0.2,
            },
          });
        }
              } else {
              }

      // Crear historial de votos para gráficas
      for (let optIndex = 0; optIndex < createdOptions.length; optIndex++) {
        const option = createdOptions[optIndex];
        const baseVotes = pollData.votesDistribution[optIndex];
        const totalVotes = pollData.votesDistribution.reduce((a, b) => a + b, 0);

        // Crear 30 puntos históricos (últimos 30 días)
        for (let day = 29; day >= 0; day--) {
          const date = new Date();
          date.setDate(date.getDate() - day);
          date.setHours(12, 0, 0, 0);

          // Simular crecimiento gradual (menos votos en el pasado)
          const growthFactor = 0.3 + (0.7 * (30 - day) / 30); // De 30% a 100%
          const variation = 1 + (Math.random() - 0.5) * 0.1; // ±5% variación
          const historicalVotes = Math.round(baseVotes * growthFactor * variation);
          const percentage = (historicalVotes / totalVotes) * 100;

          await prisma.voteHistory.create({
            data: {
              pollId: poll.id,
              optionId: option.id,
              voteCount: historicalVotes,
              percentage: percentage,
              recordedAt: date,
            },
          });
        }
      }

                }

    // 5. Crear usuarios destacados
        
    const featuredData = [
      { userId: users[0].id, roleTitle: 'Experta en Tecnología', citationsCount: 312 },
      { userId: users[1].id, roleTitle: 'Activista Ambiental', citationsCount: 289 },
      { userId: users[4].id, roleTitle: 'Chef Profesional', citationsCount: 156 },
    ];

    for (const featured of featuredData) {
      await prisma.featuredUser.upsert({
        where: { userId: featured.userId },
        update: featured,
        create: featured,
      });
    }

    
    // 6. Crear hashtags
        
    const hashtagsData = [
      { tag: 'tecnología', usageCount: 5 },
      { tag: 'trabajo', usageCount: 4 },
      { tag: 'entretenimiento', usageCount: 3 },
      { tag: 'salud', usageCount: 2 },
      { tag: 'comida', usageCount: 2 },
    ];

    for (const hashtagData of hashtagsData) {
      await prisma.hashtag.upsert({
        where: { tag: hashtagData.tag },
        update: hashtagData,
        create: hashtagData,
      });
    }

    
    // Resumen final
    const finalStats = {
      users: await prisma.user.count(),
      polls: await prisma.poll.count(),
      options: await prisma.pollOption.count(),
      votes: await prisma.vote.count(),
      voteHistory: await prisma.voteHistory.count(),
      followers: await prisma.userFollower.count(),
      featured: await prisma.featuredUser.count(),
      hashtags: await prisma.hashtag.count(),
    };

                                        
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createRealisticData();
