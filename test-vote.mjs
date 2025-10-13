// Test de votación directa
// node test-vote.mjs

const API_URL = 'http://localhost:5173/api/polls';

console.log('🧪 Test de Votación\n');

// Primero obtener una encuesta para votar
console.log('1️⃣ Obteniendo encuesta...');
const trendingRes = await fetch(`${API_URL}/trending?limit=1`);
const { data: polls } = await trendingRes.json();

if (!polls || polls.length === 0) {
  console.error('❌ No hay encuestas disponibles');
  process.exit(1);
}

const poll = polls[0];
console.log(`✅ Encuesta encontrada: "${poll.title}" (ID: ${poll.id})`);
console.log(`   Opciones disponibles:`);
poll.options.forEach((opt, i) => {
  console.log(`   ${i + 1}. ${opt.optionLabel} (ID: ${opt.id}) - ${opt.voteCount} votos`);
});

// Votar por la primera opción
const optionToVote = poll.options[0];
console.log(`\n2️⃣ Votando por: "${optionToVote.optionLabel}"`);

try {
  const voteResponse = await fetch(`${API_URL}/${poll.id}/vote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      optionId: optionToVote.id,
      latitude: 40.4168,
      longitude: -3.7038,
      countryIso3: 'ESP',
      countryName: 'España',
      subdivisionId: null,
      subdivisionName: null,
      cityName: 'Madrid'
    })
  });

  if (voteResponse.ok) {
    const result = await voteResponse.json();
    console.log('✅ Voto registrado exitosamente!');
    console.log('   Detalles:', result);
    
    // Verificar que se incrementó
    console.log('\n3️⃣ Verificando incremento...');
    const checkRes = await fetch(`${API_URL}/trending?limit=1`);
    const { data: updatedPolls } = await checkRes.json();
    const updatedOption = updatedPolls[0].options.find(o => o.id === optionToVote.id);
    
    console.log(`   Votos antes: ${optionToVote.voteCount}`);
    console.log(`   Votos después: ${updatedOption.voteCount}`);
    
    if (updatedOption.voteCount > optionToVote.voteCount) {
      console.log('✅ ¡Contador incrementado correctamente!');
    } else {
      console.log('⚠️  El contador no cambió (puede ser caché)');
    }
  } else {
    const error = await voteResponse.json();
    console.error('❌ Error al votar:', voteResponse.status);
    console.error('   Mensaje:', error);
    
    if (voteResponse.status === 400 && error.message?.includes('Ya has votado')) {
      console.log('\n💡 Ya votaste en esta encuesta desde esta IP.');
      console.log('   Para probar de nuevo, usa una encuesta diferente o limpia la BD.');
    }
  }
} catch (error) {
  console.error('❌ Error de conexión:', error.message);
  console.log('\n💡 Asegúrate de que el servidor esté corriendo: npm run dev');
}
