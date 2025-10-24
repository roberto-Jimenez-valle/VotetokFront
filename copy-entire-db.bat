@echo off
echo =========================================
echo COPIAR TODA LA DB LOCAL A RAILWAY
echo =========================================
echo.
echo Este script copiara TODAS las tablas:
echo - Usuarios
echo - Encuestas y opciones
echo - Subdivisiones (49K)
echo - Votos
echo - Historial de votos
echo - Hashtags
echo.

set DATABASE_URL=postgresql://postgres:ajlnBQueMwvXXqyIsJHUSSZbDbwvLzSn@metro.proxy.rlwy.net:54076/railway

npx tsx scripts/copy-entire-db-to-railway.ts

if errorlevel 1 (
    echo.
    echo ❌ Error copiando base de datos
    exit /b 1
)

echo.
echo =========================================
echo ✅ BASE DE DATOS COPIADA COMPLETAMENTE
echo =========================================
echo.
echo Tu DB local ahora esta en Railway
echo Verifica: www.voutop.com
