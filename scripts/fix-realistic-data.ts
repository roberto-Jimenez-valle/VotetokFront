import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixRealisticData() {
  
  try {
    // 1. Crear más usuarios realistas
        
    const additionalUsers = [
      { username: 'tech_guru', displayName: 'Alex Tech', email: 'alex@votetok.com', bio: 'Apasionado de la tecnología y la innovación', verified: true },
      { username: 'eco_warrior', displayName: 'Elena Verde', email: 'elena@votetok.com', bio: 'Activista ambiental', verified: false },
      { username: 'music_lover', displayName: 'David Música', email: 'david@votetok.com', bio: 'Melómano empedernido', verified: false },
      { username: 'sports_fan', displayName: 'Roberto Deporte', email: 'roberto@votetok.com', bio: 'Fanático del deporte', verified: false },
      { username: 'foodie_life', displayName: 'Ana Cocina', email: 'ana@votetok.com', bio: 'Chef y amante de la comida', verified: true },
      { username: 'movie_buff', displayName: 'Pedro Cine', email: 'pedro@votetok.com', bio: 'Cinéfilo profesional', verified: false },
      { username: 'gamer_pro', displayName: 'Luis Gaming', email: 'luis@votetok.com', bio: 'Gamer profesional', verified: true },
      { username: 'book_worm', displayName: 'Carmen Libros', email: 'carmen@votetok.com', bio: 'Lectora empedernida', verified: false },
    ];

    for (const userData of additionalUsers) {
      await prisma.user.upsert({
        where: { email: userData.email },
        update: {},
        create: userData,
      });
    }

    
    // 2. Obtener todos los usuarios
    const allUsers = await prisma.user.findMany();
    
    // 3. Actualizar encuestas con opciones lógicas y creadores
    
    const polls = await prisma.poll.findMany({
      include: { options: true },
    });

    for (const poll of polls) {
      
      // Eliminar opciones antiguas
      await prisma.pollOption.deleteMany({
        where: { pollId: poll.id },
      });

      // Eliminar votos antiguos
      await prisma.vote.deleteMany({
        where: { pollId: poll.id },
      });

      // Crear opciones lógicas según la encuesta
      let newOptions: Array<{ key: string; label: string; color: string }> = [];

      if (poll.title.includes('red social')) {
        newOptions = [
          { key: 'tiktok', label: 'TikTok', color: '#000000', creatorId: allUsers[6]?.id },
          { key: 'instagram', label: 'Instagram', color: '#E4405F', creatorId: allUsers[5]?.id },
          { key: 'twitter', label: 'X (Twitter)', color: '#1DA1F2', creatorId: allUsers[0]?.id },
          { key: 'youtube', label: 'YouTube', color: '#FF0000', creatorId: allUsers[7]?.id },
        ];
      } else if (poll.title.includes('trabajo') && poll.title.includes('casa')) {
        newOptions = [
          { key: 'remoto', label: '100% remoto', color: '#10b981', creatorId: allUsers[0]?.id },
          { key: 'hibrido', label: 'Modelo híbrido', color: '#3b82f6', creatorId: allUsers[1]?.id },
          { key: 'oficina', label: 'Presencial', color: '#ef4444', creatorId: allUsers[2]?.id },
        ];
      } else if (poll.title.includes('música')) {
        newOptions = [
          { key: 'reggaeton', label: 'Reggaetón', color: '#ef4444', creatorId: allUsers[2]?.id },
          { key: 'pop', label: 'Pop', color: '#ec4899', creatorId: allUsers[2]?.id },
          { key: 'rock', label: 'Rock', color: '#6366f1', creatorId: allUsers[3]?.id },
          { key: 'electronica', label: 'Electrónica', color: '#8b5cf6', creatorId: allUsers[6]?.id },
          { key: 'clasica', label: 'Clásica', color: '#f59e0b', creatorId: allUsers[7]?.id },
        ];
      } else if (poll.title.includes('duermes')) {
        newOptions = [
          { key: 'menos5', label: 'Menos de 5 horas', color: '#ef4444', creatorId: allUsers[6]?.id },
          { key: '5a6', label: '5-6 horas', color: '#f59e0b', creatorId: allUsers[1]?.id },
          { key: '7a8', label: '7-8 horas', color: '#10b981', creatorId: allUsers[4]?.id },
          { key: 'mas8', label: 'Más de 8 horas', color: '#3b82f6', creatorId: allUsers[5]?.id },
        ];
      } else if (poll.title.includes('Piña')) {
        newOptions = [
          { key: 'si', label: 'Sí, me encanta', color: '#10b981', creatorId: allUsers[4]?.id },
          { key: 'no', label: 'No, es un crimen', color: '#ef4444', creatorId: allUsers[4]?.id },
          { key: 'depende', label: 'Depende del día', color: '#f59e0b', creatorId: allUsers[2]?.id },
        ];
      } else if (poll.title.includes('serie')) {
        newOptions = [
          { key: 'succession', label: 'Succession', color: '#6366f1', creatorId: allUsers[5]?.id },
          { key: 'thelastofus', label: 'The Last of Us', color: '#10b981', creatorId: allUsers[6]?.id },
          { key: 'wednesday', label: 'Wednesday', color: '#8b5cf6', creatorId: allUsers[5]?.id },
          { key: 'stranger', label: 'Stranger Things', color: '#ef4444', creatorId: allUsers[5]?.id },
          { key: 'otra', label: 'Otra', color: '#f59e0b', creatorId: allUsers[7]?.id },
        ];
      } else if (poll.title.includes('semana laboral')) {
        newOptions = [
          { key: 'si', label: 'Sí, totalmente', color: '#10b981', creatorId: allUsers[0]?.id },
          { key: 'no', label: 'No, prefiero 5 días', color: '#ef4444', creatorId: allUsers[1]?.id },
          { key: 'prueba', label: 'Habría que probarlo', color: '#f59e0b', creatorId: allUsers[2]?.id },
        ];
      } else if (poll.title.includes('desayunar')) {
        newOptions = [
          { key: 'dulce', label: 'Dulce (tostadas, cereales)', color: '#ec4899', creatorId: allUsers[4]?.id },
          { key: 'salado', label: 'Salado (huevos, bacon)', color: '#f59e0b', creatorId: allUsers[4]?.id },
          { key: 'cafe', label: 'Solo café', color: '#6366f1', creatorId: allUsers[0]?.id },
          { key: 'nada', label: 'No desayuno', color: '#ef4444', creatorId: allUsers[1]?.id },
        ];
      } else if (poll.title.includes('IA reemplazará')) {
        newOptions = [
          { key: 'si', label: 'Sí, en menos de 5 años', color: '#ef4444', creatorId: allUsers[0]?.id },
          { key: 'parcial', label: 'Parcialmente', color: '#f59e0b', creatorId: allUsers[0]?.id },
          { key: 'no', label: 'No, mi trabajo es seguro', color: '#10b981', creatorId: allUsers[1]?.id },
          { key: 'nosé', label: 'No estoy seguro/a', color: '#6366f1', creatorId: allUsers[2]?.id },
        ];
      } else if (poll.title.includes('deporte')) {
        newOptions = [
          { key: 'futbol', label: 'Fútbol', color: '#10b981', creatorId: allUsers[3]?.id },
          { key: 'baloncesto', label: 'Baloncesto', color: '#f59e0b', creatorId: allUsers[3]?.id },
          { key: 'tenis', label: 'Tenis', color: '#3b82f6', creatorId: allUsers[3]?.id },
          { key: 'otro', label: 'Otro', color: '#8b5cf6', creatorId: allUsers[6]?.id },
        ];
      } else if (poll.title.includes('ChatGPT')) {
        newOptions = [
          { key: 'diario', label: 'Todos los días', color: '#10b981', creatorId: allUsers[0]?.id },
          { key: 'aveces', label: 'A veces', color: '#3b82f6', creatorId: allUsers[1]?.id },
          { key: 'rara', label: 'Rara vez', color: '#f59e0b', creatorId: allUsers[2]?.id },
          { key: 'nunca', label: 'Nunca', color: '#ef4444', creatorId: allUsers[3]?.id },
        ];
      } else if (poll.title.includes('perros o gatos')) {
        newOptions = [
          { key: 'perros', label: '🐕 Perros', color: '#f59e0b', creatorId: allUsers[4]?.id },
          { key: 'gatos', label: '🐈 Gatos', color: '#8b5cf6', creatorId: allUsers[4]?.id },
          { key: 'ambos', label: 'Ambos', color: '#10b981', creatorId: allUsers[5]?.id },
          { key: 'ninguno', label: 'Ninguno', color: '#6366f1', creatorId: allUsers[2]?.id },
        ];
      } else if (poll.title.includes('redes sociales al día')) {
        newOptions = [
          { key: 'menos1', label: 'Menos de 1 hora', color: '#10b981', creatorId: allUsers[7]?.id },
          { key: '1a2', label: '1-2 horas', color: '#3b82f6', creatorId: allUsers[1]?.id },
          { key: '3a4', label: '3-4 horas', color: '#f59e0b', creatorId: allUsers[6]?.id },
          { key: 'mas4', label: 'Más de 4 horas', color: '#ef4444', creatorId: allUsers[6]?.id },
        ];
      } else if (poll.title.includes('cambio climático')) {
        newOptions = [
          { key: 'urgente', label: 'Es urgente actuar ya', color: '#10b981', creatorId: allUsers[1]?.id },
          { key: 'importante', label: 'Es importante pero no urgente', color: '#f59e0b', creatorId: allUsers[2]?.id },
          { key: 'exagerado', label: 'Está exagerado', color: '#ef4444', creatorId: allUsers[3]?.id },
          { key: 'nosé', label: 'No tengo opinión', color: '#6366f1', creatorId: allUsers[4]?.id },
        ];
      } else if (poll.title.includes('streaming')) {
        newOptions = [
          { key: 'netflix', label: 'Netflix', color: '#ef4444', creatorId: allUsers[5]?.id },
          { key: 'disney', label: 'Disney+', color: '#3b82f6', creatorId: allUsers[5]?.id },
          { key: 'prime', label: 'Prime Video', color: '#00a8e1', creatorId: allUsers[5]?.id },
          { key: 'hbo', label: 'HBO Max', color: '#8b5cf6', creatorId: allUsers[5]?.id },
          { key: 'otra', label: 'Otra', color: '#f59e0b', creatorId: allUsers[6]?.id },
        ];
      } else {
        // Opciones genéricas para encuestas no identificadas
        newOptions = [
          { key: 'opcion1', label: 'Opción 1', color: '#3b82f6', creatorId: allUsers[0]?.id },
          { key: 'opcion2', label: 'Opción 2', color: '#10b981', creatorId: allUsers[1]?.id },
          { key: 'opcion3', label: 'Opción 3', color: '#f59e0b', creatorId: allUsers[2]?.id },
        ];
      }

      // Crear las opciones
      const createdOptions = [];
      for (let i = 0; i < newOptions.length; i++) {
        const opt = newOptions[i];
        const option = await prisma.pollOption.create({
          data: {
            pollId: poll.id,
            optionKey: opt.key,
            optionLabel: opt.label,
            color: opt.color,
            voteCount: 0,
            displayOrder: i,
            userId: opt.creatorId,
          },
        });
        createdOptions.push(option);
      }

      // Crear votos realistas (solo algunos usuarios votarán)
      // Solo algunas encuestas tendrán votos visibles
      const shouldHaveVisibleVotes = Math.random() > 0.4; // 60% de probabilidad

      if (shouldHaveVisibleVotes) {
        // Seleccionar aleatoriamente 1-3 usuarios que votaron
        const numVoters = Math.floor(Math.random() * 3) + 1;
        const voters = allUsers.slice(1, numVoters + 1); // Usar usuarios del 2 al 4

        for (const voter of voters) {
          // Votar por una opción aleatoria
          const randomOption = createdOptions[Math.floor(Math.random() * createdOptions.length)];
          
          try {
            await prisma.vote.create({
              data: {
                userId: voter.id,
                pollId: poll.id,
                optionId: randomOption.id,
                countryIso3: 'ESP',
                countryName: 'España',
                latitude: 40.4168 + (Math.random() - 0.5) * 0.1,
                longitude: -3.7038 + (Math.random() - 0.5) * 0.1,
              },
            });

            // Incrementar voteCount
            await prisma.pollOption.update({
              where: { id: randomOption.id },
              data: { voteCount: { increment: 1 } },
            });
          } catch (e) {
            // Ignorar si el usuario ya votó
          }
        }

              } else {
              }

      // Agregar votos generales para dar volumen
      const totalVotes = Math.floor(Math.random() * 3000) + 1000;
      for (let i = 0; i < totalVotes; i++) {
        const randomOption = createdOptions[Math.floor(Math.random() * createdOptions.length)];
        await prisma.pollOption.update({
          where: { id: randomOption.id },
          data: { voteCount: { increment: 1 } },
        });
      }

      // Actualizar totalVotes del poll
      const updatedOptions = await prisma.pollOption.findMany({
        where: { pollId: poll.id },
      });
      const newTotalVotes = updatedOptions.reduce((sum, opt) => sum + opt.voteCount, 0);
      
      await prisma.poll.update({
        where: { id: poll.id },
        data: { totalVotes: newTotalVotes },
      });

          }

                
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixRealisticData();
