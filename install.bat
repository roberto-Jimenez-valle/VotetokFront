@echo off
REM ===============================================
REM VOTETOK - INSTALACION PARA WINDOWS
REM ===============================================

echo.
echo ===============================================
echo   VOTETOK - INSTALACION PARA WINDOWS
echo ===============================================
echo.

REM Verificar Node.js
echo [1/5] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js no esta instalado
    echo Por favor instala Node.js desde: https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo OK - Node.js instalado: %NODE_VERSION%
echo.

REM Instalar pnpm
echo [2/5] Instalando pnpm...
call npm install -g pnpm@8
echo OK - pnpm instalado
echo.

REM Instalar dependencias
echo [3/5] Instalando dependencias del proyecto...
call pnpm install
if %errorlevel% neq 0 (
    echo ERROR: No se pudieron instalar las dependencias
    pause
    exit /b 1
)
echo OK - Dependencias instaladas
echo.

REM Crear archivo .env.local
echo [4/5] Configurando variables de entorno...
if not exist ".env.local" (
    copy ".env.example" ".env.local" >nul
    echo OK - Archivo .env.local creado
) else (
    echo OK - Archivo .env.local ya existe
)
echo.

REM Generar Prisma Client
echo [5/5] Generando Prisma Client...
call npx prisma generate
echo OK - Prisma Client generado
echo.

echo ===============================================
echo   INSTALACION COMPLETADA
echo ===============================================
echo.
echo SIGUIENTES PASOS:
echo.
echo 1. DOCKER (Opcional pero recomendado):
echo    - Asegurate de que Docker Desktop este corriendo
echo    - Ejecuta: docker-compose up -d postgres redis
echo.
echo 2. INICIAR DESARROLLO:
echo    pnpm dev
echo.
echo 3. ABRIR EN NAVEGADOR:
echo    http://localhost:5173
echo.
echo NOTA: Si no tienes Docker, la app funcionara con SQLite local
echo.
pause
