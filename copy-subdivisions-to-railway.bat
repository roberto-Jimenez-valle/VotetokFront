@echo off
echo =========================================
echo Copiando Subdivisiones de LOCAL a RAILWAY
echo =========================================
echo.

set DATABASE_URL=postgresql://postgres:ajlnBQueMwvXXqyIsJHUSSZbDbwvLzSn@metro.proxy.rlwy.net:54076/railway

echo Leyendo de: prisma/dev.db (SQLite)
echo Escribiendo a: Railway PostgreSQL
echo.

npx tsx scripts/copy-subdivisions-local-to-railway.ts

if errorlevel 1 (
    echo.
    echo ❌ Error copiando subdivisiones
    exit /b 1
)

echo.
echo =========================================
echo ✅ Subdivisiones copiadas exitosamente
echo =========================================
echo.
echo Ahora puedes ejecutar: .\run-seed.bat
