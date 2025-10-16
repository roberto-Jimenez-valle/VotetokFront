// Script para probar qué devuelve la API de IP geolocation

async function testIPGeo() {
  console.log('\n🌐 Probando IP Geolocation API...\n');
  
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    
    console.log('📍 Ubicación detectada:');
    console.log('  IP:', data.ip);
    console.log('  Ciudad:', data.city);
    console.log('  Región:', data.region);
    console.log('  País:', data.country_name, `(${data.country})`);
    console.log('  Coordenadas:', data.latitude, ',', data.longitude);
    console.log('  ISP:', data.org);
    console.log('\n');
    
    // Probar geocoding con esas coordenadas
    console.log('🗺️  Probando geocoding con esas coordenadas...\n');
    
    const geocodeUrl = `http://localhost:5173/api/geocode?lat=${data.latitude}&lon=${data.longitude}`;
    console.log('URL:', geocodeUrl);
    
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();
    
    console.log('Resultado geocoding:');
    console.log(JSON.stringify(geocodeData, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testIPGeo();
