import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Coordenadas correctas de centroides de países (lat, lon)
const countryCoordinates = {
  'ESP': { lat: 40.4168, lon: -3.7038, name: 'España' },
  'FRA': { lat: 46.2276, lon: 2.2137, name: 'Francia' },
  'DEU': { lat: 51.1657, lon: 10.4515, name: 'Alemania' },
  'ITA': { lat: 41.8719, lon: 12.5674, name: 'Italia' },
  'GBR': { lat: 55.3781, lon: -3.4360, name: 'Reino Unido' },
  'USA': { lat: 37.0902, lon: -95.7129, name: 'Estados Unidos' },
  'MEX': { lat: 23.6345, lon: -102.5528, name: 'México' },
  'ARG': { lat: -38.4161, lon: -63.6167, name: 'Argentina' },
  'BRA': { lat: -14.2350, lon: -51.9253, name: 'Brasil' },
  'CAN': { lat: 56.1304, lon: -106.3468, name: 'Canadá' },
  'CHN': { lat: 35.8617, lon: 104.1954, name: 'China' },
  'JPN': { lat: 36.2048, lon: 138.2529, name: 'Japón' },
  'IND': { lat: 20.5937, lon: 78.9629, name: 'India' },
  'RUS': { lat: 61.5240, lon: 105.3188, name: 'Rusia' },
  'AUS': { lat: -25.2744, lon: 133.7751, name: 'Australia' },
  'PRT': { lat: 39.3999, lon: -8.2245, name: 'Portugal' },
  'NLD': { lat: 52.1326, lon: 5.2913, name: 'Países Bajos' },
  'BEL': { lat: 50.5039, lon: 4.4699, name: 'Bélgica' },
  'POL': { lat: 51.9194, lon: 19.1451, name: 'Polonia' },
  'SWE': { lat: 60.1282, lon: 18.6435, name: 'Suecia' },
  'NOR': { lat: 60.4720, lon: 8.4689, name: 'Noruega' },
  'DNK': { lat: 56.2639, lon: 9.5018, name: 'Dinamarca' },
  'FIN': { lat: 61.9241, lon: 25.7482, name: 'Finlandia' },
  'CHE': { lat: 46.8182, lon: 8.2275, name: 'Suiza' },
  'AUT': { lat: 47.5162, lon: 14.5501, name: 'Austria' },
  'GRC': { lat: 39.0742, lon: 21.8243, name: 'Grecia' },
  'CZE': { lat: 49.8175, lon: 15.4730, name: 'República Checa' },
  'HUN': { lat: 47.1625, lon: 19.5033, name: 'Hungría' },
  'ROU': { lat: 45.9432, lon: 24.9668, name: 'Rumanía' },
  'TUR': { lat: 38.9637, lon: 35.2433, name: 'Turquía' },
};

async function fixCoordinates() {
  console.log('🔧 Corrigiendo coordenadas de países...\n');
  
  let fixed = 0;
  let notFound = 0;
  
  for (const [iso3, coords] of Object.entries(countryCoordinates)) {
    try {
      const country = await prisma.country.findUnique({
        where: { iso3 }
      });
      
      if (!country) {
        console.log(`❌ ${iso3} no encontrado en BD`);
        notFound++;
        continue;
      }
      
      await prisma.country.update({
        where: { iso3 },
        data: {
          latitude: coords.lat,
          longitude: coords.lon,
          name: coords.name
        }
      });
      
      console.log(`✅ ${iso3} (${coords.name}): ${coords.lat}, ${coords.lon}`);
      fixed++;
    } catch (error) {
      console.error(`❌ Error con ${iso3}:`, error.message);
    }
  }
  
  console.log(`\n📊 Resumen:`);
  console.log(`   ✅ Corregidos: ${fixed}`);
  console.log(`   ❌ No encontrados: ${notFound}`);
  
  await prisma.$disconnect();
}

fixCoordinates();
