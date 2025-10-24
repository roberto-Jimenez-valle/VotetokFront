@echo off
echo =========================================
echo Copiando Subdivisiones LOCAL → RAILWAY
echo =========================================
echo.

echo Paso 1/2: Exportar de LOCAL (SQLite) a JSON...
echo.
npx tsx scripts/export-subdivisions-from-local.ts

if errorlevel 1 (
    echo.
    echo ❌ Error exportando de LOCAL
    exit /b 1
)

echo.
echo =========================================
echo Paso 2/2: Importar de JSON a RAILWAY...
echo =========================================
echo.

set DATABASE_URL=postgresql://postgres:ajlnBQueMwvXXqyIsJHUSSZbDbwvLzSn@metro.proxy.rlwy.net:54076/railway

npx tsx scripts/import-subdivisions-to-railway.ts

if errorlevel 1 (
    echo.
    echo ❌ Error importando a RAILWAY
    exit /b 1
)

echo.
echo =========================================
echo ✅ PROCESO COMPLETADO
echo =========================================
echo.
echo Las subdivisiones de tu DB local ahora están en Railway
echo.
echo Siguiente paso: .\run-seed.bat
