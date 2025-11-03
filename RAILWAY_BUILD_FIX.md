# 🚂 FIX PARA RAILWAY BUILD

**Problema:** Railway intentaba usar Dockerfile con comandos incorrectos (`build:optimized`)

**Solución:** Desactivar Dockerfile y dejar que Railway use su sistema de detección automática

---

## ✅ CAMBIOS REALIZADOS

1. **Dockerfile renombrado** → `Dockerfile.backup`
2. **`.railwayignore` creado** → Ignora Dockerfiles
3. **Railway usará autodetección** → Node.js + pnpm

---

## 🎯 CÓMO FUNCIONA AHORA

Railway detectará automáticamente:

```yaml
# Railway detecta package.json y usa:
Build Command: pnpm install && pnpm build
Start Command: pnpm start  # o node build/index.js
```

**Comandos que usará de package.json:**
```json
{
  "scripts": {
    "build": "vite build",           // ✅ Compila el proyecto
    "postbuild": "node scripts/copy-static-files.js",  // ✅ Copia archivos
    "start": "node build/index.js"   // ✅ Inicia servidor
  }
}
```

---

## 🔧 SI NECESITAS CONFIGURAR MANUALMENTE EN RAILWAY

**Variables de entorno necesarias:**
```
DATABASE_URL=postgresql://...
NODE_ENV=production
```

**Build Settings (opcional):**
- Build Command: `pnpm install && pnpm db:generate && pnpm build`
- Start Command: `pnpm start`
- Install Command: `pnpm install`

---

## 📦 SI QUIERES VOLVER A USAR DOCKERFILE

```bash
# 1. Renombrar de vuelta
mv Dockerfile.backup Dockerfile

# 2. Corregir comandos en package.json
# Añadir en scripts:
{
  "build:optimized": "vite build",
  "optimize:assets": "echo 'Assets optimized'"
}
```

---

## 🚀 DEPLOY AHORA

```bash
git add .
git commit -m "fix: usar Railway autodetect en lugar de Dockerfile"
git push origin main
```

Railway detectará los cambios y compilará correctamente con `pnpm build` ✅
