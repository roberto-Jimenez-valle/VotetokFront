# Script para actualizar .env con los secrets generados

$envFile = ".env"
$jwtSecret = "84549e29caccddafc192bca90fa2e653c9d78c16afe1fa968a86e369215194f7"
$appSecret = "3c936cdc9c7087bef3e653780cd2209d4c8ec4c873f1c808f5c2e01cd69dc1a3405b4e8f35c50728c250d8bf28300cc5293ee54b05d76b1ee78e9a2795fe1a36"

# Leer contenido actual
$content = Get-Content $envFile -Raw

# Reemplazar secrets
$content = $content -replace "JWT_SECRET=change-this-secret-in-production-use-random-32-chars-minimum", "JWT_SECRET=$jwtSecret"
$content = $content -replace "APP_SECRET=change-this-app-secret-in-production-random-64-chars-minimum", "APP_SECRET=$appSecret"
$content = $content -replace "VITE_APP_SECRET=change-this-app-secret-in-production-random-64-chars-minimum", "VITE_APP_SECRET=$appSecret"

# Guardar
$content | Set-Content $envFile -NoNewline

Write-Host "✅ Archivo .env actualizado con los secrets" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Configuración aplicada:" -ForegroundColor Cyan
Write-Host "  JWT_SECRET: $($jwtSecret.Substring(0, 20))..." -ForegroundColor Gray
Write-Host "  APP_SECRET: $($appSecret.Substring(0, 20))..." -ForegroundColor Gray
Write-Host "  VITE_APP_ID: voutop-web-v1" -ForegroundColor Gray
Write-Host "  VITE_APP_SECRET: $($appSecret.Substring(0, 20))..." -ForegroundColor Gray
Write-Host ""
