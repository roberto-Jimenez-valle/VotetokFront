@echo off
echo =======================================
echo   SEED VOTOS CON FECHAS (Railway)
echo =======================================
echo.
echo Insertara 1,000-2,000 votos distribuidos
echo en el ultimo año
echo.

npx tsc scripts/seed-votes-with-dates.ts --outDir scripts/dist --module es2020 --target es2020 --esModuleInterop --skipLibCheck --moduleResolution node

if %errorlevel% neq 0 (
  echo Error al compilar
  pause
  exit /b 1
)

echo.
echo Configurando DATABASE_URL...
set DATABASE_URL=postgresql://postgres:ajlnBQueMwvXXqyIsJHUSSZbDbwvLzSn@metro.proxy.rlwy.net:54076/railway

echo.
echo Regenerando Prisma Client...
npx prisma generate

echo.
echo Ejecutando seed...
node scripts/dist/seed-votes-with-dates.js

echo.
echo =======================================
echo   COMPLETADO
echo =======================================
pause
