# Script de Testing para Media Proxy
# Ejecutar: .\test-media-proxy.ps1

Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Testing Sistema de Proxy de Medios - VouTop          ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$baseUrl = "http://localhost:5173"
$testsPassed = 0
$testsFailed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus,
        [hashtable]$ExpectedHeaders = @{}
    )
    
    Write-Host "→ Testing: " -NoNewline
    Write-Host $Name -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Head -ErrorAction Stop
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "  ✓ Status Code: " -NoNewline -ForegroundColor Green
            Write-Host "$($response.StatusCode) OK" -ForegroundColor Gray
            
            # Verificar headers esperados
            $allHeadersOk = $true
            foreach ($header in $ExpectedHeaders.Keys) {
                $expectedValue = $ExpectedHeaders[$header]
                $actualValue = $response.Headers[$header]
                
                if ($actualValue -like "*$expectedValue*") {
                    Write-Host "  ✓ Header $header" -NoNewline -ForegroundColor Green
                    Write-Host ": $actualValue" -ForegroundColor Gray
                } else {
                    Write-Host "  ✗ Header $header" -NoNewline -ForegroundColor Red
                    Write-Host ": Expected '$expectedValue', Got '$actualValue'" -ForegroundColor Gray
                    $allHeadersOk = $false
                }
            }
            
            if ($allHeadersOk) {
                $script:testsPassed++
                Write-Host "  ✓ PASSED`n" -ForegroundColor Green
                return $true
            } else {
                $script:testsFailed++
                Write-Host "  ✗ FAILED (headers mismatch)`n" -ForegroundColor Red
                return $false
            }
        } else {
            Write-Host "  ✗ Status Code: Expected $ExpectedStatus, Got $($response.StatusCode)" -ForegroundColor Red
            $script:testsFailed++
            Write-Host "  ✗ FAILED`n" -ForegroundColor Red
            return $false
        }
    } catch {
        if ($_.Exception.Response.StatusCode.Value__ -eq $ExpectedStatus) {
            Write-Host "  ✓ Status Code: " -NoNewline -ForegroundColor Green
            Write-Host "$ExpectedStatus OK (Expected Error)" -ForegroundColor Gray
            $script:testsPassed++
            Write-Host "  ✓ PASSED`n" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
            $script:testsFailed++
            Write-Host "  ✗ FAILED`n" -ForegroundColor Red
            return $false
        }
    }
}

