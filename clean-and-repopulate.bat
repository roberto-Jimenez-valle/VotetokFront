@echo off
echo =========================================
echo Limpiando y Re-poblando Base de Datos
echo =========================================
echo.

set DATABASE_URL=postgresql://postgres:ajlnBQueMwvXXqyIsJHUSSZbDbwvLzSn@metro.proxy.rlwy.net:54076/railway

echo Paso 1: Limpiando subdivisiones antiguas...
npx tsx -e "import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient(); await prisma.subdivision.deleteMany({}); console.log('✅ Subdivisiones eliminadas'); await prisma.$disconnect();"

echo.
echo Paso 2: Re-poblando con nivel correcto...
npx tsx scripts/populate-subdivisions.ts

echo.
echo Paso 3: Ejecutando seed con datos completos...
npx tsx prisma/seed.ts

echo.
echo =========================================
echo ✅ Proceso completado
echo =========================================
