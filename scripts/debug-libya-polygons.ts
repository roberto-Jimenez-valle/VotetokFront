/**
 * Debug específico de polígonos de Libia
 */

import * as fs from 'fs';
import * as path from 'path';
import { feature } from 'topojson-client';
import { topology } from 'topojson-server';
import rewind from '@mapbox/geojson-rewind';

function signedArea(ring: number[][]): number {
  let area = 0;
  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    area += (ring[j][0] - ring[i][0]) * (ring[i][1] + ring[j][1]);
  }
  return area / 2;
}

function reverseRing(ring: number[][]): number[][] {
  return [...ring].reverse();
}

async function main() {
  console.log('🔍 Debug de polígonos de Libia...\n');
  
  const libyaFile = path.join('static/geojson/LBY/LBY.topojson');
  
  if (!fs.existsSync(libyaFile)) {
    console.log('❌ Archivo no existe:', libyaFile);
    return;
  }
  
  // Leer archivo
  const topoData = JSON.parse(fs.readFileSync(libyaFile, 'utf8'));
  console.log('📁 Archivo: LBY.topojson');
  console.log('   Objetos:', Object.keys(topoData.objects));
  
  const objKey = Object.keys(topoData.objects)[0];
  let geoData: any = feature(topoData, topoData.objects[objKey]);
  
  console.log(`   Features: ${geoData.features.length}\n`);
  
  // Analizar cada feature
  console.log('📊 Análisis de orientación:\n');
  
  let clockwise = 0;
  let counterClockwise = 0;
  
  for (let i = 0; i < Math.min(5, geoData.features.length); i++) {
    const feat = geoData.features[i];
    const props = feat.properties;
    const name = props.NAME || props.shapeName || `Feature ${i}`;
    
    if (feat.geometry && feat.geometry.coordinates) {
      const coords = feat.geometry.coordinates;
      
      if (feat.geometry.type === 'Polygon') {
        const area = signedArea(coords[0]);
        const winding = area < 0 ? 'clockwise' : 'counter-clockwise';
        console.log(`   ${name}:`);
        console.log(`      Tipo: ${feat.geometry.type}`);
        console.log(`      Área firmada: ${area.toFixed(2)}`);
        console.log(`      Orientación: ${winding}`);
        
        if (area < 0) clockwise++;
        else counterClockwise++;
        
      } else if (feat.geometry.type === 'MultiPolygon') {
        console.log(`   ${name}:`);
        console.log(`      Tipo: ${feat.geometry.type}`);
        console.log(`      Polígonos: ${coords.length}`);
        
        for (let j = 0; j < coords.length; j++) {
          const area = signedArea(coords[j][0]);
          const winding = area < 0 ? 'clockwise' : 'counter-clockwise';
          console.log(`         Polígono ${j + 1}: ${winding} (área: ${area.toFixed(2)})`);
          
          if (area < 0) clockwise++;
          else counterClockwise++;
        }
      }
    }
    console.log('');
  }
  
  console.log('='.repeat(70));
  console.log('📊 RESUMEN:\n');
  console.log(`   Clockwise: ${clockwise}`);
  console.log(`   Counter-clockwise: ${counterClockwise}`);
  
  // Comparar con España
  console.log('\n📊 COMPARACIÓN CON ESPAÑA:\n');
  
  const espFile = path.join('static/geojson/ESP/ESP.topojson');
  if (fs.existsSync(espFile)) {
    const espTopo = JSON.parse(fs.readFileSync(espFile, 'utf8'));
    const espObj = Object.keys(espTopo.objects)[0];
    const espGeo: any = feature(espTopo, espTopo.objects[espObj]);
    
    const espFeature = espGeo.features[0];
    if (espFeature.geometry && espFeature.geometry.coordinates) {
      const espArea = signedArea(espFeature.geometry.coordinates[0]);
      console.log(`   España (primer feature): ${espArea < 0 ? 'clockwise' : 'counter-clockwise'} (área: ${espArea.toFixed(2)})`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🔧 OPCIONES DE CORRECCIÓN:\n');
  
  console.log('1. Invertir orientación (rewind con inversión):');
  console.log('   - Aplica la orientación OPUESTA al estándar RFC 7946');
  console.log('   - Útil si los polígonos se muestran "invertidos"');
  
  console.log('\n2. Mantener orientación estándar RFC 7946:');
  console.log('   - Exterior: counter-clockwise');
  console.log('   - Ya aplicado anteriormente');
  
  console.log('\n¿Aplicar inversión? (creando backup primero)');
  
  // Crear backup
  const backupFile = libyaFile.replace('.topojson', '.backup.topojson');
  fs.writeFileSync(backupFile, JSON.stringify(topoData));
  console.log(`\n💾 Backup guardado: ${backupFile}`);
  
  // Aplicar inversión (rewind con true = inverso)
  console.log('\n🔄 Aplicando inversión de orientación...');
  geoData = rewind(geoData, true); // true = orientación inversa (right-hand rule)
  
  // Convertir de vuelta a TopoJSON
  const newTopo = topology({ [objKey]: geoData });
  fs.writeFileSync(libyaFile, JSON.stringify(newTopo));
  
  console.log('✅ Orientación invertida aplicada');
  console.log('\n💡 Si los polígonos siguen viéndose mal:');
  console.log('   - Restaura el backup: LBY.backup.topojson → LBY.topojson');
  console.log('   - El problema puede estar en otro lado (renderizado, etc.)');
}

main().catch(console.error);
