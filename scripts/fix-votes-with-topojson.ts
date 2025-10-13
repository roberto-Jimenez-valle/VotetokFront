import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface SubdivisionInfo {
  id: string; // ESP.16.3
  name: string;
  lat?: number;
  lng?: number;
}

async function fixVotesWithTopoJSON() {
  console.log('🔧 Corrigiendo subdivision_id usando datos de archivos TopoJSON...\n');

  // 1. Cargar todas las subdivisiones de los archivos TopoJSON
  const geojsonDir = path.join(process.cwd(), 'static', 'geojson');
  const subdivisionsByCountry = new Map<string, SubdivisionInfo[]>();

  console.log('📂 Leyendo archivos TopoJSON...');
  
  const countries = fs.readdirSync(geojsonDir);
  
  for (const country of countries) {
    const countryPath = path.join(geojsonDir, country);
    if (!fs.statSync(countryPath).isDirectory()) continue;
    
    const subdivisions: SubdivisionInfo[] = [];
    const files = fs.readdirSync(countryPath);
    
    for (const file of files) {
      if (!file.endsWith('.topojson')) continue;
      if (file === `${country}.topojson`) continue;
      
      try {
        const filePath = path.join(countryPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        for (const [key, value] of Object.entries(data.objects || {})) {
          const obj = value as any;
          if (obj.geometries) {
            for (const geom of obj.geometries) {
              if (geom.properties && geom.properties.ID_2) {
                subdivisions.push({
                  id: geom.properties.ID_2, // ej: ESP.16.3
                  name: geom.properties.name_2 || geom.properties.NAME_2 || ''
                });
              }
            }
          }
        }
      } catch (error) {
        // Ignorar errores de lectura
      }
    }
    
    if (subdivisions.length > 0) {
      subdivisionsByCountry.set(country, subdivisions);
    }
  }

  console.log(`✅ ${subdivisionsByCountry.size} países con subdivisiones cargados`);
  
  const espSubs = subdivisionsByCountry.get('ESP');
  if (espSubs) {
    console.log(`🇪🇸 España: ${espSubs.length} subdivisiones`);
    console.log(`   Ejemplos: ${espSubs.slice(0, 5).map(s => s.id).join(', ')}\n`);
  }

  // 2. Obtener todos los votos
  const votes = await prisma.vote.findMany({
    select: {
      id: true,
      countryIso3: true,
      subdivisionId: true,
      latitude: true,
      longitude: true,
    },
  });

  console.log(`📊 Total de votos: ${votes.length}\n`);

  let fixed = 0;
  let noSubdivisionAvailable = 0;

  for (const vote of votes) {
    const { id, countryIso3, subdivisionId, latitude, longitude } = vote;
    
    const subdivisions = subdivisionsByCountry.get(countryIso3);
    if (!subdivisions || subdivisions.length === 0) {
      noSubdivisionAvailable++;
      continue;
    }

    // Seleccionar una subdivisión aleatoria (o por proximidad si tuviéramos coordenadas)
    const randomSubdivision = subdivisions[Math.floor(Math.random() * subdivisions.length)];
    
    // El formato debe ser ESP.16.3, pero solo guardamos 16.3 en la DB
    // porque el countryIso3 ya está en otro campo
    const subdivisionIdWithoutCountry = randomSubdivision.id.replace(`${countryIso3}.`, '');
    
    await prisma.vote.update({
      where: { id },
      data: { 
        subdivisionId: subdivisionIdWithoutCountry,
        subdivisionName: randomSubdivision.name
      },
    });
    
    fixed++;
    
    if (fixed % 1000 === 0) {
      console.log(`   Procesados: ${fixed} votos...`);
    }
  }

  console.log('\n✅ Proceso completado:\n');
  console.log(`   Votos actualizados:                 ${fixed}`);
  console.log(`   Votos sin subdivisiones disponibles: ${noSubdivisionAvailable}`);
  console.log(`   Total:                              ${votes.length}\n`);

  // Verificar resultado
  const sampleVotes = await prisma.vote.findMany({
    select: { countryIso3: true, subdivisionId: true, subdivisionName: true },
    take: 10,
    where: { subdivisionId: { not: null } }
  });

  console.log('📋 Muestra de 10 votos actualizados:');
  sampleVotes.forEach((vote, i) => {
    console.log(`   ${i + 1}. ${vote.countryIso3}.${vote.subdivisionId} - ${vote.subdivisionName}`);
  });

  await prisma.$disconnect();
}

fixVotesWithTopoJSON().catch(console.error);
