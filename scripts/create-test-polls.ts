import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creando encuestas de prueba...\n');

  // 1. Crear o encontrar usuario de prueba
  let user = await prisma.user.findUnique({
    where: { username: 'testuser' }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        username: 'testuser',
        email: 'test@votetok.com',
        displayName: 'Usuario de Prueba',
        avatarUrl: 'https://i.pravatar.cc/150?u=testuser',
        bio: 'Usuario de prueba para encuestas',
        verified: true
      }
    });
    console.log('✅ Usuario de prueba creado:', user.username);
  } else {
    console.log('✅ Usuario de prueba encontrado:', user.username);
  }

  // 2. ENCUESTA CON 1 OPCIÓN
  console.log('\n📊 Creando encuesta con 1 opción...');
  
  const poll1 = await prisma.poll.create({
    data: {
      userId: user.id,
      title: '¿Te gusta el nuevo diseño del globo?',
      description: 'Queremos saber tu opinión sobre las mejoras visuales',
      category: 'Design',
      type: 'poll',
      status: 'active',
      totalVotes: 0,
      totalViews: 150,
      options: {
        create: [
          {
            optionKey: 'Si',
            optionLabel: 'Sí, me encanta',
            color: '#3fb950',
            avatarUrl: '👍',
            voteCount: 0,
            displayOrder: 0
          }
        ]
      }
    },
    include: { options: true }
  });

  console.log('✅ Encuesta 1 creada:', poll1.title);
  console.log('   ID:', poll1.id);
  console.log('   Opción:', poll1.options[0].optionLabel);

  // Agregar votos a la encuesta 1 - CON IDS JERÁRQUICOS COMPLETOS
  const votes1Data = [
    // ESPAÑA - Formato ESP.COMUNIDAD.PROVINCIA
    // Madrid - varias provincias/ciudades (ESP.13.X)
    { lat: 40.4168, lng: -3.7038, country: 'ESP', countryName: 'España', subdivision: 'ESP.13.1', subdivisionName: 'Madrid', city: 'Madrid' },
    { lat: 40.4500, lng: -3.6900, country: 'ESP', countryName: 'España', subdivision: 'ESP.13.1', subdivisionName: 'Madrid', city: 'Alcalá de Henares' },
    { lat: 40.3000, lng: -3.7100, country: 'ESP', countryName: 'España', subdivision: 'ESP.13.1', subdivisionName: 'Madrid', city: 'Getafe' },
    
    // Cataluña - diferentes provincias (ESP.9.X)
    { lat: 41.3851, lng: 2.1734, country: 'ESP', countryName: 'España', subdivision: 'ESP.9.1', subdivisionName: 'Cataluña - Barcelona', city: 'Barcelona' },
    { lat: 41.6176, lng: 0.6200, country: 'ESP', countryName: 'España', subdivision: 'ESP.9.2', subdivisionName: 'Cataluña - Lleida', city: 'Lleida' },
    { lat: 41.1189, lng: 1.2445, country: 'ESP', countryName: 'España', subdivision: 'ESP.9.3', subdivisionName: 'Cataluña - Tarragona', city: 'Tarragona' },
    
    // Andalucía - varias provincias (ESP.1.X)
    { lat: 37.3891, lng: -5.9845, country: 'ESP', countryName: 'España', subdivision: 'ESP.1.1', subdivisionName: 'Andalucía - Sevilla', city: 'Sevilla' },
    { lat: 36.7213, lng: -4.4214, country: 'ESP', countryName: 'España', subdivision: 'ESP.1.2', subdivisionName: 'Andalucía - Málaga', city: 'Málaga' },
    { lat: 37.1773, lng: -3.5986, country: 'ESP', countryName: 'España', subdivision: 'ESP.1.3', subdivisionName: 'Andalucía - Granada', city: 'Granada' },
    { lat: 37.8882, lng: -4.7794, country: 'ESP', countryName: 'España', subdivision: 'ESP.1.4', subdivisionName: 'Andalucía - Córdoba', city: 'Córdoba' },
    
    // Comunidad Valenciana (ESP.10.X)
    { lat: 39.4699, lng: -0.3763, country: 'ESP', countryName: 'España', subdivision: 'ESP.10.1', subdivisionName: 'Valencia - Valencia', city: 'Valencia' },
    { lat: 38.3452, lng: -0.4815, country: 'ESP', countryName: 'España', subdivision: 'ESP.10.2', subdivisionName: 'Valencia - Alicante', city: 'Alicante' },
    
    // País Vasco - diferentes provincias (ESP.16.X)
    { lat: 43.2630, lng: -2.9350, country: 'ESP', countryName: 'España', subdivision: 'ESP.16.1', subdivisionName: 'País Vasco - Vizcaya', city: 'Bilbao' },
    { lat: 43.3183, lng: -1.9812, country: 'ESP', countryName: 'España', subdivision: 'ESP.16.2', subdivisionName: 'País Vasco - Guipúzcoa', city: 'San Sebastián' },
    
    // FRANCIA - Formato FRA.REGIÓN.DEPARTAMENTO
    { lat: 48.8566, lng: 2.3522, country: 'FRA', countryName: 'France', subdivision: 'FRA.11.1', subdivisionName: 'Île-de-France - Paris', city: 'Paris' },
    { lat: 48.8700, lng: 2.3200, country: 'FRA', countryName: 'France', subdivision: 'FRA.11.1', subdivisionName: 'Île-de-France - Paris', city: 'Saint-Denis' },
    { lat: 45.7640, lng: 4.8357, country: 'FRA', countryName: 'France', subdivision: 'FRA.84.1', subdivisionName: 'Auvergne-Rhône-Alpes - Rhône', city: 'Lyon' },
    { lat: 45.1885, lng: 5.7245, country: 'FRA', countryName: 'France', subdivision: 'FRA.84.2', subdivisionName: 'Auvergne-Rhône-Alpes - Isère', city: 'Grenoble' },
    
    // ITALIA - Formato ITA.REGIÓN.PROVINCIA
    { lat: 41.9028, lng: 12.4964, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.12.1', subdivisionName: 'Lazio - Roma', city: 'Rome' },
    { lat: 45.4642, lng: 9.1900, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.9.1', subdivisionName: 'Lombardia - Milano', city: 'Milan' },
    { lat: 45.0703, lng: 7.6869, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.13.1', subdivisionName: 'Piemonte - Torino', city: 'Turin' },
    { lat: 40.8518, lng: 14.2681, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.15.1', subdivisionName: 'Campania - Napoli', city: 'Naples' },
    
    // ALEMANIA - Formato DEU.LAND.CIUDAD
    { lat: 52.5200, lng: 13.4050, country: 'DEU', countryName: 'Germany', subdivision: 'DEU.11.1', subdivisionName: 'Berlin - Mitte', city: 'Berlin' },
    { lat: 48.1351, lng: 11.5820, country: 'DEU', countryName: 'Germany', subdivision: 'DEU.2.1', subdivisionName: 'Bavaria - München', city: 'Munich' },
    { lat: 50.1109, lng: 8.6821, country: 'DEU', countryName: 'Germany', subdivision: 'DEU.6.1', subdivisionName: 'Hessen - Frankfurt', city: 'Frankfurt' },
    
    // USA - Formato USA.ESTADO.CONDADO
    { lat: 40.7128, lng: -74.0060, country: 'USA', countryName: 'United States', subdivision: 'USA.36.1', subdivisionName: 'New York - Manhattan', city: 'New York' },
    { lat: 40.7500, lng: -73.9900, country: 'USA', countryName: 'United States', subdivision: 'USA.36.2', subdivisionName: 'New York - Brooklyn', city: 'Brooklyn' },
    { lat: 34.0522, lng: -118.2437, country: 'USA', countryName: 'United States', subdivision: 'USA.6.1', subdivisionName: 'California - Los Angeles County', city: 'Los Angeles' },
    { lat: 37.7749, lng: -122.4194, country: 'USA', countryName: 'United States', subdivision: 'USA.6.2', subdivisionName: 'California - San Francisco County', city: 'San Francisco' },
    { lat: 32.7157, lng: -117.1611, country: 'USA', countryName: 'United States', subdivision: 'USA.6.3', subdivisionName: 'California - San Diego County', city: 'San Diego' },
    
    // Reino Unido - Formato GBR.PAÍS.REGIÓN
    { lat: 51.5074, lng: -0.1278, country: 'GBR', countryName: 'United Kingdom', subdivision: 'GBR.ENG.1', subdivisionName: 'England - Greater London', city: 'London' },
    { lat: 53.4808, lng: -2.2426, country: 'GBR', countryName: 'United Kingdom', subdivision: 'GBR.ENG.2', subdivisionName: 'England - Greater Manchester', city: 'Manchester' },
  ];

  for (const voteData of votes1Data) {
    await prisma.vote.create({
      data: {
        pollId: poll1.id,
        optionId: poll1.options[0].id,
        userId: null, // voto anónimo
        latitude: voteData.lat,
        longitude: voteData.lng,
        countryIso3: voteData.country,
        countryName: voteData.countryName,
        subdivisionId: voteData.subdivision,
        subdivisionName: voteData.subdivisionName,
        cityName: voteData.city,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Test)'
      }
    });
  }

  // Actualizar contadores de la opción y poll
  await prisma.pollOption.update({
    where: { id: poll1.options[0].id },
    data: { voteCount: votes1Data.length }
  });

  await prisma.poll.update({
    where: { id: poll1.id },
    data: { totalVotes: votes1Data.length }
  });

  console.log(`✅ ${votes1Data.length} votos agregados a la encuesta 1\n`);

  // 3. ENCUESTA CON 2 OPCIONES
  console.log('📊 Creando encuesta con 2 opciones...');

  const poll2 = await prisma.poll.create({
    data: {
      userId: user.id,
      title: '¿Prefieres tema oscuro o claro?',
      description: 'Ayúdanos a mejorar la experiencia visual',
      category: 'Preferences',
      type: 'poll',
      status: 'active',
      totalVotes: 0,
      totalViews: 230,
      options: {
        create: [
          {
            optionKey: 'Dark',
            optionLabel: 'Tema Oscuro',
            color: '#1f6feb',
            avatarUrl: '🌙',
            voteCount: 0,
            displayOrder: 0
          },
          {
            optionKey: 'Light',
            optionLabel: 'Tema Claro',
            color: '#f0f6fc',
            avatarUrl: '☀️',
            voteCount: 0,
            displayOrder: 1
          }
        ]
      }
    },
    include: { options: true }
  });

  console.log('✅ Encuesta 2 creada:', poll2.title);
  console.log('   ID:', poll2.id);
  console.log('   Opciones:', poll2.options.map(o => o.optionLabel).join(', '));

  // Agregar votos a la opción 1 (Dark) - CON IDS JERÁRQUICOS COMPLETOS
  const votesDark = [
    // ESPAÑA - Formato jerárquico completo
    { lat: 40.4168, lng: -3.7038, country: 'ESP', countryName: 'España', subdivision: 'ESP.13.1', subdivisionName: 'Madrid', city: 'Madrid Centro' },
    { lat: 40.4200, lng: -3.7100, country: 'ESP', countryName: 'España', subdivision: 'ESP.13.1', subdivisionName: 'Madrid', city: 'Chamberí' },
    { lat: 40.4500, lng: -3.6900, country: 'ESP', countryName: 'España', subdivision: 'ESP.13.1', subdivisionName: 'Madrid', city: 'Alcalá de Henares' },
    { lat: 40.3800, lng: -3.7200, country: 'ESP', countryName: 'España', subdivision: 'ESP.13.1', subdivisionName: 'Madrid', city: 'Leganés' },
    
    { lat: 41.3851, lng: 2.1734, country: 'ESP', countryName: 'España', subdivision: 'ESP.9.1', subdivisionName: 'Cataluña - Barcelona', city: 'Barcelona' },
    { lat: 41.3900, lng: 2.1800, country: 'ESP', countryName: 'España', subdivision: 'ESP.9.1', subdivisionName: 'Cataluña - Barcelona', city: 'Barcelona Nord' },
    { lat: 41.3950, lng: 2.1650, country: 'ESP', countryName: 'España', subdivision: 'ESP.9.1', subdivisionName: 'Cataluña - Barcelona', city: 'Eixample' },
    { lat: 41.6176, lng: 0.6200, country: 'ESP', countryName: 'España', subdivision: 'ESP.9.2', subdivisionName: 'Cataluña - Lleida', city: 'Lleida' },
    
    { lat: 37.3891, lng: -5.9845, country: 'ESP', countryName: 'España', subdivision: 'ESP.1.1', subdivisionName: 'Andalucía - Sevilla', city: 'Sevilla' },
    { lat: 36.7213, lng: -4.4214, country: 'ESP', countryName: 'España', subdivision: 'ESP.1.2', subdivisionName: 'Andalucía - Málaga', city: 'Málaga' },
    
    { lat: 39.4699, lng: -0.3763, country: 'ESP', countryName: 'España', subdivision: 'ESP.10.1', subdivisionName: 'Valencia - Valencia', city: 'Valencia' },
    { lat: 38.3452, lng: -0.4815, country: 'ESP', countryName: 'España', subdivision: 'ESP.10.2', subdivisionName: 'Valencia - Alicante', city: 'Alicante' },
    
    { lat: 43.2630, lng: -2.9350, country: 'ESP', countryName: 'España', subdivision: 'ESP.16.1', subdivisionName: 'País Vasco - Vizcaya', city: 'Bilbao' },
    { lat: 43.3183, lng: -1.9812, country: 'ESP', countryName: 'España', subdivision: 'ESP.16.2', subdivisionName: 'País Vasco - Guipúzcoa', city: 'San Sebastián' },
    
    // FRANCIA - formato jerárquico
    { lat: 48.8566, lng: 2.3522, country: 'FRA', countryName: 'France', subdivision: 'FRA.11.1', subdivisionName: 'Île-de-France - Paris', city: 'Paris' },
    { lat: 48.8600, lng: 2.3500, country: 'FRA', countryName: 'France', subdivision: 'FRA.11.1', subdivisionName: 'Île-de-France - Paris', city: 'Paris 1er' },
    { lat: 48.8700, lng: 2.3200, country: 'FRA', countryName: 'France', subdivision: 'FRA.11.1', subdivisionName: 'Île-de-France - Paris', city: 'Saint-Denis' },
    { lat: 48.8900, lng: 2.2400, country: 'FRA', countryName: 'France', subdivision: 'FRA.11.1', subdivisionName: 'Île-de-France - Paris', city: 'La Défense' },
    
    { lat: 45.7640, lng: 4.8357, country: 'FRA', countryName: 'France', subdivision: 'FRA.84.1', subdivisionName: 'Auvergne-Rhône-Alpes - Rhône', city: 'Lyon' },
    { lat: 45.1885, lng: 5.7245, country: 'FRA', countryName: 'France', subdivision: 'FRA.84.2', subdivisionName: 'Auvergne-Rhône-Alpes - Isère', city: 'Grenoble' },
    
    // ALEMANIA - formato jerárquico
    { lat: 52.5200, lng: 13.4050, country: 'DEU', countryName: 'Germany', subdivision: 'DEU.11.1', subdivisionName: 'Berlin - Mitte', city: 'Berlin Mitte' },
    { lat: 52.5300, lng: 13.3800, country: 'DEU', countryName: 'Germany', subdivision: 'DEU.11.2', subdivisionName: 'Berlin - Charlottenburg', city: 'Charlottenburg' },
    { lat: 48.1351, lng: 11.5820, country: 'DEU', countryName: 'Germany', subdivision: 'DEU.2.1', subdivisionName: 'Bavaria - München', city: 'Munich' },
    { lat: 50.1109, lng: 8.6821, country: 'DEU', countryName: 'Germany', subdivision: 'DEU.6.1', subdivisionName: 'Hessen - Frankfurt', city: 'Frankfurt' },
    
    // USA - formato jerárquico
    { lat: 40.7128, lng: -74.0060, country: 'USA', countryName: 'United States', subdivision: 'USA.36.1', subdivisionName: 'New York - Manhattan', city: 'Manhattan' },
    { lat: 40.7500, lng: -73.9900, country: 'USA', countryName: 'United States', subdivision: 'USA.36.2', subdivisionName: 'New York - Brooklyn', city: 'Brooklyn' },
    { lat: 40.7282, lng: -73.7949, country: 'USA', countryName: 'United States', subdivision: 'USA.36.3', subdivisionName: 'New York - Queens', city: 'Queens' },
    
    { lat: 37.7749, lng: -122.4194, country: 'USA', countryName: 'United States', subdivision: 'USA.6.2', subdivisionName: 'California - San Francisco County', city: 'San Francisco' },
    { lat: 34.0522, lng: -118.2437, country: 'USA', countryName: 'United States', subdivision: 'USA.6.1', subdivisionName: 'California - Los Angeles County', city: 'Los Angeles' },
    { lat: 32.7157, lng: -117.1611, country: 'USA', countryName: 'United States', subdivision: 'USA.6.3', subdivisionName: 'California - San Diego County', city: 'San Diego' },
    
    // REINO UNIDO - formato jerárquico
    { lat: 51.5074, lng: -0.1278, country: 'GBR', countryName: 'United Kingdom', subdivision: 'GBR.ENG.1', subdivisionName: 'England - Greater London', city: 'London' },
    { lat: 51.5100, lng: -0.1300, country: 'GBR', countryName: 'United Kingdom', subdivision: 'GBR.ENG.1', subdivisionName: 'England - Greater London', city: 'Westminster' },
    { lat: 53.4808, lng: -2.2426, country: 'GBR', countryName: 'United Kingdom', subdivision: 'GBR.ENG.2', subdivisionName: 'England - Greater Manchester', city: 'Manchester' },
    
    // ITALIA - formato jerárquico
    { lat: 41.9028, lng: 12.4964, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.12.1', subdivisionName: 'Lazio - Roma', city: 'Rome' },
    { lat: 45.4642, lng: 9.1900, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.9.1', subdivisionName: 'Lombardia - Milano', city: 'Milan' },
  ];

  for (const voteData of votesDark) {
    await prisma.vote.create({
      data: {
        pollId: poll2.id,
        optionId: poll2.options[0].id,
        userId: null,
        latitude: voteData.lat,
        longitude: voteData.lng,
        countryIso3: voteData.country,
        countryName: voteData.countryName,
        subdivisionId: voteData.subdivision,
        subdivisionName: voteData.subdivisionName,
        cityName: voteData.city,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Test)'
      }
    });
  }

  // Agregar votos a la opción 2 (Light) - CON IDS JERÁRQUICOS COMPLETOS
  const votesLight = [
    // ESPAÑA - formato jerárquico
    { lat: 37.1773, lng: -3.5986, country: 'ESP', countryName: 'España', subdivision: 'ESP.1.3', subdivisionName: 'Andalucía - Granada', city: 'Granada' },
    { lat: 37.8882, lng: -4.7794, country: 'ESP', countryName: 'España', subdivision: 'ESP.1.4', subdivisionName: 'Andalucía - Córdoba', city: 'Córdoba' },
    { lat: 36.7213, lng: -4.4214, country: 'ESP', countryName: 'España', subdivision: 'ESP.1.2', subdivisionName: 'Andalucía - Málaga', city: 'Málaga' },
    
    { lat: 42.8782, lng: -8.5448, country: 'ESP', countryName: 'España', subdivision: 'ESP.12.1', subdivisionName: 'Galicia - A Coruña', city: 'Santiago' },
    { lat: 42.2328, lng: -8.7226, country: 'ESP', countryName: 'España', subdivision: 'ESP.12.2', subdivisionName: 'Galicia - Pontevedra', city: 'Vigo' },
    
    { lat: 41.6488, lng: -0.8891, country: 'ESP', countryName: 'España', subdivision: 'ESP.3.1', subdivisionName: 'Aragón - Zaragoza', city: 'Zaragoza' },
    
    { lat: 37.9922, lng: -1.1307, country: 'ESP', countryName: 'España', subdivision: 'ESP.14.1', subdivisionName: 'Murcia', city: 'Murcia' },
    
    // ITALIA - formato jerárquico
    { lat: 41.9028, lng: 12.4964, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.12.1', subdivisionName: 'Lazio - Roma', city: 'Roma Centro' },
    { lat: 41.8947, lng: 12.4839, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.12.1', subdivisionName: 'Lazio - Roma', city: 'Trastevere' },
    
    { lat: 45.4642, lng: 9.1900, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.9.1', subdivisionName: 'Lombardia - Milano', city: 'Milano' },
    { lat: 45.0703, lng: 7.6869, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.13.1', subdivisionName: 'Piemonte - Torino', city: 'Torino' },
    { lat: 40.8518, lng: 14.2681, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.15.1', subdivisionName: 'Campania - Napoli', city: 'Napoli' },
    { lat: 43.7696, lng: 11.2558, country: 'ITA', countryName: 'Italy', subdivision: 'ITA.16.1', subdivisionName: 'Toscana - Firenze', city: 'Florence' },
    
    // PORTUGAL - formato jerárquico
    { lat: 38.7223, lng: -9.1393, country: 'PRT', countryName: 'Portugal', subdivision: 'PRT.11.1', subdivisionName: 'Lisboa', city: 'Lisboa' },
    { lat: 38.7100, lng: -9.1400, country: 'PRT', countryName: 'Portugal', subdivision: 'PRT.11.1', subdivisionName: 'Lisboa', city: 'Belém' },
    { lat: 41.1579, lng: -8.6291, country: 'PRT', countryName: 'Portugal', subdivision: 'PRT.13.1', subdivisionName: 'Porto', city: 'Porto' },
    
    // MÉXICO - formato jerárquico
    { lat: 19.4326, lng: -99.1332, country: 'MEX', countryName: 'Mexico', subdivision: 'MEX.9.1', subdivisionName: 'Ciudad de México', city: 'Centro Histórico' },
    { lat: 19.4200, lng: -99.1700, country: 'MEX', countryName: 'Mexico', subdivision: 'MEX.9.2', subdivisionName: 'Ciudad de México', city: 'Polanco' },
    { lat: 20.6597, lng: -103.3496, country: 'MEX', countryName: 'Mexico', subdivision: 'MEX.14.1', subdivisionName: 'Jalisco', city: 'Guadalajara' },
    
    // ARGENTINA - formato jerárquico
    { lat: -34.6037, lng: -58.3816, country: 'ARG', countryName: 'Argentina', subdivision: 'ARG.7.1', subdivisionName: 'Buenos Aires', city: 'Buenos Aires' },
    { lat: -34.6000, lng: -58.4000, country: 'ARG', countryName: 'Argentina', subdivision: 'ARG.7.1', subdivisionName: 'Buenos Aires', city: 'Palermo' },
    { lat: -31.4201, lng: -64.1888, country: 'ARG', countryName: 'Argentina', subdivision: 'ARG.5.1', subdivisionName: 'Córdoba', city: 'Córdoba' },
    
    // BRASIL - formato jerárquico
    { lat: -23.5505, lng: -46.6333, country: 'BRA', countryName: 'Brazil', subdivision: 'BRA.27.1', subdivisionName: 'São Paulo', city: 'São Paulo' },
    { lat: -22.9068, lng: -43.1729, country: 'BRA', countryName: 'Brazil', subdivision: 'BRA.21.1', subdivisionName: 'Rio de Janeiro', city: 'Rio de Janeiro' },
    
    // COLOMBIA - formato jerárquico
    { lat: 4.7110, lng: -74.0721, country: 'COL', countryName: 'Colombia', subdivision: 'COL.25.1', subdivisionName: 'Cundinamarca - Bogotá', city: 'Bogotá' },
  ];

  for (const voteData of votesLight) {
    await prisma.vote.create({
      data: {
        pollId: poll2.id,
        optionId: poll2.options[1].id,
        userId: null,
        latitude: voteData.lat,
        longitude: voteData.lng,
        countryIso3: voteData.country,
        countryName: voteData.countryName,
        subdivisionId: voteData.subdivision,
        subdivisionName: voteData.subdivisionName,
        cityName: voteData.city,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Test)'
      }
    });
  }

  // Actualizar contadores
  await prisma.pollOption.update({
    where: { id: poll2.options[0].id },
    data: { voteCount: votesDark.length }
  });

  await prisma.pollOption.update({
    where: { id: poll2.options[1].id },
    data: { voteCount: votesLight.length }
  });

  await prisma.poll.update({
    where: { id: poll2.id },
    data: { totalVotes: votesDark.length + votesLight.length }
  });

  console.log(`✅ ${votesDark.length} votos para "Tema Oscuro"`);
  console.log(`✅ ${votesLight.length} votos para "Tema Claro"`);
  console.log(`✅ Total: ${votesDark.length + votesLight.length} votos en la encuesta 2\n`);

  // Resumen final
  console.log('🎉 RESUMEN:');
  console.log('=' .repeat(50));
  console.log(`✅ Usuario: ${user.username} (ID: ${user.id})`);
  console.log(`✅ Encuesta 1: "${poll1.title}" (ID: ${poll1.id})`);
  console.log(`   - 1 opción: ${poll1.options[0].optionLabel}`);
  console.log(`   - ${votes1Data.length} votos`);
  console.log(`✅ Encuesta 2: "${poll2.title}" (ID: ${poll2.id})`);
  console.log(`   - 2 opciones: ${poll2.options.map(o => o.optionLabel).join(', ')}`);
  console.log(`   - ${votesDark.length + votesLight.length} votos`);
  console.log('=' .repeat(50));
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
