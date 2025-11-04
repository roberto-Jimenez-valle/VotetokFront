import fs from 'fs';
import * as topojson from 'topojson-client';

const data = JSON.parse(fs.readFileSync('static/geojson/UKR/UKR.topojson', 'utf8'));
const geojson = topojson.feature(data, data.objects.UKR);

console.log('=== Análisis de fragmentos en UKR.topojson ===\n');
console.log('Total features:', geojson.features.length);

let totalPolygons = 0;
let smallPolygons = 0;

for (const feature of geojson.features) {
  const props = feature.properties;
  const geom = feature.geometry;
  
  console.log(`\n${props.GID_1} - ${props.NAME_1}:`);
  
  if (geom.type === 'MultiPolygon') {
    console.log(`  Tipo: MultiPolygon con ${geom.coordinates.length} partes`);
    totalPolygons += geom.coordinates.length;
    
    // Contar polígonos muy pequeños (probablemente fragmentos)
    let small = 0;
    for (const poly of geom.coordinates) {
      const coords = poly[0]; // Primer ring
      if (coords.length < 10) {
        small++;
        smallPolygons++;
      }
    }
    
    if (small > 0) {
      console.log(`  ⚠️ Tiene ${small} fragmentos pequeños (< 10 puntos)`);
    }
  } else if (geom.type === 'Polygon') {
    console.log(`  Tipo: Polygon simple`);
    totalPolygons++;
  }
}

console.log('\n📊 RESUMEN:');
console.log('Total de polígonos/partes:', totalPolygons);
console.log('Fragmentos pequeños detectados:', smallPolygons);

if (smallPolygons > 0) {
  console.log('\n🔥 PROBLEMA: Hay fragmentos pequeños que se ven como rayas/puntitos');
  console.log('\n💡 SOLUCIÓN: Usa mapshaper con estos comandos:');
  console.log('1. Sube UKR.topojson a https://mapshaper.org');
  console.log('2. Ejecuta estos comandos en orden:');
  console.log('   -filter-slivers min-area=1km2');
  console.log('   -simplify 1% keep-shapes');
  console.log('   -clean');
  console.log('3. Exporta como TopoJSON');
}
