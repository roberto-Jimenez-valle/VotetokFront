// Test del endpoint de geocoding
const testGeocode = async () => {
  console.log('🧪 Testeando endpoint de geocoding...\n');
  
  // Coordenadas de Madrid (las mismas que se usan en los votos)
  const lat = 40.4168;
  const lon = -3.7038;
  
  console.log(`📍 Buscando: lat=${lat}, lon=${lon} (Madrid, España)\n`);
  
  try {
    const url = `http://localhost:5173/api/geocode?lat=${lat}&lon=${lon}`;
    console.log(`🌐 URL: ${url}\n`);
    
    const response = await fetch(url);
    
    console.log(`📨 Status: ${response.status} ${response.statusText}\n`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Respuesta del geocoding:');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.found) {
        console.log('\n✅ ÉXITO:');
        console.log(`   País: ${data.countryName} (${data.countryIso3})`);
        console.log(`   Subdivisión: ${data.subdivisionName || 'N/A'}`);
        console.log(`   Subdivisión ID: ${data.subdivisionId || 'NULL'}`);
        
        if (data.subdivisionId) {
          console.log('\n🎉 El geocoding funciona correctamente!');
        } else {
          console.log('\n⚠️ El geocoding no encontró subdivisionId');
        }
      } else {
        console.log('\n❌ El geocoding no encontró nada (found: false)');
      }
    } else {
      const error = await response.text();
      console.log('❌ Error:', error);
    }
  } catch (error) {
    console.log('❌ Error de red:', error.message);
    console.log('\n💡 ¿Está corriendo el servidor? (npm run dev)');
  }
};

testGeocode();
