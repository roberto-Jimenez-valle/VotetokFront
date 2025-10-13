import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVotesSubdivisions() {
  console.log('🔍 Verificando formatos de subdivision_id en votos...\n');

  // Obtener todos los votos con sus subdivision_id
  const votes = await prisma.vote.findMany({
    select: {
      subdivisionId: true,
      countryIso3: true,
      countryName: true,
      subdivisionName: true,
    },
  });

  console.log(`📊 Total de votos: ${votes.length}\n`);

  // Analizar formatos
  const formatCounts: Record<string, number> = {
    'null': 0,
    'nivel_1': 0,  // Solo número: "1"
    'nivel_2': 0,  // Dos niveles: "1.3"
    'nivel_3': 0,  // Tres niveles: "1.3.2"
    'invalido': 0,
  };

  const uniqueFormats = new Set<string>();
  const samplesByFormat: Record<string, string[]> = {
    'null': [],
    'nivel_1': [],
    'nivel_2': [],
    'nivel_3': [],
    'invalido': [],
  };

  for (const vote of votes) {
    const { subdivisionId, countryIso3 } = vote;
    
    if (!subdivisionId) {
      formatCounts['null']++;
      if (samplesByFormat['null'].length < 5) {
        samplesByFormat['null'].push(`${countryIso3}: NULL`);
      }
      continue;
    }

    uniqueFormats.add(subdivisionId);
    const parts = subdivisionId.split('.');
    
    if (parts.length === 1) {
      formatCounts['nivel_1']++;
      if (samplesByFormat['nivel_1'].length < 5) {
        samplesByFormat['nivel_1'].push(`${countryIso3}: ${subdivisionId}`);
      }
    } else if (parts.length === 2) {
      formatCounts['nivel_2']++;
      if (samplesByFormat['nivel_2'].length < 5) {
        samplesByFormat['nivel_2'].push(`${countryIso3}: ${subdivisionId}`);
      }
    } else if (parts.length === 3) {
      formatCounts['nivel_3']++;
      if (samplesByFormat['nivel_3'].length < 5) {
        samplesByFormat['nivel_3'].push(`${countryIso3}: ${subdivisionId}`);
      }
    } else {
      formatCounts['invalido']++;
      if (samplesByFormat['invalido'].length < 5) {
        samplesByFormat['invalido'].push(`${countryIso3}: ${subdivisionId}`);
      }
    }
  }

  console.log('📊 DISTRIBUCIÓN DE FORMATOS:\n');
  console.log(`   NULL (sin subdivision_id):          ${formatCounts['null']} (${((formatCounts['null'] / votes.length) * 100).toFixed(1)}%)`);
  console.log(`   Nivel 1 (ej: "1"):                  ${formatCounts['nivel_1']} (${((formatCounts['nivel_1'] / votes.length) * 100).toFixed(1)}%)`);
  console.log(`   Nivel 2 (ej: "1.3"):                ${formatCounts['nivel_2']} (${((formatCounts['nivel_2'] / votes.length) * 100).toFixed(1)}%)`);
  console.log(`   Nivel 3 (ej: "1.3.2"):              ${formatCounts['nivel_3']} (${((formatCounts['nivel_3'] / votes.length) * 100).toFixed(1)}%)`);
  console.log(`   Inválidos:                          ${formatCounts['invalido']} (${((formatCounts['invalido'] / votes.length) * 100).toFixed(1)}%)\n`);

  // Mostrar ejemplos de cada formato
  for (const [format, samples] of Object.entries(samplesByFormat)) {
    if (samples.length > 0) {
      console.log(`\n🔍 Ejemplos de ${format}:`);
      samples.forEach(sample => console.log(`   ${sample}`));
    }
  }

  console.log(`\n📈 Formatos únicos encontrados: ${uniqueFormats.size}`);

  // Verificar si el formato esperado es correcto
  const expectedFormat = formatCounts['nivel_3'] === votes.length;
  
  if (expectedFormat) {
    console.log('\n✅ PERFECTO: Todos los votos tienen el formato de 3 niveles requerido\n');
  } else {
    console.log('\n⚠️  PROBLEMA DETECTADO:');
    
    if (formatCounts['null'] > 0) {
      console.log(`   - ${formatCounts['null']} votos sin subdivision_id`);
    }
    if (formatCounts['nivel_1'] > 0) {
      console.log(`   - ${formatCounts['nivel_1']} votos con solo 1 nivel (debe ser 3)`);
    }
    if (formatCounts['nivel_2'] > 0) {
      console.log(`   - ${formatCounts['nivel_2']} votos con solo 2 niveles (debe ser 3)`);
    }
    if (formatCounts['invalido'] > 0) {
      console.log(`   - ${formatCounts['invalido']} votos con formato inválido`);
    }
    
    console.log('\n💡 SOLUCIÓN:');
    console.log('   Ejecuta: npx tsx scripts/fix-votes-subdivisions.ts');
    console.log('   Este script corregirá todos los subdivision_id al formato correcto\n');
  }

  await prisma.$disconnect();
}

checkVotesSubdivisions().catch(console.error);
