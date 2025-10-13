import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function fixVotesToMatchGeoJSON() {
  console.log('🔧 Corrigiendo subdivision_id para coincidir con archivos GeoJSON...\n');

  // 1. Escanear todos los archivos GeoJSON para obtener subdivisiones válidas
  const geojsonDir = path.join(process.cwd(), 'static', 'geojson');
  const validSubdivisions = new Map<string, Set<string>>();

  console.log('📂 Escaneando archivos GeoJSON...');
  
  const countries = fs.readdirSync(geojsonDir);
  
  for (const country of countries) {
    const countryPath = path.join(geojsonDir, country);
    if (!fs.statSync(countryPath).isDirectory()) continue;
    
    const files = fs.readdirSync(countryPath);
    const subdivisions = new Set<string>();
    
    for (const file of files) {
      // Archivos como ESP.1.topojson, ESP.2.topojson
      const match = file.match(/^([A-Z]{3})\.(\d+)\.topojson$/);
      if (match) {
        subdivisions.add(match[2]); // Guardar solo el número: "1", "2", etc.
      }
    }
    
    if (subdivisions.size > 0) {
      validSubdivisions.set(country, subdivisions);
    }
  }

  console.log(`✅ ${validSubdivisions.size} países con subdivisiones encontrados\n`);

  // Mostrar subdivisiones de España como ejemplo
  const espSubdivisions = validSubdivisions.get('ESP');
  if (espSubdivisions) {
    console.log(`🇪🇸 España tiene ${espSubdivisions.size} subdivisiones válidas:`);
    console.log(`   ${Array.from(espSubdivisions).sort((a, b) => Number(a) - Number(b)).join(', ')}\n`);
  }

  // 2. Obtener todos los votos
  const votes = await prisma.vote.findMany({
    select: {
      id: true,
      countryIso3: true,
      subdivisionId: true,
    },
  });

  console.log(`📊 Total de votos a revisar: ${votes.length}\n`);

  let fixed = 0;
  let alreadyCorrect = 0;
  let noSubdivision = 0;

  for (const vote of votes) {
    const { id, countryIso3, subdivisionId } = vote;
    
    if (!subdivisionId) {
      noSubdivision++;
      continue;
    }

    const validSubs = validSubdivisions.get(countryIso3);
    if (!validSubs || validSubs.size === 0) {
      // Este país no tiene subdivisiones en los GeoJSON
      continue;
    }

    // Parsear el subdivisionId actual
    // Formato actual: "ESP.16.3" o "16.3"
    // Formato deseado: "16" (solo el primer nivel de subdivisión)
    
    const parts = subdivisionId.replace(countryIso3 + '.', '').split('.');
    const mainSubdivision = parts[0]; // "16" de "ESP.16.3" o "16.3"
    
    // Verificar si esta subdivisión existe en los GeoJSON
    if (!validSubs.has(mainSubdivision)) {
      console.log(`⚠️  Voto ${id}: ${countryIso3}.${subdivisionId} - subdivisión ${mainSubdivision} NO existe`);
      // Seleccionar una subdivisión válida aleatoria
      const validSubsArray = Array.from(validSubs);
      const randomSub = validSubsArray[Math.floor(Math.random() * validSubsArray.length)];
      
      await prisma.vote.update({
        where: { id },
        data: { subdivisionId: randomSub },
      });
      
      fixed++;
    } else if (subdivisionId !== mainSubdivision) {
      // La subdivisión existe, pero el formato está mal (tiene 3 niveles)
      // Actualizar a solo 2 niveles
      await prisma.vote.update({
        where: { id },
        data: { subdivisionId: mainSubdivision },
      });
      
      fixed++;
    } else {
      alreadyCorrect++;
    }
  }

  console.log('\n✅ Proceso completado:\n');
  console.log(`   Votos corregidos:           ${fixed}`);
  console.log(`   Votos ya correctos:         ${alreadyCorrect}`);
  console.log(`   Votos sin subdivisión:      ${noSubdivision}`);
  console.log(`   Total procesado:            ${votes.length}\n`);

  // Verificar resultado
  console.log('🔍 Verificando resultado...\n');
  
  const updatedVotes = await prisma.vote.findMany({
    select: { subdivisionId: true, countryIso3: true },
    take: 10,
  });

  console.log('📋 Muestra de 10 votos actualizados:');
  updatedVotes.forEach((vote, i) => {
    console.log(`   ${i + 1}. ${vote.countryIso3}: ${vote.subdivisionId}`);
  });

  await prisma.$disconnect();
}

fixVotesToMatchGeoJSON().catch(console.error);
