import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapeo de subdivisiones de España con sus IDs correctos del GeoJSON
// Los IDs son del formato "ESP.1", "ESP.2", etc. según el archivo ESP.topojson
const SPAIN_SUBDIVISIONS = {
  'Andalucía': { id: 'ESP.1', cities: ['Sevilla', 'Málaga', 'Granada', 'Córdoba', 'Jaén'] },
  'Aragón': { id: 'ESP.2', cities: ['Zaragoza', 'Huesca', 'Teruel'] },
  'Cantabria': { id: 'ESP.3', cities: ['Santander', 'Torrelavega'] },
  'Castilla-La Mancha': { id: 'ESP.4', cities: ['Toledo', 'Albacete', 'Ciudad Real'] },
  'Castilla y León': { id: 'ESP.5', cities: ['Valladolid', 'Burgos', 'Salamanca', 'León'] },
  'Cataluña': { id: 'ESP.6', cities: ['Barcelona', 'Tarragona', 'Girona', 'Lleida'] },
  'Ceuta y Melilla': { id: 'ESP.7', cities: ['Ceuta', 'Melilla'] },
  'Comunidad de Madrid': { id: 'ESP.8', cities: ['Madrid', 'Alcalá de Henares', 'Móstoles'] },
  'Comunidad Foral de Navarra': { id: 'ESP.9', cities: ['Pamplona', 'Tudela'] },
  'Comunidad Valenciana': { id: 'ESP.10', cities: ['Valencia', 'Alicante', 'Castellón'] },
  'Extremadura': { id: 'ESP.11', cities: ['Badajoz', 'Cáceres', 'Mérida'] },
  'Galicia': { id: 'ESP.12', cities: ['A Coruña', 'Vigo', 'Santiago de Compostela', 'Ourense'] },
  'Islas Baleares': { id: 'ESP.13', cities: ['Palma', 'Ibiza', 'Mahón'] },
  'Islas Canarias': { id: 'ESP.14', cities: ['Las Palmas', 'Santa Cruz de Tenerife', 'La Laguna'] },
  'La Rioja': { id: 'ESP.15', cities: ['Logroño', 'Calahorra'] },
  'País Vasco': { id: 'ESP.16', cities: ['Bilbao', 'Vitoria', 'San Sebastián'] },
  'Principado de Asturias': { id: 'ESP.17', cities: ['Oviedo', 'Gijón', 'Avilés'] }
};

async function updateVoteLocations() {
  
  try {
    // Obtener todos los votos de España para actualizar con IDs correctos
    const votes = await prisma.vote.findMany({
      where: {
        countryIso3: 'ESP',
        subdivisionName: { not: null }
      }
    });

    
    if (votes.length === 0) {
            return;
    }

    // Obtener todas las subdivisiones disponibles
    const subdivisionNames = Object.keys(SPAIN_SUBDIVISIONS);
    let updatedCount = 0;

    for (const vote of votes) {
      // Buscar la subdivisión correspondiente al nombre actual del voto
      let subdivisionData = null;
      let subdivisionName = vote.subdivisionName;
      
      // Buscar coincidencia exacta o parcial
      for (const [name, data] of Object.entries(SPAIN_SUBDIVISIONS)) {
        if (name === subdivisionName || 
            subdivisionName?.includes(name) || 
            name.includes(subdivisionName || '')) {
          subdivisionData = data;
          subdivisionName = name;
          break;
        }
      }
      
      // Si no se encuentra, asignar una aleatoria
      if (!subdivisionData) {
        subdivisionName = subdivisionNames[Math.floor(Math.random() * subdivisionNames.length)];
        subdivisionData = SPAIN_SUBDIVISIONS[subdivisionName as keyof typeof SPAIN_SUBDIVISIONS];
      }
      
      // Seleccionar una ciudad aleatoria de esa subdivisión si no tiene
      const cityName = vote.cityName || subdivisionData.cities[Math.floor(Math.random() * subdivisionData.cities.length)];

      // Actualizar el voto con el ID correcto
      await prisma.vote.update({
        where: { id: vote.id },
        data: {
          subdivisionId: subdivisionData.id,
          subdivisionName: subdivisionName,
          cityName: cityName
        }
      });

      updatedCount++;
          }

    
    // Mostrar resumen por subdivisión
        const summary = await prisma.vote.groupBy({
      by: ['subdivisionName'],
      where: {
        countryIso3: 'ESP',
        subdivisionName: { not: null }
      },
      _count: true
    });

    summary.forEach(item => {
      const subdivisionData = SPAIN_SUBDIVISIONS[item.subdivisionName as keyof typeof SPAIN_SUBDIVISIONS];
          });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
updateVoteLocations();
