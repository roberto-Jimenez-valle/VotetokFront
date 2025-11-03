@echo off
echo Descargando archivos GADM nivel 3...
echo.

mkdir temp_gadm_downloads 2>nul

echo Descargando Libya (LBY)...
curl -o temp_gadm_downloads/LBY_level3.json "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_LBY_3.json" 2>nul
if errorlevel 1 (
    echo   Intentando nivel 2...
    curl -o temp_gadm_downloads/LBY_level2.json "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_LBY_2.json"
)

echo.
echo Descarga completa!
echo Archivos en: temp_gadm_downloads
echo.
echo SIGUIENTE PASO:
echo   npx tsx scripts/process-gadm-files.ts
pause
