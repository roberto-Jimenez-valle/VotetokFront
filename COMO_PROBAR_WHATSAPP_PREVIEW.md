# Cómo Probar el Preview de WhatsApp

## ⚠️ Por Qué No Funciona en Localhost

WhatsApp (y otras redes sociales) necesitan:
1. **Acceder públicamente a tu URL** para leer los meta tags
2. **Descargar la imagen** del servidor
3. **HTTPS** (no HTTP)

❌ `http://localhost:5173` NO es accesible desde internet
❌ WhatsApp no puede leer los meta tags
❌ Solo aparece texto plano

## ✅ Soluciones para Probar

### Opción 1: Usar ngrok (Rápido, para testing)

**1. Instalar ngrok:**
```bash
npm install -g ngrok
# o descargar desde https://ngrok.com/
```

**2. Iniciar tu aplicación:**
```bash
npm run dev
# Tu app corre en http://localhost:5173
```

**3. En otra terminal, exponer localhost:**
```bash
ngrok http 5173
```

**4. Ngrok te dará una URL pública temporal:**
```
Forwarding: https://abc123.ngrok.io -> http://localhost:5173
```

**5. Compartir en WhatsApp:**
```
https://abc123.ngrok.io/poll/1
```

**Ventajas:**
- ✅ Rápido para testing
- ✅ No requiere deploy
- ✅ HTTPS incluido

**Desventajas:**
- ⏱️ URL temporal (expira cuando cierras ngrok)
- 🐌 Puede ser lento si estás lejos del servidor de ngrok

---

### Opción 2: Deploy en Railway (Recomendado para producción)

**1. Asegúrate de tener una cuenta en Railway:**
- https://railway.app/

**2. Conecta tu repositorio:**
```bash
# Si no has conectado Railway aún:
railway login
railway link
```

**3. Deploy:**
```bash
git add .
git commit -m "fix: Open Graph meta tags con URL dinámica"
git push origin main
```

**4. Railway automáticamente:**
- Detecta que es un proyecto SvelteKit
- Lo construye con `npm run build`
- Lo despliega con HTTPS
- Te da una URL como: `https://tu-app.up.railway.app`

**5. Compartir en WhatsApp:**
```
https://tu-app.up.railway.app/poll/1
```

**Ventajas:**
- ✅ URL permanente
- ✅ HTTPS incluido
- ✅ Deploy automático con git push
- ✅ Rápido globalmente

---

### Opción 3: Deploy en Vercel (Alternativa)

**1. Instalar Vercel CLI:**
```bash
npm install -g vercel
```

**2. Login y deploy:**
```bash
vercel login
vercel
```

**3. Seguir las instrucciones:**
- Framework Preset: SvelteKit
- Build Command: `npm run build`
- Output Directory: `.svelte-kit`

**4. Vercel te dará una URL:**
```
https://tu-app.vercel.app
```

**5. Compartir:**
```
https://tu-app.vercel.app/poll/1
```

---

## 🧪 Validar Meta Tags

Antes de probar en WhatsApp, valida que los meta tags funcionan:

### 1. Facebook Sharing Debugger (recomendado para WhatsApp)
```
https://developers.facebook.com/tools/debug/
```
- Pega tu URL: `https://tu-url.com/poll/1`
- Click en "Debug"
- Verás exactamente qué ve WhatsApp/Facebook

**Problemas comunes:**
- ❌ "Could not resolve the hostname" → URL no accesible públicamente
- ❌ "Missing Required Property" → Meta tag faltante
- ❌ "Image could not be downloaded" → Endpoint de imagen no funciona

### 2. Twitter Card Validator
```
https://cards-dev.twitter.com/validator
```

### 3. Open Graph Checker
```
https://www.opengraph.xyz/
```

---

## 🎯 Checklist para que Funcione

- [ ] **App desplegada públicamente** (Railway/Vercel/ngrok)
- [ ] **HTTPS activo** (automático con Railway/Vercel/ngrok)
- [ ] **Endpoint `/poll/[id]` funcionando**
- [ ] **Endpoint `/api/polls/[id]/og-image` devuelve SVG**
- [ ] **Meta tags en HTML** (revisar con View Source)
- [ ] **Validado con Facebook Debugger**
- [ ] **Cache limpiado** en WhatsApp (si ya compartiste antes)

---

## 🔧 Debugging

### Verificar que el endpoint de imagen funciona:

**En navegador, visita:**
```
https://tu-url.com/api/polls/1/og-image
```

