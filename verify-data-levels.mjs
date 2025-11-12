import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GEOJSON_DIR = 'static/geojson';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

async function verifyCountryDataLevels(countryCode) {
  // 1. Detectar qué niveles tiene disponibles en archivos TopoJSON
  const countryDir = path.join(GEOJSON_DIR, countryCode);
  
  if (!fs.existsSync(countryDir)) {
    return null;
  }
  
  const level2File = path.join(countryDir, `${countryCode}.topojson`);
  const hasLevel2 = fs.existsSync(level2File);
  
  const files = fs.readdirSync(countryDir);
  const level3Files = files.filter(f => f.match(/\.\d+\.topojson$/));
  const hasLevel3 = level3Files.length > 0;
  
  if (!hasLevel2) {
    return null;
  }
  
  const expectedLowestLevel = hasLevel3 ? 3 : 2;
  
  // 2. Obtener subdivisiones de la base de datos
  const dbSubdivisions = await prisma.subdivision.findMany({
    where: {
      subdivisionId: {
        startsWith: `${countryCode}.`
      }
    },
    select: {
      id: true,
      subdivisionId: true,
      level: true,
      name: true,
      _count: {
        select: {
          votes: true
        }
      }
    }
  });
  
  if (dbSubdivisions.length === 0) {
    return null;
  }
  
  // 3. Analizar distribución de votos por nivel
  const level2Subs = dbSubdivisions.filter(s => s.level === 2);
  const level3Subs = dbSubdivisions.filter(s => s.level === 3);
  
  const level2WithVotes = level2Subs.filter(s => s._count.votes > 0);
  const level3WithVotes = level3Subs.filter(s => s._count.votes > 0);
  
  const totalVotesLevel2 = level2Subs.reduce((sum, s) => sum + s._count.votes, 0);
  const totalVotesLevel3 = level3Subs.reduce((sum, s) => sum + s._count.votes, 0);
  
  // 4. Determinar si hay problema
  let issue = null;
  
  if (expectedLowestLevel === 3) {
    // Debería tener votos SOLO en nivel 3
    if (totalVotesLevel2 > 0) {
      issue = {
        type: 'votes_in_wrong_level',
        message: `Tiene nivel 3 pero ${totalVotesLevel2} votos en nivel 2`,
        level2Votes: totalVotesLevel2,
        level3Votes: totalVotesLevel3,
        level2WithVotes: level2WithVotes.length,
        level3WithVotes: level3WithVotes.length
      };
    }
  } else {
    // Solo tiene nivel 2, debería tener votos en nivel 2
    if (totalVotesLevel2 === 0 && totalVotesLevel3 === 0) {
      issue = {
        type: 'no_votes',
        message: 'No tiene votos en ningún nivel'
      };
    } else if (totalVotesLevel3 > 0) {
      issue = {
        type: 'unexpected_level3',
        message: `Solo tiene nivel 2 pero hay ${totalVotesLevel3} votos en nivel 3`,
        level2Votes: totalVotesLevel2,
        level3Votes: totalVotesLevel3
      };
    }
  }
  
  return {
    country: countryCode,
    hasLevel2,
    hasLevel3,
    expectedLowestLevel,
    stats: {
      level2Subdivisions: level2Subs.length,
      level3Subdivisions: level3Subs.length,
      level2WithVotes: level2WithVotes.length,
      level3WithVotes: level3WithVotes.length,
      totalVotesLevel2,
      totalVotesLevel3
    },
    issue
  };
}

