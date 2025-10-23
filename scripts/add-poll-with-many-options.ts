import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📊 Creando encuesta con 8 opciones para probar paginación...\n');

  // Usar el primer usuario
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('❌ No hay usuarios en la base de datos');
    return;
  }

  // Crear encuesta
  const poll = await prisma.poll.create({
    data: {
      userId: user.id,
      title: '¿Cuál es tu película favorita de superhéroes?',
      description: 'Vota por tu película favorita (encuesta con 8 opciones para probar paginación)',
      category: 'Entretenimiento',
      type: 'poll',
      status: 'active',
      options: {
        create: [
          { optionKey: 'A', optionLabel: 'Avengers: Endgame', color: '#ff6b6b', displayOrder: 0 },
          { optionKey: 'B', optionLabel: 'The Dark Knight', color: '#4ecdc4', displayOrder: 1 },
          { optionKey: 'C', optionLabel: 'Spider-Man: No Way Home', color: '#45b7d1', displayOrder: 2 },
          { optionKey: 'D', optionLabel: 'Black Panther', color: '#96ceb4', displayOrder: 3 },
          { optionKey: 'E', optionLabel: 'Iron Man', color: '#feca57', displayOrder: 4 },
          { optionKey: 'F', optionLabel: 'Wonder Woman', color: '#ff6348', displayOrder: 5 },
          { optionKey: 'G', optionLabel: 'Guardians of the Galaxy', color: '#a29bfe', displayOrder: 6 },
          { optionKey: 'H', optionLabel: 'Logan', color: '#fd79a8', displayOrder: 7 },
        ]
      }
    },
    include: {
      options: true
    }
  });

  console.log('✅ Encuesta creada exitosamente:');
  console.log(`   ID: ${poll.id}`);
  console.log(`   Título: ${poll.title}`);
  console.log(`   Usuario: ${user.displayName} (@${user.username})`);
  console.log(`   Opciones: ${poll.options.length}`);
  console.log(`   Páginas: ${Math.ceil(poll.options.length / 4)}\n`);

  console.log('📄 Esta encuesta tendrá 2 páginas:');
  console.log('   Página 1: Opciones A, B, C, D');
  console.log('   Página 2: Opciones E, F, G, H\n');

  console.log('🎯 Ahora puedes:');
  console.log('   1. Abrir el perfil de', user.displayName);
  console.log('   2. Ver esta encuesta en el tab "Encuestas"');
  console.log('   3. Arrastrar horizontal para cambiar de página');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
