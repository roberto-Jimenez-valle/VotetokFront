@echo off
echo =========================================
echo Importacion RAPIDA con createMany
echo =========================================
echo.

set DATABASE_URL=postgresql://postgres:ajlnBQueMwvXXqyIsJHUSSZbDbwvLzSn@metro.proxy.rlwy.net:54076/railway

echo Ejecutando importacion en batches de 1000...
echo (Sera 100x mas rapido que uno por uno)
echo.

npx tsx scripts/import-subdivisions-FAST.ts

if errorlevel 1 (
    echo.
    echo ❌ Error importando
    exit /b 1
)

echo.
echo =========================================
echo ✅ Importacion completada
echo =========================================
echo.
echo Ahora ejecuta: .\run-seed.bat
