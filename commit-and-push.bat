@echo off
echo Haciendo commit y push...
git commit -m "Fix static files loading in production"
git push
echo.
echo ✅ Cambios desplegados a Railway
echo Espera 2-3 minutos para que Railway complete el build
