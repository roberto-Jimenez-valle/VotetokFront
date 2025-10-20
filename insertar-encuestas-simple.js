import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const encuestas = [
  {
    title: '¿Cuál es tu superpoder ideal?',
    description: 'Si pudieras elegir un superpoder, ¿cuál sería?',
    category: 'Entretenimiento',
    daysAgo: 5,
    options: [
      { key: 'volar', label: 'Volar', color: '#3b82f6', votes: 320 },
      { key: 'invisible', label: 'Invisibilidad', color: '#8b5cf6', votes: 200 },
      { key: 'teletransporte', label: 'Teletransportación', color: '#ec4899', votes: 380 },
      { key: 'leer_mentes', label: 'Leer mentes', color: '#f59e0b', votes: 100 }
    ]
  },
  {
    title: '¿Qué harías primero si ganaras la lotería?',
    description: 'Imagina que ganas 10 millones de euros...',
    category: 'Lifestyle',
    daysAgo: 4,
    options: [
      { key: 'viajar', label: 'Viajar por el mundo', color: '#10b981', votes: 420 },
      { key: 'casa', label: 'Comprar casa de ensueño', color: '#3b82f6', votes: 280 },
      { key: 'ayudar', label: 'Ayudar a familia/amigos', color: '#f59e0b', votes: 220 },
      { key: 'invertir', label: 'Invertir sabiamente', color: '#8b5cf6', votes: 130 }
    ]
  },
  {
    title: '¿Piña en la pizza? 🍕🍍',
    description: 'El debate eterno que divide a la humanidad',
    category: 'Comida',
    daysAgo: 3,
    options: [
      { key: 'si', label: '¡Sí! Es deliciosa', color: '#10b981', votes: 350 },
      { key: 'no', label: 'No, es un crimen', color: '#ef4444', votes: 580 },
      { key: 'depende', label: 'Depende del día', color: '#f59e0b', votes: 70 }
    ]
  },
  {
    title: '¿Mejor forma de comer Oreo? 🍪',
    description: '¿Cómo disfrutas tu galleta favorita?',
    category: 'Comida',
    daysAgo: 6,
    options: [
      { key: 'entera', label: 'Entera de un bocado', color: '#8b5cf6', votes: 180 },
      { key: 'separar', label: 'Separar y lamer crema', color: '#ec4899', votes: 290 },
      { key: 'leche', label: 'Mojar en leche', color: '#3b82f6', votes: 440 },
      { key: 'postre', label: 'En postres/batidos', color: '#f59e0b', votes: 90 }
    ]
  },
  {
    title: '¿Perro o gato? 🐶🐱',
    description: 'El eterno debate de las mascotas',
    category: 'Mascotas',
    daysAgo: 7,
    options: [
      { key: 'perro', label: '🐶 Team Perros', color: '#f59e0b', votes: 480 },
      { key: 'gato', label: '🐱 Team Gatos', color: '#8b5cf6', votes: 380 },
      { key: 'ambos', label: 'Ambos son geniales', color: '#10b981', votes: 120 },
      { key: 'ninguno', label: 'Prefiero otras mascotas', color: '#6b7280', votes: 20 }
    ]
  },
  {
    title: '¿Mejor saga de películas?',
    description: 'La batalla de las franquicias épicas',
    category: 'Cine',
    daysAgo: 2,
    options: [
      { key: 'starwars', label: 'Star Wars', color: '#3b82f6', votes: 220 },
      { key: 'lotr', label: 'El Señor de los Anillos', color: '#10b981', votes: 360 },
      { key: 'marvel', label: 'Marvel (MCU)', color: '#ef4444', votes: 280 },
      { key: 'hp', label: 'Harry Potter', color: '#8b5cf6', votes: 140 }
    ]
  },
  {
    title: '¿Cómo te gusta el café? ☕',
    description: 'La pregunta del millón cada mañana',
    category: 'Comida',
    daysAgo: 8,
    options: [
      { key: 'solo', label: 'Solo (negro)', color: '#1f2937', votes: 280 },
      { key: 'leche', label: 'Con leche', color: '#a0522d', votes: 380 },
      { key: 'cortado', label: 'Cortado/Cappuccino', color: '#8b4513', votes: 250 },
      { key: 'no_cafe', label: 'No tomo café', color: '#6b7280', votes: 90 }
    ]
  },
  {
    title: '¿Mejor década para la música? 🎵',
    description: '¿Cuándo sonaba mejor todo?',
    category: 'Música',
    daysAgo: 10,
    options: [
      { key: '70s', label: 'Años 70 (Rock/Disco)', color: '#f59e0b', votes: 150 },
      { key: '80s', label: 'Años 80 (Pop/New Wave)', color: '#ec4899', votes: 280 },
      { key: '90s', label: 'Años 90 (Grunge/Hip Hop)', color: '#8b5cf6', votes: 340 },
      { key: '2000s', label: 'Años 2000-2010', color: '#3b82f6', votes: 140 },
      { key: 'actual', label: 'Música actual', color: '#10b981', votes: 90 }
    ]
  },
  {
    title: '¿Trabajar desde casa o en oficina? 💼',
    description: 'El debate post-pandemia',
    category: 'Trabajo',
    daysAgo: 1,
    options: [
      { key: 'casa', label: '🏠 100% remoto', color: '#10b981', votes: 520 },
      { key: 'oficina', label: '🏢 100% oficina', color: '#3b82f6', votes: 120 },
      { key: 'hibrido', label: '⚖️ Híbrido', color: '#f59e0b', votes: 360 }
    ]
  },
  {
    title: '¿Dónde te irías a vivir? 🌍',
    description: 'Si pudieras elegir cualquier lugar del mundo',
    category: 'Viajes',
    daysAgo: 9,
    options: [
      { key: 'playa', label: '🏖️ Cerca de la playa', color: '#3b82f6', votes: 450 },
      { key: 'montana', label: '🏔️ En las montañas', color: '#10b981', votes: 180 },
      { key: 'ciudad', label: '🌆 Gran ciudad', color: '#f59e0b', votes: 240 },
      { key: 'pueblo', label: '🏡 Pueblo tranquilo', color: '#8b5cf6', votes: 130 }
    ]
  }
];

