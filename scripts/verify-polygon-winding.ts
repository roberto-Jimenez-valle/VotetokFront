/**
 * Verificar y corregir la orientación (winding order) de polígonos
 */

import * as fs from 'fs';
import * as path from 'path';
import { feature } from 'topojson-client';
import { topology } from 'topojson-server';
import rewind from '@mapbox/geojson-rewind';

// Función para calcular el área firmada de un anillo (signed area)
function signedArea(ring: number[][]): number {
  let area = 0;
  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    area += (ring[j][0] - ring[i][0]) * (ring[i][1] + ring[j][1]);
  }
  return area / 2;
}

// Determinar orientación de un polígono
function getWindingOrder(coords: any): string {
  if (!coords || !coords[0]) return 'unknown';
  
  const area = signedArea(coords[0]);
  return area < 0 ? 'clockwise' : 'counter-clockwise';
}

async function main() {
  console.log('🔍 Verificando orientación de polígonos...\n');
  
  // 1. Verificar archivo original (España)
  console.log('📊 ARCHIVO ORIGINAL (España):');
  const espFile = path.join('static/geojson/ESP/ESP.topojson');
  
  if (fs.existsSync(espFile)) {
    const topoData = JSON.parse(fs.readFileSync(espFile, 'utf8'));
    const objKey = Object.keys(topoData.objects)[0];
    const geoData: any = feature(topoData, topoData.objects[objKey]);
    
    const sample = geoData.features.slice(0, 3);
    for (const feat of sample) {
      if (feat.geometry && feat.geometry.coordinates) {
        const winding = getWindingOrder(feat.geometry.coordinates);
        console.log(`   ${feat.properties.NAME || 'Unknown'}: ${winding}`);
      }
    }
  }
  
  // 2. Verificar archivos nuevos
  console.log('\n📊 ARCHIVOS NUEVOS:');
  
  const newCountries = ['LBY', 'UKR', 'ARM', 'MKD'];
  
  for (const countryCode of newCountries) {
    const countryDir = path.join('static/geojson', countryCode);
    
    if (!fs.existsSync(countryDir)) continue;
    
    const mainFile = path.join(countryDir, `${countryCode}.topojson`);
    
    if (!fs.existsSync(mainFile)) continue;
    
    const topoData = JSON.parse(fs.readFileSync(mainFile, 'utf8'));
    const objKey = Object.keys(topoData.objects)[0];
    const geoData: any = feature(topoData, topoData.objects[objKey]);
    
    if (geoData.features.length > 0) {
      const feat = geoData.features[0];
      if (feat.geometry && feat.geometry.coordinates) {
        const winding = getWindingOrder(feat.geometry.coordinates);
        console.log(`   ${countryCode}: ${winding}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🔧 CORRECCIÓN AUTOMÁTICA\n');
  console.log('Aplicando geojson-rewind para estandarizar orientación...\n');
  
  // 3. Corregir orientación de archivos nuevos
  let fixed = 0;
  
  for (const countryCode of newCountries) {
    const countryDir = path.join('static/geojson', countryCode);
    
    if (!fs.existsSync(countryDir)) continue;
    
    const files = fs.readdirSync(countryDir).filter(f => f.endsWith('.topojson'));
    
    for (const file of files) {
      const filePath = path.join(countryDir, file);
      
      try {
        // Leer TopoJSON
        const topoData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Convertir a GeoJSON
        const objKey = Object.keys(topoData.objects)[0];
        let geoData: any = feature(topoData, topoData.objects[objKey]);
        
        // Corregir orientación con geojson-rewind
        // Por defecto, rewind usa la especificación GeoJSON RFC 7946:
        // - Exterior: counter-clockwise
        // - Huecos: clockwise
        geoData = rewind(geoData, false); // false = seguir RFC 7946
        
        // Convertir de vuelta a TopoJSON
        const newTopo = topology({ [objKey]: geoData });
        
        // Guardar
        fs.writeFileSync(filePath, JSON.stringify(newTopo));
        fixed++;
        
      } catch (error: any) {
        console.log(`   ⚠️  Error procesando ${file}: ${error.message}`);
      }
    }
    
    console.log(`   ✅ ${countryCode}: ${files.length} archivos corregidos`);
  }
  
  console.log(`\n📊 Total archivos corregidos: ${fixed}`);
  console.log('\n✨ Orientación estandarizada según RFC 7946');
  console.log('   - Exteriores: counter-clockwise');
  console.log('   - Huecos: clockwise');
}

main().catch(console.error);
