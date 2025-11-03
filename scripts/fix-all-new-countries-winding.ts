/**
 * Aplicar orientación inversa a TODOS los países nuevos
 */

import * as fs from 'fs';
import * as path from 'path';
import { feature } from 'topojson-client';
import { topology } from 'topojson-server';
import rewind from '@mapbox/geojson-rewind';

const newCountries = [
  'ARM', 'UKR', 'MKD', 'ISR', 'CYP', 'JAM', 'KWT', 'QAT', 
  'BHS', 'BLZ', 'LSO', 'PRI', 'LBY', 'MDA', 'MNE', 'TTO'
];

async function main() {
  console.log('🔄 Aplicando orientación inversa a países nuevos...\n');
  
  let totalFixed = 0;
  
  for (const countryCode of newCountries) {
    const countryDir = path.join('static/geojson', countryCode);
    
    if (!fs.existsSync(countryDir)) {
      console.log(`⚠️  ${countryCode}: directorio no existe`);
      continue;
    }
    
    const files = fs.readdirSync(countryDir).filter(f => 
      f.endsWith('.topojson') && !f.includes('backup')
    );
    
    console.log(`🌍 ${countryCode}: ${files.length} archivos`);
    
    for (const file of files) {
      const filePath = path.join(countryDir, file);
      
      try {
        // Leer TopoJSON
        const topoData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Convertir a GeoJSON
        const objKey = Object.keys(topoData.objects)[0];
        let geoData: any = feature(topoData, topoData.objects[objKey]);
        
        // Aplicar orientación INVERSA (right-hand rule)
        // true = orientación opuesta al estándar RFC 7946
        geoData = rewind(geoData, true);
        
        // Convertir de vuelta a TopoJSON
        const newTopo = topology({ [objKey]: geoData });
        
        // Guardar
        fs.writeFileSync(filePath, JSON.stringify(newTopo));
        totalFixed++;
        
      } catch (error: any) {
        console.log(`   ❌ Error: ${file}: ${error.message}`);
      }
    }
    
    console.log(`   ✅ ${files.length} archivos procesados`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN:\n');
  console.log(`✅ Total archivos corregidos: ${totalFixed}`);
  console.log(`🔄 Orientación aplicada: RIGHT-HAND RULE (clockwise exterior)`);
  console.log('\n💡 Esta orientación coincide con cómo globe.gl renderiza los polígonos');
  console.log('   Si ahora se ven correctamente, ¡perfecto!');
  console.log('   Si no, restaura los backups y revisa la configuración de globe.gl');
}

main().catch(console.error);
