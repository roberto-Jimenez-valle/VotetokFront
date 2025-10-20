import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verificarVotos() {
  try {
    console.log('🔍 Verificando votos en la base de datos...\n');
    
    // Obtener algunos votos de muestra
    const votos = await prisma.vote.findMany({
      take: 5,
      include: {
        poll: { select: { title: true } },
        option: { select: { optionLabel: true } },
        subdivision: { select: { name: true, subdivisionId: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('📊 Muestra de 5 votos recientes:\n');
    
    votos.forEach((voto, i) => {
      console.log(`${i + 1}. Voto ID: ${voto.id}`);
      console.log(`   Encuesta: ${voto.poll.title}`);
      console.log(`   Opción: ${voto.option.optionLabel}`);
      console.log(`   📍 Coordenadas: (${voto.latitude.toFixed(4)}, ${voto.longitude.toFixed(4)})`);
      console.log(`   🌍 Subdivisión: ${voto.subdivision.name} (${voto.subdivision.subdivisionId})`);
      console.log(`   📅 Fecha: ${voto.createdAt.toISOString()}`);
      console.log(`   👤 Usuario: ${voto.userId || 'Anónimo'}`);
      console.log(`   🌐 IP: ${voto.ipAddress || 'N/A'}`);
      console.log('');
    });
    
    // Estadísticas generales
    const totalVotos = await prisma.vote.count();
    const votosConSubdivision = await prisma.vote.count({
      where: { subdivisionId: { not: null } }
    });
    const votosConCoordenadas = await prisma.vote.count({
      where: { 
        AND: [
          { latitude: { not: null } },
          { longitude: { not: null } }
        ]
      }
    });
    
    console.log('📈 Estadísticas generales:');
    console.log(`   Total de votos: ${totalVotos}`);
    console.log(`   Votos con subdivisionId: ${votosConSubdivision} (${((votosConSubdivision/totalVotos)*100).toFixed(1)}%)`);
    console.log(`   Votos con coordenadas: ${votosConCoordenadas} (${((votosConCoordenadas/totalVotos)*100).toFixed(1)}%)`);
    
    // Verificar subdivisión específica
    const subdivision = await prisma.subdivision.findUnique({
      where: { id: 65101 }
    });
    
    console.log(`\n🗺️ Subdivisión usada:`);
    console.log(`   ID: ${subdivision.id}`);
    console.log(`   Nombre: ${subdivision.name}`);
    console.log(`   Código: ${subdivision.subdivisionId}`);
    console.log(`   Nivel: ${subdivision.level}`);
    console.log(`   Coordenadas: (${subdivision.latitude}, ${subdivision.longitude})`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verificarVotos();
