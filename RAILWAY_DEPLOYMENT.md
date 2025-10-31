# 🚂 Deployment en Railway

## 🚨 TROUBLESHOOTING: Errores 500 después del deploy

### Problema: Todos los APIs retornan 500 Internal Server Error

**Causa:** El `startCommand` anterior era demasiado complejo y estaba fallando.

**Solución:**

#### 1. Verificar Variables de Entorno en Railway

Ve a tu proyecto Railway → tu servicio → **Variables** y verifica que existan:

```env
DATABASE_URL=postgresql://postgres:xxxxx@xxxxx.railway.app:5432/railway
JWT_SECRET=tu-secret-jwt-minimo-32-caracteres-aleatorios
APP_SECRET=tu-app-secret-minimo-64-caracteres-aleatorios
NODE_ENV=production
PORT=3000
```

**Generar secrets seguros:**
```bash
# JWT_SECRET (32 caracteres)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# APP_SECRET (64 caracteres)  
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### 2. Configurar Base de Datos (Primera vez)

En Railway CLI o desde el dashboard:

```bash
# Conectar a Railway CLI
railway login
railway link

# Ejecutar setup de base de datos (SOLO LA PRIMERA VEZ)
railway run bash scripts/railway-db-setup.sh
```

O manualmente desde Railway dashboard → tu servicio → "Console":

```bash
npx prisma generate
npx prisma db push --skip-generate
npx tsx prisma/seed.ts
```

#### 3. Re-desplegar

He simplificado el `railway.json` para que sea más robusto:

```bash
git add .
git commit -m "Fix Railway deployment configuration"
git push
```

Railway automáticamente re-desplegará con la configuración corregida.

#### 4. Verificar Logs

En Railway dashboard → tu servicio → "Deployments" → "View Logs"

Busca errores como:
- ❌ `Error: Invalid DATABASE_URL`
- ❌ `PrismaClientInitializationError`
- ❌ `ENOENT: no such file or directory`

#### 5. Verificar que el Build Copie Archivos Estáticos

El script `postbuild` debe ejecutarse. Verifica en los logs de build:

```
📦 Copiando archivos estáticos...
✅ Archivos estáticos copiados correctamente
```

---

## Pasos para desplegar VouTop en Railway (Desde Cero)

### 1. Crear cuenta en Railway
1. Ve a https://railway.app
2. Regístrate con GitHub (recomendado)
3. Obtendrás **$5 USD gratis** al mes

### 2. Subir código a GitHub (si no lo has hecho)
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/VouTop.git
git push -u origin main
```

### 3. Crear nuevo proyecto en Railway

1. Click en **"New Project"**
2. Selecciona **"Deploy from GitHub repo"**
3. Autoriza Railway para acceder a tu GitHub
4. Selecciona tu repositorio **VouTop**

### 4. Configurar PostgreSQL (Recomendado)

1. En tu proyecto Railway, click en **"+ New"**
2. Selecciona **"Database"** → **"Add PostgreSQL"**
3. Railway automáticamente creará la variable `DATABASE_URL`

### 5. Configurar Variables de Entorno

En Railway dashboard, ve a tu servicio → **"Variables"** y agrega:

```env
# Base de datos (auto-generada por Railway)
DATABASE_URL=postgresql://...

# Puerto (Railway lo asigna automáticamente)
PORT=3000

# Node environment
NODE_ENV=production

# Opcional: Habilitar datos de ejemplo si quieres
SEED_DATABASE=true
```

### 6. Actualizar Prisma para PostgreSQL

Edita `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"  // Cambiar de sqlite a postgresql
  url      = env("DATABASE_URL")
}
```

### 7. Migrar la base de datos

Railway ejecutará automáticamente las migraciones en el build. Si necesitas ejecutarlas manualmente:

```bash
# En Railway dashboard, ve a Settings → Deploy Triggers → Add build command
npx prisma migrate deploy
```

### 8. Hacer seed de datos (Opcional)

Agrega un script post-build en `package.json`:

```json
"scripts": {
  "build": "vite build",
  "postbuild": "npx prisma db seed"
}
```

### 9. Deploy!

Railway automáticamente desplegará tu app cuando hagas push a GitHub:

```bash
git add .
git commit -m "Configure for Railway"
git push
```

## 🌐 Tu aplicación estará disponible en:

`https://tu-proyecto.up.railway.app`

## 📊 Monitoreo

- **Logs**: Railway dashboard → tu servicio → "Deployments" → "View Logs"
- **Métricas**: Railway dashboard → tu servicio → "Metrics"
- **Base de datos**: Railway dashboard → PostgreSQL → "Data"

## 💰 Costos

Plan Hobby (Gratis):
- $5 USD de crédito mensual
- ~500 horas de ejecución
- Perfecto para demo y testing

Plan Pro ($20/mes):
- $20 de crédito mensual
- Sin límites de horas
- Mejor para producción

## 🔧 Comandos útiles

```bash
# Ver logs en tiempo real
railway logs

# Conectar a PostgreSQL
railway connect postgres

# Ejecutar comandos en Railway
railway run npm run db:seed

# Abrir URL del proyecto
railway open
```

## ⚡ Ventajas sobre Netlify

✅ Base de datos incluida (PostgreSQL gratis)
✅ Filesystem persistente
✅ Sin límites de funciones serverless
✅ Deploy desde GitHub automático
✅ Variables de entorno fáciles
✅ CLI poderoso para management

## 🚨 Notas importantes

1. **Migrar de SQLite a PostgreSQL**: Necesitarás actualizar tu schema de Prisma
2. **Datos de seed**: Asegúrate de ejecutar el seed después del primer deploy
3. **Domain personalizado**: Disponible en Railway (gratis)
4. **HTTPS**: Automático y gratis

## 🔗 Enlaces útiles

- Dashboard: https://railway.app/dashboard
- Docs: https://docs.railway.app
- CLI: https://docs.railway.app/develop/cli
