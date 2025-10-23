# Script para configurar la base de datos en Railway
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Configurando Base de Datos en Railway" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Paso 1: Obteniendo DATABASE_URL de Railway..." -ForegroundColor Yellow
$env:DATABASE_URL = railway variables get DATABASE_URL

if (-not $env:DATABASE_URL) {
    Write-Host "❌ Error: No se pudo obtener DATABASE_URL" -ForegroundColor Red
    exit 1
}

Write-Host "✅ DATABASE_URL obtenida" -ForegroundColor Green
Write-Host ""

Write-Host "Paso 2: Aplicando schema a la base de datos..." -ForegroundColor Yellow
npx prisma db push --accept-data-loss --skip-generate

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error aplicando schema" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Paso 3: Ejecutando seed..." -ForegroundColor Yellow
npx tsx prisma/seed.ts

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Advertencia: Seed falló, pero las tablas deberían estar creadas" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Configuración completada" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
