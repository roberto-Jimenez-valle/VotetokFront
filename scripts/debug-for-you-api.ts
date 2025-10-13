/**
 * Script para debuggear el error en /api/polls/for-you
 */

async function debugAPI() {
  console.log('🔍 Debuggeando API /api/polls/for-you...\n');
  
  try {
    const response = await fetch('http://localhost:5173/api/polls/for-you?userId=1&limit=5');
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('\nRespuesta completa:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.meta?.details) {
      console.log('\n❌ ERROR DETECTADO:');
      console.log('Mensaje:', data.meta.details);
      if (data.meta.stack) {
        console.log('\nStack trace:');
        console.log(data.meta.stack);
      }
    }
  } catch (error) {
    console.log('❌ Error al hacer fetch:', error);
  }
}

debugAPI();
