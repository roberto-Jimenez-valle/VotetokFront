#!/usr/bin/env node

/**
 * Script para corregir la orientación (winding order) de los anillos en archivos GeoJSON
 * - Anillos exteriores: sentido antihorario (counter-clockwise) - área positiva
 * - Huecos interiores: sentido horario (clockwise) - área negativa
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Calcula el área con signo de un anillo de coordenadas
 * Área positiva = sentido antihorario (CCW)
 * Área negativa = sentido horario (CW)
 */
function signedArea(ring) {
  let area = 0;
  const n = ring.length;
  
  for (let i = 0; i < n - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area += (x2 - x1) * (y2 + y1);
  }
  
  return area / 2;
}

/**
 * Invierte un anillo de coordenadas
 */
function reverseRing(ring) {
  return [...ring].reverse();
}

/**
 * Corrige la orientación de un anillo según su posición
 * @param {Array} ring - Anillo de coordenadas
 * @param {boolean} isOuter - True si es anillo exterior, false si es hueco
 */
function fixRingOrientation(ring, isOuter) {
  const area = signedArea(ring);
  
  if (isOuter) {
    // Anillo exterior debe ser antihorario (área positiva)
    if (area < 0) {
      return reverseRing(ring);
    }
  } else {
    // Hueco interior debe ser horario (área negativa)
    if (area > 0) {
      return reverseRing(ring);
    }
  }
  
  return ring;
}

/**
 * Corrige la orientación de las geometrías en GeoJSON
 */
function fixGeoJSONWinding(geojson) {
  if (!geojson.features || !Array.isArray(geojson.features)) {
    console.log('⚠️  No se encontraron features en el GeoJSON');
    return geojson;
  }
  
  let fixedPolygons = 0;
  let fixedMultiPolygons = 0;
  let reversedRings = 0;
  
  // Procesar cada feature
  geojson.features = geojson.features.map(feature => {
    if (!feature.geometry) return feature;
    
    const geomType = feature.geometry.type;
    
    if (geomType === 'Polygon') {
      fixedPolygons++;
      const rings = feature.geometry.coordinates;
      
      feature.geometry.coordinates = rings.map((ring, index) => {
        const isOuter = index === 0; // Primer anillo es exterior
        const originalArea = signedArea(ring);
        const fixed = fixRingOrientation(ring, isOuter);
        const newArea = signedArea(fixed);
        
        if (originalArea !== newArea) {
          reversedRings++;
        }
        
        return fixed;
      });
      
    } else if (geomType === 'MultiPolygon') {
      fixedMultiPolygons++;
      const polygons = feature.geometry.coordinates;
      
      feature.geometry.coordinates = polygons.map(polygon => {
        return polygon.map((ring, index) => {
          const isOuter = index === 0; // Primer anillo de cada polígono es exterior
          const originalArea = signedArea(ring);
          const fixed = fixRingOrientation(ring, isOuter);
          const newArea = signedArea(fixed);
          
          if (originalArea !== newArea) {
            reversedRings++;
          }
          
          return fixed;
        });
      });
    }
    
    return feature;
  });
  
  console.log(`   ✅ Polygons corregidos: ${fixedPolygons}`);
  console.log(`   ✅ MultiPolygons corregidos: ${fixedMultiPolygons}`);
  console.log(`   ✅ Anillos invertidos: ${reversedRings}`);
  
  return geojson;
}

/**
 * Procesa un archivo GeoJSON
 */
function processFile(filePath) {
  try {
    console.log(`\n📄 Procesando: ${filePath}`);
    
    // Leer archivo
    const content = readFileSync(filePath, 'utf-8');
    const geojson = JSON.parse(content);
    
    // Validar que sea GeoJSON
    if (geojson.type !== 'FeatureCollection') {
      console.log('   ⚠️  No es un FeatureCollection válido');
      return false;
    }
    
    console.log(`   📊 Features totales: ${geojson.features.length}`);
    
    // Corregir orientación
    const fixed = fixGeoJSONWinding(geojson);
    
    // Guardar archivo corregido
    writeFileSync(filePath, JSON.stringify(fixed));
    
    console.log('   ✅ Archivo corregido y guardado');
    return true;
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

// Uso del script
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
📋 Uso:
  node fix-geojson-winding.mjs <archivo.json>

Ejemplo:
  node fix-geojson-winding.mjs static/maps/countries-110m-iso-geojson-fixed.json
`);
  process.exit(1);
}

// Procesar archivo
const filePath = args[0];
const absolutePath = join(process.cwd(), filePath);

console.log('🔧 Corrigiendo orientación de anillos en GeoJSON...');
console.log(`   Archivo: ${absolutePath}`);

const success = processFile(absolutePath);

if (success) {
  console.log('\n✅ Proceso completado exitosamente');
} else {
  console.log('\n❌ El proceso falló');
  process.exit(1);
}
