# Script para agregar la API Key de Giphy al .env
# Ejecutar: .\setup-giphy-env.ps1

$envFile = ".env"
$giphyKey = "JiEJUHdqINWZXrJe9Qya0nJ6piG4kZ6Z"

# Si no existe .env, crear desde .env.example
if (-not (Test-Path $envFile)) {
    Write-Host "📄 Creando .env desde .env.example..." -ForegroundColor Yellow
    Copy-Item .env.example $envFile
}

# Leer contenido actual
$content = Get-Content $envFile -Raw

# Verificar si ya existe la variable
if ($content -match "VITE_GIPHY_API_KEY") {
    Write-Host "⚠️  VITE_GIPHY_API_KEY ya existe en .env" -ForegroundColor Yellow
    Write-Host "   Actualizando valor..." -ForegroundColor Yellow
    
    # Reemplazar la línea existente
    $content = $content -replace "VITE_GIPHY_API_KEY=.*", "VITE_GIPHY_API_KEY=$giphyKey"
    Set-Content -Path $envFile -Value $content -NoNewline
} else {
    Write-Host "➕ Agregando VITE_GIPHY_API_KEY a .env..." -ForegroundColor Green
    
    # Agregar al final
    Add-Content -Path $envFile -Value "`n# Giphy API"
    Add-Content -Path $envFile -Value "VITE_GIPHY_API_KEY=$giphyKey"
}

Write-Host "✅ API Key de Giphy configurada correctamente!" -ForegroundColor Green
Write-Host ""
Write-Host "🔄 Ahora reinicia el servidor:" -ForegroundColor Cyan
Write-Host "   Ctrl+C (detener)"
Write-Host "   npm run dev (iniciar)"
