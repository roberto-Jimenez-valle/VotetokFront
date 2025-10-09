import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Datos de votos con formato jerárquico correcto
const hierarchicalVotesPool = [
  // ESPAÑA - Formato ESP.COMUNIDAD.PROVINCIA
  { lat: 40.4168, lng: -3.7038, country: 'ESP', countryName: 'España', subdivision: 'ESP.13.1', subdivisionName: 'Madrid', city: 'Madrid' },
  { lat: 40.4500, lng: -3.6900, country: 'ESP', countryName: 'España', subdivision: 'ESP.13.1', subdivisionName: 'Madrid', city: 'Alcalá' },
  { lat: 41.3851, lng: 2.1734, country: 'ESP', countryName: 'España', subdivision: 'ESP.9.1', subdivisionName: 'Cataluña - Barcelona', city: 'Barcelona' },
  { lat: 41.6176, lng: 0.6200, country: 'ESP', countryName: 'España', subdivision: 'ESP.9.2', subdivisionName: 'Cataluña - Lleida', city: 'Lleida' },
  { lat: 37.3891, lng: -5.9845, country: 'ESP', countryName: 'España', subdivision: 'ESP.1.1', subdivisionName: 'Andalucía - Sevilla', city: 'Sevilla' },
  { lat: 36.7213, lng: -4.4214, country: 'ESP', countryName: 'España', subdivision: 'ESP.1.2', subdivisionName: 'Andalucía - Málaga', city: 'Málaga' },
  { lat: 37.1773, lng: -3.5986, country: 'ESP', countryName: 'España', subdivision: 'ESP.1.3', subdivisionName: 'Andalucía - Granada', city: 'Granada' },
  { lat: 39.4699, lng: -0.3763, country: 'ESP', countryName: 'España', subdivision: 'ESP.10.1', subdivisionName: 'Valencia', city: 'Valencia' },
  { lat: 43.2630, lng: -2.9350, country: 'ESP', countryName: 'España', subdivision: 'ESP.16.1', subdivisionName: 'País Vasco - Vizcaya', city: 'Bilbao' },
  { lat: 42.8782, lng: -8.5448, country: 'ESP', countryName: 'España', subdivision: 'ESP.12.1', subdivisionName: 'Galicia', city: 'Santiago' },
  
  // FRANCIA
  { lat: 48.8566, lng: 2.3522, country: 'FRA', countryName: 'France', subdivision: 'FRA.11.1', subdivisionName: 'Île-de-France', city: 'Paris' },
  { lat: 48.8700, lng: 2.3200, country: 'FRA', countryName: 'France', subdivision: 'FRA.11.1', subdivisionName: 'Île-de-France', city: 'Saint-Denis' },
  { lat: 45.7640, lng: 4.8357, country: 'FRA', countryName: 'France', subdivision: 'FRA.84.1', subdivisionName: 'Auvergne-Rhône-Alpes', city: 'Lyon' },
  { lat: 43.6047, lng: 1.4442, country: 'FRA', countryName: 'France', subdivision: 'FRA.76.1', subdivisionName: 'Occitanie', city: 'Toulouse' },
  { lat: 43.2965, lng: 5.3698, country: 'FRA', countryName: 'France', subdivision: 'FRA.93.1', subdivisionName: 'Provence', city: 'Marseille' },
  
  // ITALIA
  { lat: 41.9028, lng: 12.4964, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.12.1', subdivisionName: 'Lazio - Roma', city: 'Rome' },
  { lat: 45.4642, lng: 9.1900, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.9.1', subdivisionName: 'Lombardia', city: 'Milan' },
  { lat: 45.0703, lng: 7.6869, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.13.1', subdivisionName: 'Piemonte', city: 'Turin' },
  { lat: 40.8518, lng: 14.2681, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.15.1', subdivisionName: 'Campania', city: 'Naples' },
  { lat: 43.7696, lng: 11.2558, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.16.1', subdivisionName: 'Toscana', city: 'Florence' },
  
  // ALEMANIA
  { lat: 52.5200, lng: 13.4050, country: 'DEU', countryName: 'Germany', subdivision: 'DEU.11.1', subdivisionName: 'Berlin', city: 'Berlin' },
  { lat: 48.1351, lng: 11.5820, country: 'DEU', countryName: 'Germany', subdivision: 'DEU.2.1', subdivisionName: 'Bavaria', city: 'Munich' },
  { lat: 50.1109, lng: 8.6821, country: 'DEU', countryName: 'Germany', subdivision: 'DEU.6.1', subdivisionName: 'Hessen', city: 'Frankfurt' },
  { lat: 53.5511, lng: 9.9937, country: 'DEU', countryName: 'Germany', subdivision: 'DEU.4.1', subdivisionName: 'Hamburg', city: 'Hamburg' },
  
  // USA
  { lat: 40.7128, lng: -74.0060, country: 'USA', countryName: 'United States', subdivision: 'USA.36.1', subdivisionName: 'New York', city: 'New York' },
  { lat: 34.0522, lng: -118.2437, country: 'USA', countryName: 'United States', subdivision: 'USA.6.1', subdivisionName: 'California', city: 'Los Angeles' },
  { lat: 37.7749, lng: -122.4194, country: 'USA', countryName: 'United States', subdivision: 'USA.6.2', subdivisionName: 'California', city: 'San Francisco' },
  { lat: 41.8781, lng: -87.6298, country: 'USA', countryName: 'United States', subdivision: 'USA.17.1', subdivisionName: 'Illinois', city: 'Chicago' },
  { lat: 29.7604, lng: -95.3698, country: 'USA', countryName: 'United States', subdivision: 'USA.48.1', subdivisionName: 'Texas', city: 'Houston' },
  
  // REINO UNIDO
  { lat: 51.5074, lng: -0.1278, country: 'GBR', countryName: 'United Kingdom', subdivision: 'GBR.ENG.1', subdivisionName: 'England - London', city: 'London' },
  { lat: 53.4808, lng: -2.2426, country: 'GBR', countryName: 'United Kingdom', subdivision: 'GBR.ENG.2', subdivisionName: 'England - Manchester', city: 'Manchester' },
  { lat: 55.9533, lng: -3.1883, country: 'GBR', countryName: 'United Kingdom', subdivision: 'GBR.SCT.1', subdivisionName: 'Scotland - Edinburgh', city: 'Edinburgh' },
  
  // PORTUGAL
  { lat: 38.7223, lng: -9.1393, country: 'PRT', countryName: 'Portugal', subdivision: 'PRT.11.1', subdivisionName: 'Lisboa', city: 'Lisboa' },
  { lat: 41.1579, lng: -8.6291, country: 'PRT', countryName: 'Portugal', subdivision: 'PRT.13.1', subdivisionName: 'Porto', city: 'Porto' },
  
  // MÉXICO
  { lat: 19.4326, lng: -99.1332, country: 'MEX', countryName: 'Mexico', subdivision: 'MEX.9.1', subdivisionName: 'Ciudad de México', city: 'CDMX' },
  { lat: 20.6597, lng: -103.3496, country: 'MEX', countryName: 'Mexico', subdivision: 'MEX.14.1', subdivisionName: 'Jalisco', city: 'Guadalajara' },
  { lat: 25.6866, lng: -100.3161, country: 'MEX', countryName: 'Mexico', subdivision: 'MEX.19.1', subdivisionName: 'Nuevo León', city: 'Monterrey' },
  
  // ARGENTINA
  { lat: -34.6037, lng: -58.3816, country: 'ARG', countryName: 'Argentina', subdivision: 'ARG.7.1', subdivisionName: 'Buenos Aires', city: 'Buenos Aires' },
  { lat: -31.4201, lng: -64.1888, country: 'ARG', countryName: 'Argentina', subdivision: 'ARG.5.1', subdivisionName: 'Córdoba', city: 'Córdoba' },
  
  // BRASIL
  { lat: -23.5505, lng: -46.6333, country: 'BRA', countryName: 'Brazil', subdivision: 'BRA.27.1', subdivisionName: 'São Paulo', city: 'São Paulo' },
  { lat: -22.9068, lng: -43.1729, country: 'BRA', countryName: 'Brazil', subdivision: 'BRA.21.1', subdivisionName: 'Rio de Janeiro', city: 'Rio' },
  
  // COLOMBIA
  { lat: 4.7110, lng: -74.0721, country: 'COL', countryName: 'Colombia', subdivision: 'COL.25.1', subdivisionName: 'Cundinamarca', city: 'Bogotá' },
  
  // JAPÓN
  { lat: 35.6762, lng: 139.6503, country: 'JPN', countryName: 'Japan', subdivision: 'JPN.13.1', subdivisionName: 'Tokyo', city: 'Tokyo' },
  { lat: 34.6937, lng: 135.5023, country: 'JPN', countryName: 'Japan', subdivision: 'JPN.27.1', subdivisionName: 'Osaka', city: 'Osaka' },
  
  // AUSTRALIA
  { lat: -33.8688, lng: 151.2093, country: 'AUS', countryName: 'Australia', subdivision: 'AUS.2.1', subdivisionName: 'NSW', city: 'Sydney' },
  { lat: -37.8136, lng: 144.9631, country: 'AUS', countryName: 'Australia', subdivision: 'AUS.7.1', subdivisionName: 'Victoria', city: 'Melbourne' },
  
  // CANADÁ
  { lat: 43.6532, lng: -79.3832, country: 'CAN', countryName: 'Canada', subdivision: 'CAN.8.1', subdivisionName: 'Ontario', city: 'Toronto' },
  { lat: 45.5017, lng: -73.5673, country: 'CAN', countryName: 'Canada', subdivision: 'CAN.10.1', subdivisionName: 'Quebec', city: 'Montreal' },
];

async function main() {
  console.log('🚀 Agregando votos con jerarquía correcta a todas las encuestas...\n');

  // Obtener todas las encuestas con sus opciones
  const polls = await prisma.poll.findMany({
    include: {
      options: true,
      votes: true
    },
    orderBy: { id: 'asc' }
  });

  console.log(`📊 Total de encuestas encontradas: ${polls.length}\n`);

  let totalVotesAdded = 0;

  for (const poll of polls) {
    console.log(`📋 Encuesta #${poll.id}: "${poll.title}"`);
    console.log(`   Opciones: ${poll.options.length}`);
    console.log(`   Votos actuales: ${poll.votes.length}`);

    // Determinar cuántos votos agregar (entre 15 y 30 por encuesta)
    const votesToAdd = Math.floor(Math.random() * 16) + 15;
    
    console.log(`   ➕ Agregando ${votesToAdd} votos nuevos...`);

    for (let i = 0; i < votesToAdd; i++) {
      // Seleccionar una opción aleatoria
      const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)];
      
      // Seleccionar un voto aleatorio del pool
      const randomVote = hierarchicalVotesPool[Math.floor(Math.random() * hierarchicalVotesPool.length)];

      await prisma.vote.create({
        data: {
          pollId: poll.id,
          optionId: randomOption.id,
          userId: null,
          latitude: randomVote.lat,
          longitude: randomVote.lng,
          countryIso3: randomVote.country,
          countryName: randomVote.countryName,
          subdivisionId: randomVote.subdivision,
          subdivisionName: randomVote.subdivisionName,
          cityName: randomVote.city,
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (Hierarchical Test)'
        }
      });
    }

    totalVotesAdded += votesToAdd;

    // Actualizar contadores
    const updatedPoll = await prisma.poll.findUnique({
      where: { id: poll.id },
      include: {
        options: {
          include: {
            votes: true
          }
        },
        votes: true
      }
    });

    if (updatedPoll) {
      // Actualizar contador del poll
      await prisma.poll.update({
        where: { id: poll.id },
        data: { totalVotes: updatedPoll.votes.length }
      });

      // Actualizar contadores de cada opción
      for (const option of updatedPoll.options) {
        await prisma.pollOption.update({
          where: { id: option.id },
          data: { voteCount: option.votes.length }
        });
      }

      console.log(`   ✅ Ahora tiene ${updatedPoll.votes.length} votos totales`);
    }

    console.log('');
  }

  console.log('🎉 RESUMEN FINAL:');
  console.log('='.repeat(60));
  console.log(`📊 Encuestas procesadas: ${polls.length}`);
  console.log(`➕ Votos totales agregados: ${totalVotesAdded}`);
  console.log(`✅ Todos los votos tienen formato jerárquico (PAÍS.NIVEL2.NIVEL3)`);
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
