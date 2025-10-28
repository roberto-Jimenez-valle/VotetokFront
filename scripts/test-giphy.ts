/**
 * Script de prueba para la API de Giphy
 * Ejemplo similar al código compartido por el usuario
 * 
 * Ejecutar: npx tsx scripts/test-giphy.ts
 */

// API Key pública de Giphy (beta/testing)
const API_KEY = "dc6zaTOxFJmzC";

/**
 * Obtener URL de un GIF por término
 */
async function giphyGifUrl(term: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.giphy.com/v1/gifs/translate?api_key=${API_KEY}&s=${encodeURIComponent(term)}&rating=g`
    );
    
    if (!res.ok) {
      console.error(`❌ Error ${res.status} para "${term}"`);
      return '';
    }
    
    const json = await res.json();
    const id = json?.data?.id;
    
    return id ? `https://media.giphy.com/media/${id}/giphy.gif` : '';
  } catch (error) {
    console.error(`❌ Error obteniendo "${term}":`, error);
    return '';
  }
}

/**
 * Test principal - obtener GIFs de comidas
 */
async function testGiphy() {
  console.log('🎬 Probando API de Giphy...\n');
  
  const comidas = [
    "pizza",
    "sushi",
    "tacos",
    "curry",
    "paella",
    "shawarma",
    "hamburguesa",
    "croissant",
    "tiramisu",
    "mochi",
    "churros",
    "baklava"
  ];
  
  console.log(`📋 Buscando GIFs para ${comidas.length} comidas:\n`);
  
  for (const comida of comidas) {
    const url = await giphyGifUrl(comida);
    
    if (url) {
      console.log(`✅ ${comida.padEnd(15)} → ${url}`);
    } else {
      console.log(`❌ ${comida.padEnd(15)} → No encontrado`);
    }
    
    // Delay para no saturar la API
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('\n✨ Test completado!');
}

/**
 * Test de búsqueda con múltiples resultados
 */
async function testSearch() {
  console.log('\n🔍 Probando búsqueda con múltiples resultados...\n');
  
  const searchTerm = "pizza";
  const limit = 5;
  
  const res = await fetch(
    `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${encodeURIComponent(searchTerm)}&limit=${limit}&rating=g`
  );
  
  if (!res.ok) {
    console.error('❌ Error en búsqueda');
    return;
  }
  
  const json = await res.json();
  const gifs = json.data || [];
  
  console.log(`📊 Encontrados ${gifs.length} GIFs para "${searchTerm}":\n`);
  
  gifs.forEach((gif: any, index: number) => {
    console.log(`${index + 1}. ${gif.title}`);
    console.log(`   ID: ${gif.id}`);
    console.log(`   URL: https://media.giphy.com/media/${gif.id}/giphy.gif`);
    console.log(`   Fixed Height: ${gif.images.fixed_height.url}`);
    console.log('');
  });
}

/**
 * Test de trending GIFs
 */
async function testTrending() {
  console.log('\n🔥 Probando GIFs trending...\n');
  
  const limit = 5;
  
  const res = await fetch(
    `https://api.giphy.com/v1/gifs/trending?api_key=${API_KEY}&limit=${limit}&rating=g`
  );
  
  if (!res.ok) {
    console.error('❌ Error obteniendo trending');
    return;
  }
  
  const json = await res.json();
  const gifs = json.data || [];
  
  console.log(`🔥 Top ${gifs.length} GIFs trending:\n`);
  
  gifs.forEach((gif: any, index: number) => {
    console.log(`${index + 1}. ${gif.title}`);
    console.log(`   URL: https://media.giphy.com/media/${gif.id}/giphy.gif`);
    console.log('');
  });
}

// Ejecutar todos los tests
(async () => {
  try {
    await testGiphy();
    await testSearch();
    await testTrending();
  } catch (error) {
    console.error('❌ Error en tests:', error);
    process.exit(1);
  }
})();
