#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');


function runCommand(command, description) {
    try {
    execSync(command, { cwd: rootDir, stdio: 'inherit' });
        return true;
  } catch (error) {
    console.error(`❌ Error en: ${description}`);
    console.error(error.message);
    return false;
  }
}

// Paso 1: Verificar que las dependencias estén instaladas
const nodeModulesExists = existsSync(join(rootDir, 'node_modules'));
if (!nodeModulesExists) {
    if (!runCommand('npm install', 'Instalación de dependencias')) {
    process.exit(1);
  }
}

// Paso 2: Verificar Prisma
const prismaClientExists = existsSync(join(rootDir, 'node_modules/@prisma/client'));
if (!prismaClientExists) {
    if (!runCommand('npm install @prisma/client', 'Instalación de Prisma Client')) {
    process.exit(1);
  }
}

// Paso 3: Generar cliente Prisma
if (!runCommand('npx prisma generate', 'Generación del cliente Prisma')) {
  process.exit(1);
}

// Paso 4: Verificar si ya existe la base de datos
const dbExists = existsSync(join(rootDir, 'prisma/dev.db'));
if (dbExists) {
    } else {
  // Paso 5: Ejecutar migración
  if (!runCommand('npx prisma migrate dev --name init', 'Creación de base de datos')) {
    process.exit(1);
  }
}

// Paso 6: Ejecutar seed
if (!runCommand('npx tsx prisma/seed.ts', 'Población de datos iniciales')) {
  process.exit(1);
}

// Paso 7: Ejecutar limpieza automática
if (!runCommand('node scripts/auto-cleanup.mjs', 'Limpieza de código mock')) {
  }



