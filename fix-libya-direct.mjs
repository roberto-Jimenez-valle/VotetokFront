import fs from 'fs';

const file = 'static/geojson/LBY/LBY.topojson';

console.log('📖 Leyendo archivo:', file);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const objects = data.objects || {};
const firstKey = Object.keys(objects)[0];
const geometries = objects[firstKey].geometries || [];

console.log(`📦 Procesando ${geometries.length} geometrías...`);

geometries.forEach((geom, index) => {
  const sequentialId = `LBY.${index + 1}`;
  const oldId = geom.properties.ID_1;
  geom.properties.ID_1 = sequentialId;
  console.log(`  ${oldId} → ${sequentialId} (${geom.properties.NAME_1})`);
});

// Guardar
fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
console.log(`\n💾 Archivo guardado: ${file}`);

// Verificar
const verification = JSON.parse(fs.readFileSync(file, 'utf8'));
const verifyGeoms = verification.objects[firstKey].geometries;
console.log('\n🔍 Verificación - Primeros 5:');
verifyGeoms.slice(0, 5).forEach(g => {
  console.log(`  ${g.properties.ID_1} - ${g.properties.NAME_1}`);
});

console.log('\n✅ TopoJSON actualizado con IDs secuenciales');
