import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Agregando encuestas de prueba con rells...');

  // Obtener usuarios existentes
  const users = await prisma.user.findMany({
    take: 5
  });

  if (users.length === 0) {
    console.log('❌ No hay usuarios en la base de datos');
    return;
  }

  // Obtener algunas encuestas originales existentes
  const originalPolls = await prisma.poll.findMany({
    where: {
      isRell: false
    },
    take: 10
  });

  if (originalPolls.length === 0) {
    console.log('❌ No hay encuestas originales en la base de datos');
    return;
  }

  // Crear rells (republicaciones) de diferentes usuarios
  const rellsToCreate = [
    {
      userId: users[0].id,
      originalPollId: originalPolls[0].id,
      title: originalPolls[0].title,
      description: `Republicado por ${users[0].displayName || users[0].username}`,
      category: originalPolls[0].category
    },
    {
      userId: users[1 % users.length].id,
      originalPollId: originalPolls[1 % originalPolls.length].id,
      title: originalPolls[1 % originalPolls.length].title,
      description: `Republicado por ${users[1 % users.length].displayName || users[1 % users.length].username}`,
      category: originalPolls[1 % originalPolls.length].category
    },
    {
      userId: users[2 % users.length].id,
      originalPollId: originalPolls[2 % originalPolls.length].id,
      title: originalPolls[2 % originalPolls.length].title,
      description: `Republicado por ${users[2 % users.length].displayName || users[2 % users.length].username}`,
      category: originalPolls[2 % originalPolls.length].category
    },
    {
      userId: users[0].id,
      originalPollId: originalPolls[3 % originalPolls.length].id,
      title: originalPolls[3 % originalPolls.length].title,
      description: `Republicado por ${users[0].displayName || users[0].username}`,
      category: originalPolls[3 % originalPolls.length].category
    },
  ];

  for (const rellData of rellsToCreate) {
    // Verificar si ya existe un rell de este usuario para este poll
    const existingRell = await prisma.poll.findFirst({
      where: {
        userId: rellData.userId,
        originalPollId: rellData.originalPollId,
        isRell: true
      }
    });

    if (existingRell) {
      console.log(`⏭️  Rell ya existe: Usuario ${rellData.userId} -> Poll ${rellData.originalPollId}`);
      continue;
    }

    // Crear el rell (sin copiar opciones, referencia al original)
    const rell = await prisma.poll.create({
      data: {
        userId: rellData.userId,
        title: rellData.title,
        description: rellData.description,
        category: rellData.category,
        isRell: true,
        originalPollId: rellData.originalPollId,
        type: 'poll',
        status: 'active'
      }
    });

    console.log(`✅ Rell creado: ID ${rell.id} (Usuario ${rellData.userId} -> Poll original ${rellData.originalPollId})`);
  }

  // Crear algunas interacciones "save" (guardadas) para otros usuarios
  const savesToCreate = [
    {
      userId: users[3 % users.length].id,
      pollId: originalPolls[4 % originalPolls.length].id
    },
    {
      userId: users[4 % users.length].id,
      pollId: originalPolls[5 % originalPolls.length].id
    },
    {
      userId: users[3 % users.length].id,
      pollId: originalPolls[6 % originalPolls.length].id
    },
  ];

  for (const saveData of savesToCreate) {
    // Verificar si ya existe
    const existing = await prisma.pollInteraction.findFirst({
      where: {
        userId: saveData.userId,
        pollId: saveData.pollId,
        interactionType: 'save'
      }
    });

    if (existing) {
      console.log(`⏭️  Save ya existe: Usuario ${saveData.userId} -> Poll ${saveData.pollId}`);
      continue;
    }

    await prisma.pollInteraction.create({
      data: {
        userId: saveData.userId,
        pollId: saveData.pollId,
        interactionType: 'save'
      }
    });

    console.log(`💾 Save creado: Usuario ${saveData.userId} -> Poll ${saveData.pollId}`);
  }

  console.log('✅ Proceso completado');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
