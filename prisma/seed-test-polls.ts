import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  
  // Obtener un usuario existente
  const existingUser = await prisma.user.findFirst();
  if (!existingUser) {
            return;
  }

  
  // Encuesta con 8 opciones
  const testPoll8 = await prisma.poll.create({
    data: {
      title: '🧪 TEST: ¿Cuál es tu lenguaje de programación favorito?',
      type: 'poll',
      userId: existingUser.id,
      category: 'Tecnología',
      options: {
        create: [
          { optionKey: 'js', optionLabel: 'JavaScript', color: '#F7DF1E', voteCount: 450, avatarUrl: 'https://images.unsplash.com/photo-1599507593499-a3f7d7d97667?w=150&h=150&fit=crop' },
          { optionKey: 'py', optionLabel: 'Python', color: '#3776AB', voteCount: 380, avatarUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=150&h=150&fit=crop' },
          { optionKey: 'ts', optionLabel: 'TypeScript', color: '#3178C6', voteCount: 320, avatarUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=150&h=150&fit=crop' },
          { optionKey: 'java', optionLabel: 'Java', color: '#007396', voteCount: 290, avatarUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=150&h=150&fit=crop' },
          { optionKey: 'go', optionLabel: 'Go', color: '#00ADD8', voteCount: 250, avatarUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=150&h=150&fit=crop' },
          { optionKey: 'rust', optionLabel: 'Rust', color: '#CE422B', voteCount: 210, avatarUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=150&h=150&fit=crop' },
          { optionKey: 'cpp', optionLabel: 'C++', color: '#00599C', voteCount: 180, avatarUrl: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=150&h=150&fit=crop' },
          { optionKey: 'ruby', optionLabel: 'Ruby', color: '#CC342D', voteCount: 150, avatarUrl: 'https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=150&h=150&fit=crop' },
        ],
      },
    },
    include: { options: true },
  });

  
  // Encuesta con 12 opciones
  const testPoll12 = await prisma.poll.create({
    data: {
      title: '🧪 TEST: ¿Cuál es tu framework web favorito?',
      type: 'poll',
      userId: existingUser.id,
      category: 'Tecnología',
      options: {
        create: [
          { optionKey: 'react', optionLabel: 'React', color: '#61DAFB', voteCount: 520, avatarUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=150&h=150&fit=crop' },
          { optionKey: 'vue', optionLabel: 'Vue.js', color: '#4FC08D', voteCount: 480, avatarUrl: 'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=150&h=150&fit=crop' },
          { optionKey: 'angular', optionLabel: 'Angular', color: '#DD0031', voteCount: 420, avatarUrl: 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=150&h=150&fit=crop' },
          { optionKey: 'svelte', optionLabel: 'Svelte', color: '#FF3E00', voteCount: 380, avatarUrl: 'https://images.unsplash.com/photo-1619410283995-43d9134e7656?w=150&h=150&fit=crop' },
          { optionKey: 'next', optionLabel: 'Next.js', color: '#000000', voteCount: 350, avatarUrl: 'https://images.unsplash.com/photo-1618477247222-acbdb0e159b3?w=150&h=150&fit=crop' },
          { optionKey: 'nuxt', optionLabel: 'Nuxt.js', color: '#00DC82', voteCount: 310, avatarUrl: 'https://images.unsplash.com/photo-1618477460930-c0568c5e3c85?w=150&h=150&fit=crop' },
          { optionKey: 'remix', optionLabel: 'Remix', color: '#3992FF', voteCount: 270, avatarUrl: 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=150&h=150&fit=crop' },
          { optionKey: 'astro', optionLabel: 'Astro', color: '#FF5D01', voteCount: 240, avatarUrl: 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?w=150&h=150&fit=crop' },
          { optionKey: 'solid', optionLabel: 'Solid.js', color: '#2C4F7C', voteCount: 210, avatarUrl: 'https://images.unsplash.com/photo-1605379399642-870262d3d051?w=150&h=150&fit=crop' },
          { optionKey: 'qwik', optionLabel: 'Qwik', color: '#AC7EF4', voteCount: 180, avatarUrl: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=150&h=150&fit=crop' },
          { optionKey: 'lit', optionLabel: 'Lit', color: '#324FFF', voteCount: 150, avatarUrl: 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?w=150&h=150&fit=crop' },
          { optionKey: 'alpine', optionLabel: 'Alpine.js', color: '#8BC0D0', voteCount: 120, avatarUrl: 'https://images.unsplash.com/photo-1605379399642-870262d3d051?w=150&h=150&fit=crop' },
        ],
      },
    },
    include: { options: true },
  });

  
  // Encuesta con 6 opciones
  const testPoll6 = await prisma.poll.create({
    data: {
      title: '🧪 TEST: ¿Cuál es tu red social favorita? (6 opciones)',
      type: 'poll',
      userId: existingUser.id,
      category: 'Tecnología',
      options: {
        create: [
          { optionKey: 'instagram', optionLabel: 'Instagram', color: '#E4405F', voteCount: 520, avatarUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=150&h=150&fit=crop' },
          { optionKey: 'twitter', optionLabel: 'Twitter/X', color: '#1DA1F2', voteCount: 480, avatarUrl: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=150&h=150&fit=crop' },
          { optionKey: 'tiktok', optionLabel: 'TikTok', color: '#000000', voteCount: 450, avatarUrl: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=150&h=150&fit=crop' },
          { optionKey: 'facebook', optionLabel: 'Facebook', color: '#1877F2', voteCount: 380, avatarUrl: 'https://images.unsplash.com/photo-1611944212129-29977ae1398c?w=150&h=150&fit=crop' },
          { optionKey: 'linkedin', optionLabel: 'LinkedIn', color: '#0A66C2', voteCount: 320, avatarUrl: 'https://images.unsplash.com/photo-1611944212129-29977ae1398c?w=150&h=150&fit=crop' },
          { optionKey: 'youtube', optionLabel: 'YouTube', color: '#FF0000', voteCount: 290, avatarUrl: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=150&h=150&fit=crop' },
        ],
      },
    },
    include: { options: true },
  });

  
  // Encuesta con 7 opciones
  const testPoll7 = await prisma.poll.create({
    data: {
      title: '🧪 TEST: ¿Cuál es tu sistema operativo favorito? (7 opciones)',
      type: 'poll',
      userId: existingUser.id,
      category: 'Tecnología',
      options: {
        create: [
          { optionKey: 'windows', optionLabel: 'Windows', color: '#0078D4', voteCount: 550, avatarUrl: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=150&h=150&fit=crop' },
          { optionKey: 'macos', optionLabel: 'macOS', color: '#000000', voteCount: 480, avatarUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=150&h=150&fit=crop' },
          { optionKey: 'linux', optionLabel: 'Linux', color: '#FCC624', voteCount: 420, avatarUrl: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=150&h=150&fit=crop' },
          { optionKey: 'android', optionLabel: 'Android', color: '#3DDC84', voteCount: 380, avatarUrl: 'https://images.unsplash.com/photo-1607252650355-f7fd0460ccdb?w=150&h=150&fit=crop' },
          { optionKey: 'ios', optionLabel: 'iOS', color: '#000000', voteCount: 350, avatarUrl: 'https://images.unsplash.com/photo-1621768216002-5ac171876625?w=150&h=150&fit=crop' },
          { optionKey: 'chromeos', optionLabel: 'ChromeOS', color: '#4285F4', voteCount: 280, avatarUrl: 'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=150&h=150&fit=crop' },
          { optionKey: 'other', optionLabel: 'Otro', color: '#9E9E9E', voteCount: 210, avatarUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=150&h=150&fit=crop' },
        ],
      },
    },
    include: { options: true },
  });

  
  // Encuesta con 1 sola opción
  const testPoll1 = await prisma.poll.create({
    data: {
      title: '🧪 TEST: ¿Te gusta la pizza? (1 opción)',
      type: 'poll',
      userId: existingUser.id,
      category: 'Comida',
      options: {
        create: [
          { optionKey: 'yes', optionLabel: 'Sí, me encanta la pizza 🍕', color: '#FF6B6B', voteCount: 9999, avatarUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=150&h=150&fit=crop' },
        ],
      },
    },
    include: { options: true },
  });

  
              }

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
