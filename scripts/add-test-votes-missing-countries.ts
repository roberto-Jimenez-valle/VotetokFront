import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addTestVotesToNewCountries() {
  try {
    console.log('🗳️  Agregando votos de prueba a países recién agregados...\n');
    
    // Lista de países que acabamos de agregar
    const newCountries = [
      'ATA', 'ABW', 'BVT', 'CCK', 'SGS', 'HKG', 'HMD', 'CPT', 'CUW', 'CXR',
      'FLK', 'GIB', 'NFK', 'NIU', 'KIR', 'MCO', 'MAC', 'MDV', 'SXM', 'PCN',
      'VAT', 'XA', 'XB', 'XC', 'XD', 'XE', 'XF', 'XG', 'XH', 'XI',
      'XJL', 'XL', 'XM', 'XN', 'XO', 'XU', 'XV', 'XXR', 'XXS'
    ];
    
    // Obtener una encuesta activa para los votos
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
    
    let totalVotesAdded = 0;
    const results: Array<{ iso3: string, name: string, level: number, votes: number }> = [];
    
    for (const iso3 of newCountries) {
      // Obtener todas las subdivisiones de este país
      const subdivisions = await prisma.subdivision.findMany({
        where: {
          subdivisionId: {
            startsWith: iso3
          }
        },
        orderBy: {
          level: 'desc' // Ordenar por nivel descendente para obtener el más bajo primero
        }
      });
      
      if (subdivisions.length === 0) {
        console.log(`⏭️  ${iso3}: No se encontró en DB`);
        continue;
      }
      
      // Determinar nivel máximo (más bajo en la jerarquía)
      const maxLevel = subdivisions[0].level;
      
      // Filtrar subdivisiones del nivel más bajo
      const lowestLevelSubdivisions = subdivisions.filter(s => s.level === maxLevel);
      
      console.log(`${iso3} (${subdivisions[0].name}):`);
      console.log(`   Nivel más bajo: ${maxLevel}`);
      console.log(`   Subdivisiones en nivel ${maxLevel}: ${lowestLevelSubdivisions.length}`);
      
      // Si solo hay nivel 1, agregar 5-10 votos
      // Si hay más niveles, agregar 1-3 votos por subdivisión
      const votesPerSubdivision = maxLevel === 1 ? 8 : 2;
      
      let votesAddedForCountry = 0;
      
      for (const subdivision of lowestLevelSubdivisions) {
        // Agregar votos distribuidos entre las opciones
        for (let i = 0; i < votesPerSubdivision; i++) {
          const randomOption = activePoll.options[Math.floor(Math.random() * activePoll.options.length)];
          
          // Pequeña variación en las coordenadas alrededor del centroide
          const latVariation = (Math.random() - 0.5) * 0.1; // ±0.05 grados
          const lngVariation = (Math.random() - 0.5) * 0.1;
          
          await prisma.vote.create({
            data: {
              pollId: activePoll.id,
              optionId: randomOption.id,
              userId: null, // Votos anónimos
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
      
      results.push({
        iso3,
        name: subdivisions[0].name,
        level: maxLevel,
        votes: votesAddedForCountry
      });
    }
    
    // Resumen
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`✅ Total de votos agregados: ${totalVotesAdded}`);
    console.log(`✅ Países procesados: ${results.length}\n`);
    
    // Agrupar por nivel
    const byLevel = results.reduce((acc, r) => {
      if (!acc[r.level]) acc[r.level] = [];
      acc[r.level].push(r);
      return acc;
    }, {} as Record<number, typeof results>);
    
    for (const [level, countries] of Object.entries(byLevel).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
      const totalVotes = countries.reduce((sum, c) => sum + c.votes, 0);
      console.log(`Nivel ${level}:`);
      console.log(`   - Países: ${countries.length}`);
      console.log(`   - Votos totales: ${totalVotes}`);
      console.log(`   Ejemplos: ${countries.slice(0, 5).map(c => `${c.iso3} (${c.votes})`).join(', ')}`);
      console.log();
    }
    
    console.log('✅ Proceso completado exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestVotesToNewCountries();
