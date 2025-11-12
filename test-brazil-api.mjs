// Probar endpoint de votos por subdivisión para Brasil
// Simular lo que hace el frontend

const testPollId = 157; // Poll con más votos según el script anterior

const response = await fetch(`http://localhost:5173/api/polls/${testPollId}/votes-by-subdivisions?country=BRA`);

if (response.ok) {
  const data = await response.json();
  
  console.log('📊 Respuesta API para Brasil (Poll', testPollId, '):');
  console.log('Total de subdivisiones:', Object.keys(data.data || {}).length);
  
  const entries = Object.entries(data.data || {});
  
  if (entries.length > 0) {
    console.log('\n✅ Primeras 10 subdivisiones con datos:');
    entries.slice(0, 10).forEach(([id, votes]) => {
      const totalVotes = Object.values(votes).reduce((sum, v) => sum + v, 0);
      console.log(`  ${id.padEnd(10)} - ${totalVotes} votos total`);
    });
  } else {
    console.log('\n❌ NO HAY DATOS para Brasil en este poll');
  }
  
  // Verificar si hay datos de nivel 2 (estados: BRA.X)
  const level2Data = entries.filter(([id]) => {
    const parts = id.split('.');
    return parts.length === 2; // BRA.11 = nivel 2
  });
  
  console.log('\n📊 Datos de nivel 2 (estados):');
  console.log('Total estados con datos:', level2Data.length);
  
  if (level2Data.length > 0) {
    console.log('\n✅ Estados con votos:');
    level2Data.slice(0, 10).forEach(([id, votes]) => {
      const totalVotes = Object.values(votes).reduce((sum, v) => sum + v, 0);
      console.log(`  ${id.padEnd(10)} - ${totalVotes} votos`);
    });
  } else {
    console.log('❌ NO HAY datos en nivel 2 (problema de agregación)');
  }
  
} else {
  console.error('❌ Error:', response.status, response.statusText);
}
