# Script para optimizar los archivos TopoJSON más grandes
# Usa mapshaper para simplificar geometrías

$baseDir = "C:\Users\rober\proyectos\VoteTokFront\static\geojson"

# Lista de los 20 archivos más grandes (según el análisis previo)
$targetFiles = @(
    "CHL\CHL.topojson",
    "GBR\GBR.topojson",
    "JAM\JAM.undefined.topojson",
    "BRA\BRA.13.topojson",
    "CAN\CAN.8.topojson",
    "GBR\GBR.3.topojson",
    "IDN\IDN.topojson",
    "CYP\CYP.undefined.topojson",
    "BRA\BRA.25.topojson",
    "NZL\NZL.topojson",
    "AUS\AUS.topojson",
    "BHS\BHS.topojson",
    "GBR\GBR.1.topojson",
    "BRA\BRA.21.topojson",
    "CHL\CHL.11.topojson",
    "GRL\GRL.topojson",
    "BRA\BRA.5.topojson",
    "AUS\AUS.5.topojson",
    "BRA\BRA.16.topojson",
    "USA\USA.2.topojson"
)

$totalOriginal = 0
$totalOptimized = 0
$processedCount = 0

Write-Host "[INICIO] Optimizacion de archivos TopoJSON..." -ForegroundColor Cyan
Write-Host "[CONFIG] Simplificacion: 20% (mantiene 80% de puntos)" -ForegroundColor Yellow
Write-Host "[SEGURO] Metodo: Visvalingam (conserva TODOS los poligonos, solo reduce puntos)" -ForegroundColor Green
Write-Host ""

foreach ($file in $targetFiles) {
    $filePath = Join-Path $baseDir $file
    
    if (Test-Path $filePath) {
        # Obtener tamaño original
        $originalSize = (Get-Item $filePath).Length
        $totalOriginal += $originalSize
        
        # Crear backup
        $backupPath = $filePath -replace '\.topojson$', '.backup.topojson'
        Copy-Item $filePath $backupPath -Force
        
        Write-Host "Procesando: $file" -ForegroundColor White
        Write-Host "   Tamaño original: $([math]::Round($originalSize/1KB, 2)) KB" -ForegroundColor Gray
        
        # Optimizar con mapshaper (CONSERVADOR)
        # -simplify visvalingam 20% = reduce 20% de puntos usando método suave Visvalingam
        # keep-shapes = GARANTIZA que NO se pierda ningún polígono
        # -clean = elimina geometrías inválidas sin borrar polígonos
        # planar = tratamiento plano para mejor precisión
        # -o = output con formato TopoJSON
        $tempOutput = $filePath -replace '\.topojson$', '.temp.topojson'
        
        $mapshaperCmd = "mapshaper `"$filePath`" -simplify visvalingam 20% keep-shapes planar -clean -o format=topojson `"$tempOutput`""
        
        try {
            Invoke-Expression $mapshaperCmd | Out-Null
            
            if (Test-Path $tempOutput) {
                # Reemplazar archivo original con el optimizado
                Move-Item $tempOutput $filePath -Force
                
                # Obtener nuevo tamaño
                $newSize = (Get-Item $filePath).Length
                $totalOptimized += $newSize
                $savings = $originalSize - $newSize
                $savingsPercent = [math]::Round(($savings / $originalSize) * 100, 1)
                
                Write-Host "   Tamaño optimizado: $([math]::Round($newSize/1KB, 2)) KB" -ForegroundColor Green
                $savingsKB = [math]::Round($savings/1KB, 2)
                Write-Host "   Ahorro: $savingsKB KB ($savingsPercent%)" -ForegroundColor Cyan
                Write-Host ""
                
                $processedCount++
            }
        } catch {
            Write-Host "   [ERROR] Error al procesar: $_" -ForegroundColor Red
            # Restaurar backup si falla
            if (Test-Path $backupPath) {
                Copy-Item $backupPath $filePath -Force
            }
        }
    } else {
        Write-Host "[AVISO] No encontrado: $file" -ForegroundColor Yellow
    }
}

# Resumen
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "RESUMEN DE OPTIMIZACION" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Archivos procesados: $processedCount de $($targetFiles.Count)" -ForegroundColor White
Write-Host "Tamaño total original: $([math]::Round($totalOriginal/1MB, 2)) MB" -ForegroundColor Yellow
Write-Host "Tamaño total optimizado: $([math]::Round($totalOptimized/1MB, 2)) MB" -ForegroundColor Green
$totalSavings = $totalOriginal - $totalOptimized
$totalSavingsPercent = if ($totalOriginal -gt 0) { [math]::Round(($totalSavings / $totalOriginal) * 100, 1) } else { 0 }
$totalSavingsKB = [math]::Round($totalSavings/1KB, 2)
Write-Host "Ahorro total: $totalSavingsKB KB ($totalSavingsPercent%)" -ForegroundColor Cyan
Write-Host ""
Write-Host "[OK] Optimizacion completada!" -ForegroundColor Green
Write-Host "[INFO] Backups guardados como *.backup.topojson" -ForegroundColor Gray
