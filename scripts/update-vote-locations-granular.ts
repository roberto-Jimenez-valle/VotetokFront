import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapeo de provincias de España con sus IDs más granulares (ID_2)
// Formato: "ESP.1.1" = Comunidad.Provincia
const SPAIN_PROVINCES = {
  // Andalucía (ESP.1)
  'Almería': { id: 'ESP.1.1', region: 'Andalucía', regionId: 'ESP.1' },
  'Cádiz': { id: 'ESP.1.2', region: 'Andalucía', regionId: 'ESP.1' },
  'Córdoba': { id: 'ESP.1.3', region: 'Andalucía', regionId: 'ESP.1' },
  'Granada': { id: 'ESP.1.4', region: 'Andalucía', regionId: 'ESP.1' },
  'Huelva': { id: 'ESP.1.5', region: 'Andalucía', regionId: 'ESP.1' },
  'Jaén': { id: 'ESP.1.6', region: 'Andalucía', regionId: 'ESP.1' },
  'Málaga': { id: 'ESP.1.7', region: 'Andalucía', regionId: 'ESP.1' },
  'Sevilla': { id: 'ESP.1.8', region: 'Andalucía', regionId: 'ESP.1' },
  
  // Aragón (ESP.2)
  'Huesca': { id: 'ESP.2.1', region: 'Aragón', regionId: 'ESP.2' },
  'Teruel': { id: 'ESP.2.2', region: 'Aragón', regionId: 'ESP.2' },
  'Zaragoza': { id: 'ESP.2.3', region: 'Aragón', regionId: 'ESP.2' },
  
  // Cantabria (ESP.3) - Solo una provincia
  'Cantabria': { id: 'ESP.3.1', region: 'Cantabria', regionId: 'ESP.3' },
  
  // Castilla-La Mancha (ESP.4)
  'Albacete': { id: 'ESP.4.1', region: 'Castilla-La Mancha', regionId: 'ESP.4' },
  'Ciudad Real': { id: 'ESP.4.2', region: 'Castilla-La Mancha', regionId: 'ESP.4' },
  'Cuenca': { id: 'ESP.4.3', region: 'Castilla-La Mancha', regionId: 'ESP.4' },
  'Guadalajara': { id: 'ESP.4.4', region: 'Castilla-La Mancha', regionId: 'ESP.4' },
  'Toledo': { id: 'ESP.4.5', region: 'Castilla-La Mancha', regionId: 'ESP.4' },
  
  // Castilla y León (ESP.5)
  'Ávila': { id: 'ESP.5.1', region: 'Castilla y León', regionId: 'ESP.5' },
  'Burgos': { id: 'ESP.5.2', region: 'Castilla y León', regionId: 'ESP.5' },
  'León': { id: 'ESP.5.3', region: 'Castilla y León', regionId: 'ESP.5' },
  'Palencia': { id: 'ESP.5.4', region: 'Castilla y León', regionId: 'ESP.5' },
  'Salamanca': { id: 'ESP.5.5', region: 'Castilla y León', regionId: 'ESP.5' },
  'Segovia': { id: 'ESP.5.6', region: 'Castilla y León', regionId: 'ESP.5' },
  'Soria': { id: 'ESP.5.7', region: 'Castilla y León', regionId: 'ESP.5' },
  'Valladolid': { id: 'ESP.5.8', region: 'Castilla y León', regionId: 'ESP.5' },
  'Zamora': { id: 'ESP.5.9', region: 'Castilla y León', regionId: 'ESP.5' },
  
  // Cataluña (ESP.6)
  'Barcelona': { id: 'ESP.6.1', region: 'Cataluña', regionId: 'ESP.6' },
  'Girona': { id: 'ESP.6.2', region: 'Cataluña', regionId: 'ESP.6' },
  'Lleida': { id: 'ESP.6.3', region: 'Cataluña', regionId: 'ESP.6' },
  'Tarragona': { id: 'ESP.6.4', region: 'Cataluña', regionId: 'ESP.6' },
  
  // Comunidad de Madrid (ESP.8) - Solo una provincia
  'Madrid': { id: 'ESP.8.1', region: 'Comunidad de Madrid', regionId: 'ESP.8' },
  
  // Comunidad Valenciana (ESP.10)
  'Alicante': { id: 'ESP.10.1', region: 'Comunidad Valenciana', regionId: 'ESP.10' },
  'Castellón': { id: 'ESP.10.2', region: 'Comunidad Valenciana', regionId: 'ESP.10' },
  'Valencia': { id: 'ESP.10.3', region: 'Comunidad Valenciana', regionId: 'ESP.10' },
  
  // Galicia (ESP.12)
  'A Coruña': { id: 'ESP.12.1', region: 'Galicia', regionId: 'ESP.12' },
  'Lugo': { id: 'ESP.12.2', region: 'Galicia', regionId: 'ESP.12' },
  'Ourense': { id: 'ESP.12.3', region: 'Galicia', regionId: 'ESP.12' },
  'Pontevedra': { id: 'ESP.12.4', region: 'Galicia', regionId: 'ESP.12' },
  
  // País Vasco (ESP.16)
  'Álava': { id: 'ESP.16.1', region: 'País Vasco', regionId: 'ESP.16' },
  'Guipúzcoa': { id: 'ESP.16.2', region: 'País Vasco', regionId: 'ESP.16' },
  'Vizcaya': { id: 'ESP.16.3', region: 'País Vasco', regionId: 'ESP.16' }
};

async function updateVoteLocations() {
  
  try {
    // Obtener todos los votos de España
    const votes = await prisma.vote.findMany({
      where: {
        countryIso3: 'ESP'
      }
    });

    
    if (votes.length === 0) {
            return;
    }

    const provinceNames = Object.keys(SPAIN_PROVINCES);
    let updatedCount = 0;

    for (const vote of votes) {
      // Seleccionar una provincia aleatoria
      const randomProvince = provinceNames[Math.floor(Math.random() * provinceNames.length)];
      const provinceData = SPAIN_PROVINCES[randomProvince as keyof typeof SPAIN_PROVINCES];

      // Actualizar el voto con el ID más granular (provincia)
      await prisma.vote.update({
        where: { id: vote.id },
        data: {
          subdivisionId: provinceData.id,        // ID_2: "ESP.1.1"
          subdivisionName: provinceData.region,  // "Andalucía"
          cityName: randomProvince               // "Sevilla"
        }
      });

      updatedCount++;
          }

    
    // Mostrar resumen por región
        const summary = await prisma.vote.groupBy({
      by: ['subdivisionName'],
      where: {
        countryIso3: 'ESP',
        subdivisionName: { not: null }
      },
      _count: true
    });

    summary.forEach(item => {
          });

    // Mostrar resumen por provincia (cityName)
        const citySummary = await prisma.vote.groupBy({
      by: ['cityName'],
      where: {
        countryIso3: 'ESP',
        cityName: { not: null }
      },
      _count: true
    });

    citySummary.slice(0, 10).forEach(item => {
      const provinceData = SPAIN_PROVINCES[item.cityName as keyof typeof SPAIN_PROVINCES];
          });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
updateVoteLocations();
