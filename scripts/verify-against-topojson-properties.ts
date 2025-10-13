import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import * as topojson from 'topojson-client';

const prisma = new PrismaClient();

async function verifyAgainstTopoJSON() {
  console.log('🔍 Verificando votos contra propiedades de archivos TopoJSON...\n');

  // 1. Cargar todas las subdivisiones válidas de los archivos TopoJSON
  const geojsonDir = path.join(process.cwd(), 'static', 'geojson');
  const validSubdivisions = new Set<string>();

  console.log('📂 Leyendo archivos TopoJSON...');
  
  const countries = fs.readdirSync(geojsonDir);
  let filesProcessed = 0;
  
  for (const country of countries) {
    const countryPath = path.join(geojsonDir, country);
    if (!fs.statSync(countryPath).isDirectory()) continue;
    
    const files = fs.readdirSync(countryPath);
    
    for (const file of files) {
      // Archivos como ESP.1.topojson, ESP.2.topojson
      if (!file.endsWith('.topojson')) continue;
      if (file === `${country}.topojson`) continue; // Skip el archivo principal del país
      
      try {
        const filePath = path.join(countryPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        // Extraer geometries de cada objeto en el TopoJSON
        for (const [key, value] of Object.entries(data.objects || {})) {
          const obj = value as any;
          if (obj.geometries) {
            for (const geom of obj.geometries) {
              if (geom.properties && geom.properties.ID_2) {
                validSubdivisions.add(geom.properties.ID_2);
              }
            }
          }
        }
        
        filesProcessed++;
      } catch (error) {
        console.log(`⚠️  Error leyendo ${file}:`, error);
      }
    }
  }

  console.log(`✅ ${filesProcessed} archivos procesados`);
  console.log(`✅ ${validSubdivisions.size} subdivisiones válidas encontradas\n`);

  // Mostrar ejemplos de España
  const espSubdivisions = Array.from(validSubdivisions).filter(s => s.startsWith('ESP.')).sort();
  console.log(`🇪🇸 Subdivisiones de España encontradas: ${espSubdivisions.length}`);
  console.log(`   Ejemplos: ${espSubdivisions.slice(0, 10).join(', ')}\n`);

  // 2. Verificar votos
  const votes = await prisma.vote.findMany({
    select: {
      countryIso3: true,
      subdivisionId: true,
    },
  });

  console.log(`📊 Total de votos: ${votes.length}\n`);

  let valid = 0;
  let invalid = 0;
  const invalidSamples: string[] = [];

  for (const vote of votes) {
    const fullId = `${vote.countryIso3}.${vote.subdivisionId}`;
    
    if (validSubdivisions.has(fullId)) {
      valid++;
    } else {
      invalid++;
      if (invalidSamples.length < 20) {
        invalidSamples.push(fullId);
      }
    }
  }

  console.log('📊 RESULTADO:\n');
  console.log(`   ✅ Votos válidos:    ${valid} (${((valid / votes.length) * 100).toFixed(1)}%)`);
  console.log(`   ❌ Votos inválidos:  ${invalid} (${((invalid / votes.length) * 100).toFixed(1)}%)\n`);

  if (invalid > 0) {
    console.log('⚠️  Ejemplos de subdivisiones inválidas:');
    invalidSamples.forEach(sample => console.log(`   ${sample}`));
    console.log('\n💡 Estos votos tienen subdivision_id que no existen en los archivos TopoJSON');
  } else {
    console.log('✅ ¡Perfecto! Todos los votos coinciden con subdivisiones en los archivos TopoJSON\n');
  }

  await prisma.$disconnect();
}

verifyAgainstTopoJSON().catch(console.error);
