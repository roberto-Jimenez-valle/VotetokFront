#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');


// 1. Limpiar BottomSheet.svelte
const bottomSheetPath = join(rootDir, 'src/lib/globe/BottomSheet.svelte');
let bottomSheet = readFileSync(bottomSheetPath, 'utf-8');

// Reemplazar generateHistoricalData con versión que usa API
const oldGenerateHistorical = /\/\/ Helper para generar datos históricos mock[\s\S]*?return data;\s*}/;
const newGenerateHistorical = `// Helper para cargar datos históricos desde API
  async function loadHistoricalData(pollId: number, days: number) {
    try {
      const response = await fetch(\`/api/polls/\${pollId}/history?days=\${days}\`);
      if (!response.ok) throw new Error('Failed to load history');
      const { data } = await response.json();
      return data.map((item: any) => ({
        x: new Date(item.recordedAt).getTime(),
        y: item.percentage,
        votes: item.voteCount,
      }));
    } catch (error) {
      console.error('Error loading historical data:', error);
      return [];
    }
  }`;

bottomSheet = bottomSheet.replace(oldGenerateHistorical, newGenerateHistorical);

// Reemplazar uso de generateHistoricalData
bottomSheet = bottomSheet.replace(
  /\$: historicalData = generateHistoricalData\([^)]+\);/g,
  '// historicalData se carga dinámicamente desde la API'
);

// Reemplazar Math.random() en creadores
bottomSheet = bottomSheet.replace(
  /{@const creatorNames = \[[^\]]+\]}\s*{@const creatorName = creatorNames\[Math\.floor\(Math\.random\(\)[^\]]+\]}\s*{@const avatarHue = Math\.floor\(Math\.random\(\)[^}]+}/g,
  ''
);

// Reemplazar Math.random() en estadísticas
bottomSheet = bottomSheet.replace(
  /Math\.floor\(Math\.random\(\) \* \d+\) \+ \d+/g,
  '0 /* TODO: cargar desde API */'
);

// Reemplazar Math.random() en general
bottomSheet = bottomSheet.replace(
  /Math\.random\(\)/g,
  '0.5 /* removed random */'
);

// Reemplazar pravatar.cc
bottomSheet = bottomSheet.replace(
  /https:\/\/i\.pravatar\.cc\/\d+\?[^"']+/g,
  '/default-avatar.png'
);

writeFileSync(bottomSheetPath, bottomSheet, 'utf-8');

// 2. Limpiar GlobeGL.svelte
const globeGLPath = join(rootDir, 'src/lib/GlobeGL.svelte');
let globeGL = readFileSync(globeGLPath, 'utf-8');

// Reemplazar Math.random()
globeGL = globeGL.replace(
  /Math\.random\(\)/g,
  '0.5 /* removed random */'
);

// Reemplazar pravatar.cc
globeGL = globeGL.replace(
  /https:\/\/i\.pravatar\.cc\/\d+\?[^"']+/g,
  '/default-avatar.png'
);

writeFileSync(globeGLPath, globeGL, 'utf-8');

// 3. Limpiar header.svelte
const headerPath = join(rootDir, 'src/lib/header.svelte');
let header = readFileSync(headerPath, 'utf-8');

// Reemplazar pravatar.cc
header = header.replace(
  /https:\/\/i\.pravatar\.cc\/\d+\?[^"']+/g,
  '/default-avatar.png'
);

writeFileSync(headerPath, header, 'utf-8');

// Verificación final
const filesToCheck = [
  'src/lib/globe/BottomSheet.svelte',
  'src/lib/GlobeGL.svelte',
  'src/lib/header.svelte',
];

let totalRandom = 0;
let totalPravatar = 0;

filesToCheck.forEach(file => {
  const content = readFileSync(join(rootDir, file), 'utf-8');
  const randomMatches = content.match(/Math\.random\(\)/g);
  const pravaMatches = content.match(/pravatar\.cc/g);
  
  if (randomMatches) {
        totalRandom += randomMatches.length;
  }
  
  if (pravaMatches) {
        totalPravatar += pravaMatches.length;
  }
});

if (totalRandom === 0 && totalPravatar === 0) {
  } else {
  }

