# Script para iniciar la aplicacion completa (Web + Base de datos)
# Libera puertos si estan ocupados y los inicia en puertos fijos

$WEB_PORT = 5173
$DB_PORT = 5555

Write-Host ""
Write-Host "INICIANDO VOTETOK - Desarrollo Completo" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Funcion para liberar un puerto
function Free-Port {
    param($Port, $Name)
    
    Write-Host "Verificando puerto $Port ($Name)..." -ForegroundColor Yellow
    
    $processInfo = netstat -ano | Select-String ":$Port" | Select-String "LISTENING" | Select-Object -First 1
    
    if ($processInfo) {
        Write-Host "   Puerto $Port ocupado, liberando..." -ForegroundColor Red
        
        $line = $processInfo.ToString()
        $parts = $line -split '\s+' | Where-Object { $_ -ne '' }
        $processId = $parts[-1]
        
        if ($processId -and $processId -match '^\d+$') {
            Write-Host "   Matando proceso PID: $processId" -ForegroundColor Yellow
            taskkill /PID $processId /F 2>&1 | Out-Null
            Start-Sleep -Seconds 1
            Write-Host "   Puerto $Port liberado" -ForegroundColor Green
        }
    } else {
        Write-Host "   Puerto $Port disponible" -ForegroundColor Green
    }
}

# Liberar puertos
Free-Port -Port $WEB_PORT -Name "Web"
Free-Port -Port $DB_PORT -Name "Database"

Write-Host ""
Write-Host "Generando Prisma Client..." -ForegroundColor Cyan
npx prisma generate 2>$null | Out-Null

Write-Host ""
Write-Host "Iniciando servicios..." -ForegroundColor Cyan
Write-Host "   - Web App:       http://localhost:$WEB_PORT" -ForegroundColor Green
Write-Host "   - Prisma Studio: http://localhost:$DB_PORT" -ForegroundColor Green
Write-Host ""
Write-Host "Presiona Ctrl+C para detener todos los servicios" -ForegroundColor Gray
Write-Host ""

# Iniciar Prisma Studio en segundo plano
$studioJob = Start-Job -ScriptBlock {
    param($port)
    Set-Location $using:PWD
    npx prisma studio --port $port
} -ArgumentList $DB_PORT

# Esperar un momento para que Prisma Studio inicie
Start-Sleep -Seconds 2

# Iniciar Vite Dev (esto bloqueara hasta que se presione Ctrl+C)
try {
    npm run dev
} finally {
    # Cuando se presiona Ctrl+C, detener Prisma Studio
    Write-Host ""
    Write-Host "Deteniendo servicios..." -ForegroundColor Yellow
    Stop-Job -Job $studioJob -ErrorAction SilentlyContinue
    Remove-Job -Job $studioJob -ErrorAction SilentlyContinue
    
    # Liberar puertos por si acaso
    Free-Port -Port $WEB_PORT -Name "Web"
    Free-Port -Port $DB_PORT -Name "Database"
    
    Write-Host "Servicios detenidos correctamente" -ForegroundColor Green
}
