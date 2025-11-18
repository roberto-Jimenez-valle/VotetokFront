@echo off
echo ========================================
echo 🚀 voutop Mobile HTTPS Tunnel
echo ========================================
echo.
echo 1. Asegurate de que el servidor este corriendo (npm run dev)
echo 2. Ngrok creara un tunel HTTPS
echo 3. Usa la URL https://xxx.ngrok.io en tu movil
echo.
echo Presiona CTRL+C para detener
echo ========================================
echo.
ngrok http 5173
