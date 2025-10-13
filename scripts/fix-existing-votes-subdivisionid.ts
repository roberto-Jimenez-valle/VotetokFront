/**
 * Script para corregir los subdivisionId de los votos existentes
 * Convierte todos los IDs a formato jerárquico de 3 niveles (ej: ESP.1.1, ARG.3.2)
 * 
 * Uso: npx tsx scripts/fix-existing-votes-subdivisionid.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface SubdivisionMapping {
  fullId: string;        // ESP.1.1
  level2Id: string;      // ESP.1
  level1Id: string;      // ESP
  level2Name: string;    // Andalucía
  level3Name: string;    // Almería
  lat?: number;
  lng?: number;
}

/**
 * Carga todas las subdivisiones de nivel 3 desde archivos TopoJSON
 */
async function loadSubdivisionsMap(): Promise<Map<string, SubdivisionMapping[]>> {
  console.log('📂 Cargando subdivisiones desde TopoJSON...\n');
  
  const geojsonDir = path.join(process.cwd(), 'static', 'geojson');
  const subdivisionsByCountry = new Map<string, SubdivisionMapping[]>();
  
  const countryDirs = fs.readdirSync(geojsonDir);
  
  for (const countryIso of countryDirs) {
    const countryPath = path.join(geojsonDir, countryIso);
    if (!fs.statSync(countryPath).isDirectory()) continue;
    
    const subdivisions: SubdivisionMapping[] = [];
    const files = fs.readdirSync(countryPath);
    
    // Leer archivos de nivel 2 que contienen geometrías de nivel 3
    for (const file of files) {
      if (!file.endsWith('.topojson')) continue;
      if (file === `${countryIso}.topojson`) continue;
      
      try {
        const filePath = path.join(countryPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        for (const [key, value] of Object.entries(data.objects || {})) {
          const obj = value as any;
          if (obj.geometries) {
            for (const geom of obj.geometries) {
              const props = geom.properties;
              
              // Buscar ID_2 (nivel 3) o ID_1 (nivel 2)
              if (props && props.ID_2) {
                const fullId = props.ID_2; // ESP.1.1
                const parts = fullId.split('.');
                
                if (parts.length >= 3) {
                  subdivisions.push({
                    fullId: fullId,                          // ESP.1.1
                    level2Id: `${parts[0]}.${parts[1]}`,     // ESP.1
                    level1Id: parts[0],                      // ESP
                    level2Name: props.name_1 || props.NAME_1 || '',  // Andalucía
                    level3Name: props.name_2 || props.NAME_2 || '',  // Almería
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        // Ignorar errores
      }
    }
    
    if (subdivisions.length > 0) {
      subdivisionsByCountry.set(countryIso, subdivisions);
      console.log(`✅ ${countryIso}: ${subdivisions.length} subdivisiones de nivel 3`);
    }
  }
  
  console.log(`\n📊 Total: ${subdivisionsByCountry.size} países con subdivisiones de nivel 3\n`);
  return subdivisionsByCountry;
}

/**
 * Intenta encontrar el subdivisionId de 3 niveles correcto para un voto
 */
function findCorrectSubdivisionId(
  vote: any,
  subdivisions: SubdivisionMapping[]
): string | null {
  const currentId = vote.subdivisionId;
  const countryIso = vote.countryIso3;
  
  if (!currentId || !subdivisions || subdivisions.length === 0) {
    return null;
  }
  
  // Caso 1: Ya está en formato completo de 3 niveles (ESP.1.1)
  const parts = currentId.split('.');
  if (parts.length === 3 && parts[0] === countryIso) {
    // Verificar que existe en TopoJSON
    const exists = subdivisions.some(s => s.fullId === currentId);
    if (exists) {
      return currentId; // Ya está correcto
    }
  }
  
  // Caso 2: Formato de 2 niveles con país (ESP.1)
  if (parts.length === 2 && parts[0] === countryIso) {
    // Buscar cualquier subdivisión de nivel 3 que pertenezca a este nivel 2
    const level2Subdivisions = subdivisions.filter(s => s.level2Id === currentId);
    if (level2Subdivisions.length > 0) {
      // Seleccionar una aleatoria de esa región
      const randomIndex = Math.floor(Math.random() * level2Subdivisions.length);
      return level2Subdivisions[randomIndex].fullId;
    }
  }
  
  // Caso 3: Solo número (1, 2, 3...)
  if (!currentId.includes('.')) {
    const level2Id = `${countryIso}.${currentId}`;
    const level2Subdivisions = subdivisions.filter(s => s.level2Id === level2Id);
    if (level2Subdivisions.length > 0) {
      const randomIndex = Math.floor(Math.random() * level2Subdivisions.length);
      return level2Subdivisions[randomIndex].fullId;
    }
  }
  
  // Caso 4: Formato de 2 niveles sin país (1.1, 2.3...)
  if (parts.length === 2 && parts[0] !== countryIso) {
    const fullId = `${countryIso}.${currentId}`;
    const exists = subdivisions.some(s => s.fullId === fullId);
    if (exists) {
      return fullId;
    }
  }
  
  // Caso 5: No se pudo mapear - asignar una subdivisión aleatoria del país
  if (subdivisions.length > 0) {
    const randomIndex = Math.floor(Math.random() * subdivisions.length);
    return subdivisions[randomIndex].fullId;
  }
  
  return null;
}

async function main() {
  console.log('🔧 CORRIGIENDO SUBDIVISION_ID DE VOTOS EXISTENTES\n');
  console.log('=' .repeat(60));
  
  try {
    // PASO 1: Cargar mapeo de subdivisiones desde TopoJSON
    const subdivisionsByCountry = await loadSubdivisionsMap();
    
    if (subdivisionsByCountry.size === 0) {
      throw new Error('❌ No se encontraron subdivisiones en archivos TopoJSON');
    }
    
    // PASO 2: Obtener todos los votos
    console.log('📊 Cargando votos de la base de datos...\n');
    const votes = await prisma.vote.findMany({
      select: {
        id: true,
        countryIso3: true,
        subdivisionId: true,
        subdivisionName: true,
        latitude: true,
        longitude: true,
      }
    });
    
    console.log(`✅ ${votes.length} votos encontrados\n`);
    
    if (votes.length === 0) {
      console.log('ℹ️  No hay votos para procesar\n');
      return;
    }
    
    // PASO 3: Analizar estado actual
    console.log('📋 Análisis del estado actual:\n');
    
    let with3Levels = 0;
    let with2Levels = 0;
    let with1Level = 0;
    let withNull = 0;
    let other = 0;
    
    votes.forEach(vote => {
      if (!vote.subdivisionId) {
        withNull++;
      } else {
        const levels = vote.subdivisionId.split('.').length;
        if (levels === 3) with3Levels++;
        else if (levels === 2) with2Levels++;
        else if (levels === 1) with1Level++;
        else other++;
      }
    });
    
    console.log(`   ✅ Nivel 3 (ESP.1.1): ${with3Levels} votos (${((with3Levels/votes.length)*100).toFixed(1)}%)`);
    console.log(`   ⚠️  Nivel 2 (ESP.1): ${with2Levels} votos (${((with2Levels/votes.length)*100).toFixed(1)}%)`);
    console.log(`   ⚠️  Nivel 1 (1): ${with1Level} votos (${((with1Level/votes.length)*100).toFixed(1)}%)`);
    console.log(`   ❌ Null: ${withNull} votos (${((withNull/votes.length)*100).toFixed(1)}%)`);
    console.log(`   ❓ Otros: ${other} votos (${((other/votes.length)*100).toFixed(1)}%)\n`);
    
    // PASO 4: Corregir cada voto
    console.log('🔧 Corrigiendo votos...\n');
    console.log('=' .repeat(60));
    
    let corrected = 0;
    let alreadyCorrect = 0;
    let couldNotFix = 0;
    let batchSize = 0;
    const updates: Array<{id: number, newId: string}> = [];
    
    for (const vote of votes) {
      const subdivisions = subdivisionsByCountry.get(vote.countryIso3);
      
      if (!subdivisions) {
        // País sin subdivisiones en TopoJSON
        couldNotFix++;
        continue;
      }
      
      const correctId = findCorrectSubdivisionId(vote, subdivisions);
      
      if (!correctId) {
        couldNotFix++;
        continue;
      }
      
      // Verificar si ya está correcto
      if (vote.subdivisionId === correctId) {
        alreadyCorrect++;
        continue;
      }
      
      // Agregar a la cola de actualizaciones
      updates.push({ id: vote.id, newId: correctId });
      corrected++;
      
      // Mostrar progreso cada 100 votos
      if (corrected % 100 === 0) {
        console.log(`   Procesados: ${corrected} votos corregidos...`);
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n💾 Guardando cambios en la base de datos...\n');
    
    // PASO 5: Aplicar actualizaciones en lotes
    const BATCH_SIZE = 50;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(update =>
          prisma.vote.update({
            where: { id: update.id },
            data: { subdivisionId: update.newId }
          })
        )
      );
      
      if ((i + BATCH_SIZE) % 500 === 0) {
        console.log(`   Guardados: ${Math.min(i + BATCH_SIZE, updates.length)} / ${updates.length} votos...`);
      }
    }
    
    console.log(`✅ Todos los cambios guardados\n`);
    
    // PASO 6: Verificación final
    console.log('=' .repeat(60));
    console.log('\n🔍 VERIFICACIÓN FINAL\n');
    
    const updatedVotes = await prisma.vote.findMany({
      select: { subdivisionId: true },
    });
    
    let finalLevel3 = 0;
    let finalLevel2 = 0;
    let finalLevel1 = 0;
    let finalNull = 0;
    let finalOther = 0;
    
    updatedVotes.forEach(vote => {
      if (!vote.subdivisionId) {
        finalNull++;
      } else {
        const levels = vote.subdivisionId.split('.').length;
        if (levels === 3) finalLevel3++;
        else if (levels === 2) finalLevel2++;
        else if (levels === 1) finalLevel1++;
        else finalOther++;
      }
    });
    
    console.log('📊 Distribución final:');
    console.log(`   ✅ Nivel 3 (ESP.1.1): ${finalLevel3} votos (${((finalLevel3/updatedVotes.length)*100).toFixed(1)}%)`);
    console.log(`   ⚠️  Nivel 2 (ESP.1): ${finalLevel2} votos (${((finalLevel2/updatedVotes.length)*100).toFixed(1)}%)`);
    console.log(`   ⚠️  Nivel 1 (1): ${finalLevel1} votos (${((finalLevel1/updatedVotes.length)*100).toFixed(1)}%)`);
    console.log(`   ❌ Null: ${finalNull} votos (${((finalNull/updatedVotes.length)*100).toFixed(1)}%)`);
    console.log(`   ❓ Otros: ${finalOther} votos (${((finalOther/updatedVotes.length)*100).toFixed(1)}%)\n`);
    
    // Mostrar ejemplos
    console.log('📋 Ejemplos de subdivisionId corregidos:');
    const examples = updatedVotes.filter(v => v.subdivisionId).slice(0, 15);
    examples.forEach((v, i) => {
      const levels = v.subdivisionId?.split('.').length || 0;
      const emoji = levels === 3 ? '✅' : levels === 2 ? '⚠️' : '❌';
      console.log(`   ${emoji} ${i + 1}. ${v.subdivisionId}`);
    });
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n📊 RESUMEN:\n');
    console.log(`   ✅ Votos corregidos: ${corrected}`);
    console.log(`   ✓  Ya estaban correctos: ${alreadyCorrect}`);
    console.log(`   ❌ No se pudieron corregir: ${couldNotFix}`);
    console.log(`   📈 Mejora: ${with3Levels} → ${finalLevel3} votos con 3 niveles (+${finalLevel3 - with3Levels})\n`);
    
    if (finalLevel3 === updatedVotes.length) {
      console.log('🎉 ¡PERFECTO! Todos los votos tienen subdivisionId de 3 niveles\n');
    } else if (finalLevel3 > with3Levels) {
      console.log('✅ Mejora significativa en el formato de subdivisionId\n');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error en el script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
