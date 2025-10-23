@echo off
echo =========================================
echo Configurando Base de Datos Railway
echo =========================================
echo.

REM Reemplaza AQUI_TU_DATABASE_URL con el valor real
set DATABASE_URL=AQUI_TU_DATABASE_URL

echo Generando Prisma Client...
npx prisma generate

echo.
echo Aplicando schema...
npx prisma db push --skip-generate

echo.
echo Ejecutando seed...
npx tsx prisma/seed.ts

echo.
echo =========================================
echo ✅ Configuracion completada
echo =========================================
