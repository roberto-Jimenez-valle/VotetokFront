@echo off
echo =========================================
echo Poblando Subdivisiones en Railway
echo =========================================
echo.

set DATABASE_URL=postgresql://postgres:ajlnBQueMwvXXqyIsJHUSSZbDbwvLzSn@metro.proxy.rlwy.net:54076/railway

echo Ejecutando script de subdivisiones...
echo (Esto puede tomar 2-3 minutos)
echo.

npx tsx scripts/populate-subdivisions.ts

if errorlevel 1 (
    echo.
    echo ❌ Error poblando subdivisiones
    exit /b 1
)

echo.
echo =========================================
echo ✅ Subdivisiones pobladas
echo =========================================
echo.
echo Ahora ejecuta: .\run-seed.bat
