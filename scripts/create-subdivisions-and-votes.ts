import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Provincias de España (nivel 3)
const spanishProvinces = [
  { name: 'Madrid', gid: 'ESP.8.1', lat: 40.4168, lon: -3.7038 },
  { name: 'Barcelona', gid: 'ESP.5.1', lat: 41.3851, lon: 2.1734 },
  { name: 'Valencia', gid: 'ESP.17.1', lat: 39.4699, lon: -0.3763 },
  { name: 'Sevilla', gid: 'ESP.1.1', lat: 37.3891, lon: -5.9845 },
  { name: 'Málaga', gid: 'ESP.1.2', lat: 36.7213, lon: -4.4214 },
  { name: 'Cádiz', gid: 'ESP.1.3', lat: 36.5271, lon: -6.2886 },
  { name: 'Bilbao', gid: 'ESP.16.1', lat: 43.2630, lon: -2.9350 },
  { name: 'Zaragoza', gid: 'ESP.2.1', lat: 41.6488, lon: -0.8891 },
  { name: 'Granada', gid: 'ESP.1.4', lat: 37.1773, lon: -3.5986 },
  { name: 'Córdoba', gid: 'ESP.1.5', lat: 37.8882, lon: -4.7794 },
  { name: 'Alicante', gid: 'ESP.17.2', lat: 38.3452, lon: -0.4810 },
  { name: 'Murcia', gid: 'ESP.11.1', lat: 37.9922, lon: -1.1307 },
  { name: 'Palma de Mallorca', gid: 'ESP.4.1', lat: 39.5696, lon: 2.6502 },
  { name: 'Las Palmas', gid: 'ESP.6.1', lat: 28.1235, lon: -15.4363 },
  { name: 'Santa Cruz de Tenerife', gid: 'ESP.6.2', lat: 28.4636, lon: -16.2518 },
];

// Algunas ciudades de otros países
const otherCities = [
  { name: 'Paris', gid: 'FRA.7.1', countryIso: 'FRA', lat: 48.8566, lon: 2.3522 },
  { name: 'London', gid: 'GBR.1.1', countryIso: 'GBR', lat: 51.5074, lon: -0.1278 },
  { name: 'Berlin', gid: 'DEU.3.1', countryIso: 'DEU', lat: 52.5200, lon: 13.4050 },
  { name: 'Rome', gid: 'ITA.7.1', countryIso: 'ITA', lat: 41.9028, lon: 12.4964 },
  { name: 'New York', gid: 'USA.33.1', countryIso: 'USA', lat: 40.7128, lon: -74.0060 },
  { name: 'Los Angeles', gid: 'USA.5.1', countryIso: 'USA', lat: 34.0522, lon: -118.2437 },
  { name: 'Mexico City', gid: 'MEX.9.1', countryIso: 'MEX', lat: 19.4326, lon: -99.1332 },
  { name: 'Buenos Aires', gid: 'ARG.1.1', countryIso: 'ARG', lat: -34.6037, lon: -58.3816 },
  { name: 'São Paulo', gid: 'BRA.25.1', countryIso: 'BRA', lat: -23.5505, lon: -46.6333 },
  { name: 'Tokyo', gid: 'JPN.13.1', countryIso: 'JPN', lat: 35.6762, lon: 139.6503 },
];

async function main() {
  console.log('🚀 Creando subdivisiones y votos...');

  // Crear subdivisiones españolas (nivel 3)
  const createdSubdivisions: number[] = [];
  
  for (const province of spanishProvinces) {
    const sub = await prisma.subdivision.upsert({
      where: { subdivisionId: province.gid },
      update: {},
      create: {
        subdivisionId: province.gid,
        name: province.name,
        countryCode: 'ESP',
        level: 3,
        latitude: province.lat,
        longitude: province.lon,
        isLowestLevel: true,
      }
    });
    createdSubdivisions.push(sub.id);
    console.log(`✅ ${province.name} (ESP)`);
  }

  // Crear subdivisiones de otros países
  for (const city of otherCities) {
    const sub = await prisma.subdivision.upsert({
      where: { subdivisionId: city.gid },
      update: {},
      create: {
        subdivisionId: city.gid,
        name: city.name,
        countryCode: city.countryIso,
        level: 3,
        latitude: city.lat,
        longitude: city.lon,
        isLowestLevel: true,
      }
    });
    createdSubdivisions.push(sub.id);
    console.log(`✅ ${city.name} (${city.countryIso})`);
  }

  console.log(`\n🌍 ${createdSubdivisions.length} subdivisiones creadas`);

  // Obtener todas las encuestas
  const polls = await prisma.poll.findMany({
    include: { options: true }
  });
  console.log(`📊 ${polls.length} encuestas encontradas`);

  // Obtener subdivisiones
  const subdivisions = await prisma.subdivision.findMany({
    where: { level: 3 }
  });

  // Crear usuarios ficticios
  const fakeUsers: number[] = [];
  for (let i = 1; i <= 50; i++) {
    const user = await prisma.user.upsert({
      where: { email: `fake${i}@votetok.com` },
      update: {},
      create: {
        email: `fake${i}@votetok.com`,
        username: `user${i}`,
        displayName: `Usuario ${i}`,
      }
    });
    fakeUsers.push(user.id);
  }
  console.log(`👥 ${fakeUsers.length} usuarios`);

  let totalVotes = 0;

  // Agregar votos a cada encuesta
  for (const poll of polls) {
    if (poll.options.length === 0) continue;

    const numVotes = Math.floor(Math.random() * 80) + 30; // 30-110 votos

    for (let i = 0; i < numVotes; i++) {
      const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)];
      const randomUser = fakeUsers[Math.floor(Math.random() * fakeUsers.length)];
      const randomSubdivision = subdivisions[Math.floor(Math.random() * subdivisions.length)];

      try {
        const existingVote = await prisma.vote.findFirst({
          where: { pollId: poll.id, userId: randomUser }
        });

        if (!existingVote) {
          await prisma.vote.create({
            data: {
              pollId: poll.id,
              optionId: randomOption.id,
              userId: randomUser,
              subdivisionId: randomSubdivision.id,
              latitude: randomSubdivision.latitude,
              longitude: randomSubdivision.longitude,
              createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
            }
          });
          totalVotes++;
        }
      } catch (e) {
        // Ignorar duplicados
      }
    }
    console.log(`✅ "${poll.title.substring(0, 35)}..." - votos agregados`);
  }

  console.log(`\n🎉 Total: ${totalVotes} votos agregados`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
