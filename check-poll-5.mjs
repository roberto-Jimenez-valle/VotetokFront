import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPoll5() {
  try {
    const poll = await prisma.poll.findUnique({
      where: { id: 5 },
      include: { 
        options: true,
        user: { select: { username: true } }
      }
    });
    
    if (!poll) {
      console.log('❌ Poll #5 no existe en la base de datos');
      console.log('Esa es la causa del error 500');
    } else {
      console.log('✅ Poll #5 encontrada:');
      console.log(JSON.stringify(poll, null, 2));
      console.log(`\nOpciones: ${poll.options.length}`);
      poll.options.forEach(opt => {
        console.log(`  - ID: ${opt.id}, Key: ${opt.optionKey}, Label: ${opt.optionLabel}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPoll5();
