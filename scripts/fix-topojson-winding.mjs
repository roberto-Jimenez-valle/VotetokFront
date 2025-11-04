#!/usr/bin/env node

/**
 * Script para corregir la orientación (winding order) de los anillos en archivos TopoJSON
 * - Anillos exteriores: sentido antihorario (counter-clockwise)
 * - Huecos interiores: sentido horario (clockwise)
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
 * Corrige la orientación de los arcos en TopoJSON
 */
function fixTopoJSONWinding(topojson) {
  if (!topojson.arcs || !Array.isArray(topojson.arcs)) {
    console.log('⚠️  No se encontraron arcos en el TopoJSON');
    return topojson;
  }
  
  let reversedCount = 0;
  
  // Procesar cada arco
  topojson.arcs = topojson.arcs.map((arc, index) => {
    const area = signedArea(arc);
    
    // Si el área es negativa (sentido horario), invertir
    // La mayoría de arcos deberían ser exteriores (antihorario)
    if (area < 0) {
      reversedCount++;
      return reverseRing(arc);
    }
    
    return arc;
  });
  
  console.log(`   ✅ Invertidos ${reversedCount} de ${topojson.arcs.length} arcos`);
  
  return topojson;
}

/**
 * Procesa un archivo TopoJSON
 */
function processFile(filePath) {
  try {
    console.log(`\n📄 Procesando: ${filePath}`);
    
    // Leer archivo
    const content = readFileSync(filePath, 'utf-8');
    const topojson = JSON.parse(content);
    
    // Validar que sea TopoJSON
    if (topojson.type !== 'Topology') {
      console.log('   ⚠️  No es un archivo TopoJSON válido');
      return false;
    }
    
    // Corregir orientación
    const fixed = fixTopoJSONWinding(topojson);
    
    // Guardar archivo corregido
    writeFileSync(filePath, JSON.stringify(fixed));
    
    console.log('   ✅ Archivo corregido');
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
  node fix-topojson-winding.mjs <archivo.topojson>
  node fix-topojson-winding.mjs <directorio>/*.topojson

Ejemplos:
  node fix-topojson-winding.mjs static/geojson/IND/IND.36.topojson
  node fix-topojson-winding.mjs static/geojson/IND/*.topojson
`);
  process.exit(1);
}

// Procesar archivos
const filePath = args[0];
const absolutePath = join(process.cwd(), filePath);

console.log('🔧 Corrigiendo orientación de anillos en TopoJSON...');
console.log(`   Archivo: ${absolutePath}`);

const success = processFile(absolutePath);

if (success) {
  console.log('\n✅ Proceso completado exitosamente');
} else {
  console.log('\n❌ El proceso falló');
  process.exit(1);
}
