@echo off
echo ========================================
echo   SEED DE VOTOS HISTORICOS (Railway)
echo ========================================
echo.
echo Este script ejecutara el seed en Railway
echo Insertara votos distribuidos en el ultimo año
echo.
echo Presiona Ctrl+C para cancelar...
timeout /t 3

echo.
echo Compilando script TypeScript...
npx tsc scripts/seed-historical-votes.ts --outDir scripts/dist --module commonjs --target es2020 --esModuleInterop --skipLibCheck

echo.
echo Ejecutando seed en Railway...
railway run node scripts/dist/seed-historical-votes.js

echo.
echo ========================================
echo   PROCESO COMPLETADO
echo ========================================
pause
