#!/usr/bin/env pwsh
# Script de ayuda rápida para VouTop Mobile

Write-Host "`n🚀 VouTop - Comandos Rápidos Mobile`n" -ForegroundColor Cyan

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "📱 COMANDOS DISPONIBLES" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor DarkGray

Write-Host "`n🔧 Sincronización y Apertura:" -ForegroundColor Green
Write-Host "  npm run mobile:sync          " -NoNewline -ForegroundColor White
Write-Host "→ Sincronizar cambios web a apps" -ForegroundColor Gray
Write-Host "  npm run mobile:android       " -NoNewline -ForegroundColor White
Write-Host "→ Abrir Android Studio" -ForegroundColor Gray
Write-Host "  npm run mobile:ios           " -NoNewline -ForegroundColor White
Write-Host "→ Abrir Xcode (macOS only)" -ForegroundColor Gray

Write-Host "`n🏗️  Compilación Local:" -ForegroundColor Green
Write-Host "  npm run mobile:build:android " -NoNewline -ForegroundColor White
Write-Host "→ Compilar APK local" -ForegroundColor Gray
Write-Host "  npm run mobile:build:ios     " -NoNewline -ForegroundColor White
Write-Host "→ Preparar iOS local" -ForegroundColor Gray

Write-Host "`n📤 Git & Deploy:" -ForegroundColor Green
Write-Host "  git add .                    " -NoNewline -ForegroundColor White
Write-Host "→ Agregar cambios" -ForegroundColor Gray
Write-Host "  git commit -m 'mensaje'      " -NoNewline -ForegroundColor White
Write-Host "→ Hacer commit" -ForegroundColor Gray
Write-Host "  git push origin main         " -NoNewline -ForegroundColor White
Write-Host "→ Push (activa GitHub Actions)" -ForegroundColor Gray

Write-Host "`n═══════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "📚 DOCUMENTACIÓN" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor DarkGray

Write-Host "`n  PRIMER_PUSH.md             " -NoNewline -ForegroundColor Cyan
Write-Host "→ Instrucciones primer push" -ForegroundColor Gray
Write-Host "  MOBILE_BUILD_GUIDE.md      " -NoNewline -ForegroundColor Cyan
Write-Host "→ Guía completa" -ForegroundColor Gray
Write-Host "  ARCHITECTURE_BUILD.md      " -NoNewline -ForegroundColor Cyan
Write-Host "→ Diagrama arquitectura" -ForegroundColor Gray
Write-Host "  CHECKLIST_SETUP.md         " -NoNewline -ForegroundColor Cyan
Write-Host "→ Checklist setup" -ForegroundColor Gray

Write-Host "`n═══════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "🎯 FLUJO RECOMENDADO" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor DarkGray

Write-Host "`n  1. Desarrollar web       " -NoNewline -ForegroundColor White
Write-Host "→ npm run dev" -ForegroundColor DarkCyan
Write-Host "  2. Sincronizar mobile    " -NoNewline -ForegroundColor White
Write-Host "→ npm run mobile:sync" -ForegroundColor DarkCyan
Write-Host "  3. Probar en Android     " -NoNewline -ForegroundColor White
Write-Host "→ npm run mobile:android" -ForegroundColor DarkCyan
Write-Host "  4. Commit cambios        " -NoNewline -ForegroundColor White
Write-Host "→ git add . && git commit -m '...'" -ForegroundColor DarkCyan
Write-Host "  5. Push a GitHub         " -NoNewline -ForegroundColor White
Write-Host "→ git push origin main" -ForegroundColor DarkCyan
Write-Host "  6. Descargar apps        " -NoNewline -ForegroundColor White
Write-Host "→ GitHub → Actions → Artifacts" -ForegroundColor DarkCyan

Write-Host "`n═══════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "📦 DESCARGAR APPS COMPILADAS" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor DarkGray

Write-Host "`n  1. Ve a tu repositorio en GitHub" -ForegroundColor White
Write-Host "  2. Click en 'Actions'" -ForegroundColor White
Write-Host "  3. Selecciona el workflow más reciente" -ForegroundColor White
Write-Host "  4. Descarga desde 'Artifacts':" -ForegroundColor White
Write-Host "     • android-apk  " -NoNewline -ForegroundColor Cyan
Write-Host "→ Aplicación Android (.apk)" -ForegroundColor Gray
Write-Host "     • ios-ipa      " -NoNewline -ForegroundColor Cyan
Write-Host "→ Aplicación iOS (.ipa)" -ForegroundColor Gray
Write-Host "  5. O desde 'Releases' (permanente)" -ForegroundColor White

Write-Host "`n═══════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "⚡ EJECUTAR WORKFLOW MANUAL" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor DarkGray

Write-Host "`n  1. GitHub → Actions" -ForegroundColor White
Write-Host "  2. 'Build Mobile Apps' → 'Run workflow'" -ForegroundColor White
Write-Host "  3. Seleccionar:" -ForegroundColor White
Write-Host "     ☑️  Build Android APK" -ForegroundColor Green
Write-Host "     ☑️  Build iOS IPA" -ForegroundColor Green
Write-Host "  4. Click 'Run workflow'" -ForegroundColor White
Write-Host "  5. Esperar ~15 minutos" -ForegroundColor White

Write-Host "`n═══════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "✅ ESTADO ACTUAL" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor DarkGray

Write-Host "`n  ✅ Capacitor iOS instalado" -ForegroundColor Green
Write-Host "  ✅ GitHub Actions configurado" -ForegroundColor Green
Write-Host "  ✅ Scripts NPM agregados" -ForegroundColor Green
Write-Host "  ✅ Documentación completa" -ForegroundColor Green

Write-Host "`n  🎯 Próximo paso: " -NoNewline -ForegroundColor Cyan
Write-Host "git push origin main" -ForegroundColor Yellow

Write-Host "`n═══════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""

# Preguntar si quiere ejecutar algún comando
Write-Host "¿Quieres ejecutar algún comando ahora? (y/n): " -NoNewline -ForegroundColor Yellow
$response = Read-Host

if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host "`nComandos disponibles:" -ForegroundColor Cyan
    Write-Host "  1. npm run mobile:sync" -ForegroundColor White
    Write-Host "  2. npm run mobile:android" -ForegroundColor White
    Write-Host "  3. git status" -ForegroundColor White
    Write-Host "  4. Ver PRIMER_PUSH.md" -ForegroundColor White
    Write-Host "  5. Salir" -ForegroundColor White
    
    Write-Host "`nSelecciona (1-5): " -NoNewline -ForegroundColor Yellow
    $cmd = Read-Host
    
    switch ($cmd) {
        "1" { npm run mobile:sync }
        "2" { npm run mobile:android }
        "3" { git status }
        "4" { Get-Content PRIMER_PUSH.md | Write-Host -ForegroundColor White }
        default { Write-Host "Saliendo..." -ForegroundColor Gray }
    }
}

Write-Host "`n🚀 Para más ayuda, lee MOBILE_BUILD_GUIDE.md`n" -ForegroundColor Cyan
