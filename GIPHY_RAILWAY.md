# 🚀 Configurar Giphy en Railway (Producción)

## 📌 Importante sobre Variables VITE_

Las variables que empiezan con `VITE_` funcionan diferente en producción:

- ✅ **Se embeben en el código** durante el build
- ⚠️ **Se exponen públicamente** en el frontend (esto es normal para APIs públicas)
- 🔄 **Requieren rebuild** después de cambiarlas

---

## 🎯 Paso 1: Agregar Variable en Railway

### Opción A: Dashboard Web

1. Ve a tu proyecto en Railway: https://railway.app/dashboard
2. Click en tu servicio (app)
3. Ve a la pestaña **"Variables"**
4. Click en **"+ New Variable"**
5. Agrega:
   ```
   Nombre: VITE_GIPHY_API_KEY
   Valor:  JiEJUHdqINWZXrJe9Qya0nJ6piG4kZ6Z
   ```
6. Click en **"Add"**

### Opción B: Railway CLI

```bash
# Instalar Railway CLI si no lo tienes
npm i -g @railway/cli

# Login
railway login

# Link a tu proyecto
railway link

# Agregar variable
railway variables set VITE_GIPHY_API_KEY=JiEJUHdqINWZXrJe9Qya0nJ6piG4kZ6Z
```

---

## 🔄 Paso 2: Rebuild Automático

Railway **automáticamente** hará un nuevo deployment después de agregar la variable.

Puedes monitorear el progreso en:
- Dashboard → Tu servicio → **"Deployments"**

**Log esperado**:
```
Building...
Installing dependencies...
Building Vite app...
✓ VITE_GIPHY_API_KEY detected
✓ Build complete
Deploying...
✓ Deployment successful
```

---

## ✅ Paso 3: Verificar en Producción

### Desde la consola del navegador en tu app desplegada:

```javascript
// Abrir: https://tu-app.railway.app
// Presionar F12 → Console

// Verificar que la API Key se cargó
console.log('Giphy API Key:', import.meta.env.VITE_GIPHY_API_KEY);
// Deberías ver: JiEJUHdq...

// Probar búsqueda
fetch(`https://api.giphy.com/v1/gifs/translate?api_key=${import.meta.env.VITE_GIPHY_API_KEY}&s=pizza&rating=g`)
  .then(r => r.json())
  .then(data => {
    console.log('✅ GIF encontrado:', data.data.id);
  });
```

También deberías ver en la consola:
```
[Giphy] ✅ Usando API Key personalizada (JiEJUHdq...)
```

---

## 🔒 Seguridad en Railway

### 1. Restricciones de Dominio en Giphy

Ve a https://developers.giphy.com/dashboard/ y configura:

**Dominios permitidos**:
```
localhost                    (para desarrollo)
127.0.0.1                   (para desarrollo)
tu-app.railway.app          (tu dominio de Railway)
```

### 2. Variables Privadas vs Públicas

| Variable | Tipo | Expuesta | Uso |
|----------|------|----------|-----|
| `VITE_GIPHY_API_KEY` | Pública | ✅ Sí (Frontend) | API Keys públicas |
| `DATABASE_URL` | Privada | ❌ No (Backend) | Credenciales sensibles |
| `JWT_SECRET` | Privada | ❌ No (Backend) | Secrets del servidor |

**Esto es normal**: Giphy requiere la API Key en el cliente.

---

## 🐛 Troubleshooting

### Problema 1: "API Key undefined en producción"

**Causa**: La variable no se agregó antes del build.

**Solución**:
1. Verifica que la variable existe en Railway → Variables
2. Forzar rebuild:
   ```bash
   railway up --detach
   ```
   O push un cambio al repo:
   ```bash
   git commit --allow-empty -m "Trigger Railway rebuild for Giphy"
   git push
   ```

### Problema 2: "Sigue usando la API Key pública"

**Causa**: El navegador tiene cache del build anterior.

**Solución**:
1. Hacer **hard refresh**: `Ctrl + Shift + R`
2. O borrar cache del navegador
3. Verificar en "Network" tab que la nueva API Key aparece en los requests

### Problema 3: "403 Forbidden en Giphy"

**Causa**: Restricciones de dominio muy estrictas.

**Solución**:
1. Ve a Giphy Dashboard
2. En "Application Settings" → "HTTP Referrers"
3. Agrega: `*.railway.app` o tu dominio específico

---

## 📊 Monitorear Uso

Railway no limita las requests a APIs externas, pero Giphy sí:

### Límites de tu API Key:
- **Free**: 42,000 requests/día
- **Paid**: 1M+ requests/día

**Monitorear en**:
👉 https://developers.giphy.com/dashboard/

---

## 🔄 Variables de Desarrollo vs Producción

### Desarrollo (local):
```bash
# .env (en tu máquina)
VITE_GIPHY_API_KEY=JiEJUHdqINWZXrJe9Qya0nJ6piG4kZ6Z
```

### Producción (Railway):
```bash
# Variables de Railway (Dashboard)
VITE_GIPHY_API_KEY=JiEJUHdqINWZXrJe9Qya0nJ6piG4kZ6Z
```

**Puedes usar la misma API Key** en ambos ambientes.

---

## 🎯 Variables de Railway que Necesitas

Tu configuración completa en Railway debería incluir:

```bash
# Backend
DATABASE_URL=postgresql://...           (auto-generada)
JWT_SECRET=tu-secret-aqui
APP_SECRET=tu-app-secret-aqui
NODE_ENV=production

# Frontend (VITE_)
VITE_APP_ID=voutop-web-v1
VITE_APP_SECRET=tu-app-secret-aqui     (mismo que APP_SECRET)
VITE_GIPHY_API_KEY=JiEJUHdqINWZXrJe9Qya0nJ6piG4kZ6Z
```

---

## 🚀 Deployment Automático

Cada vez que:
1. ✅ Hagas push a GitHub → Railway redeploys automáticamente
2. ✅ Cambies una variable → Railway redeploys automáticamente
3. ✅ Hagas `railway up` → Deployment manual

**No necesitas hacer nada más** después de agregar la variable.

---

## ✅ Checklist Final

Antes de usar Giphy en producción:

- [ ] Variable `VITE_GIPHY_API_KEY` agregada en Railway
- [ ] Deployment exitoso (sin errores en logs)
- [ ] Hard refresh en el navegador (`Ctrl + Shift + R`)
- [ ] Console muestra: "✅ Usando API Key personalizada"
- [ ] Test de búsqueda funciona
- [ ] Restricciones de dominio configuradas en Giphy

---

## 📞 Comandos Útiles

```bash
# Ver variables actuales
railway variables

# Ver logs en tiempo real
railway logs

# Forzar nuevo deployment
railway up --detach

# Ver info del servicio
railway status
```

---

## 🎉 ¡Listo!

Después de agregar la variable en Railway:

1. ✅ Railway rebuildeará automáticamente
2. ✅ La API Key estará disponible en `import.meta.env.VITE_GIPHY_API_KEY`
3. ✅ Todos los usuarios verán GIFs de Giphy funcionando

**Tu app en Railway ya está lista para usar Giphy.** 🚀

---

**Última actualización**: Octubre 2024

**Enlaces útiles**:
- Railway Dashboard: https://railway.app/dashboard
- Giphy Dashboard: https://developers.giphy.com/dashboard/
- Railway Docs: https://docs.railway.app/
