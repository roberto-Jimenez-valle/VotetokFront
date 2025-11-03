/**
 * Verificar qué niveles tiene el archivo TopoJSON de Libia
 */

import * as fs from 'fs';
import * as path from 'path';
import { feature } from 'topojson-client';

async function main() {
  const libyaFile = path.join(process.cwd(), 'static/geojson/LBY/LBY.topojson');
  const topoData = JSON.parse(fs.readFileSync(libyaFile, 'utf8'));
  
  console.log('📊 Análisis del archivo LBY.topojson\n');
  console.log('Objetos en el TopoJSON:', Object.keys(topoData.objects));
  console.log('');
  
  for (const objKey of Object.keys(topoData.objects)) {
    const geoData: any = feature(topoData, topoData.objects[objKey]);
    
    console.log(`📁 Objeto: ${objKey}`);
    console.log(`   Features: ${geoData.features.length}`);
    
    // Analizar propiedades de algunos features
    const sample = geoData.features.slice(0, 5);
    
    console.log(`\n   Muestra de features:\n`);
    sample.forEach((f: any, i: number) => {
      const p = f.properties;
      console.log(`   ${i + 1}. ${p.NAME || p.name || 'N/A'}`);
      console.log(`      ID_0: ${p.ID_0 || 'N/A'} (País)`);
      console.log(`      ID_1: ${p.ID_1 || 'N/A'} (Nivel 2)`);
      console.log(`      ID_2: ${p.ID_2 || 'N/A'} (Nivel 3)`);
      console.log(`      GID_1: ${p.GID_1 || 'N/A'}`);
      console.log(`      GID_2: ${p.GID_2 || 'N/A'}`);
      console.log('');
    });
    
    // Verificar si hay nivel 3
    const hasLevel3 = geoData.features.some((f: any) => f.properties.ID_2 || f.properties.GID_2);
    const hasLevel2 = geoData.features.some((f: any) => f.properties.ID_1 || f.properties.GID_1);
    
    console.log(`   Tiene nivel 2 (ID_1/GID_1): ${hasLevel2 ? '✅' : '❌'}`);
    console.log(`   Tiene nivel 3 (ID_2/GID_2): ${hasLevel3 ? '✅' : '❌'}`);
  }
  
  console.log('\n💡 CONCLUSIÓN:');
  console.log('   Si el archivo NO tiene ID_2/GID_2, entonces solo contiene nivel 2.');
  console.log('   Para obtener nivel 3, necesitas descargar archivos GADM con mayor detalle.');
}

main().catch(console.error);
