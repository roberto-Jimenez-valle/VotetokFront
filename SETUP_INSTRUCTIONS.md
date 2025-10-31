# 🛠️ INSTRUCCIONES DE CONFIGURACIÓN - VOTETOK

## 🔧 Solución de Problemas Detectados

### 1. ❌ Error: "pnpm no se reconoce"

**Problema:** pnpm no está instalado en tu sistema.

**Solución:**
```bash
# Opción 1: Instalar con npm (recomendado)
npm install -g pnpm@8

# Opción 2: Usar npm directamente
# Reemplaza todos los comandos 'pnpm' por 'npm'
npm install
npm run dev
```

### 2. ❌ Error: "Docker Desktop no puede conectar"

**Problema:** Docker Desktop no está corriendo o no está instalado correctamente.

**Soluciones:**

1. **Si tienes Docker Desktop instalado:**
   - Abre Docker Desktop manualmente
   - Espera a que aparezca "Docker Desktop is running" 
   - Intenta de nuevo: `docker-compose up -d postgres redis`

2. **Si NO tienes Docker instalado:**
   - La app funcionará con SQLite local (sin configuración adicional)
   - O puedes instalar Docker Desktop desde: https://www.docker.com/products/docker-desktop/

3. **Si Docker sigue sin funcionar:**
   - Reinicia tu computadora
   - Abre Docker Desktop como Administrador
   - Verifica que WSL2 esté habilitado (en Windows)

### 3. ❌ Error en script PowerShell

**Problema:** El script tenía errores de sintaxis.

**Solución:** He creado scripts corregidos. Usa uno de estos:

---

## ✅ INSTALACIÓN PASO A PASO (SIMPLIFICADA)

### Opción A: Usar el script .BAT (MÁS SIMPLE)

```cmd
# En Command Prompt o PowerShell:
install.bat
```

### Opción B: Usar PowerShell

```powershell
# En PowerShell:
.\install.ps1
```

### Opción C: Instalación Manual

```bash
# 1. Instalar pnpm (si no lo tienes)
npm install -g pnpm@8

# 2. Instalar dependencias
pnpm install
# O si pnpm no funciona:
npm install

# 3. Copiar configuración
copy .env.example .env.local

# 4. Generar Prisma Client
npx prisma generate

# 5. Iniciar desarrollo
pnpm dev
# O si pnpm no funciona:
npm run dev
```

---

## 📋 CHECKLIST DE VERIFICACIÓN

Antes de empezar, verifica que tienes:

- [ ] **Node.js instalado** (v18 o superior)
  ```bash
  node --version  # Debe mostrar v18.x.x o superior
  ```

- [ ] **NPM funcionando**
  ```bash
  npm --version   # Debe mostrar un número de versión
  ```

- [ ] **Docker Desktop** (OPCIONAL)
  - Si lo tienes: ábrelo y espera a que esté corriendo
  - Si NO lo tienes: la app funcionará con SQLite local

---

## 🚀 INICIO RÁPIDO SIN DOCKER

Si NO tienes Docker o está dando problemas:

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar base de datos SQLite:**
   
   Edita `.env.local` y asegúrate de que tiene:
   ```env
   DATABASE_URL="file:./prisma/dev.db"
   ```

3. **Crear base de datos:**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Iniciar aplicación:**
   ```bash
   npm run dev
   ```

5. **Abrir en navegador:**
   ```
   http://localhost:5173
   ```

---

## 🐳 INICIO CON DOCKER (RECOMENDADO)

Si Docker Desktop está funcionando:

1. **Verificar Docker:**
   ```bash
   docker --version
   docker ps
   ```

2. **Levantar servicios:**
   ```bash
   docker-compose up -d postgres redis
   ```

3. **Configurar .env.local:**
   ```env
   DATABASE_URL="postgresql://votetok:votetok_pass@localhost:5432/votetok_db"
   REDIS_URL="redis://localhost:6379"
   ```

4. **Aplicar migraciones:**
   ```bash
   npx prisma migrate dev
   ```

5. **Iniciar aplicación:**
   ```bash
   npm run dev
   ```

---

## ❓ PREGUNTAS FRECUENTES

### ¿Qué hacer si npm/pnpm da error de permisos?

**Windows:**
- Abre PowerShell como Administrador
- Ejecuta: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`

**Alternativa:**
- Usa npm sin instalación global: `npx pnpm install`

### ¿Cómo saber si Docker está funcionando?

Ejecuta:
```bash
docker ps
```

Si muestra una tabla (aunque esté vacía), Docker está funcionando.
Si da error, Docker no está corriendo.

### ¿Puedo usar la app sin Docker?

¡Sí! La app funcionará perfectamente con SQLite local. Solo:
1. Asegúrate de que `.env.local` use SQLite
2. Las funciones de Redis (caché) no estarán disponibles
3. Todo lo demás funcionará normal

### ¿Por qué el build tarda tanto?

La primera vez tarda más porque:
- Descarga todas las dependencias
- Genera el cliente de Prisma
- Compila TypeScript

Las siguientes veces será mucho más rápido.

---

## 📞 SOPORTE

Si sigues teniendo problemas:

1. **Verifica los logs:**
   ```bash
   # Ver logs de npm
   npm config get cache
   npm cache clean --force
   
   # Ver logs de Docker (si lo usas)
   docker-compose logs
   ```

2. **Reinicia todo:**
   ```bash
   # Limpiar node_modules
   rm -rf node_modules .svelte-kit
   npm install
   
   # Reiniciar Docker (si lo usas)
   docker-compose down
   docker-compose up -d
   ```

3. **Usa la versión simple:**
   - Sin Docker
   - Con npm en lugar de pnpm
   - Con SQLite en lugar de PostgreSQL

---

## ✅ CONFIRMACIÓN DE ÉXITO

Sabrás que todo está funcionando cuando:

1. `npm run dev` muestre:
   ```
   VITE ready in XXX ms
   ➜ Local: http://localhost:5173/
   ```

2. Puedas abrir http://localhost:5173 en tu navegador

3. Veas el globo 3D cargando

¡Eso es todo! 🎉
