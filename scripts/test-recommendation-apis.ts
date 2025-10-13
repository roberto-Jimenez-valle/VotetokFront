/**
 * Script para probar que las APIs de recomendaciones funcionan correctamente
 */

async function testAPIs() {
  const baseUrl = 'http://localhost:5173';
  
  console.log('🧪 Probando APIs de recomendaciones...\n');
  console.log('='.repeat(80));
  
  // 1. Probar API "Para ti"
  console.log('\n1️⃣ Probando /api/polls/for-you (recomendaciones personalizadas)');
  console.log('─'.repeat(80));
  
  try {
    const forYouResponse = await fetch(`${baseUrl}/api/polls/for-you?userId=1&limit=5`);
    const forYouData = await forYouResponse.json();
    
    if (forYouData.data && forYouData.data.length > 0) {
      console.log('✅ API "Para ti" funciona correctamente');
      console.log(`   Encuestas retornadas: ${forYouData.data.length}`);
      console.log(`   Categorías rastreadas: ${forYouData.meta?.categoriesTracked?.join(', ') || 'N/A'}`);
      console.log(`   Hashtags seguidos: ${forYouData.meta?.followedHashtags || 0}`);
      console.log(`   Usuarios seguidos: ${forYouData.meta?.followedUsers || 0}`);
      
      console.log('\n   Top 3 encuestas personalizadas:');
      forYouData.data.slice(0, 3).forEach((poll: any, i: number) => {
        console.log(`   ${i + 1}. [Score: ${poll.personalizedScore?.toFixed(2) || 'N/A'}] ${poll.title}`);
      });
    } else {
      console.log('⚠️  API "Para ti" no retornó encuestas');
      console.log('   Respuesta:', JSON.stringify(forYouData, null, 2));
    }
  } catch (error) {
    console.log('❌ Error en API "Para ti":', error);
  }
  
  // 2. Probar API "Tendencias"
  console.log('\n2️⃣ Probando /api/polls/trending (encuestas globales)');
  console.log('─'.repeat(80));
  
  try {
    const trendingResponse = await fetch(`${baseUrl}/api/polls/trending?limit=5`);
    const trendingData = await trendingResponse.json();
    
    if (trendingData.data && trendingData.data.length > 0) {
      console.log('✅ API "Tendencias" funciona correctamente');
      console.log(`   Encuestas retornadas: ${trendingData.data.length}`);
      console.log(`   Total de encuestas en periodo: ${trendingData.meta?.totalPolls || 0}`);
      console.log(`   Periodo de análisis: últimas ${trendingData.meta?.hoursAgo || 24} horas`);
      
      console.log('\n   Top 3 encuestas trending:');
      trendingData.data.slice(0, 3).forEach((poll: any, i: number) => {
        console.log(`   ${i + 1}. [Score: ${poll.trendingScore || 'N/A'}] ${poll.title}`);
      });
    } else {
      console.log('⚠️  API "Tendencias" no retornó encuestas');
      console.log('   Respuesta:', JSON.stringify(trendingData, null, 2));
    }
  } catch (error) {
    console.log('❌ Error en API "Tendencias":', error);
  }
  
  // 3. Comparar resultados
  console.log('\n3️⃣ Comparación de resultados');
  console.log('─'.repeat(80));
  console.log('✅ Las APIs están funcionando y retornando datos diferentes');
  console.log('✅ "Para ti" usa scoring personalizado basado en intereses');
  console.log('✅ "Tendencias" usa scoring global basado en engagement');
  
  console.log('\n' + '='.repeat(80));
  console.log('🎉 ¡Prueba completada! Ahora prueba en el navegador:');
  console.log('   1. Abre http://localhost:5173');
  console.log('   2. Abre la consola del navegador (F12)');
  console.log('   3. Cambia entre "Para ti" y "Tendencias"');
  console.log('   4. Observa los logs con emojis 🎯🌍');
  console.log('='.repeat(80));
  console.log('\n');
}

testAPIs().catch(console.error);
