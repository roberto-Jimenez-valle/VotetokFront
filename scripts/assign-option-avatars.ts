import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function assignAvatars() {
  
  // Obtener todas las opciones
  const options = await prisma.pollOption.findMany({
    orderBy: { id: 'asc' }
  });

  
  // Asignar avatares de pravatar.cc
  let updated = 0;
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    // Usar diferentes IDs de pravatar para variedad
    const avatarId = (i % 70) + 1; // pravatar tiene muchos avatares
    const avatarUrl = `https://i.pravatar.cc/150?img=${avatarId}`;

    await prisma.pollOption.update({
      where: { id: option.id },
      data: { avatarUrl }
    });

    updated++;
    if (updated % 10 === 0) {
          }
  }

  
  // Verificar
  const withAvatar = await prisma.pollOption.count({
    where: {
      avatarUrl: {
        not: null,
        not: ''
      }
    }
  });

  
  await prisma.$disconnect();
}

assignAvatars();
