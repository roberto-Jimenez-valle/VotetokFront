@echo off
echo =========================================
echo Desplegando correccion a Railway
echo =========================================
echo.

git commit -m "Fix Railway deployment configuration"
if errorlevel 1 (
    echo Error en commit. Los archivos ya pueden estar staged.
)

echo.
echo Haciendo push a GitHub...
git push
if errorlevel 1 (
    echo Error en push
    exit /b 1
)

echo.
echo =========================================
echo ✅ Deploy iniciado en Railway
echo =========================================
echo.
echo Ahora:
echo 1. Ve a Railway dashboard
echo 2. Espera a que termine el build
echo 3. Verifica los logs
echo 4. Ejecuta el setup de DB (primera vez):
echo    railway run bash scripts/railway-db-setup.sh
echo.
