# 🧪 Test de Link Preview - Diagnóstico

## Problema: Imagen no se muestra en el preview

### ✅ Paso 1: Verifica que el sistema está funcionando

1. Abre el modal de crear encuesta
2. Pega esta URL de YouTube en el título:
   ```
   https://youtube.com/watch?v=dQw4w9WgXcQ
   ```
3. Espera 500ms (el debounce)
4. Abre la consola del navegador (F12)

**Deberías ver:**
```
[LinkPreview] 🔍 Fetching preview for: https://youtube.com/watch?v=dQw4w9WgXcQ
[Link Preview] Fetching oEmbed: https://www.youtube.com/oembed?url=...
[Link Preview] 🖼️ oEmbed image found: {
  original: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  proxied: "/api/media-proxy?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2FdQw4w9WgXcQ%2Fhqdefault.jpg"
}
[LinkPreview] ✅ Preview fetched successfully: { ... }
```

### ✅ Paso 2: Verifica que la imagen carga

**Si ves el preview pero no la imagen**, busca estos logs:

```
[LinkPreview] Imagen cargada: /api/media-proxy?url=...
```

**Si en lugar ves esto:**
```
[LinkPreview] Error al cargar imagen: /api/media-proxy?url=... [error]
```

Significa que el proxy está fallando.

### ✅ Paso 3: Prueba el proxy manualmente

En la consola del navegador:

```javascript
// 1. Obtener la URL de la imagen del preview
const testUrl = '/api/media-proxy?url=' + encodeURIComponent('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');

// 2. Probar el proxy
fetch(testUrl)
  .then(r => {
    console.log('Status:', r.status);
    console.log('Content-Type:', r.headers.get('content-type'));
    return r.blob();
  })
  .then(blob => {
    console.log('Image size:', blob.size, 'bytes');
    // Mostrar la imagen
    const img = document.createElement('img');
    img.src = URL.createObjectURL(blob);
    document.body.appendChild(img);
  })
  .catch(e => console.error('Proxy error:', e));
```

### ✅ Paso 4: Errores comunes

#### Error: "Domain not allowed"
```
[Media Proxy] ❌ Domain not allowed: example.com
```

**Solución**: Agregar el dominio a `src/lib/server/media-proxy-config.ts`:

```typescript
allowedDomains: [
  // ... existentes
  'example.com',
  'cdn.example.com'
]
```

#### Error: "CORS blocked"

El proxy debería manejar esto, pero si falla:

```javascript
// En la consola, verifica headers
fetch('/api/media-proxy?url=...', { method: 'HEAD' })
  .then(r => {
    for (let [key, value] of r.headers) {
      console.log(key + ':', value);
    }
  });
```

#### Error: Imagen demasiado grande
```
[Media Proxy] ❌ File too large: 15MB (max: 10MB)
```

**Solución**: Ajustar `maxFileSize` en `media-proxy-config.ts` o rechazar la URL.

### ✅ Paso 5: Test con diferentes URLs

Prueba estas URLs para verificar diferentes proveedores:

**YouTube (oEmbed):**
```
https://youtube.com/watch?v=dQw4w9WgXcQ
```

**Wikipedia (Open Graph):**
```
https://en.wikipedia.org/wiki/JavaScript
```

**Giphy (oEmbed + GIF):**
```
https://giphy.com/gifs/funny-cat-JIX9t2j0ZTN9S
```

**Twitter/X (oEmbed):**
```
https://twitter.com/username/status/1234567890
```

**Imagen directa:**
```
https://i.imgur.com/abc123.jpg
```

### ✅ Paso 6: Verificar estado del preview en CreatePollModal

Agrega esto temporalmente en `CreatePollModal.svelte` después de `detectedTitlePreview`:

```typescript
$effect(() => {
  if (detectedTitlePreview) {
    console.log('🎯 Preview en modal:', {
      title: detectedTitlePreview.title,
      hasImage: !!detectedTitlePreview.image,
      image: detectedTitlePreview.image,
      imageProxied: detectedTitlePreview.imageProxied
    });
  }
});
```

### ✅ Paso 7: Verificar CSS

Si la imagen carga pero no se ve, verifica en las DevTools:

1. Inspecciona el elemento `<img>` dentro de `.link-preview`
2. Verifica el `opacity` (debería ser `1` cuando tiene clase `.loaded`)
3. Verifica `z-index` y `position`
4. Mira la pestaña Network para ver si la imagen se descargó

### 🎯 Solución rápida temporal

Si nada funciona, usa la imagen original sin proxy (temporal, no recomendado para producción):

En `LinkPreview.svelte`, cambia:
```svelte
<img 
  src={preview.imageProxied || preview.image}
```

A:
```svelte
<img 
  src={preview.image}
  crossorigin="anonymous"
```

Esto mostrará la imagen directamente (puede fallar con CORS pero te ayuda a diagnosticar).

---

## 📝 Reporte de Issue

Si sigues teniendo problemas, proporciona:

1. URL que estás probando
2. Logs de la consola (completos)
3. Estado de `detectedTitlePreview` en el effect
4. Respuesta de `/api/link-preview?url=...`
5. Respuesta de `/api/media-proxy?url=...`
6. Screenshot del inspector de elementos mostrando el `<img>`
