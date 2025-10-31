# ===============================================
# VOTETOK - INSTALACION SIMPLIFICADA
# ===============================================

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  VOTETOK - INSTALACION SIMPLIFICADA" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar Node.js
Write-Host "[1/5] Verificando Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js no esta instalado" -ForegroundColor Red
    Write-Host "Por favor instala Node.js desde: https://nodejs.org" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK - Node.js instalado: $nodeVersion" -ForegroundColor Green
Write-Host ""

# Instalar pnpm
Write-Host "[2/5] Instalando pnpm..." -ForegroundColor Yellow
npm install -g pnpm@8
Write-Host "OK - pnpm instalado" -ForegroundColor Green
Write-Host ""

# Instalar dependencias
Write-Host "[3/5] Instalando dependencias del proyecto..." -ForegroundColor Yellow
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: No se pudieron instalar las dependencias" -ForegroundColor Red
    exit 1
}
Write-Host "OK - Dependencias instaladas" -ForegroundColor Green
Write-Host ""

# Crear archivo .env.local
Write-Host "[4/5] Configurando variables de entorno..." -ForegroundColor Yellow
if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
    Write-Host "OK - Archivo .env.local creado" -ForegroundColor Green
} else {
    Write-Host "OK - Archivo .env.local ya existe" -ForegroundColor Green
}
Write-Host ""

# Generar Prisma Client
Write-Host "[5/5] Generando Prisma Client..." -ForegroundColor Yellow
npx prisma generate
Write-Host "OK - Prisma Client generado" -ForegroundColor Green
Write-Host ""

# Resumen final
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  INSTALACION COMPLETADA" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "SIGUIENTES PASOS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. DOCKER (Opcional pero recomendado):" -ForegroundColor Cyan
Write-Host "   - Asegurate de que Docker Desktop este corriendo" -ForegroundColor White
Write-Host "   - Ejecuta: docker-compose up -d postgres redis" -ForegroundColor White
Write-Host ""
Write-Host "2. INICIAR DESARROLLO:" -ForegroundColor Cyan
Write-Host "   pnpm dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. ABRIR EN NAVEGADOR:" -ForegroundColor Cyan
Write-Host "   http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "NOTA: Si no tienes Docker, la app funcionara con SQLite local" -ForegroundColor Gray
Write-Host ""
