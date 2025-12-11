import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creando datos de prueba...');

  // Crear usuario
  const user = await prisma.user.upsert({
    where: { email: 'test@votetok.com' },
    update: {},
    create: {
      email: 'test@votetok.com',
      username: 'testuser',
      displayName: 'Test User',
    }
  });
  console.log('✅ Usuario:', user.id);

  // Encuesta 1
  await prisma.poll.create({
    data: {
      userId: user.id,
      title: '¿Cuál es tu red social favorita?',
      category: 'Tecnología',
      type: 'poll',
      status: 'active',
      options: {
        create: [
          { optionKey: 'tiktok', optionLabel: 'TikTok', color: '#ff0050', displayOrder: 0 },
          { optionKey: 'instagram', optionLabel: 'Instagram', color: '#e4405f', displayOrder: 1 },
          { optionKey: 'youtube', optionLabel: 'YouTube', color: '#ff0000', displayOrder: 2 },
          { optionKey: 'twitter', optionLabel: 'X (Twitter)', color: '#1da1f2', displayOrder: 3 },
        ]
      }
    }
  });
  console.log('✅ Encuesta 1 creada');

  // Encuesta 2
  await prisma.poll.create({
    data: {
      userId: user.id,
      title: '¿Pizza o Hamburguesa?',
      category: 'Entretenimiento',
      type: 'poll',
      status: 'active',
      options: {
        create: [
          { optionKey: 'pizza', optionLabel: '🍕 Pizza', color: '#f97316', displayOrder: 0 },
          { optionKey: 'hamburguesa', optionLabel: '🍔 Hamburguesa', color: '#84cc16', displayOrder: 1 },
        ]
      }
    }
  });
  console.log('✅ Encuesta 2 creada');

  // Encuesta 3
  await prisma.poll.create({
    data: {
      userId: user.id,
      title: '¿Cuál es el mejor lenguaje de programación?',
      category: 'Tecnología',
      type: 'poll',
      status: 'active',
      options: {
        create: [
          { optionKey: 'javascript', optionLabel: 'JavaScript', color: '#f7df1e', displayOrder: 0 },
          { optionKey: 'python', optionLabel: 'Python', color: '#3776ab', displayOrder: 1 },
          { optionKey: 'rust', optionLabel: 'Rust', color: '#000000', displayOrder: 2 },
          { optionKey: 'go', optionLabel: 'Go', color: '#00add8', displayOrder: 3 },
        ]
      }
    }
  });
  console.log('✅ Encuesta 3 creada');

  // Encuesta 4
  await prisma.poll.create({
    data: {
      userId: user.id,
      title: '¿Café o Té?',
      category: 'Entretenimiento',
      type: 'poll',
      status: 'active',
      options: {
        create: [
          { optionKey: 'cafe', optionLabel: '☕ Café', color: '#6f4e37', displayOrder: 0 },
          { optionKey: 'te', optionLabel: '🍵 Té', color: '#90ee90', displayOrder: 1 },
        ]
      }
    }
  });
  console.log('✅ Encuesta 4 creada');

  // Encuesta 5
  await prisma.poll.create({
    data: {
      userId: user.id,
      title: '¿Perro o Gato?',
      category: 'Entretenimiento',
      type: 'poll',
      status: 'active',
      options: {
        create: [
          { optionKey: 'perro', optionLabel: '🐕 Perro', color: '#8b4513', displayOrder: 0 },
          { optionKey: 'gato', optionLabel: '🐱 Gato', color: '#ffa500', displayOrder: 1 },
        ]
      }
    }
  });
  console.log('✅ Encuesta 5 creada');

  console.log('\n🎉 ¡Datos de prueba creados exitosamente!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
