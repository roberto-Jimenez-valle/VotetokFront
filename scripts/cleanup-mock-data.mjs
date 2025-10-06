#!/usr/bin/env node

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');


// Archivos a eliminar
const filesToDelete = [
  'src/lib/poll-data.ts',
  'src/lib/data/featured-users.ts',
  'static/data/votes-example.json',
];

// Eliminar archivos
let deletedCount = 0;
filesToDelete.forEach(file => {
  const filePath = join(rootDir, file);
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath);
            deletedCount++;
    } catch (error) {
          }
  } else {
      }
});


// Actualizar header.svelte
const headerPath = join(rootDir, 'src/lib/header.svelte');
if (existsSync(headerPath)) {
  let headerContent = readFileSync(headerPath, 'utf-8');
  
  // Eliminar el fallback con usuarios mock
  const fallbackRegex = /\/\/ Fallback:.*?\n\s*users = \[[\s\S]*?\];/g;
  if (fallbackRegex.test(headerContent)) {
    headerContent = headerContent.replace(fallbackRegex, '// Sin fallback mock\n      users = [];');
    writeFileSync(headerPath, headerContent, 'utf-8');
      } else {
      }
}

// Actualizar +page.svelte
const pagePath = join(rootDir, 'src/routes/+page.svelte');
if (existsSync(pagePath)) {
  let pageContent = readFileSync(pagePath, 'utf-8');
  
  // Eliminar topUsers
  const topUsersRegex = /const topUsers = \[[\s\S]*?\];/g;
  if (topUsersRegex.test(pageContent)) {
    pageContent = pageContent.replace(topUsersRegex, '// topUsers eliminado - usar API');
    writeFileSync(pagePath, pageContent, 'utf-8');
      } else {
      }
}

// Buscar Math.random() restantes
const filesToCheck = [
  'src/lib/globe/BottomSheet.svelte',
  'src/lib/GlobeGL.svelte',
  'src/lib/header.svelte',
  'src/routes/+page.svelte',
];

let randomCount = 0;
filesToCheck.forEach(file => {
  const filePath = join(rootDir, file);
  if (existsSync(filePath)) {
    const content = readFileSync(filePath, 'utf-8');
    const matches = content.match(/Math\.random\(\)/g);
    if (matches) {
            randomCount += matches.length;
    }
  }
});

if (randomCount === 0) {
  } else {
    }

// Buscar URLs externas
const urlPatterns = [
  { name: 'pravatar.cc', pattern: /pravatar\.cc/g },
  { name: 'randomuser.me', pattern: /randomuser\.me/g },
];

urlPatterns.forEach(({ name, pattern }) => {
  let urlCount = 0;
  filesToCheck.forEach(file => {
    const filePath = join(rootDir, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      const matches = content.match(pattern);
      if (matches) {
                urlCount += matches.length;
      }
    }
  });
  
  if (urlCount === 0) {
      }
});

