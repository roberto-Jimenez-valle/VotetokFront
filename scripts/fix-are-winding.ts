/**
 * Verificar y corregir orientación de polígonos de Emiratos Árabes
 */

import * as fs from 'fs';
import * as path from 'path';
import { feature } from 'topojson-client';
import { topology } from 'topojson-server';
import rewind from '@mapbox/geojson-rewind';

async function main() {
  console.log('🔧 Corrigiendo orientación de polígonos de ARE...\n');
  
  const areDir = path.join('static/geojson/ARE');
  
  if (!fs.existsSync(areDir)) {
    console.log('❌ Directorio no existe');
    return;
  }
  
  const files = fs.readdirSync(areDir).filter(f => 
    f.endsWith('.topojson') && !f.includes('backup')
  );
  
  console.log(`📁 Archivos encontrados: ${files.length}\n`);
  
  let fixed = 0;
  
  for (const file of files) {
    const filePath = path.join(areDir, file);
    
    try {
      // Leer TopoJSON
      const topoData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Convertir a GeoJSON
      const objKey = Object.keys(topoData.objects)[0];
      let geoData: any = feature(topoData, topoData.objects[objKey]);
      
      // Aplicar orientación INVERSA (right-hand rule para globe.gl)
      geoData = rewind(geoData, true);
      
      // Convertir de vuelta a TopoJSON
      const newTopo = topology({ [objKey]: geoData });
      
      // Guardar
      fs.writeFileSync(filePath, JSON.stringify(newTopo));
      
      console.log(`   ✅ ${file}`);
      fixed++;
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${file}: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Total corregidos: ${fixed} archivos`);
  console.log('\n✨ Orientación aplicada: RIGHT-HAND RULE (clockwise)');
  console.log('   Compatible con globe.gl rendering\n');
  
  console.log('🔧 SIGUIENTE PASO:');
  console.log('   1. Hard refresh (Ctrl + Shift + R)');
  console.log('   2. Limpiar caché del navegador');
  console.log('   3. Los polígonos de ARE deberían verse correctamente');
}

main().catch(console.error);
