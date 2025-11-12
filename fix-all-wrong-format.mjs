import fs from 'fs';
import path from 'path';

const countriesWithIssues = ['MDA', 'MNE', 'TTO'];

function fixTopoJSON(filePath, countryCode) {
  console.log(`\n📖 Procesando ${countryCode}...`);
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const objects = data.objects || {};
  const firstKey = Object.keys(objects)[0];
  const geometries = objects[firstKey].geometries || [];
  
  console.log(`   📦 ${geometries.length} geometrías encontradas`);
  
  let converted = 0;
  
  geometries.forEach((geom, index) => {
    const props = geom.properties || {};
    
    // Convertir formato shapeISO/shapeName a ID_1/NAME_1
    if (props.shapeISO || props.shapeName) {
      const newId = `${countryCode}.${index + 1}`;
      
      geom.properties = {
        ID_1: newId,
        NAME_1: props.shapeName || props.shapeISO || `Region ${index + 1}`,
        // Mantener las originales como backup
        _originalShapeISO: props.shapeISO,
        _originalShapeName: props.shapeName,
        _originalShapeID: props.shapeID,
        shapeGroup: props.shapeGroup,
        shapeType: props.shapeType
      };
      
      console.log(`   ${props.shapeISO || props.shapeName} → ${newId}`);
      converted++;
    }
  });
  
  console.log(`   ✅ ${converted} geometrías convertidas`);
  
  // Guardar
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`   💾 Guardado: ${filePath}`);
  
  // Verificar
  const verification = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const verifyGeom = verification.objects[firstKey].geometries[0];
  console.log(`   🔍 Verificación:`);
  console.log(`      ID_1: ${verifyGeom.properties.ID_1}`);
  console.log(`      NAME_1: ${verifyGeom.properties.NAME_1}`);
}

console.log('═══════════════════════════════════════════════════════');
console.log('🔧 ARREGLANDO TOPOJSON CON FORMATO INCORRECTO');
console.log('═══════════════════════════════════════════════════════');

for (const country of countriesWithIssues) {
  const filePath = path.join('static', 'geojson', country, `${country}.topojson`);
  
  if (fs.existsSync(filePath)) {
    fixTopoJSON(filePath, country);
  } else {
    console.log(`\n⚠️  Archivo no encontrado: ${filePath}`);
  }
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('✅ PROCESO COMPLETADO');
console.log('═══════════════════════════════════════════════════════');
console.log('\n💡 Ahora recarga la página para ver los cambios');
