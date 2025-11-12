import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GEOJSON_DIR = 'static/geojson';

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const issues = {
  wrongFormat: [],
  idMismatch: [],
  emptyFiles: [],
  missingIds: [],
  success: []
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

async function verifyTopoJSON(filePath, level) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const objects = data.objects || {};
    const firstKey = Object.keys(objects)[0];
    
    if (!firstKey) {
      return { status: 'empty', message: 'No objects found' };
    }
    
    const geometries = objects[firstKey].geometries || [];
    
    if (geometries.length === 0) {
      return { status: 'empty', message: 'No geometries' };
    }
    
    // Verificar formato de propiedades
    const firstGeom = geometries[0];
    const props = firstGeom.properties || {};
    
    // Detectar formato incorrecto (shapeISO, shapeName, etc.)
    const hasWrongFormat = props.shapeISO || props.shapeName || props.shapeID;
    if (hasWrongFormat && !props.ID_1 && !props.ID_2) {
      return {
        status: 'wrong_format',
        message: `Formato incorrecto: usa shapeISO/shapeName`,
        count: geometries.length,
        sample: {
          shapeISO: props.shapeISO,
          shapeName: props.shapeName,
          shapeID: props.shapeID
        }
      };
    }
    
    // Verificar que tiene IDs estándar
    const idField = level === 2 ? 'ID_1' : 'ID_2';
    const hasStandardIds = geometries.some(g => g.properties?.[idField]);
    
    if (!hasStandardIds) {
      return {
        status: 'missing_ids',
        message: `No tiene campo ${idField}`,
        count: geometries.length,
        sample: props
      };
    }
    
    // Extraer IDs del TopoJSON
    const topoIds = geometries
      .map(g => g.properties?.[idField])
      .filter(id => id);
    
    return {
      status: 'ok',
      count: geometries.length,
      ids: topoIds,
      sampleId: topoIds[0]
    };
    
  } catch (error) {
    return {
      status: 'error',
      message: error.message
    };
  }
}

async function verifyCountry(countryCode) {
  log(colors.cyan, `\n📍 Verificando ${countryCode}...`);
  
  // Verificar nivel 2 (país)
  const level2File = path.join(GEOJSON_DIR, countryCode, `${countryCode}.topojson`);
  
  if (!fs.existsSync(level2File)) {
    log(colors.yellow, `  ⚠️  Archivo nivel 2 no existe`);
    return;
  }
  
  const level2Result = await verifyTopoJSON(level2File, 2);
  
  if (level2Result.status === 'wrong_format') {
    log(colors.red, `  ❌ Nivel 2: Formato incorrecto`);
    log(colors.yellow, `     ${level2Result.message}`);
    log(colors.yellow, `     Sample:`, JSON.stringify(level2Result.sample, null, 2));
    issues.wrongFormat.push({ country: countryCode, level: 2, file: level2File, ...level2Result });
  } else if (level2Result.status === 'missing_ids') {
    log(colors.red, `  ❌ Nivel 2: Sin IDs estándar`);
    issues.missingIds.push({ country: countryCode, level: 2, file: level2File, ...level2Result });
  } else if (level2Result.status === 'ok') {
    // Verificar si los IDs coinciden con la base de datos
    const dbPrefix = `${countryCode}.`;
    const dbSubs = await prisma.subdivision.findMany({
      where: {
        subdivisionId: {
          startsWith: dbPrefix
        },
        level: 2
      },
      select: { subdivisionId: true }
    });
    
    const dbIds = new Set(dbSubs.map(s => s.subdivisionId));
    const topoIds = new Set(level2Result.ids);
    
    // Verificar si hay mismatch
    const hasDbMatch = level2Result.ids.some(id => dbIds.has(id));
    
    if (dbIds.size > 0 && !hasDbMatch) {
      log(colors.yellow, `  ⚠️  Nivel 2: IDs no coinciden con DB`);
      log(colors.yellow, `     TopoJSON: ${level2Result.sampleId}`);
      log(colors.yellow, `     DB: ${[...dbIds][0]}`);
      issues.idMismatch.push({
        country: countryCode,
        level: 2,
        topoSample: level2Result.sampleId,
        dbSample: [...dbIds][0],
        topoCount: topoIds.size,
        dbCount: dbIds.size
      });
    } else {
      log(colors.green, `  ✅ Nivel 2: ${level2Result.count} subdivisiones OK`);
      issues.success.push({ country: countryCode, level: 2, count: level2Result.count });
    }
    
    // Verificar nivel 3 (si existen archivos)
    const countryDir = path.join(GEOJSON_DIR, countryCode);
    const files = fs.readdirSync(countryDir);
    const level3Files = files.filter(f => f.match(/\.\d+\.topojson$/));
    
    if (level3Files.length > 0) {
      log(colors.blue, `  🔍 Verificando ${level3Files.length} archivos nivel 3...`);
      
      for (const file of level3Files.slice(0, 3)) { // Solo verificar primeros 3
        const level3File = path.join(countryDir, file);
        const level3Result = await verifyTopoJSON(level3File, 3);
        
        if (level3Result.status === 'wrong_format') {
          log(colors.red, `     ❌ ${file}: Formato incorrecto`);
          issues.wrongFormat.push({ country: countryCode, level: 3, file: level3File, ...level3Result });
        } else if (level3Result.status === 'ok') {
          log(colors.green, `     ✅ ${file}: ${level3Result.count} OK`);
        }
      }
    }
  } else {
    log(colors.red, `  ❌ Nivel 2: ${level2Result.status} - ${level2Result.message}`);
  }
}

