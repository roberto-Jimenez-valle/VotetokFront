# 🚨 Solución para Errores 500 en Producción

## Problema Identificado

Todos tus endpoints están retornando **500 Internal Server Error** porque:

1. ❌ El `startCommand` en `railway.json` era demasiado complejo y fallaba
2. ❌ Variables de entorno faltantes o incorrectas
3. ❌ Base de datos no configurada correctamente

---

## ✅ Solución Completa (Sigue estos pasos)

### Paso 1: Configurar Variables de Entorno en Railway

1. Ve a **Railway Dashboard** → tu proyecto → tu servicio
2. Click en **"Variables"**
3. Agrega estas variables (copia y pega):

```env
JWT_SECRET=4b91e5e8edb7d15af99d1f56c67578b9d2898ec6db7cc7f25bae7f3a2b309e6e
APP_SECRET=2257c19dbca8660127417632b626da357c252dec3b4d5beb215722626f0216b0729b22090fe9b808535ea53bdcd2b50dad7a05d21a56c3d4457c0611a26ae27d
VITE_APP_SECRET=2257c19dbca8660127417632b626da357c252dec3b4d5beb215722626f0216b0729b22090fe9b808535ea53bdcd2b50dad7a05d21a56c3d4457c0611a26ae27d
NODE_ENV=production
PORT=3000
```

4. Verifica que **DATABASE_URL** ya exista (auto-generada por Railway si agregaste PostgreSQL)

---

### Paso 2: Desplegar Corrección

He arreglado el `railway.json` para que sea más simple y robusto.

**Opción A: Script automático** (Recomendado)
```bash
.\deploy-fix.bat
```

**Opción B: Comandos manuales**
```bash
git commit -m "Fix Railway deployment"
git push
```

Railway automáticamente re-desplegará con la configuración corregida.

---

### Paso 3: Configurar Base de Datos (PRIMERA VEZ)

Después del deploy, necesitas configurar la base de datos **UNA SOLA VEZ**.

**Opción A: Desde Railway CLI** (Recomendado)
```bash
# Si no tienes Railway CLI instalado:
npm i -g @railway/cli

# Login y link al proyecto
railway login
railway link

# Ejecutar setup de DB
railway run bash scripts/railway-db-setup.sh
```

**Opción B: Desde Railway Dashboard**

1. Ve a Railway Dashboard → tu servicio
2. Click en el tab **"Console"** o **"Shell"**
3. Ejecuta estos comandos uno por uno:

```bash
npx prisma generate
npx prisma db push --skip-generate
npx tsx prisma/seed.ts
```

---

### Paso 4: Verificar que Funcione

1. **Verificar logs de build:**
   - Railway Dashboard → tu servicio → "Deployments" → "View Logs"
   - Busca: `✅ Archivos estáticos copiados correctamente`

2. **Verificar logs de runtime:**
   - Busca errores de Prisma o DATABASE_URL
   - NO debería haber `PrismaClientInitializationError`

3. **Probar la aplicación:**
   - Ve a tu URL: `https://tu-app.up.railway.app`
   - Abre la consola del navegador (F12)
   - Los APIs deberían retornar **200 OK** en lugar de 500

---

## 🔍 Explicación de los Errores

### Errores del Navegador (Ignorar)
```
Unchecked runtime.lastError: Could not establish connection
SSL certificate error occurred when fetching the script
```
Estos son de **extensiones del navegador**, no de tu app. Ignorar.

### Errores Reales (500 Internal Server Error)
```
GET https://voutop.com/api/polls/trending-by-region 500
GET https://voutop.com/api/maps/world 500
GET https://voutop.com/api/data/world 500
```

**Causa:** El servidor no arranca correctamente porque:
1. Prisma no puede conectarse a la base de datos
2. Variables de entorno faltantes
3. El `startCommand` fallaba antes de iniciar el servidor

---

## 📊 Cómo Verificar que Está Solucionado

### ✅ Checklist Final

- [ ] Variables de entorno configuradas en Railway
- [ ] `railway.json` actualizado (git push)
- [ ] Build exitoso en Railway (sin errores)
- [ ] Base de datos configurada (seed ejecutado)
- [ ] La app carga sin errores 500
- [ ] APIs retornan datos correctamente

### Comandos de Verificación

```bash
# Ver logs en tiempo real
railway logs

# Verificar variables de entorno
railway variables

# Abrir la app
railway open
```

---

## 🆘 Si Aún Hay Errores

### 1. Verificar DATABASE_URL

En Railway Dashboard → PostgreSQL service → "Variables" → copia `DATABASE_URL`

Debe verse así:
```
postgresql://postgres:XXXXXXX@containers-us-west-XXX.railway.app:5432/railway
```

### 2. Verificar Logs de Prisma

En los logs de Railway, busca:

```bash
# ✅ Correcto
Prisma schema loaded from prisma/schema.prisma
✔ Generated Prisma Client

# ❌ Error
Error: P1001: Can't reach database server at `...`
PrismaClientInitializationError
```

Si ves el error, tu `DATABASE_URL` está mal o la base de datos no está accesible.

### 3. Verificar Archivos Estáticos

En los logs de build, busca:

```bash
# ✅ Correcto
📦 Copiando archivos estáticos...
✅ Archivos estáticos copiados correctamente

# ❌ Error
Error copiando archivos: ENOENT
```

Si falla, el script `postbuild` no se ejecutó.

---

## 📁 Archivos Modificados

- ✅ `railway.json` - Simplificado startCommand
- ✅ `scripts/generate-secrets.js` - Generador de secrets
- ✅ `scripts/railway-db-setup.sh` - Setup de DB
- ✅ `RAILWAY_DEPLOYMENT.md` - Troubleshooting agregado
- ✅ `deploy-fix.bat` - Script de deploy rápido

---

## 🎯 Resumen en 3 Pasos

1. **Agregar variables de entorno** en Railway Dashboard
2. **Hacer git push** para re-desplegar
3. **Ejecutar setup de DB** desde Railway CLI o console

¡Eso es todo! Tu aplicación debería funcionar sin errores 500.
