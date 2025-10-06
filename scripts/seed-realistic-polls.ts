import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Colores vibrantes para las opciones
const COLORS = [
  '#3b82f6', // Azul
  '#10b981', // Verde
  '#f59e0b', // Amarillo
  '#ef4444', // Rojo
  '#8b5cf6', // Púrpura
  '#06b6d4', // Cian
  '#ec4899', // Rosa
  '#22c55e', // Verde lima
  '#f97316', // Naranja
  '#6366f1', // Índigo
];

// Encuestas realistas con diferentes categorías
const REALISTIC_POLLS = [
  {
    title: '¿Cuál es tu red social favorita en 2025?',
    category: 'tecnología',
    options: [
      { key: 'tiktok', label: 'TikTok', votes: 1250 },
      { key: 'instagram', label: 'Instagram', votes: 980 },
      { key: 'twitter', label: 'X (Twitter)', votes: 756 },
      { key: 'youtube', label: 'YouTube', votes: 1420 },
    ],
    views: 4500,
  },
  {
    title: '¿Prefieres trabajar desde casa o en la oficina?',
    category: 'trabajo',
    options: [
      { key: 'casa', label: '100% remoto', votes: 2340 },
      { key: 'hibrido', label: 'Modelo híbrido', votes: 3120 },
      { key: 'oficina', label: 'Presencial', votes: 890 },
    ],
    views: 6500,
  },
  {
    title: '¿Qué tipo de música escuchas más?',
    category: 'entretenimiento',
    options: [
      { key: 'reggaeton', label: 'Reggaetón', votes: 1890 },
      { key: 'pop', label: 'Pop', votes: 1450 },
      { key: 'rock', label: 'Rock', votes: 980 },
      { key: 'electronica', label: 'Electrónica', votes: 1120 },
      { key: 'clasica', label: 'Clásica', votes: 340 },
    ],
    views: 5800,
  },
  {
    title: '¿Cuántas horas duermes normalmente?',
    category: 'salud',
    options: [
      { key: 'menos5', label: 'Menos de 5 horas', votes: 450 },
      { key: '5a6', label: '5-6 horas', votes: 1230 },
      { key: '7a8', label: '7-8 horas', votes: 2890 },
      { key: 'mas8', label: 'Más de 8 horas', votes: 780 },
    ],
    views: 5400,
  },
  {
    title: '¿Piña en la pizza? 🍕🍍',
    category: 'comida',
    options: [
      { key: 'si', label: 'Sí, me encanta', votes: 1890 },
      { key: 'no', label: 'No, es un crimen', votes: 2340 },
      { key: 'depende', label: 'Depende del día', votes: 670 },
    ],
    views: 4900,
  },
  {
    title: '¿Cuál es tu serie favorita del momento?',
    category: 'entretenimiento',
    options: [
      { key: 'succession', label: 'Succession', votes: 890 },
      { key: 'thelastofus', label: 'The Last of Us', votes: 1450 },
      { key: 'wednesday', label: 'Wednesday', votes: 1120 },
      { key: 'stranger', label: 'Stranger Things', votes: 980 },
      { key: 'otra', label: 'Otra', votes: 560 },
    ],
    views: 5000,
  },
  {
    title: '¿Apoyas la semana laboral de 4 días?',
    category: 'trabajo',
    options: [
      { key: 'si', label: 'Sí, totalmente', votes: 3450 },
      { key: 'no', label: 'No, prefiero 5 días', votes: 560 },
      { key: 'prueba', label: 'Habría que probarlo', votes: 1230 },
    ],
    views: 5300,
  },
  {
    title: '¿Qué prefieres para desayunar?',
    category: 'comida',
    options: [
      { key: 'dulce', label: 'Dulce (tostadas, cereales)', votes: 1890 },
      { key: 'salado', label: 'Salado (huevos, bacon)', votes: 1450 },
      { key: 'cafe', label: 'Solo café', votes: 980 },
      { key: 'nada', label: 'No desayuno', votes: 670 },
    ],
    views: 5000,
  },
  {
    title: '¿Crees que la IA reemplazará tu trabajo?',
    category: 'tecnología',
    options: [
      { key: 'si', label: 'Sí, en menos de 5 años', votes: 890 },
      { key: 'parcial', label: 'Parcialmente', votes: 2340 },
      { key: 'no', label: 'No, mi trabajo es seguro', votes: 1560 },
      { key: 'nosé', label: 'No estoy seguro/a', votes: 780 },
    ],
    views: 5700,
  },
  {
    title: '¿Cuál es tu deporte favorito?',
    category: 'deportes',
    options: [
      { key: 'futbol', label: 'Fútbol', votes: 2890 },
      { key: 'baloncesto', label: 'Baloncesto', votes: 1120 },
      { key: 'tenis', label: 'Tenis', votes: 670 },
      { key: 'otro', label: 'Otro', votes: 890 },
    ],
    views: 5600,
  },
  {
    title: '¿Usas ChatGPT o IA generativa?',
    category: 'tecnología',
    options: [
      { key: 'diario', label: 'Todos los días', votes: 1890 },
      { key: 'aveces', label: 'A veces', votes: 2340 },
      { key: 'rara', label: 'Rara vez', votes: 780 },
      { key: 'nunca', label: 'Nunca', votes: 450 },
    ],
    views: 5500,
  },
  {
    title: '¿Prefieres perros o gatos?',
    category: 'mascotas',
    options: [
      { key: 'perros', label: '🐕 Perros', votes: 2560 },
      { key: 'gatos', label: '🐈 Gatos', votes: 2120 },
      { key: 'ambos', label: 'Ambos', votes: 890 },
      { key: 'ninguno', label: 'Ninguno', votes: 340 },
    ],
    views: 5900,
  },
  {
    title: '¿Cuánto tiempo pasas en redes sociales al día?',
    category: 'tecnología',
    options: [
      { key: 'menos1', label: 'Menos de 1 hora', votes: 450 },
      { key: '1a2', label: '1-2 horas', votes: 1230 },
      { key: '3a4', label: '3-4 horas', votes: 2340 },
      { key: 'mas4', label: 'Más de 4 horas', votes: 1560 },
    ],
    views: 5600,
  },
  {
    title: '¿Qué opinas del cambio climático?',
    category: 'medioambiente',
    options: [
      { key: 'urgente', label: 'Es urgente actuar ya', votes: 3450 },
      { key: 'importante', label: 'Es importante pero no urgente', votes: 890 },
      { key: 'exagerado', label: 'Está exagerado', votes: 340 },
      { key: 'nosé', label: 'No tengo opinión', votes: 230 },
    ],
    views: 4900,
  },
  {
    title: '¿Cuál es tu plataforma de streaming favorita?',
    category: 'entretenimiento',
    options: [
      { key: 'netflix', label: 'Netflix', votes: 2340 },
      { key: 'disney', label: 'Disney+', votes: 1120 },
      { key: 'prime', label: 'Prime Video', votes: 890 },
      { key: 'hbo', label: 'HBO Max', votes: 780 },
      { key: 'otra', label: 'Otra', votes: 450 },
    ],
    views: 5600,
  },
];

