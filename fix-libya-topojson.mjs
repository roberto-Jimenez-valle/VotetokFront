import fs from 'fs';

const file = 'static/geojson/LBY/LBY.topojson';

console.log('📖 Leyendo archivo:', file);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const objects = data.objects || {};
const firstKey = Object.keys(objects)[0];

if (!firstKey) {
  console.error('❌ No se encontraron objects en el TopoJSON');
  process.exit(1);
}

const geometries = objects[firstKey].geometries || [];
console.log(`📦 Procesando ${geometries.length} geometrías...`);

let converted = 0;

geometries.forEach((geom, index) => {
  const props = geom.properties || {};
  
  // Convertir formato shapeISO/shapeName a ID_1/NAME_1
  if (props.shapeISO || props.shapeName) {
    // Crear nuevas propiedades en formato estándar
    geom.properties = {
      ID_1: props.shapeISO || props.shapeID || `LBY.${index + 1}`,
      NAME_1: props.shapeName || props.shapeISO || `Region ${index + 1}`,
      // Mantener las originales por si acaso
      _originalShapeISO: props.shapeISO,
      _originalShapeName: props.shapeName,
      _originalShapeID: props.shapeID,
      shapeGroup: props.shapeGroup,
      shapeType: props.shapeType
    };
    converted++;
  }
});

console.log(`✅ Convertidas ${converted} geometrías`);

// Guardar archivo actualizado
fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
console.log(`💾 Archivo guardado: ${file}`);

// Verificar resultado
const verification = JSON.parse(fs.readFileSync(file, 'utf8'));
const verifyGeom = verification.objects[firstKey].geometries[0];
console.log('\n🔍 Verificación - Primera geometría:');
console.log('  ID_1:', verifyGeom.properties.ID_1);
console.log('  NAME_1:', verifyGeom.properties.NAME_1);
console.log('\n✅ TopoJSON de Libia actualizado correctamente');
