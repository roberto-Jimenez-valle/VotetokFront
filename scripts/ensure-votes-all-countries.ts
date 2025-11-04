import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureVotesForAllCountries() {
  try {
    console.log('🗳️  Asegurando votos para todos los países en su nivel más bajo...\n');
    
    // Obtener una encuesta activa
    const activePoll = await prisma.poll.findFirst({
      where: {
        status: 'active'
      },
      include: {
        options: true
      }
    });
    
    if (!activePoll || activePoll.options.length === 0) {
      console.log('❌ No se encontró una encuesta activa con opciones');
      return;
    }
    
    console.log(`📊 Usando encuesta: "${activePoll.title}"`);
    console.log(`   Opciones: ${activePoll.options.length}\n`);
    
    // Obtener todos los países (nivel 1)
    const allCountries = await prisma.subdivision.findMany({
      where: {
        level: 1
      },
      orderBy: {
        subdivisionId: 'asc'
      }
    });
    
    console.log(`🌍 Países totales: ${allCountries.length}\n`);
    
    let totalVotesAdded = 0;
    const countriesProcessed: Array<{
      iso3: string;
      name: string;
      maxLevel: number;
      subdivisions: number;
      hadVotes: boolean;
      votesAdded: number;
    }> = [];
    
    for (const country of allCountries) {
      const iso3 = country.subdivisionId;
      
      // Obtener todas las subdivisiones de este país
      const allSubdivisions = await prisma.subdivision.findMany({
        where: {
          subdivisionId: {
            startsWith: iso3
          }
        },
        orderBy: {
          level: 'desc'
        }
      });
      
      // Determinar nivel máximo (más bajo en la jerarquía)
      const maxLevel = allSubdivisions[0]?.level || 1;
      
      // Obtener subdivisiones del nivel más bajo
      const lowestLevelSubdivisions = allSubdivisions.filter(s => s.level === maxLevel);
      
      // Verificar si ya tiene votos en el nivel más bajo
      const subdivisionIds = lowestLevelSubdivisions.map(s => s.id);
      
      const existingVotes = await prisma.vote.count({
        where: {
          subdivisionId: {
            in: subdivisionIds
          }
        }
      });
      
      const hadVotes = existingVotes > 0;
      
      // Si ya tiene votos, saltar
      if (hadVotes) {
        console.log(`⏭️  ${iso3} (${country.name}): Ya tiene ${existingVotes} votos en nivel ${maxLevel}`);
        countriesProcessed.push({
          iso3,
          name: country.name,
          maxLevel,
          subdivisions: lowestLevelSubdivisions.length,
          hadVotes: true,
          votesAdded: 0
        });
        continue;
      }
      
      // Añadir votos
      console.log(`${iso3} (${country.name}):`);
      console.log(`   Nivel más bajo: ${maxLevel}`);
      console.log(`   Subdivisiones: ${lowestLevelSubdivisions.length}`);
      
      // Determinar cantidad de votos según el nivel
      const votesPerSubdivision = maxLevel === 1 ? 8 : maxLevel === 2 ? 3 : 2;
      
      let votesAddedForCountry = 0;
      
      for (const subdivision of lowestLevelSubdivisions) {
        for (let i = 0; i < votesPerSubdivision; i++) {
          const randomOption = activePoll.options[Math.floor(Math.random() * activePoll.options.length)];
          
          // Pequeña variación en las coordenadas
          const latVariation = (Math.random() - 0.5) * 0.1;
          const lngVariation = (Math.random() - 0.5) * 0.1;
          
          await prisma.vote.create({
            data: {
              pollId: activePoll.id,
              optionId: randomOption.id,
              userId: null,
              latitude: subdivision.latitude + latVariation,
              longitude: subdivision.longitude + lngVariation,
              subdivisionId: subdivision.id,
              ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
              userAgent: 'Test Script'
            }
          });
          
          votesAddedForCountry++;
          totalVotesAdded++;
        }
      }
      
      console.log(`   ✅ Votos agregados: ${votesAddedForCountry}\n`);
      
      countriesProcessed.push({
        iso3,
        name: country.name,
        maxLevel,
        subdivisions: lowestLevelSubdivisions.length,
        hadVotes: false,
        votesAdded: votesAddedForCountry
      });
    }
    
    // Resumen
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const countriesWithExistingVotes = countriesProcessed.filter(c => c.hadVotes).length;
    const countriesWithNewVotes = countriesProcessed.filter(c => !c.hadVotes).length;
    
    console.log(`✅ Total de votos agregados: ${totalVotesAdded}`);
    console.log(`📊 Países procesados: ${countriesProcessed.length}`);
    console.log(`   - Con votos existentes: ${countriesWithExistingVotes}`);
    console.log(`   - Votos nuevos agregados: ${countriesWithNewVotes}\n`);
    
    // Agrupar por nivel
    const byLevel = countriesProcessed.reduce((acc, c) => {
      if (!acc[c.maxLevel]) acc[c.maxLevel] = { existing: [], new: [] };
      if (c.hadVotes) {
        acc[c.maxLevel].existing.push(c);
      } else {
        acc[c.maxLevel].new.push(c);
      }
      return acc;
    }, {} as Record<number, { existing: typeof countriesProcessed, new: typeof countriesProcessed }>);
    
    for (const [level, data] of Object.entries(byLevel).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
      const levelName = level === '1' ? 'País' : level === '2' ? 'Estado/Región' : 'Municipio/Distrito';
      const totalCountries = data.existing.length + data.new.length;
      const totalVotes = data.new.reduce((sum, c) => sum + c.votesAdded, 0);
      
      console.log(`Nivel ${level} (${levelName}):`);
      console.log(`   - Países con este nivel: ${totalCountries}`);
      console.log(`   - Ya tenían votos: ${data.existing.length}`);
      console.log(`   - Votos nuevos agregados: ${totalVotes}`);
      
      if (data.new.length > 0 && data.new.length <= 10) {
        console.log(`   Países con votos nuevos: ${data.new.map(c => c.iso3).join(', ')}`);
      }
      console.log();
    }
    
    console.log('✅ Proceso completado exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

ensureVotesForAllCountries();
