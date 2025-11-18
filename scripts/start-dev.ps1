# Script para iniciar la aplicacion completa (Web + Base de datos)
# Libera puertos si estan ocupados y los inicia en puertos fijos

$WEB_PORT = 5173
$DB_PORT = 5555

Write-Host ""
Write-Host "INICIANDO voutop - Desarrollo Completo" -ForegroundColor Cyan
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
Write-Host "   - API Docs:      http://localhost:$WEB_PORT/api-docs" -ForegroundColor Magenta
Write-Host "   - Prisma Studio: http://localhost:$DB_PORT" -ForegroundColor Green
Write-Host ""
Write-Host "Se abriran automaticamente:" -ForegroundColor Yellow
Write-Host "   1. Swagger UI (Documentacion API)" -ForegroundColor Cyan
Write-Host "   2. Prisma Studio (Base de Datos)" -ForegroundColor Cyan
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

# Función para abrir el navegador cuando el servidor esté listo
$browserJob = Start-Job -ScriptBlock {
    param($webPort, $dbPort)
    
    # Esperar a que el servidor web esté listo
    $maxAttempts = 30
    $attempt = 0
    $serverReady = $false
    
    while ($attempt -lt $maxAttempts -and -not $serverReady) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$webPort" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $serverReady = $true
            }
        } catch {
            # Servidor aún no está listo
        }
        
        if (-not $serverReady) {
            Start-Sleep -Seconds 1
            $attempt++
        }
    }
    
    if ($serverReady) {
        # Servidor listo, abrir Swagger UI
        Start-Sleep -Seconds 1
        Start-Process "http://localhost:$webPort/api-docs"
        
        # Esperar medio segundo y abrir Prisma Studio
        Start-Sleep -Milliseconds 500
        Start-Process "http://localhost:$dbPort"
    }
} -ArgumentList $WEB_PORT, $DB_PORT

# Iniciar Vite Dev (esto bloqueara hasta que se presione Ctrl+C)
try {
    npm run dev
} finally {
    # Detener el job del navegador
    Stop-Job -Job $browserJob -ErrorAction SilentlyContinue
    Remove-Job -Job $browserJob -ErrorAction SilentlyContinue
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
