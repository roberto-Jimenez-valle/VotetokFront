import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Insertando usuarios de prueba...');

  const testUsers = [
    {
      id: 1,
      username: 'maria_gonzalez',
      displayName: 'María González',
      email: 'maria@voutop.com',
      avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
      verified: true,
      bio: 'Activista social y política',
      countryIso3: 'ESP',
      role: 'user'
    },
    {
      id: 2,
      username: 'carlos_lopez',
      displayName: 'Carlos López',
      email: 'carlos@voutop.com',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
      verified: true,
      bio: 'Analista político',
      countryIso3: 'ESP',
      role: 'user'
    },
    {
      id: 3,
      username: 'laura_sanchez',
      displayName: 'Laura Sánchez',
      email: 'laura@voutop.com',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop',
      verified: false,
      bio: 'Periodista independiente',
      countryIso3: 'MEX',
      role: 'user'
    },
    {
      id: 4,
      username: 'juan_martin',
      displayName: 'Juan Martín',
      email: 'juan@voutop.com',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
      verified: true,
      bio: 'Economista',
      countryIso3: 'ARG',
      role: 'user'
    },
    {
      id: 5,
      username: 'sofia_herrera',
      displayName: 'Sofía Herrera',
      email: 'sofia@voutop.com',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop',
      verified: false,
      bio: 'Estudiante de ciencias políticas',
      countryIso3: 'COL',
      role: 'user'
    }
  ];

  for (const user of testUsers) {
    try {
      // Usar upsert para crear o actualizar
      const result = await prisma.user.upsert({
        where: { id: user.id },
        update: user,
        create: user
      });
      console.log(`✅ Usuario ${user.username} (ID: ${user.id}) - ${result.id === user.id ? 'actualizado' : 'creado'}`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Conflicto de unique constraint (username o email)
        console.log(`⚠️  Usuario ${user.username} ya existe con username/email diferente`);
      } else {
        console.error(`❌ Error con usuario ${user.username}:`, error.message);
      }
    }
  }

  console.log('\n✅ Proceso completado');
}

main()
  .catch((error) => {
    console.error('❌ Error general:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
