/**
 * Verificar si los países grises tienen votos en la BD
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const grayCountries = [
  'LBY', 'UKR', 'ARM', 'MDA', 'MKD', 'MNE', 'ISR', 'CYP', 
  'JAM', 'KWT', 'QAT', 'BHS', 'BLZ', 'GRL', 'LSO', 'PRI', 
  'ESH', 'TTO', 'ATF'
];

async function main() {
  console.log('🔍 Verificando votos de países grises en BD...\n');
  
  for (const code of grayCountries) {
    const count = await prisma.vote.count({
      where: {
        subdivision: {
          subdivisionId: {
            startsWith: `${code}.`
          }
        }
      }
    });
    
    const icon = count > 0 ? '✅' : '❌';
    console.log(`${icon} ${code}: ${count} votos`);
  }
  
  console.log('\n📊 CONCLUSIÓN:');
  const withVotes = [];
  const withoutVotes = [];
  
  for (const code of grayCountries) {
    const count = await prisma.vote.count({
      where: {
        subdivision: {
          subdivisionId: {
            startsWith: `${code}.`
          }
        }
      }
    });
    
    if (count > 0) {
      withVotes.push(code);
    } else {
      withoutVotes.push(code);
    }
  }
  
  console.log(`\n✅ Con votos pero grises: ${withVotes.length}`);
  if (withVotes.length > 0) {
    console.log('   ', withVotes.join(', '));
    console.log('   → Estos DEBERÍAN estar coloreados!');
  }
  
  console.log(`\n❌ Sin votos (normalmente grises): ${withoutVotes.length}`);
  if (withoutVotes.length > 0) {
    console.log('   ', withoutVotes.join(', '));
    console.log('   → Es normal que salgan grises');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
