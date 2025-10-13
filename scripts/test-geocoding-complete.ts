/**
 * Prueba completa del sistema de geocoding con tablas maestras
 */

async function testGeocoding() {
  console.log('🧪 Probando sistema de geocoding completo\n');
  console.log('═'.repeat(60));

  // Coordenadas de prueba
  const testLocations = [
    { name: 'Madrid, España', lat: 40.4168, lon: -3.7038 },
    { name: 'Barcelona, España', lat: 41.3851, lon: 2.1734 },
    { name: 'Sevilla, España', lat: 37.3891, lon: -5.9845 },
    { name: 'Nueva York, USA', lat: 40.7128, lon: -74.0060 },
    { name: 'Los Ángeles, USA', lat: 34.0522, lon: -118.2437 },
    { name: 'París, Francia', lat: 48.8566, lon: 2.3522 },
    { name: 'Berlín, Alemania', lat: 52.5200, lon: 13.4050 },
    { name: 'Tokio, Japón', lat: 35.6762, lon: 139.6503 },
  ];

  for (const location of testLocations) {
    console.log(`\n📍 ${location.name} (${location.lat}, ${location.lon})`);
    
    try {
      const response = await fetch(
        `http://localhost:5173/api/geocode?lat=${location.lat}&lon=${location.lon}`
      );

      if (!response.ok) {
        console.error(`  ❌ Error HTTP: ${response.status}`);
        continue;
      }

      const result = await response.json();

      if (result.found) {
        console.log(`  ✅ País: ${result.countryName} (${result.countryIso3})`);
        console.log(`  ✅ Subdivisión: ${result.subdivisionName}`);
        console.log(`  ✅ ID: ${result.subdivisionId}`);
      } else {
        console.log(`  ⚠️  No se encontró ubicación`);
      }
    } catch (error) {
      console.error(`  ❌ Error:`, error.message);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Prueba completada');
}

testGeocoding();
