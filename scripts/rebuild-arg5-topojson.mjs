import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { topology } from 'topojson-server';
import { feature } from 'topojson-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Leer el archivo TopoJSON actual
const inputPath = path.join(__dirname, '..', 'static', 'geojson', 'ARG', 'ARG.5.topojson');
const outputPath = inputPath;

console.log('📖 Leyendo archivo TopoJSON:', inputPath);
const topoData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

// Convertir TopoJSON a GeoJSON
console.log('🔄 Convirtiendo TopoJSON a GeoJSON...');
const firstKey = Object.keys(topoData.objects)[0];
const geojson = feature(topoData, topoData.objects[firstKey]);

console.log(`   Features encontrados: ${geojson.features.length}`);

// Transformar propiedades: cambiar ID_2 para que coincida con los votos
console.log('🔄 Transformando propiedades...');
geojson.features = geojson.features.map((feat, index) => {
  const oldProps = feat.properties;
  const oldId2 = oldProps.ID_2;
  
  // ID_2 actualmente es solo el número (ej: "6")
  // Lo transformamos a ARG.5.6 para que coincida con la BD
  const newId2 = `ARG.5.${oldId2}`;
  
  const newProperties = {
    ID_1: "ARG.5",
    ID_2: newId2,
    NAME_1: oldProps.NAME_1 || "Ciudad Autónoma de Buenos Aires",
    NAME_2: oldProps.NAME_2 || `Comuna ${oldId2}`,
    VARNAME_2: oldProps.VARNAME_2,
    TYPE_2: oldProps.TYPE_2 || "Comuna",
    ENGTYPE_2: oldProps.ENGTYPE_2 || "Commune"
  };
  
  console.log(`  ✅ ${oldProps.NAME_2} → ID_2: ${newId2}`);
  
  return {
    ...feat,
    properties: newProperties
  };
});

// Convertir de vuelta a TopoJSON
console.log('🔄 Convirtiendo a TopoJSON...');
const newTopo = topology({ 
  comunas: geojson 
});

// Guardar
console.log('💾 Guardando archivo...');
fs.writeFileSync(outputPath, JSON.stringify(newTopo), 'utf-8');

console.log('✅ Transformación completada!');
console.log(`   Archivo: ${outputPath}`);
console.log(`   Features: ${geojson.features.length}`);
console.log(`   Arcos: ${newTopo.arcs.length}`);