async function main() {
  try {
    log(colors.cyan, '═══════════════════════════════════════════════════════');
    log(colors.cyan, '🔍 VERIFICACIÓN DE NIVELES DE DATOS');
    log(colors.cyan, '═══════════════════════════════════════════════════════\n');
    
    const countries = fs.readdirSync(GEOJSON_DIR)
      .filter(f => {
        const stat = fs.statSync(path.join(GEOJSON_DIR, f));
        return stat.isDirectory() && f.length === 3;
      })
      .sort();
    
    log(colors.blue, `📊 Analizando ${countries.length} países...\n`);
    
    const results = [];
    const issues = {
      votesInWrongLevel: [],
      unexpectedLevel3: [],
      noVotes: []
    };
    
    for (const country of countries) {
      const result = await verifyCountryDataLevels(country);
      
      if (!result) continue;
      
      results.push(result);
      
      // Mostrar progreso
      if (result.issue) {
        if (result.issue.type === 'votes_in_wrong_level') {
          log(colors.red, `❌ ${country}: ${result.issue.message}`);
          log(colors.yellow, `   L2: ${result.stats.totalVotesLevel2} votos, L3: ${result.stats.totalVotesLevel3} votos`);
          issues.votesInWrongLevel.push(result);
        } else if (result.issue.type === 'unexpected_level3') {
          log(colors.yellow, `⚠️  ${country}: ${result.issue.message}`);
          issues.unexpectedLevel3.push(result);
        } else if (result.issue.type === 'no_votes') {
          // No mostrar estos, son normales
          issues.noVotes.push(result);
        }
      } else {
        // OK
        const votesInCorrectLevel = result.expectedLowestLevel === 3 
          ? result.stats.totalVotesLevel3 
          : result.stats.totalVotesLevel2;
        
        if (votesInCorrectLevel > 0) {
          log(colors.green, `✅ ${country}: ${votesInCorrectLevel} votos en nivel ${result.expectedLowestLevel}`);
        }
      }
    }
    
    // REPORTE FINAL
    log(colors.cyan, '\n═══════════════════════════════════════════════════════');
    log(colors.cyan, '📊 REPORTE FINAL');
    log(colors.cyan, '═══════════════════════════════════════════════════════\n');
    
    const countriesWithVotes = results.filter(r => 
      r.stats.totalVotesLevel2 > 0 || r.stats.totalVotesLevel3 > 0
    );
    
    const countriesOK = countriesWithVotes.filter(r => !r.issue);
    
    log(colors.green, `✅ Países con datos correctos: ${countriesOK.length}`);
    log(colors.red, `❌ Votos en nivel incorrecto: ${issues.votesInWrongLevel.length}`);
    log(colors.yellow, `⚠️  Nivel 3 inesperado: ${issues.unexpectedLevel3.length}`);
    log(colors.blue, `📊 Países sin votos: ${issues.noVotes.length}`);
    
    if (issues.votesInWrongLevel.length > 0) {
      log(colors.red, '\n🔴 PAÍSES CON VOTOS EN NIVEL INCORRECTO:');
      log(colors.red, '   (Tienen nivel 3 pero hay votos en nivel 2)\n');
      
      issues.votesInWrongLevel.forEach(r => {
        log(colors.red, `   ${r.country}:`);
        log(colors.yellow, `      Nivel 2: ${r.stats.totalVotesLevel2} votos en ${r.stats.level2WithVotes} subdivisiones`);
        log(colors.yellow, `      Nivel 3: ${r.stats.totalVotesLevel3} votos en ${r.stats.level3WithVotes} subdivisiones`);
        log(colors.cyan, `      Acción: Migrar ${r.stats.totalVotesLevel2} votos de nivel 2 a nivel 3`);
      });
    }
    
    if (issues.unexpectedLevel3.length > 0) {
      log(colors.yellow, '\n⚠️  PAÍSES CON NIVEL 3 INESPERADO:');
      log(colors.yellow, '   (Solo tienen archivos nivel 2 pero hay votos en nivel 3)\n');
      
      issues.unexpectedLevel3.forEach(r => {
        log(colors.yellow, `   ${r.country}:`);
        log(colors.yellow, `      Votos nivel 2: ${r.stats.totalVotesLevel2}`);
        log(colors.yellow, `      Votos nivel 3: ${r.stats.totalVotesLevel3}`);
      });
    }
    
    // Estadísticas generales
    const totalVotes = results.reduce((sum, r) => 
      sum + r.stats.totalVotesLevel2 + r.stats.totalVotesLevel3, 0
    );
    
    const totalVotesLevel2 = results.reduce((sum, r) => sum + r.stats.totalVotesLevel2, 0);
    const totalVotesLevel3 = results.reduce((sum, r) => sum + r.stats.totalVotesLevel3, 0);
    
    log(colors.cyan, '\n📊 ESTADÍSTICAS GLOBALES:');
    log(colors.blue, `   Total de votos: ${totalVotes.toLocaleString()}`);
    log(colors.blue, `   Votos en nivel 2: ${totalVotesLevel2.toLocaleString()}`);
    log(colors.blue, `   Votos en nivel 3: ${totalVotesLevel3.toLocaleString()}`);
    
    // Guardar reporte
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalCountries: results.length,
        countriesWithVotes: countriesWithVotes.length,
        countriesOK: countriesOK.length,
        votesInWrongLevel: issues.votesInWrongLevel.length,
        unexpectedLevel3: issues.unexpectedLevel3.length,
        noVotes: issues.noVotes.length,
        totalVotes,
        totalVotesLevel2,
        totalVotesLevel3
      },
      issues: {
        votesInWrongLevel: issues.votesInWrongLevel.map(r => ({
          country: r.country,
          level2Votes: r.stats.totalVotesLevel2,
          level3Votes: r.stats.totalVotesLevel3,
          level2WithVotes: r.stats.level2WithVotes,
          level3WithVotes: r.stats.level3WithVotes
        })),
        unexpectedLevel3: issues.unexpectedLevel3.map(r => ({
          country: r.country,
          level2Votes: r.stats.totalVotesLevel2,
          level3Votes: r.stats.totalVotesLevel3
        }))
      }
    };
    
    fs.writeFileSync('data-levels-report.json', JSON.stringify(report, null, 2));
    log(colors.green, '\n💾 Reporte guardado en: data-levels-report.json');
    
  } catch (error) {
    log(colors.red, '\n❌ Error:', error);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
