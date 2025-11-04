import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

interface CountryInfo {
  iso3: string;
  name: string;
  existsInDB: boolean;
  maxLevel: number;
  levelCounts: Record<number, number>;
  votesPerLevel: Record<number, number>;
}

async function validateSubdivisionsAndVotes() {
  try {
    console.log('🔍 Validando países y votos en la base de datos...\n');
    
    // 1. Leer archivo GeoJSON del mundo
    const geojsonPath = join(process.cwd(), 'static', 'maps', 'countries-110m-iso-geojson-fixed.json');
    const geojsonContent = readFileSync(geojsonPath, 'utf-8');
    const geojson = JSON.parse(geojsonContent);
    
    console.log(`📊 Features en GeoJSON: ${geojson.features.length}\n`);
    
    // 2. Extraer países únicos del GeoJSON
    const countriesInGeoJSON = new Map<string, string>();
    
    for (const feature of geojson.features) {
      const iso3 = feature.properties?.ISO3_CODE || feature.properties?.ISO_A3;
      const name = feature.properties?.NAME_ENGL || feature.properties?.CNTR_NAME || feature.id;
      
      if (iso3 && iso3 !== '-99') {
        countriesInGeoJSON.set(iso3, name);
      }
    }
    
    console.log(`🌍 Países únicos en GeoJSON: ${countriesInGeoJSON.size}\n`);
    
    // 3. Verificar cada país en la base de datos
    const results: CountryInfo[] = [];
    const missingCountries: string[] = [];
    const countriesWithVotesInWrongLevel: string[] = [];
    
    for (const [iso3, name] of countriesInGeoJSON) {
      // Buscar subdivisiones de este país (nivel 1 = país)
      // El subdivisionId para países sigue el formato: ISO3 (ej: "ESP", "USA", "FRA")
      const countrySubdivision = await prisma.subdivision.findFirst({
        where: {
          subdivisionId: iso3,
          level: 1
        }
      });
      
      if (!countrySubdivision) {
        missingCountries.push(`${iso3} (${name})`);
        continue;
      }
      
      // Obtener todas las subdivisiones de este país
      // Buscar por subdivisionId que comience con el código ISO3
      const allSubdivisions = await prisma.subdivision.findMany({
        where: {
          subdivisionId: {
            startsWith: iso3
          }
        },
        orderBy: {
          level: 'asc'
        }
      });
      
      // Contar subdivisiones por nivel
      const levelCounts: Record<number, number> = {};
      let maxLevel = 0;
      
      for (const sub of allSubdivisions) {
        levelCounts[sub.level] = (levelCounts[sub.level] || 0) + 1;
        if (sub.level > maxLevel) {
          maxLevel = sub.level;
        }
      }
      
      // Obtener IDs de subdivisiones
      const subdivisionIds = allSubdivisions.map(s => s.id);
      
      // Contar votos por nivel usando agregación SQL (mucho más rápido)
      const votesPerLevel: Record<number, number> = {};
      
      if (subdivisionIds.length > 0) {
        // Obtener votos agrupados por nivel en una sola query
        const votesByLevel = await prisma.$queryRaw<Array<{ level: number, count: bigint }>>`
          SELECT s.level, COUNT(v.id)::bigint as count
          FROM votes v
          INNER JOIN subdivisions s ON v.subdivision_id = s.id
          WHERE s.id = ANY(${subdivisionIds}::int[])
          GROUP BY s.level
        `;
        
        for (const row of votesByLevel) {
          votesPerLevel[row.level] = Number(row.count);
        }
      }
      
      // Verificar si hay votos en niveles que no son el máximo
      const hasVotesInWrongLevel = Object.keys(votesPerLevel).some(
        level => parseInt(level) < maxLevel && votesPerLevel[parseInt(level)] > 0
      );
      
      if (hasVotesInWrongLevel) {
        countriesWithVotesInWrongLevel.push(iso3);
      }
      
      results.push({
        iso3,
        name,
        existsInDB: true,
        maxLevel,
        levelCounts,
        votesPerLevel
      });
    }
    
    // 4. Mostrar resultados
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📋 RESUMEN DE VALIDACIÓN\n');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`✅ Países encontrados en DB: ${results.length}`);
    console.log(`❌ Países faltantes en DB: ${missingCountries.length}\n`);
    
    if (missingCountries.length > 0) {
      console.log('🚫 Países faltantes:');
      missingCountries.forEach(c => console.log(`   - ${c}`));
      console.log();
    }
    
    // Estadísticas de niveles
    console.log('📊 ESTADÍSTICAS POR NIVELES:\n');
    
    const levelStats: Record<number, { countries: number, subdivisions: number, votes: number }> = {};
    
    for (const country of results) {
      for (const [level, count] of Object.entries(country.levelCounts)) {
        const lvl = parseInt(level);
        if (!levelStats[lvl]) {
          levelStats[lvl] = { countries: 0, subdivisions: 0, votes: 0 };
        }
        levelStats[lvl].countries++;
        levelStats[lvl].subdivisions += count;
      }
      
      for (const [level, votes] of Object.entries(country.votesPerLevel)) {
        const lvl = parseInt(level);
        if (levelStats[lvl]) {
          levelStats[lvl].votes += votes;
        }
      }
    }
    
    for (const [level, stats] of Object.entries(levelStats).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
      const levelName = level === '1' ? 'País' : level === '2' ? 'Estado/Región' : level === '3' ? 'Municipio/Distrito' : `Nivel ${level}`;
      console.log(`Nivel ${level} (${levelName}):`);
      console.log(`   - Países con este nivel: ${stats.countries}`);
      console.log(`   - Subdivisiones totales: ${stats.subdivisions}`);
      console.log(`   - Votos totales: ${stats.votes}`);
      console.log();
    }
    
    // Países con votos en niveles incorrectos
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('⚠️  PAÍSES CON VOTOS EN NIVELES NO-MÁXIMOS:\n');
    
    if (countriesWithVotesInWrongLevel.length > 0) {
      console.log(`❌ ${countriesWithVotesInWrongLevel.length} países tienen votos en niveles superiores (deberían estar solo en el nivel más bajo):\n`);
      
      for (const iso3 of countriesWithVotesInWrongLevel) {
        const country = results.find(c => c.iso3 === iso3);
        if (country) {
          console.log(`${iso3} (${country.name}):`);
          console.log(`   Nivel máximo: ${country.maxLevel}`);
          console.log(`   Votos por nivel:`);
          for (const [level, votes] of Object.entries(country.votesPerLevel).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
            const isWrong = parseInt(level) < country.maxLevel;
            const marker = isWrong ? '❌' : '✅';
            console.log(`      ${marker} Nivel ${level}: ${votes} votos`);
          }
          console.log();
        }
      }
    } else {
      console.log('✅ Todos los países tienen votos SOLO en su nivel más bajo\n');
    }
    
    // Países bien configurados (ejemplos)
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ EJEMPLOS DE PAÍSES BIEN CONFIGURADOS:\n');
    
    const wellConfigured = results
      .filter(c => !countriesWithVotesInWrongLevel.includes(c.iso3))
      .filter(c => Object.keys(c.votesPerLevel).length > 0)
      .slice(0, 10);
    
    for (const country of wellConfigured) {
      console.log(`${country.iso3} (${country.name}):`);
      console.log(`   Nivel máximo: ${country.maxLevel}`);
      console.log(`   Subdivisiones: ${JSON.stringify(country.levelCounts)}`);
      console.log(`   Votos: ${JSON.stringify(country.votesPerLevel)}`);
      console.log();
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

validateSubdivisionsAndVotes();
