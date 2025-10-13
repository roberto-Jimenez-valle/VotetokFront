async function testForYou() {
  console.log('🧪 Probando API "Para ti" con usuario ID: 15\n');
  
  const response = await fetch('http://localhost:5173/api/polls/for-you?userId=15&limit=5');
  const data = await response.json();
  
  console.log('Status:', response.status);
  console.log('\n📊 Encuestas personalizadas:');
  
  if (data.data && data.data.length > 0) {
    console.log(`✅ ${data.data.length} encuestas retornadas\n`);
    
    data.data.forEach((poll: any, i: number) => {
      console.log(`${i + 1}. [Score: ${poll.personalizedScore?.toFixed(2)}] ${poll.title}`);
      console.log(`   Categoría: ${poll.category || 'N/A'}`);
      console.log(`   Votos totales: ${poll.totalVotes || 0}`);
      console.log('');
    });
    
    console.log('📈 Metadata:');
    console.log(`   Usuario ID: ${data.meta.userId}`);
    console.log(`   Categorías rastreadas: ${data.meta.categoriesTracked?.join(', ')}`);
    console.log(`   Hashtags seguidos: ${data.meta.followedHashtags}`);
    console.log(`   Usuarios seguidos: ${data.meta.followedUsers}`);
  } else {
    console.log('⚠️ No se retornaron encuestas');
    console.log('Respuesta:', JSON.stringify(data, null, 2));
  }
}

testForYou().catch(console.error);