async function main() {
  try {
    log(colors.cyan, '═══════════════════════════════════════════════════════');
    log(colors.cyan, '🔍 VERIFICACIÓN COMPLETA DE TOPOJSON');
    log(colors.cyan, '═══════════════════════════════════════════════════════\n');
    
    // Obtener todos los países
    const countries = fs.readdirSync(GEOJSON_DIR)
      .filter(f => {
        const stat = fs.statSync(path.join(GEOJSON_DIR, f));
        return stat.isDirectory() && f.length === 3; // Códigos ISO de 3 letras
      })
      .sort();
    
    log(colors.blue, `📊 Total de países a verificar: ${countries.length}\n`);
    
    for (const country of countries) {
      await verifyCountry(country);
    }
    
    // REPORTE FINAL
    log(colors.cyan, '\n═══════════════════════════════════════════════════════');
    log(colors.cyan, '📊 REPORTE FINAL');
    log(colors.cyan, '═══════════════════════════════════════════════════════\n');
    
    log(colors.green, `✅ Países OK: ${issues.success.length}`);
    log(colors.red, `❌ Formato incorrecto: ${issues.wrongFormat.length}`);
    log(colors.yellow, `⚠️  IDs no coinciden: ${issues.idMismatch.length}`);
    log(colors.yellow, `⚠️  Sin IDs estándar: ${issues.missingIds.length}`);
    
    if (issues.wrongFormat.length > 0) {
      log(colors.red, '\n🔴 PAÍSES CON FORMATO INCORRECTO:');
      issues.wrongFormat.forEach(issue => {
        log(colors.red, `   - ${issue.country} (nivel ${issue.level}): ${issue.message}`);
      });
    }
    
    if (issues.idMismatch.length > 0) {
      log(colors.yellow, '\n⚠️  PAÍSES CON IDs NO COINCIDEN:');
      issues.idMismatch.forEach(issue => {
        log(colors.yellow, `   - ${issue.country} (nivel ${issue.level})`);
        log(colors.yellow, `     TopoJSON: ${issue.topoSample} (${issue.topoCount} total)`);
        log(colors.yellow, `     DB: ${issue.dbSample} (${issue.dbCount} total)`);
      });
    }
    
    if (issues.missingIds.length > 0) {
      log(colors.yellow, '\n⚠️  PAÍSES SIN IDs ESTÁNDAR:');
      issues.missingIds.forEach(issue => {
        log(colors.yellow, `   - ${issue.country} (nivel ${issue.level}): ${issue.count} geometrías`);
      });
    }
    
    // Guardar reporte en JSON
    const report = {
      timestamp: new Date().toISOString(),
      totalCountries: countries.length,
      summary: {
        success: issues.success.length,
        wrongFormat: issues.wrongFormat.length,
        idMismatch: issues.idMismatch.length,
        missingIds: issues.missingIds.length
      },
      issues: {
        wrongFormat: issues.wrongFormat,
        idMismatch: issues.idMismatch,
        missingIds: issues.missingIds
      }
    };
    
    fs.writeFileSync('topojson-verification-report.json', JSON.stringify(report, null, 2));
    log(colors.green, '\n💾 Reporte guardado en: topojson-verification-report.json');
    
  } catch (error) {
    log(colors.red, '\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