function Test-Api {
    param(
        [string]$Name,
        [string]$Url,
        [hashtable]$Body,
        [string]$ExpectedField
    )
    
    Write-Host "→ Testing API: " -NoNewline
    Write-Host $Name -ForegroundColor Yellow
    
    try {
        $jsonBody = $Body | ConvertTo-Json
        $response = Invoke-RestMethod -Uri $Url -Method Post -Body $jsonBody -ContentType "application/json"
        
        if ($response.success -eq $true -and $response.data.$ExpectedField) {
            Write-Host "  ✓ API Response OK" -ForegroundColor Green
            Write-Host "  ✓ Field '$ExpectedField': " -NoNewline -ForegroundColor Green
            Write-Host "$($response.data.$ExpectedField)" -ForegroundColor Gray
            $script:testsPassed++
            Write-Host "  ✓ PASSED`n" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  ✗ Missing expected field: $ExpectedField" -ForegroundColor Red
            $script:testsFailed++
            Write-Host "  ✗ FAILED`n" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
        $script:testsFailed++
        Write-Host "  ✗ FAILED`n" -ForegroundColor Red
        return $false
    }
}

# Verificar que el servidor está corriendo
Write-Host "Verificando servidor..." -ForegroundColor Cyan
try {
    $healthCheck = Invoke-WebRequest -Uri "$baseUrl/health" -Method Get -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Servidor corriendo en $baseUrl`n" -ForegroundColor Green
} catch {
    Write-Host "✗ Error: El servidor no está corriendo en $baseUrl" -ForegroundColor Red
    Write-Host "  Ejecuta 'npm run dev' primero`n" -ForegroundColor Yellow
    exit 1
}

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  TESTS DEL PROXY DE MEDIOS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Test 1: Imagen de Picsum (no necesita proxy, pero debe funcionar)
Test-Endpoint `
    -Name "Imagen de Picsum (dominio permitido)" `
    -Url "$baseUrl/api/media-proxy?url=https://picsum.photos/200" `
    -ExpectedStatus 200 `
    -ExpectedHeaders @{
        "Content-Type" = "image"
        "Cache-Control" = "public"
        "Access-Control-Allow-Origin" = "*"
    }

# Test 2: Imagen de Imgur
Test-Endpoint `
    -Name "Imagen de Imgur (proxy necesario)" `
    -Url "$baseUrl/api/media-proxy?url=https://i.imgur.com/5LxJr0n.jpg" `
    -ExpectedStatus 200 `
    -ExpectedHeaders @{
        "Content-Type" = "image"
        "Cache-Control" = "public"
    }

# Test 3: Dominio no permitido (debe fallar con 403)
Test-Endpoint `
    -Name "Dominio malicioso (debe ser bloqueado)" `
    -Url "$baseUrl/api/media-proxy?url=https://evil-site.com/malware.jpg" `
    -ExpectedStatus 403

# Test 4: URL HTTP (debe fallar con 400)
Test-Endpoint `
    -Name "Protocolo HTTP inseguro (debe ser rechazado)" `
    -Url "$baseUrl/api/media-proxy?url=http://example.com/image.jpg" `
    -ExpectedStatus 400

# Test 5: Verificar caché
Write-Host "→ Testing: " -NoNewline
Write-Host "Sistema de caché" -ForegroundColor Yellow

$testUrl = "$baseUrl/api/media-proxy?url=https://picsum.photos/300"

# Primera llamada
$response1 = Invoke-WebRequest -Uri $testUrl -Method Head
$cache1 = $response1.Headers['X-Cache']

Start-Sleep -Milliseconds 500

# Segunda llamada
$response2 = Invoke-WebRequest -Uri $testUrl -Method Head
$cache2 = $response2.Headers['X-Cache']

if ($cache1 -eq "MISS" -and $cache2 -eq "HIT") {
    Write-Host "  ✓ Primera llamada: " -NoNewline -ForegroundColor Green
    Write-Host "X-Cache = MISS" -ForegroundColor Gray
    Write-Host "  ✓ Segunda llamada: " -NoNewline -ForegroundColor Green
    Write-Host "X-Cache = HIT" -ForegroundColor Gray
    $script:testsPassed++
    Write-Host "  ✓ PASSED`n" -ForegroundColor Green
} else {
    Write-Host "  ✗ Cache headers: Primera='$cache1', Segunda='$cache2'" -ForegroundColor Red
    $script:testsFailed++
    Write-Host "  ✗ FAILED`n" -ForegroundColor Red
}

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  TESTS DE VALIDACIÓN DE IFRAMES" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Test 6: Validar iframe de YouTube
Test-Api `
    -Name "Validación iframe de YouTube" `
    -Url "$baseUrl/api/validate-iframe" `
    -Body @{ url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } `
    -ExpectedField "sanitizedUrl"

# Test 7: Validar iframe de Vimeo
Test-Api `
    -Name "Validación iframe de Vimeo" `
    -Url "$baseUrl/api/validate-iframe" `
    -Body @{ url = "https://vimeo.com/123456789" } `
    -ExpectedField "sanitizedUrl"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  RESUMEN DE RESULTADOS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

$total = $testsPassed + $testsFailed
Write-Host "Total de tests: " -NoNewline
Write-Host $total -ForegroundColor Cyan

Write-Host "Tests exitosos: " -NoNewline
Write-Host $testsPassed -ForegroundColor Green

Write-Host "Tests fallidos: " -NoNewline
if ($testsFailed -gt 0) {
    Write-Host $testsFailed -ForegroundColor Red
} else {
    Write-Host $testsFailed -ForegroundColor Green
}

$percentage = [math]::Round(($testsPassed / $total) * 100, 2)
Write-Host "`nTasa de éxito: " -NoNewline
if ($percentage -eq 100) {
    Write-Host "$percentage%" -ForegroundColor Green
    Write-Host "`n🎉 ¡Todos los tests pasaron! El sistema está funcionando correctamente.`n" -ForegroundColor Green
} elseif ($percentage -ge 70) {
    Write-Host "$percentage%" -ForegroundColor Yellow
    Write-Host "`n⚠️  Algunos tests fallaron. Revisa los errores arriba.`n" -ForegroundColor Yellow
} else {
    Write-Host "$percentage%" -ForegroundColor Red
    Write-Host "`n❌ Muchos tests fallaron. Revisa la configuración del sistema.`n" -ForegroundColor Red
}

Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Exit code basado en resultados
if ($testsFailed -eq 0) {
    exit 0
} else {
    exit 1
}
