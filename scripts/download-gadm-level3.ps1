# Script para descargar archivos GADM nivel 3 para países que no lo tienen
# GADM (Global Administrative Areas) - https://gadm.org

$ErrorActionPreference = "Stop"

# Países que necesitan nivel 3 (según análisis previo)
$countries = @(
    @{Code="LBY"; Name="Libya"},
    @{Code="ARM"; Name="Armenia"},
    @{Code="BHS"; Name="Bahamas"},
    @{Code="BLZ"; Name="Belize"},
    @{Code="CYP"; Name="Cyprus"},
    @{Code="ISR"; Name="Israel"},
    @{Code="JAM"; Name="Jamaica"},
    @{Code="KWT"; Name="Kuwait"},
    @{Code="MDA"; Name="Moldova"},
    @{Code="MKD"; Name="North Macedonia"},
    @{Code="MNE"; Name="Montenegro"},
    @{Code="QAT"; Name="Qatar"},
    @{Code="LSO"; Name="Lesotho"},
    @{Code="PRI"; Name="Puerto Rico"},
    @{Code="ESH"; Name="Western Sahara"},
    @{Code="TTO"; Name="Trinidad and Tobago"},
    @{Code="ATF"; Name="French Southern Territories"},
    @{Code="GRL"; Name="Greenland"},
    @{Code="FLK"; Name="Falkland Islands"}
)

Write-Host "📥 Descargando archivos GADM nivel 3..." -ForegroundColor Cyan
Write-Host ""

# Crear directorio temporal para descargas
$tempDir = "temp_gadm_downloads"
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir | Out-Null
}

$downloadedCount = 0
$failedCount = 0
$failedCountries = @()

foreach ($country in $countries) {
    $code = $country.Code
    $name = $country.Name
    
    Write-Host "🌍 $code - $name" -ForegroundColor Yellow
    
    # URL de GADM para GeoJSON nivel 3
    # Formato: https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_{ISO3}_3.json
    $url = "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_${code}_3.json"
    $outputFile = Join-Path $tempDir "${code}_level3.json"
    
    try {
        Write-Host "   Descargando desde GADM..." -ForegroundColor Gray
        
        # Descargar archivo
        Invoke-WebRequest -Uri $url -OutFile $outputFile -ErrorAction Stop
        
        # Verificar que se descargó
        if (Test-Path $outputFile) {
            $fileSize = (Get-Item $outputFile).Length
            $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
            Write-Host "   ✅ Descargado: $fileSizeMB MB" -ForegroundColor Green
            $downloadedCount++
        } else {
            Write-Host "   ❌ Error: Archivo no encontrado" -ForegroundColor Red
            $failedCount++
            $failedCountries += $code
        }
    }
    catch {
        Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        
        # Si nivel 3 no existe, intentar nivel 2
        Write-Host "   Intentando nivel 2..." -ForegroundColor Gray
        $url2 = "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_${code}_2.json"
        $outputFile2 = Join-Path $tempDir "${code}_level2.json"
        
        try {
            Invoke-WebRequest -Uri $url2 -OutFile $outputFile2 -ErrorAction Stop
            if (Test-Path $outputFile2) {
                $fileSize = (Get-Item $outputFile2).Length
                $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
                Write-Host "   ⚠️  Solo nivel 2 disponible: $fileSizeMB MB" -ForegroundColor Yellow
                $downloadedCount++
            }
        }
        catch {
            Write-Host "   ❌ Nivel 2 tampoco disponible" -ForegroundColor Red
            $failedCount++
            $failedCountries += $code
        }
    }
    
    Write-Host ""
}

Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "📊 RESUMEN DE DESCARGAS" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Descargados: $downloadedCount / $($countries.Count)" -ForegroundColor Green
Write-Host "❌ Fallidos: $failedCount" -ForegroundColor Red

if ($failedCountries.Count -gt 0) {
    Write-Host ""
    Write-Host "Países fallidos:" -ForegroundColor Red
    foreach ($code in $failedCountries) {
        Write-Host "  - $code" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📁 Archivos descargados en: $tempDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔧 SIGUIENTE PASO:" -ForegroundColor Yellow
Write-Host "   Ejecutar: npx tsx scripts/process-gadm-files.ts" -ForegroundColor White
Write-Host ""
