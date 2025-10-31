# ===============================================
# Script para construir y desplegar con Docker
# ===============================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev', 'prod')]
    [string]$Environment = 'dev'
)

Write-Host "🚀 VoteTok Docker Build Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que pnpm-lock.yaml esté actualizado
Write-Host "📦 Verificando dependencias..." -ForegroundColor Yellow

if ($Environment -eq 'prod') {
    Write-Host "🔍 Verificando lockfile para producción..." -ForegroundColor Yellow
    
    # Actualizar lockfile si es necesario
    $updateLock = Read-Host "¿Actualizar pnpm-lock.yaml? (s/n)"
    if ($updateLock -eq 's') {
        Write-Host "📝 Actualizando lockfile..." -ForegroundColor Green
        pnpm install
        Write-Host "✅ Lockfile actualizado" -ForegroundColor Green
    }
    
    # Build de producción
    Write-Host ""
    Write-Host "🏗️  Construyendo imagen de producción..." -ForegroundColor Yellow
    docker build -f Dockerfile.prod -t voutop-app:latest .
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Imagen construida exitosamente" -ForegroundColor Green
        Write-Host ""
        Write-Host "Para ejecutar:" -ForegroundColor Cyan
        Write-Host "  docker-compose --profile production up -d" -ForegroundColor White
    } else {
        Write-Host "❌ Error al construir la imagen" -ForegroundColor Red
        exit 1
    }
} else {
    # Build de desarrollo
    Write-Host "🏗️  Construyendo imagen de desarrollo..." -ForegroundColor Yellow
    docker build -f Dockerfile.dev -t voutop-app:dev .
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Imagen construida exitosamente" -ForegroundColor Green
        Write-Host ""
        Write-Host "Para ejecutar:" -ForegroundColor Cyan
        Write-Host "  docker run -p 3000:3000 -v ${PWD}:/app voutop-app:dev" -ForegroundColor White
    } else {
        Write-Host "❌ Error al construir la imagen" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✨ Proceso completado" -ForegroundColor Green
