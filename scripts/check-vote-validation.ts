/**
 * Script para validar que se envían todos los campos necesarios al votar
 */

console.log('📋 Campos requeridos en la tabla Vote:\n');

const requiredFields = {
  // Campos requeridos (NOT NULL)
  pollId: { type: 'Int', required: true, source: 'URL path' },
  optionId: { type: 'Int', required: true, source: 'body' },
  latitude: { type: 'Float', required: true, source: 'body' },
  longitude: { type: 'Float', required: true, source: 'body' },
  countryIso3: { type: 'String', required: true, source: 'body' },
  
  // Campos opcionales (nullable)
  userId: { type: 'Int?', required: false, source: 'body' },
  countryName: { type: 'String?', required: false, source: 'body' },
  subdivisionId: { type: 'String?', required: false, source: 'body' },
  subdivisionName: { type: 'String?', required: false, source: 'body' },
  cityName: { type: 'String?', required: false, source: 'body' },
  ipAddress: { type: 'String?', required: false, source: 'backend (getClientAddress)' },
  userAgent: { type: 'String?', required: false, source: 'backend (request.headers)' },
};

console.log('✅ CAMPOS REQUERIDOS (deben tener valor):');
Object.entries(requiredFields)
  .filter(([_, field]) => field.required)
  .forEach(([name, field]) => {
    console.log(`  - ${name}: ${field.type} (desde ${field.source})`);
  });

console.log('\n⚠️ CAMPOS OPCIONALES (pueden ser null):');
Object.entries(requiredFields)
  .filter(([_, field]) => !field.required)
  .forEach(([name, field]) => {
    console.log(`  - ${name}: ${field.type} (desde ${field.source})`);
  });

console.log('\n🔍 VERIFICACIÓN:\n');

// Simular datos que envía el frontend
const frontendData = {
  optionId: 61,
  userId: null, // Usuario no autenticado
  latitude: 40.4168,
  longitude: -3.7038,
  countryIso3: 'ESP',
  countryName: 'España',
  subdivisionId: 'ESP.1',
  subdivisionName: 'Andalucía',
  cityName: null
};

console.log('Datos que envía el frontend:', JSON.stringify(frontendData, null, 2));

// Validar campos requeridos
console.log('\n✅ Validación de campos requeridos:');
const missingRequired = [];

if (!frontendData.optionId) missingRequired.push('optionId');
if (frontendData.latitude === undefined || frontendData.latitude === null) missingRequired.push('latitude');
if (frontendData.longitude === undefined || frontendData.longitude === null) missingRequired.push('longitude');
if (!frontendData.countryIso3) missingRequired.push('countryIso3');

if (missingRequired.length > 0) {
  console.error('❌ Faltan campos requeridos:', missingRequired);
} else {
  console.log('✅ Todos los campos requeridos están presentes');
}

// Validar tipos
console.log('\n✅ Validación de tipos:');
const typeErrors = [];

if (typeof frontendData.optionId !== 'number') typeErrors.push('optionId debe ser number');
if (typeof frontendData.latitude !== 'number') typeErrors.push('latitude debe ser number');
if (typeof frontendData.longitude !== 'number') typeErrors.push('longitude debe ser number');
if (typeof frontendData.countryIso3 !== 'string') typeErrors.push('countryIso3 debe ser string');

if (typeErrors.length > 0) {
  console.error('❌ Errores de tipo:', typeErrors);
} else {
  console.log('✅ Todos los tipos son correctos');
}

console.log('\n💡 NOTAS IMPORTANTES:');
console.log('  1. latitude y longitude son REQUERIDOS - nunca deben ser null/undefined');
console.log('  2. Si no hay geolocalización, usar valores por defecto (ej: Madrid)');
console.log('  3. countryIso3 es REQUERIDO - debe tener al menos un valor por defecto');
console.log('  4. subdivisionId debe usar formato jerárquico (ej: ESP.1, ESP.5.2)');
