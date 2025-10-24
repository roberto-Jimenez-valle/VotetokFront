@echo off
echo =========================================
echo Importando Subdivisiones a RAILWAY
echo =========================================
echo.

set DATABASE_URL=postgresql://postgres:ajlnBQueMwvXXqyIsJHUSSZbDbwvLzSn@metro.proxy.rlwy.net:54076/railway

npx tsx scripts/import-subdivisions-to-railway.ts

if errorlevel 1 (
    echo.
    echo ❌ Error importando
    exit /b 1
)

echo.
echo ✅ Importación completada
echo.
echo Ahora ejecuta: .\run-seed.bat
