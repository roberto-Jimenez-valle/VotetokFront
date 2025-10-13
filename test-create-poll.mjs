// Script de testing para crear encuesta via API
// Ejecutar con: node test-create-poll.mjs

const API_URL = 'http://localhost:5173/api/polls';

const testPollData = {
  title: "¿Cuál es tu lenguaje de programación favorito?",
  description: "Vota por tu lenguaje preferido para desarrollo web",
  category: "Tecnología",
  type: "single",
  duration: "7d",
  hashtags: ["programacion", "webdev", "tecnologia"],
  location: "España",
  options: [
    {
      optionKey: "1",
      optionLabel: "JavaScript",
      color: "#f59e0b",
      displayOrder: 0
    },
    {
      optionKey: "2",
      optionLabel: "TypeScript",
      color: "#3b82f6",
      displayOrder: 1
    },
    {
      optionKey: "3",
      optionLabel: "Python",
      color: "#10b981",
      displayOrder: 2
    },
    {
      optionKey: "4",
      optionLabel: "Rust",
      color: "#ef4444",
      displayOrder: 3
    }
  ],
  settings: {
    ratingIcon: null,
    ratingCount: null,
    collaborativePermission: null,
    specificFriend: null
  }
};

console.log('🧪 Testing API de creación de encuestas...\n');
console.log('📤 Datos a enviar:');
console.log(JSON.stringify(testPollData, null, 2));
console.log('\n🚀 Enviando solicitud POST...\n');

try {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testPollData)
  });

  console.log(`📥 Respuesta: ${response.status} ${response.statusText}\n`);

  if (response.ok) {
    const result = await response.json();
    console.log('✅ ¡Encuesta creada exitosamente!\n');
    console.log('📊 Datos de la encuesta:');
    console.log(`  ID: ${result.data.id}`);
    console.log(`  Título: ${result.data.title}`);
    console.log(`  Estado: ${result.data.status}`);
    console.log(`  Total votos: ${result.data.totalVotes}`);
    console.log(`  Creada: ${result.data.createdAt}`);
    console.log(`  Cierra: ${result.data.closedAt}`);
    console.log(`\n  Opciones (${result.data.options.length}):`);
    result.data.options.forEach(opt => {
      console.log(`    - ${opt.optionLabel} (${opt.color})`);
    });
    console.log(`\n  Usuario:`);
    console.log(`    - ${result.data.user.displayName} (@${result.data.user.username})`);
    console.log('\n✅ Todo funcionó correctamente!');
    console.log('\n💡 Abre http://localhost:5555 para ver en Prisma Studio');
  } else {
    const error = await response.json();
    console.error('❌ Error al crear la encuesta:');
    console.error(error);
  }
} catch (error) {
  console.error('❌ Error de conexión:');
  console.error(error.message);
  console.error('\n💡 Asegúrate de que el servidor esté corriendo: npm run dev');
}
