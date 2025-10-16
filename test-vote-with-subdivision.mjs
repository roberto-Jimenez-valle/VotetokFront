// Test completo de votación con subdivisionId

const testVote = async () => {
  console.log('🧪 Test de votación CON subdivisionId...\n');
  
  const voteData = {
    optionId: 1, // Primera opción de la encuesta #1
    userId: 1,   // Usuario maria_gonzalez
    latitude: 40.4168,
    longitude: -3.7038,
    countryIso3: 'ESP',
    countryName: 'España',
    subdivisionId: 'ESP.11', // ✅ CON subdivisionId
    subdivisionName: 'ESP 11',
    cityName: 'Madrid'
  };
  
  console.log('📦 Datos a enviar:');
  console.log(JSON.stringify(voteData, null, 2));
  console.log('');
  
  try {
    const response = await fetch('http://localhost:5173/api/polls/1/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(voteData)
    });
    
    console.log(`📨 Status: ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('\n✅ Respuesta:');
      console.log(JSON.stringify(result, null, 2));
      
      console.log('\n🔍 Verificando en BD...');
      
      // Importar Prisma para verificar
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const savedVote = await prisma.vote.findUnique({
        where: { id: result.vote.id }
      });
      
      console.log('\n📊 Voto guardado en BD:');
      console.log(`   ID: ${savedVote.id}`);
      console.log(`   País: ${savedVote.countryName} (${savedVote.countryIso3})`);
      console.log(`   Subdivisión: ${savedVote.subdivisionName || 'NULL'}`);
      console.log(`   subdivisionId: ${savedVote.subdivisionId || 'NULL'}`);
      
      if (savedVote.subdivisionId) {
        console.log('\n🎉 ¡ÉXITO! subdivisionId se guardó correctamente');
      } else {
        console.log('\n❌ ERROR: subdivisionId es NULL en la BD');
        console.log('   Aunque enviamos:', voteData.subdivisionId);
      }
      
      await prisma.$disconnect();
    } else {
      const error = await response.text();
      console.log('❌ Error:', error);
    }
  } catch (error) {
    console.log('❌ Error de red:', error.message);
  }
};

testVote();
