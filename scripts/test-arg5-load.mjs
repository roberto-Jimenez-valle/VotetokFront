import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { feature } from 'topojson-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simular la carga como lo hace loadSubregionTopoAsGeoFeatures
async function testLoadSubregion(iso, id1) {
  const filePath = path.join(__dirname, '..', 'static', 'geojson', iso, `${id1}.topojson`);
  
  console.log(`\n📖 Probando carga de: ${iso}/${id1}.topojson`);
  console.log(`   Ruta completa: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ Archivo no existe!');
    return;
  }
  
  console.log('✅ Archivo existe');
  
  try {
    const topo = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`   Tipo: ${topo.type}`);
    console.log(`   Objetos: ${Object.keys(topo.objects).join(', ')}`);
    console.log(`   Arcos: ${topo.arcs.length}`);
    
    const objects = topo.objects || {};
    const firstKey = Object.keys(objects)[0];
    
    if (!firstKey) {
      console.error('❌ No se encontraron objetos en el TopoJSON');
      return;
    }
    
    const fc = feature(topo, objects[firstKey]);
    const feats = Array.isArray(fc?.features) ? fc.features : [];
    
    console.log(`   Features extraídos: ${feats.length}`);
    
    if (feats.length > 0) {
      console.log('\n✅ Primeros 3 features:');
      feats.slice(0, 3).forEach((f, i) => {
        const props = f.properties || {};
        console.log(`   ${i + 1}. ${props.NAME_2 || props.NAME_1 || 'Sin nombre'}`);
        console.log(`      GID: ${props.GID_2 || props.GID_1 || 'Sin GID'}`);
        console.log(`      ID_1: ${props.ID_1}, ID_2: ${props.ID_2}`);
      });
    }
    
    console.log('\n✅ ¡Carga exitosa!');
    
  } catch (error) {
    console.error('❌ Error al procesar el archivo:', error.message);
    console.error(error.stack);
  }
}

// Probar ARG.5 (Buenos Aires)
await testLoadSubregion('ARG', 'ARG.5');

// Probar ARG.6 (Catamarca) para comparar
await testLoadSubregion('ARG', 'ARG.6');
