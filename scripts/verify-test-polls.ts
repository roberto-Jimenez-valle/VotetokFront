import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando encuestas de prueba...\n');

  const polls = await prisma.poll.findMany({
    include: {
      user: true,
      options: {
        include: {
          votes: true
        }
      },
      votes: true
    },
    orderBy: { id: 'desc' },
    take: 2
  });

  for (const poll of polls) {
    console.log('📊 ENCUESTA:', poll.title);
    console.log('   ID:', poll.id);
    console.log('   Usuario:', poll.user.username);
    console.log('   Categoría:', poll.category);
    console.log('   Estado:', poll.status);
    console.log('   Total votos:', poll.totalVotes);
    console.log('   Total vistas:', poll.totalViews);
    console.log('\n   OPCIONES:');
    
    for (const option of poll.options) {
      console.log(`   ${option.avatarUrl} ${option.optionLabel}`);
      console.log(`      - Color: ${option.color}`);
      console.log(`      - Votos: ${option.voteCount}`);
      
      // Mostrar distribución geográfica
      const votesByCountry: Record<string, number> = {};
      for (const vote of option.votes) {
        votesByCountry[vote.countryIso3] = (votesByCountry[vote.countryIso3] || 0) + 1;
      }
      console.log(`      - Países: ${Object.entries(votesByCountry).map(([iso, count]) => `${iso}(${count})`).join(', ')}`);
    }
    console.log('   ' + '='.repeat(60) + '\n');
  }

  console.log('✅ Verificación completada');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
