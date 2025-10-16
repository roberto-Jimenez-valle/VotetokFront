import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixLevel2Coords() {
  console.log('\n🔧 Actualizando coordenadas de comunidades autónomas (nivel 2)...\n');
  
  // Centroides geográficos reales de comunidades autónomas (no capitales)
  const communityCoords: Record<string, { lat: number; lon: number; name?: string }> = {
    'ESP.1': { lat: 37.5000, lon: -4.5000 },     // Andalucía (centroide geográfico)
    'ESP.2': { lat: 41.5000, lon: -1.0000 },     // Aragón
    'ESP.3': { lat: 43.3000, lon: -5.7000 },     // Asturias
    'ESP.4': { lat: 39.5000, lon: -3.0000 },     // Castilla-La Mancha (centroide real)
    'ESP.5': { lat: 42.0000, lon: -5.0000 },     // Castilla y León
    'ESP.6': { lat: 41.8000, lon: 1.5000 },      // Cataluña
    'ESP.7': { lat: 39.5696, lon: 2.6502 },      // Islas Baleares
    'ESP.8': { lat: 43.1828, lon: -3.9878 },     // Cantabria
    'ESP.9': { lat: 42.8000, lon: -1.6500 },     // Navarra
    'ESP.10': { lat: 39.5000, lon: -0.7000 },    // Comunidad Valenciana
    'ESP.11': { lat: 39.5000, lon: -6.0000 },    // Extremadura
    'ESP.12': { lat: 42.7500, lon: -8.0000 },    // Galicia
    'ESP.13': { lat: 40.5000, lon: -3.6000 },    // Madrid (centroide región, NO capital)
    'ESP.14': { lat: 28.5000, lon: -15.5000 },   // Canarias
    'ESP.15': { lat: 38.0000, lon: -1.5000 },    // Murcia
    'ESP.16': { lat: 43.0000, lon: -2.7000 },    // País Vasco
    'ESP.17': { lat: 42.4000, lon: -2.5000 },    // La Rioja
  };
  
  let updated = 0;
  
  for (const [subdivisionId, coords] of Object.entries(communityCoords)) {
    const subdivision = await prisma.subdivision.findFirst({
      where: {
        subdivisionId,
        level: 2
      }
    });
    
    if (subdivision) {
      await prisma.subdivision.update({
        where: { id: subdivision.id },
        data: {
          latitude: coords.lat,
          longitude: coords.lon
        }
      });
      
      console.log(`✅ ${subdivision.name} (${subdivisionId}): ${coords.lat}, ${coords.lon}`);
      updated++;
    }
  }
  
  console.log(`\n✅ Actualizadas ${updated} comunidades autónomas\n`);
  await prisma.$disconnect();
}

fixLevel2Coords().catch(console.error);
