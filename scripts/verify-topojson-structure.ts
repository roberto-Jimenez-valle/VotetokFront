/**
 * Script para verificar que todos los TopoJSON tengan la misma estructura
 * Identifica archivos con propiedades faltantes o diferentes
 */

import * as fs from 'fs';
import * as path from 'path';

const GEOJSON_DIR = 'static/geojson';

interface CountryInfo {
  country: string;
  hasFile: boolean;
  hasISO_A3: boolean;
  hasADM0_A3: boolean;
  hasSOV_A3: boolean;
  hasNAME: boolean;
  properties: string[];
  iso_a3_value?: string;
  adm0_a3_value?: string;
  name_value?: string;
  error?: string;
}

async function main() {
  console.log('🔍 Verificando estructura de TopoJSON...\n');

  const geojsonPath = path.join(process.cwd(), GEOJSON_DIR);
  
  if (!fs.existsSync(geojsonPath)) {
    console.log('❌ Directorio geojson no existe:', geojsonPath);
    return;
  }

  // Obtener todos los subdirectorios (países)
  const countries = fs.readdirSync(geojsonPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  console.log(`📁 Total de países con directorio: ${countries.length}\n`);

  const results: CountryInfo[] = [];

  for (const country of countries) {
    const countryDir = path.join(geojsonPath, country);
    const topoJsonPath = path.join(countryDir, `${country}.topojson`);

    const info: CountryInfo = {
      country,
      hasFile: false,
      hasISO_A3: false,
      hasADM0_A3: false,
      hasSOV_A3: false,
      hasNAME: false,
      properties: []
    };

    // Verificar si existe el archivo
    if (!fs.existsSync(topoJsonPath)) {
      info.error = 'Archivo .topojson no existe';
      results.push(info);
      continue;
    }

    info.hasFile = true;

    try {
      const content = fs.readFileSync(topoJsonPath, 'utf8');
      const data = JSON.parse(content);

      // Extraer el primer objeto del archivo TopoJSON
      const objects = data.objects;
      if (!objects) {
        info.error = 'No tiene objects';
        results.push(info);
        continue;
      }

      // Obtener el primer objeto (usualmente el país principal)
      const firstObjectKey = Object.keys(objects)[0];
      const firstObject = objects[firstObjectKey];

      if (!firstObject || !firstObject.geometries || firstObject.geometries.length === 0) {
        info.error = 'No tiene geometries';
        results.push(info);
        continue;
      }

      // Obtener propiedades del primer geometry
      const props = firstObject.geometries[0].properties || {};
      
      // Verificar propiedades clave
      info.hasISO_A3 = 'ISO_A3' in props || 'iso_a3' in props;
      info.hasADM0_A3 = 'ADM0_A3' in props || 'adm0_a3' in props;
      info.hasSOV_A3 = 'SOV_A3' in props || 'sov_a3' in props;
      info.hasNAME = 'NAME' in props || 'name' in props || 'ADMIN' in props || 'admin' in props;

      // Guardar valores
      info.iso_a3_value = props.ISO_A3 || props.iso_a3;
      info.adm0_a3_value = props.ADM0_A3 || props.adm0_a3;
      info.name_value = props.NAME || props.name || props.ADMIN || props.admin;

      // Listar todas las propiedades
      info.properties = Object.keys(props).sort();

    } catch (error: any) {
      info.error = `Error leyendo archivo: ${error.message}`;
    }

    results.push(info);
  }

  // ANÁLISIS DE RESULTADOS
  console.log('📊 ANÁLISIS DE RESULTADOS\n');
  console.log('='.repeat(70));

  // 1. Archivos sin TopoJSON
  const withoutFile = results.filter(r => !r.hasFile);
  console.log(`\n❌ Sin archivo .topojson: ${withoutFile.length}`);
  if (withoutFile.length > 0) {
    for (const r of withoutFile.slice(0, 10)) {
      console.log(`   ${r.country}: ${r.error}`);
    }
    if (withoutFile.length > 10) {
      console.log(`   ... y ${withoutFile.length - 10} más`);
    }
  }

  // 2. Archivos con errores
  const withErrors = results.filter(r => r.hasFile && r.error);
  console.log(`\n⚠️  Con errores al leer: ${withErrors.length}`);
  if (withErrors.length > 0) {
    for (const r of withErrors) {
      console.log(`   ${r.country}: ${r.error}`);
    }
  }

  // 3. Archivos sin ISO_A3
  const withoutISO = results.filter(r => r.hasFile && !r.error && !r.hasISO_A3);
  console.log(`\n❌ Sin propiedad ISO_A3: ${withoutISO.length}`);
  if (withoutISO.length > 0) {
    for (const r of withoutISO) {
      console.log(`   ${r.country}:`);
      console.log(`      ADM0_A3: ${r.adm0_a3_value || 'NO'}`);
      console.log(`      SOV_A3: ${r.hasSOV_A3 ? 'Sí' : 'NO'}`);
      console.log(`      NAME: ${r.name_value || 'NO'}`);
      console.log(`      Propiedades: ${r.properties.slice(0, 5).join(', ')}...`);
    }
  }

  // 4. Archivos con ISO_A3 pero valor diferente al nombre del directorio
  const withDifferentISO = results.filter(r => 
    r.hasFile && !r.error && r.hasISO_A3 && 
    r.iso_a3_value && r.iso_a3_value !== r.country
  );
  console.log(`\n⚠️  ISO_A3 diferente al directorio: ${withDifferentISO.length}`);
  if (withDifferentISO.length > 0) {
    for (const r of withDifferentISO) {
      console.log(`   ${r.country} → ISO_A3: ${r.iso_a3_value}`);
    }
  }

  // 5. Archivos correctos (con ISO_A3)
  const correct = results.filter(r => r.hasFile && !r.error && r.hasISO_A3);
  console.log(`\n✅ Archivos correctos (con ISO_A3): ${correct.length}`);

  // RESUMEN FINAL
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN FINAL\n');
  console.log(`   Total países: ${countries.length}`);
  console.log(`   ✅ Con ISO_A3: ${correct.length} (${(correct.length/countries.length*100).toFixed(1)}%)`);
  console.log(`   ❌ Sin ISO_A3: ${withoutISO.length} (${(withoutISO.length/countries.length*100).toFixed(1)}%)`);
  console.log(`   ⚠️  Con errores: ${withErrors.length}`);
  console.log(`   ⚠️  Sin archivo: ${withoutFile.length}`);

  // LISTA DE PAÍSES PROBLEMÁTICOS
  const problematic = results.filter(r => !r.hasFile || r.error || !r.hasISO_A3);
  
  if (problematic.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('🚨 PAÍSES PROBLEMÁTICOS (pueden salir grises)\n');
    
    for (const r of problematic) {
      console.log(`   ${r.country}:`);
      if (!r.hasFile) {
        console.log(`      ❌ Sin archivo TopoJSON`);
      } else if (r.error) {
        console.log(`      ❌ Error: ${r.error}`);
      } else if (!r.hasISO_A3) {
        console.log(`      ❌ Sin ISO_A3 (tiene ADM0_A3: ${r.adm0_a3_value || 'NO'})`);
      }
    }

    console.log('\n💡 SOLUCIÓN:');
    console.log('   1. Eliminar carpetas de países problemáticos');
    console.log('   2. O agregar propiedad ISO_A3 a sus TopoJSON');
    console.log('   3. O modificar getFeatureId() para usar ADM0_A3 como fallback');
  } else {
    console.log('\n✅ ¡Todos los TopoJSON tienen estructura correcta!');
  }

  // Guardar reporte
  const reportPath = 'TOPOJSON_VERIFICATION_REPORT.txt';
  const report = [
    '# Reporte de Verificación de TopoJSON',
    `Fecha: ${new Date().toISOString()}`,
    '',
    `Total países: ${countries.length}`,
    `Con ISO_A3: ${correct.length}`,
    `Sin ISO_A3: ${withoutISO.length}`,
    `Con errores: ${withErrors.length}`,
    '',
    '## Países problemáticos:',
    ...problematic.map(r => {
      const issues = [];
      if (!r.hasFile) issues.push('Sin archivo');
      if (r.error) issues.push(r.error);
      if (!r.hasISO_A3) issues.push('Sin ISO_A3');
      return `${r.country}: ${issues.join(', ')}`;
    })
  ].join('\n');

  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Reporte guardado en: ${reportPath}`);
}

main().catch(console.error);
