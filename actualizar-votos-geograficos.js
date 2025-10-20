import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function actualizarVotosGeograficos() {
  try {
    console.log('🌍 Obteniendo subdivisiones de diferentes países...\n');
    
    // Obtener subdivisiones de nivel 2 de diferentes países
    const subdivisiones = await prisma.$queryRaw`
      SELECT id, name, subdivision_id as subdivisionId, latitude, longitude
      FROM subdivisions
      WHERE level = 2 AND latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY RANDOM()
      LIMIT 100
    `;
    
    console.log(`✅ Encontradas ${subdivisiones.length} subdivisiones\n`);
    
    // Eliminar votos anteriores de las encuestas recientes
    console.log('🗑️ Eliminando votos anteriores...');
    const encuestas = await prisma.poll.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000) // últimos 11 días
        }
      },
      select: { id: true, title: true }
    });
    
    for (const encuesta of encuestas) {
      await prisma.vote.deleteMany({
        where: { pollId: encuesta.id }
      });
    }
    
    console.log('✅ Votos anteriores eliminados\n');
    console.log('📊 Generando votos distribuidos geográficamente...\n');
    
    // Obtener encuestas con sus opciones
    const polls = await prisma.poll.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000)
        }
      },
      include: {
        options: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    let totalVotos = 0;
    
    for (const poll of polls) {
      console.log(`📊 ${poll.title}`);
      
      // Distribuir ~1000 votos entre las opciones
      const votosPorOpcion = [
        Math.floor(Math.random() * 200) + 200,  // 200-400 votos
        Math.floor(Math.random() * 200) + 200,  // 200-400 votos
        Math.floor(Math.random() * 200) + 200,  // 200-400 votos
      ];
      
      // Ajustar para que sumen ~1000
      const total = votosPorOpcion.reduce((a, b) => a + b, 0);
      const restante = 1000 - total;
      if (poll.options.length > 3) {
        votosPorOpcion.push(restante);
      } else {
        votosPorOpcion[0] += restante;
      }
      
      for (let i = 0; i < poll.options.length; i++) {
        const option = poll.options[i];
        const numVotos = votosPorOpcion[i] || 100;
        const votes = [];
        
        for (let v = 0; v < numVotos; v++) {
          // Seleccionar subdivisión aleatoria
          const subdivision = subdivisiones[Math.floor(Math.random() * subdivisiones.length)];
          
          // Añadir variación a las coordenadas (±0.5 grados)
          const lat = subdivision.latitude + (Math.random() - 0.5);
          const lng = subdivision.longitude + (Math.random() - 0.5);
          
          // Distribuir votos en el tiempo
          const voteDate = new Date(
            poll.createdAt.getTime() + Math.random() * (Date.now() - poll.createdAt.getTime())
          );
          
          votes.push({
            pollId: poll.id,
            optionId: option.id,
            latitude: lat,
            longitude: lng,
            subdivisionId: subdivision.id,
            createdAt: voteDate
          });
        }
        
        // Insertar votos en batch
        if (votes.length > 0) {
          await prisma.vote.createMany({
            data: votes
          });
          totalVotos += votes.length;
        }
      }
      
      console.log(`   ✅ ${poll.options.length} opciones con votos distribuidos`);
    }
    
    console.log(`\n🎉 ¡Completado!`);
    console.log(`   Total de votos generados: ${totalVotos}`);
    console.log(`   Distribuidos en ${subdivisiones.length} subdivisiones diferentes`);
    
    // Mostrar estadísticas de distribución
    const votosStats = await prisma.$queryRaw`
      SELECT s.name, s.subdivision_id, COUNT(*) as count
      FROM votes v
      JOIN subdivisions s ON v.subdivision_id = s.id
      WHERE v.created_at >= datetime('now', '-11 days')
      GROUP BY v.subdivision_id
      ORDER BY count DESC
      LIMIT 10
    `;
    
    console.log('\n📈 Top 10 subdivisiones con más votos:');
    votosStats.forEach((stat, i) => {
      console.log(`   ${i + 1}. ${stat.name} (${stat.subdivision_id}): ${stat.count} votos`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

actualizarVotosGeograficos();
