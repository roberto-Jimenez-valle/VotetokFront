# 🔑 Configurar tu API Key de Giphy

**Esta guía es para desarrollo local**. Para Railway (producción), ve a: [`GIPHY_RAILWAY.md`](GIPHY_RAILWAY.md)

---

## ✅ Paso 1: Agregar la API Key al archivo .env (Desarrollo Local)

Crea o edita el archivo `.env` en la raíz del proyecto:

```bash
# .env

# ============================================
# GIPHY API KEY
# ============================================

VITE_GIPHY_API_KEY=JiEJUHdqINWZXrJe9Qya0nJ6piG4kZ6Z
```

### Comando rápido (PowerShell):

```powershell
# Agregar al .env existente
Add-Content -Path .env -Value "`nVITE_GIPHY_API_KEY=JiEJUHdqINWZXrJe9Qya0nJ6piG4kZ6Z"
```

O si no existe el archivo `.env`:

```powershell
# Copiar desde .env.example y agregar Giphy
Copy-Item .env.example .env
# Luego edita manualmente .env y cambia:
# VITE_GIPHY_API_KEY=your-giphy-api-key
# por:
# VITE_GIPHY_API_KEY=JiEJUHdqINWZXrJe9Qya0nJ6piG4kZ6Z
```

---

## 🔄 Paso 2: Reiniciar el servidor

Para que las variables de entorno se carguen:

```bash
# Detener el servidor (Ctrl+C)
# Luego reiniciar:
npm run dev
```

---

## ✅ Paso 3: Verificar que funciona

### Test rápido en la terminal:

```bash
npx tsx scripts/test-giphy.ts
```

**Salida esperada**:
```
🎬 Probando API de Giphy...

📋 Buscando GIFs para 12 comidas:

✅ pizza          → https://media.giphy.com/media/.../giphy.gif
✅ sushi          → https://media.giphy.com/media/.../giphy.gif
✅ tacos          → https://media.giphy.com/media/.../giphy.gif
...
```

### Test en el navegador:

1. Abre la consola del navegador (F12)
2. Pega este código:

```javascript
// Verificar que la API Key se cargó
console.log('Giphy API Key:', import.meta.env.VITE_GIPHY_API_KEY);

// Probar búsqueda
fetch(`https://api.giphy.com/v1/gifs/translate?api_key=${import.meta.env.VITE_GIPHY_API_KEY}&s=pizza&rating=g`)
  .then(r => r.json())
  .then(data => {
    console.log('✅ GIF de pizza:', `https://media.giphy.com/media/${data.data.id}/giphy.gif`);
  })
  .catch(err => console.error('❌ Error:', err));
```

---

## 📊 Límites de tu API Key

Tu API Key **JiEJUHdqINWZXrJe9Qya0nJ6piG4kZ6Z** tiene estos límites:

| Tipo de cuenta | Requests/día | Requests/hora |
|----------------|--------------|---------------|
| Free (Beta)    | 42,000       | 1,000         |
| Paid           | 1M+          | Sin límite    |

Para verificar tu plan:
👉 https://developers.giphy.com/dashboard/

---

## 🔒 Seguridad

### ⚠️ IMPORTANTE

La API Key de Giphy **se expone en el frontend** porque es necesaria para hacer requests desde el navegador.

**Esto es normal** para APIs públicas como Giphy. Para proteger tu cuenta:

1. ✅ **Configura restricciones de dominio** en Giphy Dashboard
   - Permite solo: `localhost`, `127.0.0.1`, tu dominio de producción
   
2. ✅ **Monitorea el uso** en el dashboard de Giphy
   - Si ves uso anormal, regenera la key

3. ✅ **No la compartas públicamente** en:
   - ❌ Repositorios de GitHub (el .env está en .gitignore)
   - ❌ Screenshots
   - ❌ Videos/tutoriales

---

## 🎯 Uso en CreatePollModal

Una vez configurada la API Key, puedes usar el servicio:

```typescript
import { giphyGifUrl, searchGiphy } from '$lib/services/giphy';

// Buscar un GIF
const gifUrl = await giphyGifUrl('pizza');
console.log(gifUrl);

// Buscar múltiples
const gifs = await searchGiphy('happy', { limit: 10 });
```

---

## 🐛 Troubleshooting

### Problema: "API Key not found"

**Solución**:
1. Verifica que el archivo `.env` existe en la raíz
2. Verifica que la línea es exactamente:
   ```
   VITE_GIPHY_API_KEY=JiEJUHdqINWZXrJe9Qya0nJ6piG4kZ6Z
   ```
3. Reinicia el servidor: `Ctrl+C` → `npm run dev`

### Problema: "403 Forbidden"

**Posibles causas**:
1. API Key inválida (verifica en Giphy Dashboard)
2. Límite de requests excedido (espera o actualiza plan)
3. Restricciones de dominio muy estrictas

**Solución**:
- Verifica tu dashboard: https://developers.giphy.com/dashboard/

### Problema: "Network error"

**Posibles causas**:
1. Sin conexión a internet
2. Firewall bloqueando api.giphy.com

**Solución**:
- Prueba en navegador: https://api.giphy.com/v1/gifs/trending?api_key=JiEJUHdqINWZXrJe9Qya0nJ6piG4kZ6Z

---

## ✨ ¡Listo!

Tu API Key está configurada y lista para usar. Ahora puedes:

1. ✅ Buscar GIFs en CreatePollModal
2. ✅ Mostrar GIFs trending
3. ✅ Agregar GIFs a opciones de encuestas
4. ✅ Usar el componente GiphyPicker

---

**Última actualización**: Octubre 2024
