@echo off
echo =========================================
echo Configurando Base de Datos Railway
echo =========================================
echo.

set DATABASE_URL=postgresql://postgres:ajlnBQueMwvXXqyIsJHUSSZbDbwvLzSn@metro.proxy.rlwy.net:54076/railway

echo Aplicando schema...
npx prisma db push --accept-data-loss --skip-generate

if errorlevel 1 (
    echo.
    echo ❌ Error aplicando schema
    exit /b 1
)

echo.
echo ✅ Schema aplicado correctamente
echo.
echo Ejecutando seed...
npx tsx prisma/seed.ts

echo.
echo =========================================
echo ✅ Configuracion completada
echo =========================================
