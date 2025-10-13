/**
 * Script para verificar que TODOS los votos tienen formato de 3 niveles
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando formato de subdivision_id en votos...\n');

  // Obtener muestra de votos
  const sampleVotes = await prisma.vote.findMany({
    select: {
      id: true,
      countryIso3: true,
      subdivisionId: true,
      subdivisionName: true,
    },
    take: 20,
  });

  console.log('📋 Muestra de 20 votos:');
  console.log('─'.repeat(80));
  
  let with3Levels = 0;
  let with2Levels = 0;
  let with1Level = 0;
  let withOther = 0;

  sampleVotes.forEach((vote, index) => {
    const levels = vote.subdivisionId?.split('.').length || 0;
    const emoji = levels === 3 ? '✅' : '❌';
    
    console.log(`${emoji} ${index + 1}. ${vote.subdivisionId?.padEnd(15)} - ${vote.subdivisionName}`);
    
    if (levels === 3) with3Levels++;
    else if (levels === 2) with2Levels++;
    else if (levels === 1) with1Level++;
    else withOther++;
  });

  console.log('─'.repeat(80));

  // Contar todos los votos por niveles
  const allVotes = await prisma.vote.findMany({
    select: {
      subdivisionId: true,
    },
  });

  let total3Levels = 0;
  let total2Levels = 0;
  let total1Level = 0;
  let totalOther = 0;

  allVotes.forEach((vote) => {
    const levels = vote.subdivisionId?.split('.').length || 0;
    if (levels === 3) total3Levels++;
    else if (levels === 2) total2Levels++;
    else if (levels === 1) total1Level++;
    else totalOther++;
  });

  console.log('\n📊 Resumen total de votos:');
  console.log('─'.repeat(80));
  console.log(`Total de votos: ${allVotes.length}`);
  console.log(`\n✅ Con 3 niveles (ESP.1.3): ${total3Levels} (${((total3Levels / allVotes.length) * 100).toFixed(2)}%)`);
  console.log(`⚠️  Con 2 niveles (ESP.1):   ${total2Levels} (${((total2Levels / allVotes.length) * 100).toFixed(2)}%)`);
  console.log(`❌ Con 1 nivel (ESP):        ${total1Level} (${((total1Level / allVotes.length) * 100).toFixed(2)}%)`);
  console.log(`❌ Otros formatos:           ${totalOther} (${((totalOther / allVotes.length) * 100).toFixed(2)}%)`);
  console.log('─'.repeat(80));

  if (total3Levels === allVotes.length) {
    console.log('\n🎉 ¡PERFECTO! Todos los votos tienen formato de 3 niveles');
  } else {
    console.log(`\n⚠️  ADVERTENCIA: ${allVotes.length - total3Levels} votos NO tienen 3 niveles`);
    console.log('    Ejecuta: npx tsx scripts/fix-votes-subdivisions.ts');
  }
  
  console.log('\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
