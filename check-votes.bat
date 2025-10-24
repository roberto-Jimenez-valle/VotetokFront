@echo off
echo Compilando script...
npx tsc scripts/check-votes-count.ts --outDir scripts/dist --module commonjs --target es2020 --esModuleInterop --skipLibCheck

if %errorlevel% neq 0 (
  echo Error al compilar
  pause
  exit /b 1
)

echo.
echo Consultando votos en Railway...
railway run node scripts/dist/check-votes-count.js

pause