async function insertarEncuestas() {
  try {
    console.log('🚀 Iniciando inserción de encuestas...\n');
    
    let totalPolls = 0;
    let totalVotes = 0;
    
    for (const encuesta of encuestas) {
      const createdAt = new Date(Date.now() - encuesta.daysAgo * 24 * 60 * 60 * 1000);
      
      console.log(`📊 Creando: ${encuesta.title}`);
      
      // Crear la encuesta
      const poll = await prisma.poll.create({
        data: {
          userId: 1,
          title: encuesta.title,
          description: encuesta.description,
          category: encuesta.category,
          type: 'poll',
          status: 'active',
          createdAt: createdAt,
          updatedAt: createdAt
        }
      });
      
      totalPolls++;
      
      // Crear opciones y votos
      for (let i = 0; i < encuesta.options.length; i++) {
        const opt = encuesta.options[i];
        
        const option = await prisma.pollOption.create({
          data: {
            pollId: poll.id,
            optionKey: opt.key,
            optionLabel: opt.label,
            color: opt.color,
            displayOrder: i + 1
          }
        });
        
        // Crear votos
        const votes = [];
        for (let v = 0; v < opt.votes; v++) {
          // Distribuir votos en los últimos días
          const voteDate = new Date(
            createdAt.getTime() + Math.random() * (Date.now() - createdAt.getTime())
          );
          
          votes.push({
            pollId: poll.id,
            optionId: option.id,
            latitude: 40.4168 + (Math.random() - 0.5) / 10,
            longitude: -3.7038 + (Math.random() - 0.5) / 10,
            subdivisionId: 65101,
            createdAt: voteDate
          });
        }
        
        // Insertar votos en batch
        if (votes.length > 0) {
          await prisma.vote.createMany({
            data: votes
          });
          totalVotes += votes.length;
        }
      }
      
      console.log(`   ✅ ${encuesta.options.length} opciones con ${encuesta.options.reduce((sum, opt) => sum + opt.votes, 0)} votos`);
    }
    
    console.log(`\n🎉 ¡Completado!`);
    console.log(`   Total de encuestas: ${totalPolls}`);
    console.log(`   Total de votos: ${totalVotes}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

insertarEncuestas();
