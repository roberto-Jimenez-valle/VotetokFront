import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { topology } from 'topojson-server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Leer el archivo GeoJSON
const inputPath = path.join(__dirname, '..', 'static', 'geojson', 'ARG', 'ARG.5.topojson');
const outputPath = inputPath; // Sobrescribir el mismo archivo

console.log('📖 Leyendo archivo GeoJSON:', inputPath);
const geojson = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

console.log('🔄 Convirtiendo GeoJSON a TopoJSON...');
console.log(`   Features encontrados: ${geojson.features.length}`);

// Convertir GeoJSON a TopoJSON
// La función topology() espera un objeto con nombres de capa
const topo = topology({ 
  comunas: geojson 
});

console.log('💾 Guardando archivo TopoJSON...');
// Minificar el JSON para que sea más compacto (como ARG.6.topojson)
fs.writeFileSync(outputPath, JSON.stringify(topo), 'utf-8');

console.log('✅ Conversión completada!');
console.log(`   Archivo: ${outputPath}`);
console.log(`   Tipo: ${topo.type}`);
console.log(`   Objetos: ${Object.keys(topo.objects).join(', ')}`);
console.log(`   Arcos: ${topo.arcs.length}`);
