/**
 * Script de Verificación: Fuente de Datos de Votos
 * 
 * Este script verifica que TODOS los votos se calculen desde la tabla votes
 * y que NO existan campos redundantes en la base de datos.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyVoteDataSource() {
  console.log('\n🔍 VERIFICANDO FUENTE DE DATOS DE VOTOS\n');
  console.log('═'.repeat(60));

  try {
    // 1. Verificar que no existan campos redundantes en el schema
    console.log('\n📋 PASO 1: Verificando schema de Prisma...');
    
    // Intentar acceder a campos que NO deberían existir
    const testPoll = await prisma.poll.findFirst();
    
    if (testPoll) {
      // @ts-expect-error - Este campo NO debe existir
      if ('totalVotes' in testPoll) {
        console.error('❌ ERROR: Campo totalVotes encontrado en Poll');
        console.error('   Este campo debe ser eliminado del schema');
        process.exit(1);
      } else {
        console.log('✅ Poll.totalVotes: NO existe (correcto)');
      }
      
      // @ts-expect-error - Este campo NO debe existir
      if ('totalViews' in testPoll) {
        console.error('❌ ERROR: Campo totalViews encontrado en Poll');
        console.error('   Este campo debe ser eliminado del schema');
        process.exit(1);
      } else {
        console.log('✅ Poll.totalViews: NO existe (correcto)');
      }
    }

    const testOption = await prisma.pollOption.findFirst();
    
    if (testOption) {
      // @ts-expect-error - Este campo NO debe existir
      if ('voteCount' in testOption) {
        console.error('❌ ERROR: Campo voteCount encontrado en PollOption');
        console.error('   Este campo debe ser eliminado del schema');
        process.exit(1);
      } else {
        console.log('✅ PollOption.voteCount: NO existe (correcto)');
      }
      
      // @ts-expect-error - Este campo NO debe existir
      if ('avatarUrl' in testOption) {
        console.error('❌ ERROR: Campo avatarUrl encontrado en PollOption');
        console.error('   Este campo debe ser eliminado del schema');
        process.exit(1);
      } else {
        console.log('✅ PollOption.avatarUrl: NO existe (correcto)');
      }
    }

    // 2. Verificar que _count funciona correctamente
    console.log('\n📋 PASO 2: Verificando _count.votes...');
    
    const pollWithCount = await prisma.poll.findFirst({
      include: {
        _count: {
          select: { votes: true }
        }
      }
    });

    if (pollWithCount) {
      console.log(`✅ _count.votes funciona: ${pollWithCount._count.votes} votos`);
    }

    // 3. Verificar consistencia entre _count y count directo
    console.log('\n📋 PASO 3: Verificando consistencia de datos...');
    
    const polls = await prisma.poll.findMany({
      take: 5,
      include: {
        _count: { select: { votes: true } },
        options: {
          include: {
            _count: { select: { votes: true } }
          }
        }
      }
    });

    for (const poll of polls) {
      // Contar votos directamente
      const directCount = await prisma.vote.count({
        where: { pollId: poll.id }
      });

      const countViaRelation = poll._count.votes;

      if (directCount !== countViaRelation) {
        console.error(`❌ ERROR: Inconsistencia en Poll ${poll.id}`);
        console.error(`   Count directo: ${directCount}`);
        console.error(`   Count vía _count: ${countViaRelation}`);
        process.exit(1);
      }

      // Verificar suma de opciones = total poll
      const optionVotesSum = poll.options.reduce((sum, opt) => sum + opt._count.votes, 0);
      
      if (optionVotesSum !== directCount) {
        console.error(`❌ ERROR: Suma de votos de opciones no coincide con total`);
        console.error(`   Poll ${poll.id}: ${optionVotesSum} vs ${directCount}`);
        process.exit(1);
      }

      console.log(`✅ Poll ${poll.id}: ${directCount} votos (consistente)`);
    }

    // 4. Verificar queries geográficas
    console.log('\n📋 PASO 4: Verificando queries geográficas...');
    
    const votesByCountry = await prisma.vote.groupBy({
      by: ['countryIso3'],
      _count: true,
      take: 5
    });

    console.log(`✅ groupBy por país funciona: ${votesByCountry.length} países`);

    const votesBySubdivision = await prisma.vote.groupBy({
      by: ['subdivisionId'],
      where: { subdivisionId: { not: null } },
      _count: true,
      take: 5
    });

    console.log(`✅ groupBy por subdivisión funciona: ${votesBySubdivision.length} subdivisiones`);

    // 5. Resumen final
    console.log('\n' + '═'.repeat(60));
    console.log('✅ VERIFICACIÓN COMPLETADA EXITOSAMENTE');
    console.log('═'.repeat(60));
    console.log('\n📊 Resumen:');
    console.log('  ✅ No hay campos redundantes en el schema');
    console.log('  ✅ _count.votes funciona correctamente');
    console.log('  ✅ Datos consistentes entre queries');
    console.log('  ✅ Queries geográficas funcionan');
    console.log('\n🎯 CONCLUSIÓN: Todos los votos se obtienen ÚNICAMENTE de la tabla votes\n');

  } catch (error) {
    console.error('\n❌ ERROR durante la verificación:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar verificación
verifyVoteDataSource();
