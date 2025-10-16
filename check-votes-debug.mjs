import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando votos en base de datos...\n');
  
  const polls = await prisma.poll.findMany({
    include: {
      options: {
        include: {
          _count: {
            select: { votes: true }
          }
        }
      },
      _count: {
        select: { votes: true }
      }
    }
  });

  polls.forEach(poll => {
    console.log(`📊 ${poll.title}`);
    console.log(`   Total votos: ${poll._count.votes}`);
    poll.options.forEach(opt => {
      console.log(`   - ${opt.optionLabel}: ${opt._count.votes} votos`);
    });
    console.log('');
  });

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
