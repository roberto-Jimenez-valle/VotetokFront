# ===============================================
# VOTETOK - QUICK SETUP SCRIPT
# Configura todo el entorno de desarrollo rápidamente
# ===============================================

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  VOTETOK - CONFIGURACIÓN RÁPIDA" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar requisitos
Write-Host "[1/10] Verificando requisitos..." -ForegroundColor Yellow

# Verificar Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "❌ Node.js no está instalado. Por favor instala Node.js 20+" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js instalado: $nodeVersion" -ForegroundColor Green

# Verificar Docker
$dockerVersion = docker --version 2>$null
if (-not $dockerVersion) {
    Write-Host "⚠️ Docker no está instalado. Algunas funciones no estarán disponibles." -ForegroundColor Yellow
} else {
    Write-Host "✅ Docker instalado: $dockerVersion" -ForegroundColor Green
}

# Verificar pnpm
$pnpmVersion = pnpm --version 2>$null
if (-not $pnpmVersion) {
    Write-Host "📦 Instalando pnpm..." -ForegroundColor Yellow
    npm install -g pnpm@8
}
Write-Host "✅ pnpm instalado" -ForegroundColor Green

Write-Host ""

# Instalar dependencias
Write-Host "[2/10] Instalando dependencias..." -ForegroundColor Yellow
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error instalando dependencias" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencias instaladas" -ForegroundColor Green

Write-Host ""

# Generar Prisma Client
Write-Host "[3/10] Generando Prisma Client..." -ForegroundColor Yellow
npx prisma generate
Write-Host "✅ Prisma Client generado" -ForegroundColor Green

Write-Host ""

# Configurar archivo .env
Write-Host "[4/10] Configurando variables de entorno..." -ForegroundColor Yellow
if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
    Write-Host "✅ Archivo .env.local creado (revisa y actualiza las variables)" -ForegroundColor Green
} else {
    Write-Host "✅ Archivo .env.local ya existe" -ForegroundColor Green
}

Write-Host ""

# Levantar servicios Docker
if ($dockerVersion) {
    Write-Host "[5/10] Levantando servicios Docker..." -ForegroundColor Yellow
    
    # Verificar si docker-compose está corriendo
    $dockerRunning = docker ps 2>$null
    if ($dockerRunning) {
        Write-Host "🐳 Iniciando PostgreSQL y Redis..." -ForegroundColor Cyan
        docker-compose up -d postgres redis
        
        # Esperar a que los servicios estén listos
        Write-Host "⏳ Esperando a que los servicios estén listos..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
        
        Write-Host "✅ Servicios Docker levantados" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Docker Desktop no está corriendo. Inícialo manualmente." -ForegroundColor Yellow
    }
} else {
    Write-Host "[5/10] Saltando Docker (no instalado)" -ForegroundColor Yellow
}

Write-Host ""

# Ejecutar migraciones
Write-Host "[6/10] Ejecutando migraciones de base de datos..." -ForegroundColor Yellow
$env:DATABASE_URL = "postgresql://voutop:voutop_pass@localhost:5432/voutop_db"

# Verificar conexión a BD
$canConnect = $false
try {
    npx prisma db push --skip-generate 2>$null
    $canConnect = $true
} catch {
    $canConnect = $false
}

if ($canConnect) {
    npx prisma migrate dev --name init
    Write-Host "✅ Migraciones aplicadas" -ForegroundColor Green
} else {
    Write-Host "⚠️ No se pudo conectar a la BD. Ejecuta las migraciones manualmente más tarde." -ForegroundColor Yellow
}

Write-Host ""

# Aplicar índices optimizados
if ($canConnect -and (Test-Path "prisma/indexes-optimization.sql")) {
    Write-Host "[7/10] Aplicando índices optimizados..." -ForegroundColor Yellow
    # Aquí normalmente usarías psql, pero en Windows es más complejo
    Write-Host "ℹ️ Ejecuta manualmente: psql -U voutop -d voutop_db -f prisma/indexes-optimization.sql" -ForegroundColor Cyan
}

Write-Host ""

# Optimizar assets
Write-Host "[8/10] Optimizando assets..." -ForegroundColor Yellow
if (Test-Path "scripts/optimize-assets.mjs") {
    node scripts/optimize-assets.mjs
    Write-Host "✅ Assets optimizados" -ForegroundColor Green
} else {
    Write-Host "⚠️ Script de optimización no encontrado" -ForegroundColor Yellow
}

Write-Host ""

# Construir aplicación
Write-Host "[9/10] Construyendo aplicación..." -ForegroundColor Yellow
$buildChoice = Read-Host "¿Quieres hacer build ahora? (s/n)"
if ($buildChoice -eq "s") {
    if (Test-Path "vite.config.optimized.js") {
        npm run build:optimized
    } else {
        npm run build
    }
    Write-Host "✅ Build completado" -ForegroundColor Green
} else {
    Write-Host "ℹ️ Puedes hacer build más tarde con: npm run build:optimized" -ForegroundColor Cyan
}

Write-Host ""

# Ejecutar tests
Write-Host "[10/10] Ejecutando tests..." -ForegroundColor Yellow
$testChoice = Read-Host "¿Quieres ejecutar los tests? (s/n)"
if ($testChoice -eq "s") {
    npm run test:unit
    Write-Host "✅ Tests ejecutados" -ForegroundColor Green
} else {
    Write-Host "ℹ️ Puedes ejecutar tests más tarde con: npm test" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  ✅ CONFIGURACIÓN COMPLETADA" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "📝 PRÓXIMOS PASOS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Revisa y actualiza .env.local con tus valores" -ForegroundColor White
Write-Host "  2. Ejecuta el servidor de desarrollo:" -ForegroundColor White
Write-Host "     npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. Accede a la aplicación en:" -ForegroundColor White
Write-Host "     http://localhost:5173" -ForegroundColor Yellow
Write-Host ""

if ($dockerVersion) {
    Write-Host "📊 SERVICIOS DISPONIBLES:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  • PostgreSQL: localhost:5432" -ForegroundColor White
    Write-Host "  • Redis: localhost:6379" -ForegroundColor White
    Write-Host "  • Redis Commander: http://localhost:8081" -ForegroundColor White
    Write-Host "  • pgAdmin: http://localhost:5050" -ForegroundColor White
    Write-Host ""
}

Write-Host "📚 DOCUMENTACIÓN:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  • Guía de implementación: COMPLETE_IMPLEMENTATION_GUIDE.md" -ForegroundColor White
Write-Host "  • Informe de auditoría: AUDIT_REPORT.md" -ForegroundColor White
Write-Host "  • Informe de refactorización: REFACTORING_COMPLETE_REPORT.md" -ForegroundColor White
Write-Host ""
Write-Host "Disfruta desarrollando con VouTop optimizado!" -ForegroundColor Green
