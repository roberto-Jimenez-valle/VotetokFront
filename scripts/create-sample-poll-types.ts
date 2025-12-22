import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎯 Creating sample polls with different types...\n');

  // Get a user to create polls (use first admin or user)
  const user = await prisma.user.findFirst({
    where: { role: 'admin' }
  }) || await prisma.user.findFirst();

  if (!user) {
    console.error('❌ No user found in database');
    return;
  }

  console.log(`📝 Creating polls as user: ${user.displayName} (ID: ${user.id})\n`);

  // 1. STANDARD POLL (Votación)
  const standardPoll = await prisma.poll.create({
    data: {
      userId: user.id,
      title: '¿Qué hacemos este viernes noche? 🌙🍻',
      description: 'Vota tu plan favorito para el finde',
      type: 'standard',
      category: 'lifestyle',
      status: 'active',
      options: {
        create: [
          { optionKey: 'fiesta', optionLabel: 'Salir de Fiesta 🎉', color: '#9333ea', displayOrder: 0, imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80' },
          { optionKey: 'chill', optionLabel: 'Peli, Manta y Chill 🍿', color: '#3b82f6', displayOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=600&q=80' },
          { optionKey: 'cena', optionLabel: 'Cena con amigos 🍕', color: '#f97316', displayOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80' },
          { optionKey: 'gaming', optionLabel: 'Noche de videojuegos 🎮', color: '#22c55e', displayOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80' }
        ]
      }
    }
  });
  console.log(`✅ Created STANDARD poll: "${standardPoll.title}" (ID: ${standardPoll.id})`);

  // 2. QUIZ POLL (Trivial)
  const quizPoll = await prisma.poll.create({
    data: {
      userId: user.id,
      title: '¿Cuál es la capital de Australia? 🌏',
      description: 'Pon a prueba tus conocimientos de geografía',
      type: 'quiz',
      category: 'education',
      status: 'active',
      options: {
        create: [
          { optionKey: 'sydney', optionLabel: 'Sydney', color: '#ef4444', displayOrder: 0 },
          { optionKey: 'melbourne', optionLabel: 'Melbourne', color: '#f97316', displayOrder: 1 },
          { optionKey: 'canberra', optionLabel: 'Canberra', color: '#22c55e', displayOrder: 2 },
          { optionKey: 'perth', optionLabel: 'Perth', color: '#3b82f6', displayOrder: 3 }
        ]
      }
    }
  });
  
  // Update with correct option
  const correctOption = await prisma.pollOption.findFirst({
    where: { pollId: quizPoll.id, optionKey: 'canberra' }
  });
  if (correctOption) {
    await prisma.poll.update({
      where: { id: quizPoll.id },
      data: { correctOptionId: correctOption.id }
    });
  }
  console.log(`✅ Created QUIZ poll: "${quizPoll.title}" (ID: ${quizPoll.id}) - Correct: Canberra`);

  // 3. TIERLIST/RANKING POLL
  const tierlistPoll = await prisma.poll.create({
    data: {
      userId: user.id,
      title: 'Ranking definitivo de comida rápida 🍔🍕',
      description: 'Ordena de mejor a peor tu comida favorita',
      type: 'tierlist',
      category: 'food',
      status: 'active',
      options: {
        create: [
          { optionKey: 'burger', optionLabel: 'Hamburguesa Doble', color: '#f59e0b', displayOrder: 0, imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80' },
          { optionKey: 'pizza', optionLabel: 'Pizza Pepperoni', color: '#ef4444', displayOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&q=80' },
          { optionKey: 'sushi', optionLabel: 'Sushi Variado', color: '#10b981', displayOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&q=80' },
          { optionKey: 'tacos', optionLabel: 'Tacos Al Pastor', color: '#f97316', displayOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&q=80' },
          { optionKey: 'kebab', optionLabel: 'Kebab Mixto', color: '#dc2626', displayOrder: 4, imageUrl: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=600&q=80' },
          { optionKey: 'poke', optionLabel: 'Poke Bowl', color: '#84cc16', displayOrder: 5, imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80' }
        ]
      }
    }
  });
  console.log(`✅ Created TIERLIST poll: "${tierlistPoll.title}" (ID: ${tierlistPoll.id})`);

  // 4. SWIPE POLL (Flash/Hot or Not style)
  const swipePoll = await prisma.poll.create({
    data: {
      userId: user.id,
      title: 'Destinos Top 2025: ¿Te irías? ✈️',
      description: 'Desliza a la derecha si te irías, izquierda si no',
      type: 'swipe',
      category: 'travel',
      status: 'active',
      options: {
        create: [
          { optionKey: 'kyoto', optionLabel: 'Kyoto, Japón 🇯🇵', color: '#ec4899', displayOrder: 0, imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80' },
          { optionKey: 'santorini', optionLabel: 'Santorini, Grecia 🇬🇷', color: '#3b82f6', displayOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1613395877344-13d4c2ce52d8?w=600&q=80' },
          { optionKey: 'newyork', optionLabel: 'Nueva York, USA 🇺🇸', color: '#f59e0b', displayOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80' },
          { optionKey: 'bali', optionLabel: 'Bali, Indonesia 🇮🇩', color: '#22c55e', displayOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80' },
          { optionKey: 'paris', optionLabel: 'París, Francia 🇫🇷', color: '#8b5cf6', displayOrder: 4, imageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80' },
          { optionKey: 'dubai', optionLabel: 'Dubai, EAU 🇦🇪', color: '#f97316', displayOrder: 5, imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80' }
        ]
      }
    }
  });
  console.log(`✅ Created SWIPE poll: "${swipePoll.title}" (ID: ${swipePoll.id})`);

  console.log('\n✨ All 4 poll types created successfully!');
  console.log(`
📊 Poll Types Summary:
- STANDARD (Votación): Simple single-choice voting
- QUIZ (Trivial): Has correct answer, shows right/wrong feedback
- TIERLIST (Ranking): Users order options by preference
- SWIPE (Flash): Tinder-style swipe left/right voting
  `);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
