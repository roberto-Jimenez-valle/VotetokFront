import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createFunnyPolls() {
  
  try {
    // Obtener usuarios existentes
    const users = await prisma.user.findMany();
    
    if (users.length === 0) {
      console.error('❌ No hay usuarios en la BD');
      return;
    }

    const funnyPolls = [
      {
        title: '¿Cuál es tu superpoder inútil favorito?',
        options: [
          { label: 'Poder hablar con plantas (pero no te responden)', color: '#10b981' },
          { label: 'Volar, pero solo 2cm del suelo', color: '#3b82f6' },
          { label: 'Invisibilidad, pero solo cuando nadie te mira', color: '#f59e0b' },
          { label: 'Leer mentes, pero solo de peces', color: '#ec4899' },
        ],
      },
      {
        title: '¿Qué harías si te quedas atrapado en un ascensor?',
        options: [
          { label: 'Hacer ejercicio (aprovecho el tiempo)', color: '#10b981' },
          { label: 'Cantar ópera a todo pulmón', color: '#8b5cf6' },
          { label: 'Entrar en pánico y llamar a mi mamá', color: '#ef4444' },
          { label: 'Hacer un TikTok viral', color: '#ec4899' },
        ],
      },
      {
        title: '¿Cuál es tu excusa favorita para no ir al gimnasio?',
        options: [
          { label: 'Está lloviendo (aunque esté soleado)', color: '#3b82f6' },
          { label: 'Tengo que lavar a mi gato', color: '#ec4899' },
          { label: 'El gimnasio está muy lejos (a 5 min)', color: '#f59e0b' },
          { label: 'Ya hice ejercicio mental hoy', color: '#8b5cf6' },
          { label: 'Mañana empiezo en serio', color: '#ef4444' },
        ],
      },
      {
        title: '¿Qué emoji usas cuando no sabes qué responder?',
        options: [
          { label: '😅 (el salvavidas universal)', color: '#f59e0b' },
          { label: '👍 (el clásico)', color: '#3b82f6' },
          { label: '🤔 (ganando tiempo)', color: '#8b5cf6' },
          { label: '💀 (cuando todo falla)', color: '#6366f1' },
        ],
      },
      {
        title: '¿Cómo prefieres comer las Oreos?',
        options: [
          { label: 'Separar y lamer la crema primero', color: '#6366f1' },
          { label: 'Morderlas directamente como un salvaje', color: '#ef4444' },
          { label: 'Mojarlas en leche hasta que se deshagan', color: '#3b82f6' },
          { label: 'Solo la galleta, la crema es muy dulce', color: '#f59e0b' },
        ],
      },
      {
        title: '¿Cuál es tu mayor miedo irracional?',
        options: [
          { label: 'Que un tiburón esté en la piscina', color: '#3b82f6' },
          { label: 'Que alguien lea mis pensamientos', color: '#8b5cf6' },
          { label: 'Quedarme encerrado en el baño', color: '#ef4444' },
          { label: 'Que mi gato planee algo contra mí', color: '#ec4899' },
        ],
      },
      {
        title: '¿Qué haces cuando suena tu alarma por la mañana?',
        options: [
          { label: 'Posponer 5 veces mínimo', color: '#f59e0b' },
          { label: 'Levantarme de un salto como soldado', color: '#10b981' },
          { label: 'Llorar internamente', color: '#ef4444' },
          { label: 'Negociar con mi yo del futuro', color: '#8b5cf6' },
        ],
      },
      {
        title: '¿Cuál es tu talento oculto más raro?',
        options: [
          { label: 'Puedo mover las orejas', color: '#ec4899' },
          { label: 'Imito perfectamente el sonido de un microondas', color: '#f59e0b' },
          { label: 'Puedo dormir en cualquier lugar', color: '#3b82f6' },
          { label: 'Adivino el final de las películas siempre', color: '#8b5cf6' },
        ],
      },
      {
        title: '¿Qué tipo de persona eres en las reuniones de Zoom?',
        options: [
          { label: 'Cámara apagada, en pijama', color: '#3b82f6' },
          { label: 'Multitasking: cocino mientras escucho', color: '#f59e0b' },
          { label: 'El que siempre dice "¿me escuchan?"', color: '#ef4444' },
          { label: 'El que tiene el fondo más profesional', color: '#10b981' },
        ],
      },
      {
        title: '¿Cuál es tu estrategia en un apocalipsis zombie?',
        options: [
          { label: 'Esconderme en un supermercado', color: '#10b981' },
          { label: 'Hacerme amigo de los zombies', color: '#ec4899' },
          { label: 'Correr y no mirar atrás', color: '#ef4444' },
          { label: 'Convertirme en el líder de un grupo', color: '#8b5cf6' },
        ],
      },
      {
        title: '¿Qué haces cuando ves a alguien conocido en la calle?',
        options: [
          { label: 'Finjo que miro el móvil', color: '#3b82f6' },
          { label: 'Cambio de acera rápidamente', color: '#ef4444' },
          { label: 'Saludo efusivamente', color: '#10b981' },
          { label: 'Me escondo detrás de un árbol', color: '#f59e0b' },
        ],
      },
      {
        title: '¿Cuál es tu posición favorita para dormir?',
        options: [
          { label: 'Estrella de mar (ocupo toda la cama)', color: '#3b82f6' },
          { label: 'Feto (acurrucado como bebé)', color: '#ec4899' },
          { label: 'Boca abajo (estilo plancha)', color: '#f59e0b' },
          { label: 'Cambia cada 5 minutos', color: '#8b5cf6' },
        ],
      },
      {
        title: '¿Qué haces cuando te equivocas de persona en WhatsApp?',
        options: [
          { label: 'Eliminar el mensaje y rezar', color: '#ef4444' },
          { label: 'Fingir que era para esa persona', color: '#f59e0b' },
          { label: 'Bloquear y cambiar de número', color: '#ec4899' },
          { label: 'Admitir el error como adulto', color: '#10b981' },
        ],
      },
      {
        title: '¿Cuál es tu snack de medianoche favorito?',
        options: [
          { label: 'Cereal directo de la caja', color: '#f59e0b' },
          { label: 'Queso con lo que sea', color: '#ec4899' },
          { label: 'Sobras de la cena (frías)', color: '#3b82f6' },
          { label: 'Pan con mantequilla', color: '#8b5cf6' },
          { label: 'Todo lo que encuentre en la nevera', color: '#10b981' },
        ],
      },
      {
        title: '¿Qué tipo de pasajero eres en el coche?',
        options: [
          { label: 'DJ oficial (controlo la música)', color: '#ec4899' },
          { label: 'Copiloto crítico (frena imaginario)', color: '#ef4444' },
          { label: 'Dormido en 5 minutos', color: '#3b82f6' },
          { label: 'Navegador humano (aunque no sirva)', color: '#f59e0b' },
        ],
      },
      {
        title: '¿Cuál es tu mayor logro en la vida?',
        options: [
          { label: 'Terminar Netflix antes que mis amigos', color: '#ef4444' },
          { label: 'Sobrevivir al lunes', color: '#3b82f6' },
          { label: 'Hacer la cama 3 días seguidos', color: '#10b981' },
          { label: 'Responder un email el mismo día', color: '#8b5cf6' },
        ],
      },
      {
        title: '¿Qué haces cuando alguien canta "Feliz Cumpleaños"?',
        options: [
          { label: 'Sonrío incómodamente', color: '#f59e0b' },
          { label: 'Canto junto (a mi propio cumpleaños)', color: '#ec4899' },
          { label: 'No sé dónde mirar', color: '#3b82f6' },
          { label: 'Grabo todo para Instagram', color: '#8b5cf6' },
        ],
      },
      {
        title: '¿Cuál es tu relación con las plantas?',
        options: [
          { label: 'Asesino serial de plantas', color: '#ef4444' },
          { label: 'Tengo un jardín próspero', color: '#10b981' },
          { label: 'Solo cactus (imposible de matar)', color: '#f59e0b' },
          { label: 'Plantas de plástico master', color: '#3b82f6' },
        ],
      },
      {
        title: '¿Qué haces cuando te llaman por teléfono?',
        options: [
          { label: 'Ignoro y espero el mensaje', color: '#3b82f6' },
          { label: 'Entro en pánico', color: '#ef4444' },
          { label: 'Contesto solo si sé quién es', color: '#f59e0b' },
          { label: 'Contesto siempre (soy del siglo XX)', color: '#10b981' },
        ],
      },
      {
        title: '¿Cuál es tu técnica para estudiar/trabajar?',
        options: [
          { label: 'Procrastinar hasta el último minuto', color: '#ef4444' },
          { label: 'Pomodoro (25 min trabajo, 5 min TikTok)', color: '#ec4899' },
          { label: 'Café y música a todo volumen', color: '#8b5cf6' },
          { label: 'Planificación perfecta que nunca sigo', color: '#f59e0b' },
          { label: 'Estudiar? Eso es para los débiles', color: '#6366f1' },
        ],
      },
    ];

    let pollsCreated = 0;
    let optionsCreated = 0;

    for (const pollData of funnyPolls) {
      // Asignar usuario aleatorio como creador
      const randomUser = users[Math.floor(Math.random() * users.length)];
      
      // Crear encuesta
      const poll = await prisma.poll.create({
        data: {
          title: pollData.title,
          description: '',
          type: 'poll',
          status: 'active',
          userId: randomUser.id,
          totalVotes: Math.floor(Math.random() * 5000) + 1000,
          totalViews: Math.floor(Math.random() * 8000) + 2000,
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)), // Últimos 7 días
        },
      });

      pollsCreated++;

      // Crear opciones
      for (let i = 0; i < pollData.options.length; i++) {
        const option = pollData.options[i];
        const avatarId = (pollsCreated * 10 + i) % 70 + 1;
        
        await prisma.pollOption.create({
          data: {
            pollId: poll.id,
            optionKey: `option_${i + 1}`,
            optionLabel: option.label,
            color: option.color,
            avatarUrl: `https://i.pravatar.cc/150?img=${avatarId}`,
            voteCount: Math.floor(Math.random() * 2000) + 100,
            displayOrder: i,
          },
        });

        optionsCreated++;
      }

          }

        
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createFunnyPolls();
