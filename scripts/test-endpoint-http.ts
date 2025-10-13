/**
 * Prueba el endpoint de geocoding por HTTP
 */

async function testEndpoint() {
  console.log('🧪 Probando endpoint /api/geocode por HTTP...\n');

  const testCases = [
    { name: 'Madrid', lat: 40.4168, lon: -3.7038 },
    { name: 'Barcelona', lat: 41.3851, lon: 2.1734 },
  ];

  for (const test of testCases) {
    console.log(`📍 ${test.name} (${test.lat}, ${test.lon})`);
    
    try {
      const url = `http://localhost:5173/api/geocode?lat=${test.lat}&lon=${test.lon}`;
      console.log(`   URL: ${url}`);
      
      const response = await fetch(url);
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ Respuesta:', JSON.stringify(data, null, 2));
      } else {
        const error = await response.text();
        console.log('   ❌ Error:', error);
      }
    } catch (error) {
      console.error('   ❌ Error de red:', error.message);
    }
    console.log();
  }
}

testEndpoint();