async function seedRealisticPolls() {
  
  try {
    // Obtener usuarios existentes
    const users = await prisma.user.findMany();
    
    if (users.length === 0) {
      console.error('❌ No hay usuarios en la base de datos. Ejecuta el seed principal primero.');
      return;
    }

    
    // Crear encuestas
    for (let i = 0; i < REALISTIC_POLLS.length; i++) {
      const pollData = REALISTIC_POLLS[i];
      const user = users[i % users.length]; // Rotar entre usuarios

      
      // Calcular total de votos
      const totalVotes = pollData.options.reduce((sum, opt) => sum + opt.votes, 0);

      // Crear la encuesta
      const poll = await prisma.poll.create({
        data: {
          userId: user.id,
          title: pollData.title,
          description: `Encuesta sobre ${pollData.category}`,
          category: pollData.category,
          type: 'poll',
          status: 'active',
          totalVotes: totalVotes,
          totalViews: pollData.views,
          options: {
            create: pollData.options.map((opt, index) => ({
              optionKey: opt.key,
              optionLabel: opt.label,
              color: COLORS[index % COLORS.length],
              voteCount: opt.votes,
              displayOrder: index,
            })),
          },
        },
        include: {
          options: true,
        },
      });

      // Crear historial de votos para cada opción
      for (const option of poll.options) {
        const percentage = (option.voteCount / totalVotes) * 100;
        
        // Crear 5 puntos históricos (últimos 5 días)
        for (let day = 4; day >= 0; day--) {
          const date = new Date();
          date.setDate(date.getDate() - day);
          
          // Simular variación en los votos
          const variation = 1 + (Math.random() - 0.5) * 0.2; // ±10%
          const historicalVotes = Math.round(option.voteCount * variation * (1 - day * 0.1));
          const historicalPercentage = (historicalVotes / totalVotes) * 100;

          await prisma.voteHistory.create({
            data: {
              pollId: poll.id,
              optionId: option.id,
              voteCount: historicalVotes,
              percentage: historicalPercentage,
              recordedAt: date,
            },
          });
        }
      }

                      }

        
    // Mostrar resumen
    const pollCount = await prisma.poll.count();
    const voteCount = await prisma.vote.count();
    const historyCount = await prisma.voteHistory.count();
    
                
  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedRealisticPolls();
