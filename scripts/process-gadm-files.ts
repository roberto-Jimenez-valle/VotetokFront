/**
 * Procesar archivos GADM descargados y convertirlos a TopoJSON
 */

import * as fs from 'fs';
import * as path from 'path';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';

const TEMP_DIR = 'temp_gadm_downloads';
const OUTPUT_DIR = 'static/geojson';

async function main() {
  console.log('🔧 Procesando archivos GADM descargados...\n');
  
  if (!fs.existsSync(TEMP_DIR)) {
    console.log('❌ Directorio temp_gadm_downloads no existe');
    console.log('   Ejecuta primero: ./scripts/download-gadm-level3.ps1');
    return;
  }
  
  const files = fs.readdirSync(TEMP_DIR).filter(f => f.endsWith('.json'));
  
  console.log(`📁 Archivos encontrados: ${files.length}\n`);
  
  let processedCount = 0;
  let errorCount = 0;
  
  for (const file of files) {
    const filePath = path.join(TEMP_DIR, file);
    const match = file.match(/^([A-Z]{3})_level(\d)\.json$/);
    
    if (!match) {
      console.log(`⚠️  Ignorando archivo: ${file}`);
      continue;
    }
    
    const countryCode = match[1];
    const level = parseInt(match[2]);
    
    console.log(`🌍 Procesando ${countryCode} (nivel ${level})...`);
    
    try {
      // Leer archivo GeoJSON
      const geoData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (!geoData.features || geoData.features.length === 0) {
        console.log(`   ⚠️  Archivo vacío`);
        errorCount++;
        continue;
      }
      
      console.log(`   Features: ${geoData.features.length}`);
      
      // Crear directorio del país si no existe
      const countryDir = path.join(OUTPUT_DIR, countryCode);
      if (!fs.existsSync(countryDir)) {
        fs.mkdirSync(countryDir, { recursive: true });
      }
      
      if (level === 3) {
        // Nivel 3: Agrupar por subdivisión nivel 2
        const byRegion = new Map<string, any[]>();
        
        for (const feature of geoData.features) {
          const props = feature.properties;
          const regionId = props.GID_2 || props.ID_2 || `${countryCode}.${props.NAME_1}`;
          const regionKey = regionId.split('.').slice(0, 2).join('.'); // ESP.1
          
          if (!byRegion.has(regionKey)) {
            byRegion.set(regionKey, []);
          }
          byRegion.get(regionKey)!.push(feature);
        }
        
        console.log(`   Regiones nivel 2: ${byRegion.size}`);
        
        // Crear un archivo TopoJSON por cada región
        let regionCount = 0;
        for (const [regionKey, features] of byRegion) {
          const regionGeo = {
            type: 'FeatureCollection',
            features: features
          };
          
          // Convertir a TopoJSON
          const topo = topology({ [regionKey]: regionGeo });
          
          // Simplificar geometría (reducir tamaño)
          const simplified = simplify(presimplify(topo), 0.005);
          
          // Guardar archivo
          const outputFile = path.join(countryDir, `${regionKey}.topojson`);
          fs.writeFileSync(outputFile, JSON.stringify(simplified));
          
          regionCount++;
        }
        
        console.log(`   ✅ ${regionCount} archivos TopoJSON creados`);
        
      } else {
        // Nivel 2: Crear archivo principal del país
        const topo = topology({ [countryCode]: geoData });
        const simplified = simplify(presimplify(topo), 0.005);
        
        const outputFile = path.join(countryDir, `${countryCode}.topojson`);
        fs.writeFileSync(outputFile, JSON.stringify(simplified));
        
        console.log(`   ✅ Archivo principal creado`);
      }
      
      processedCount++;
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      errorCount++;
    }
    
    console.log('');
  }
  
  console.log('='.repeat(70));
  console.log('📊 RESUMEN\n');
  console.log(`✅ Procesados: ${processedCount}`);
  console.log(`❌ Errores: ${errorCount}`);
  
  console.log('\n🔧 SIGUIENTE PASO:');
  console.log('   Ejecutar script de migración para cargar subdivisiones a la BD:');
  console.log('   npx tsx scripts/migrate-subdivisions.ts');
}

main().catch(console.error);