**Debe:**
- ✅ Devolver un SVG (1200x630px)
- ✅ Mostrar título de la encuesta
- ✅ Mostrar opciones con barras de progreso
- ✅ Mostrar total de votos

### Verificar meta tags en HTML:

**1. Visita:**
```
https://tu-url.com/poll/1
```

**2. View Source (Ctrl+U):**

**3. Busca estas líneas:**
```html
<meta property="og:image" content="https://tu-url.com/api/polls/1/og-image" />
<meta property="og:title" content="Título de la encuesta" />
<meta property="og:description" content="..." />
```

### Limpiar cache de WhatsApp:

WhatsApp cachea los previews agresivamente:

**Opción 1: Usar Facebook Debugger**
```
https://developers.facebook.com/tools/debug/
```
1. Pega tu URL
2. Click en "Scrape Again"
3. Esto limpia el cache de WhatsApp

**Opción 2: Agregar query parameter**
```
# En lugar de:
https://tu-url.com/poll/1

# Usa:
https://tu-url.com/poll/1?v=2
```

---

## 📱 Resultado Esperado en WhatsApp

Cuando compartes `https://tu-url.com/poll/1` en WhatsApp, debería verse:

```
┌─────────────────────────────────────────┐
│ [Imagen con título, opciones y gráficas]│
│                                          │
│ VouTop                                   │
│ ¿Cuál es tu color favorito?             │
│ Por @usuario ✓ • 1,234 votos            │
│                                          │
│ 🟥 Rojo         ████████████░░ 45%      │
│ 🟦 Azul         ████████░░░░░░ 30%      │
│ 🟩 Verde        ████░░░░░░░░░░ 15%      │
│ 🟨 Amarillo     ██░░░░░░░░░░░░ 10%      │
└─────────────────────────────────────────┘
```

Con texto debajo:
```
Vota ahora en VouTop
https://tu-url.com/poll/1
```

---

## 🚀 Flujo Completo Recomendado

### Para Development (testing rápido):

```bash
# Terminal 1: Inicia la app
npm run dev

# Terminal 2: Expón con ngrok
ngrok http 5173

# Copia la URL de ngrok (ej: https://abc123.ngrok.io)
# Comparte: https://abc123.ngrok.io/poll/1
# Verifica en Facebook Debugger primero
# Luego prueba en WhatsApp
```

### Para Production:

```bash
# Deploy a Railway
git push origin main

# Espera el deploy (1-2 minutos)
# Railway te dará una URL permanente
# Comparte: https://tu-app.up.railway.app/poll/1
```

---

## ⚡ Tips Adicionales

### 1. Variables de entorno para URL base:

Si quieres controlar la URL base en producción:

```env
# .env o Railway variables
PUBLIC_BASE_URL=https://voutop.com
```

Y en el código:
```typescript
import { env } from '$env/dynamic/public';
const baseUrl = env.PUBLIC_BASE_URL || window.location.origin;
```

### 2. Diferentes previews por encuesta:

El endpoint `/api/polls/[id]/og-image` ya genera imágenes dinámicas. Cada encuesta tiene su propia imagen con:
- Título único
- Top 4 opciones
- Estadísticas reales
- Colores de las opciones

### 3. Testing en múltiples plataformas:

Una vez desplegado, prueba en:
- ✅ WhatsApp (móvil y desktop)
- ✅ Facebook (post o mensaje)
- ✅ Twitter/X (tweet)
- ✅ Telegram
- ✅ Discord
- ✅ Slack
- ✅ iMessage

Todas deberían mostrar el preview rico con imagen.

---

## 📊 Monitoreo de Compartidos

Si quieres trackear cuántas veces se comparte cada encuesta:

```typescript
// En +page.server.ts
export const load: PageServerLoad = async ({ params }) => {
  const poll = await prisma.poll.findUnique({ 
    where: { id: Number(params.id) } 
  });
  
  // Incrementar contador de shares
  await prisma.poll.update({
    where: { id: Number(params.id) },
    data: { shareCount: { increment: 1 } }
  });
  
  return { poll };
};
```

---

## ✅ Checklist Final

Antes de compartir en WhatsApp:

- [ ] App desplegada públicamente (Railway/Vercel/ngrok)
- [ ] Visited `/poll/1` directamente en navegador → funciona ✅
- [ ] Visited `/api/polls/1/og-image` → muestra SVG ✅
- [ ] View Source → meta tags presentes ✅
- [ ] Facebook Debugger → preview correcto ✅
- [ ] Compartido en WhatsApp → preview con imagen ✅

Si todos están ✅, ¡funciona perfectamente! 🎉
