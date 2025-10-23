@echo off
echo =========================================
echo Ejecutando Seed en Railway
echo =========================================
echo.

set DATABASE_URL=postgresql://postgres:ajlnBQueMwvXXqyIsJHUSSZbDbwvLzSn@metro.proxy.rlwy.net:54076/railway

echo Poblando base de datos...
npx tsx prisma/seed.ts

if errorlevel 1 (
    echo.
    echo ❌ Error ejecutando seed
    exit /b 1
)

echo.
echo =========================================
echo ✅ Seed completado
echo =========================================
