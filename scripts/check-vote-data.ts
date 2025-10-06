import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVoteData() {
  
  // Verificar votos con subdivisionId
  const votes = await prisma.vote.findMany({
    where: {
      countryIso3: 'ESP',
      subdivisionId: { not: null }
    },
    select: {
      id: true,
      subdivisionId: true,
      subdivisionName: true,
      cityName: true,
      optionId: true
    },
    take: 10
  });

    votes.forEach(v => {
      });

  // Agrupar por subdivisionId
    const grouped = await prisma.vote.groupBy({
    by: ['subdivisionId'],
    where: {
      countryIso3: 'ESP',
      subdivisionId: { not: null }
    },
    _count: true
  });

  grouped.slice(0, 10).forEach(g => {
      });

  await prisma.$disconnect();
}

checkVoteData();
