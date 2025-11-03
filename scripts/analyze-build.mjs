/**
 * Analizar tamaños de chunks del build
 */

import fs from 'fs';
import path from 'path';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function analyzeDirectory(dir, label) {
  if (!fs.existsSync(dir)) {
    console.log(`⚠️  Directorio no existe: ${dir}`);
    return;
  }

  console.log(`\n📊 ${label}:`);
  console.log('='.repeat(60));

  const files = fs.readdirSync(dir, { withFileTypes: true })
    .filter(f => f.isFile() && f.name.endsWith('.js'))
    .map(f => {
      const fullPath = path.join(dir, f.name);
      const stats = fs.statSync(fullPath);
      return { name: f.name, size: stats.size };
    })
    .sort((a, b) => b.size - a.size);

  if (files.length === 0) {
    console.log('   (sin archivos .js)');
    return;
  }

  let totalSize = 0;
  files.forEach((file, i) => {
    if (i < 15) { // Top 15
      console.log(`   ${formatSize(file.size).padStart(10)} - ${file.name}`);
    }
    totalSize += file.size;
  });

  console.log('   ' + '-'.repeat(58));
  console.log(`   ${formatSize(totalSize).padStart(10)} - TOTAL (${files.length} archivos)`);
}

console.log('\n🔍 ANÁLISIS DE BUILD');

// Client chunks
analyzeDirectory('build/client/_app/immutable/chunks', 'CLIENT CHUNKS');

// Client entries
analyzeDirectory('build/client/_app/immutable/entries', 'CLIENT ENTRIES');

// Server chunks
analyzeDirectory('build/server/chunks', 'SERVER CHUNKS (Top 15)');

console.log('\n✅ Análisis completado\n');
