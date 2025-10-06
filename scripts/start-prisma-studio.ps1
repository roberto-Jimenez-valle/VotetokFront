# Script para iniciar Prisma Studio en el puerto 5555
# Mata cualquier proceso que esté usando el puerto primero

Write-Host "🔍 Verificando puerto 5555..." -ForegroundColor Cyan

# Buscar proceso en el puerto 5555
$processInfo = netstat -ano | Select-String ":5555" | Select-String "LISTENING"

if ($processInfo) {
    Write-Host "⚠️  Puerto 5555 ocupado, liberando..." -ForegroundColor Yellow
    
    # Extraer el PID del proceso
    $processInfo -match '\s+(\d+)\s*$' | Out-Null
    $pid = $matches[1]
    
    if ($pid) {
        Write-Host "   Matando proceso PID: $pid" -ForegroundColor Yellow
        taskkill /PID $pid /F 2>$null
        Start-Sleep -Seconds 1
        Write-Host "✅ Puerto 5555 liberado" -ForegroundColor Green
    }
} else {
    Write-Host "✅ Puerto 5555 disponible" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Iniciando Prisma Studio en puerto 5555..." -ForegroundColor Cyan
Write-Host "   URL: http://localhost:5555" -ForegroundColor Gray
Write-Host ""

# Iniciar Prisma Studio
npx prisma studio --port 5555
