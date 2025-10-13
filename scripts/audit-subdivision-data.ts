import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface SubdivisionData {
  id: string;
  name: string;
  subdivisions?: SubdivisionData[];
}

interface CountryData {
  id: string;
  name: string;
  subdivisions: SubdivisionData[];
}

async function auditSubdivisionData() {
  console.log('🔍 Auditando datos de subdivisiones en votos...\n');

  // Cargar datos geográficos reales
  const geoDataPath = path.join(process.cwd(), 'static', 'data', 'world-subdivisions.json');
  const geoData: CountryData[] = JSON.parse(fs.readFileSync(geoDataPath, 'utf-8'));

  // Construir índice de subdivisiones válidas
  const validSubdivisions = new Set<string>();
  
  for (const country of geoData) {
    // Nivel 2: País.Subdivisión
    for (const subdivision of country.subdivisions) {
      validSubdivisions.add(`${country.id}.${subdivision.id}`);
      
      // Nivel 3: País.Subdivisión.Sub-subdivisión
      if (subdivision.subdivisions) {
        for (const subSub of subdivision.subdivisions) {
          validSubdivisions.add(`${country.id}.${subdivision.id}.${subSub.id}`);
        }
      }
    }
  }

  console.log(`✅ ${validSubdivisions.size} subdivisiones válidas cargadas\n`);

  // Obtener todos los votos únicos con sus subdivision_id
  const votes = await prisma.vote.findMany({
    select: {
      subdivisionId: true,
      countryIso3: true,
    },
  });

  console.log(`📊 Total de votos: ${votes.length}\n`);

  // Analizar formatos
  const formatCounts: Record<string, number> = {
    'nivel_1': 0, // Solo país (ESP)
    'nivel_2': 0, // País.subdivisión (ESP.1)
    'nivel_3': 0, // País.subdivisión.sub (ESP.1.3)
    'invalido': 0, // Formato inválido
  };

  const invalidVotes: Array<{ countryIso3: string; subdivisionId: string }> = [];
  const nonExistentSubdivisions = new Set<string>();

  for (const vote of votes) {
    const { countryIso3, subdivisionId } = vote;
    
    if (!subdivisionId) {
      formatCounts['invalido']++;
      invalidVotes.push({ countryIso3, subdivisionId: 'NULL' });
      continue;
    }

    // Contar niveles
    const parts = subdivisionId.split('.');
    
    if (parts.length === 1) {
      formatCounts['nivel_1']++;
    } else if (parts.length === 2) {
      formatCounts['nivel_2']++;
      // Verificar si existe
      const fullId = `${countryIso3}.${subdivisionId}`;
      if (!validSubdivisions.has(fullId)) {
        nonExistentSubdivisions.add(fullId);
      }
    } else if (parts.length === 3) {
      formatCounts['nivel_3']++;
      // Verificar si existe
      const fullId = `${countryIso3}.${subdivisionId}`;
      if (!validSubdivisions.has(fullId)) {
        nonExistentSubdivisions.add(fullId);
      }
    } else {
      formatCounts['invalido']++;
      invalidVotes.push({ countryIso3, subdivisionId });
    }
  }

  // Mostrar resultados
  console.log('📊 Distribución de formatos:');
  console.log(`   Nivel 1 (solo país):           ${formatCounts['nivel_1']}`);
  console.log(`   Nivel 2 (país.subdiv):         ${formatCounts['nivel_2']}`);
  console.log(`   Nivel 3 (país.subdiv.subsub):  ${formatCounts['nivel_3']}`);
  console.log(`   Inválidos:                     ${formatCounts['invalido']}\n`);

  if (nonExistentSubdivisions.size > 0) {
    console.log(`⚠️  ${nonExistentSubdivisions.size} subdivisiones NO EXISTEN en los datos geográficos:\n`);
    
    const samples = Array.from(nonExistentSubdivisions).slice(0, 20);
    samples.forEach(subdiv => {
      console.log(`   ❌ ${subdiv}`);
    });
    
    if (nonExistentSubdivisions.size > 20) {
      console.log(`   ... y ${nonExistentSubdivisions.size - 20} más\n`);
    }

    // Contar votos afectados
    const affectedVotes = votes.filter(vote => {
      const fullId = `${vote.countryIso3}.${vote.subdivisionId}`;
      return nonExistentSubdivisions.has(fullId);
    });

    console.log(`\n⚠️  ${affectedVotes.length} votos tienen subdivisiones inexistentes`);
    console.log(`   Porcentaje afectado: ${((affectedVotes.length / votes.length) * 100).toFixed(2)}%\n`);
  } else {
    console.log('✅ Todas las subdivisiones en votos existen en los datos geográficos\n');
  }

  if (invalidVotes.length > 0) {
    console.log(`❌ ${invalidVotes.length} votos con formato inválido:\n`);
    invalidVotes.slice(0, 10).forEach(vote => {
      console.log(`   País: ${vote.countryIso3}, Subdivisión: ${vote.subdivisionId}`);
    });
    if (invalidVotes.length > 10) {
      console.log(`   ... y ${invalidVotes.length - 10} más\n`);
    }
  }

  // Verificar si necesitamos actualizar
  const needsUpdate = nonExistentSubdivisions.size > 0 || formatCounts['nivel_1'] > 0 || formatCounts['nivel_2'] > 0;

  if (needsUpdate) {
    console.log('\n⚠️  ACCIÓN REQUERIDA:');
    console.log('   Los votos necesitan ser actualizados para tener formato consistente de 3 niveles');
    console.log('   y usar solo subdivisiones que existan en los datos geográficos.\n');
    console.log('   Ejecuta: npx tsx scripts/fix-votes-subdivisions.ts\n');
  } else {
    console.log('\n✅ Todos los votos tienen el formato correcto (3 niveles) y subdivisiones válidas\n');
  }

  await prisma.$disconnect();
}

auditSubdivisionData().catch(console.error);
