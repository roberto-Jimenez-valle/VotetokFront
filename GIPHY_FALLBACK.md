# 🎬 Sistema de Fallback Automático a Giphy

## 📌 Descripción

Cuando creas una encuesta con la plantilla Markdown y pegas URLs de imágenes que **no cargan correctamente**, el sistema automáticamente las reemplaza con **GIFs de Giphy** usando el texto de la opción como término de búsqueda.

---

## ✨ Cómo Funciona

### Flujo Automático

```
1. Usuario crea encuesta con opción:
   "Pizza 🍕 https://ejemplo.com/imagen-rota.jpg"

2. MediaEmbed intenta cargar la imagen
   ❌ Falla (404, CORS, timeout, etc.)

3. MediaEmbed emite evento: imageerror
   { url: "https://ejemplo.com/imagen-rota.jpg" }

4. CreatePollModal captura el evento
   → Extrae texto limpio: "Pizza 🍕"

5. Llama a Giphy API:
   giphyGifUrl("Pizza 🍕")

6. Giphy retorna GIF:
   "https://media.giphy.com/media/XYZ123/giphy.gif"

7. Reemplaza automáticamente la URL:
   "Pizza 🍕 https://media.giphy.com/media/XYZ123/giphy.gif"

8. El nuevo GIF se muestra correctamente ✅
```

---

## 🎯 Ejemplo Práctico

### Antes (Imagen Rota)

```markdown
Título: ¿Cuál es tu comida favorita?

Opciones:
1. Pizza 🍕 https://sitio-caido.com/pizza.jpg
2. Sushi 🍣 https://otro-sitio.com/404.png
3. Tacos 🌮 https://imagen-inexistente.net/taco.gif
```

**Resultado**: 3 imágenes rotas (placeholder gris con "?")

### Después (Con Fallback a Giphy)

```markdown
Título: ¿Cuál es tu comida favorita?

Opciones:
1. Pizza 🍕 https://media.giphy.com/media/abc123/giphy.gif
2. Sushi 🍣 https://media.giphy.com/media/def456/giphy.gif
3. Tacos 🌮 https://media.giphy.com/media/ghi789/giphy.gif
```

**Resultado**: 3 GIFs animados de Giphy mostrando pizza, sushi y tacos ✨

---

## 🔧 Implementación Técnica

### 1. MediaEmbed.svelte

```typescript
// Emite evento cuando imagen falla
onerror={(e) => {
  const img = e.target as HTMLImageElement;
  
  if (img.src !== fallbackUrl) {
    console.log('[MediaEmbed] 🚨 Imagen falló:', img.src);
    
    dispatch('imageerror', { 
      url: img.src,
      originalUrl: url 
    });
    
    img.src = fallbackUrl;
  }
}}
```

### 2. CreatePollModal.svelte

**Estado para rastrear URLs fallidas**:
```typescript
let failedUrls = $state<Map<string, string>>(new Map());
```

**Función de fallback**:
```typescript
async function replaceWithGiphyFallback(
  optionId: string, 
  optionLabel: string, 
  failedUrl: string
) {
  // Evitar loops infinitos
  if (failedUrls.has(failedUrl)) return;
  
  // Extraer texto limpio sin URL
  const searchTerm = getLabelWithoutUrl(optionLabel).trim();
  
  // Buscar GIF en Giphy
  const gifUrl = await giphyGifUrl(searchTerm);
  
  if (gifUrl) {
    // Marcar como procesada
    failedUrls.set(failedUrl, gifUrl);
    
    // Reemplazar en la opción
    const option = options.find(opt => opt.id === optionId);
    if (option) {
      option.label = option.label.replace(failedUrl, gifUrl);
    }
  }
}
```

**Handler del evento**:
```typescript
function handleImageLoadError(
  optionId: string, 
  optionLabel: string, 
  imageUrl: string
) {
  console.log(`[Image Error] 🚨 Imagen falló: "${getLabelWithoutUrl(optionLabel)}"`);
  replaceWithGiphyFallback(optionId, optionLabel, imageUrl);
}
```

**Conexión con MediaEmbed**:
```svelte
<MediaEmbed 
  url={detectedUrl || option.imageUrl || ''} 
  mode="full"
  on:imageerror={(e) => handleImageLoadError(option.id, option.label, e.detail.url)}
/>
```

---

## 🛡️ Protecciones Implementadas

### 1. Evitar Loops Infinitos

```typescript
// Si ya intentamos reemplazar esta URL, no hacerlo de nuevo
if (failedUrls.has(failedUrl)) {
  console.log('[Giphy Fallback] Ya se intentó reemplazar:', failedUrl);
  return;
}
```

### 2. Validación de Texto

```typescript
const searchTerm = getLabelWithoutUrl(optionLabel).trim();

if (!searchTerm) {
  console.warn('[Giphy Fallback] No hay texto para buscar GIF');
  return;
}
```

### 3. Try-Catch

```typescript
try {
  const gifUrl = await giphyGifUrl(searchTerm);
  // ...
} catch (error) {
  console.error('[Giphy Fallback] Error buscando GIF:', error);
}
```

---

## 📊 Logging Detallado

### En la Consola del Navegador

```javascript
// Cuando una imagen falla
[MediaEmbed] 🚨 Imagen falló: https://ejemplo.com/rota.jpg
[Image Error] 🚨 Imagen falló para opción: "Pizza 🍕"
[Image Error] URL fallida: https://ejemplo.com/rota.jpg

// Durante la búsqueda en Giphy
[Giphy Fallback] 🎬 Buscando GIF para: "Pizza 🍕"

// Cuando se encuentra
[Giphy Fallback] ✅ GIF encontrado: https://media.giphy.com/media/abc123/giphy.gif
[Giphy Fallback] ✅ Opción "Pizza 🍕" actualizada con GIF de Giphy

// Si no se encuentra
[Giphy Fallback] ❌ No se encontró GIF para: "Pizza 🍕"
```

---

## 🎯 Casos de Uso

### Caso 1: URL Externa Caída

```markdown
Opción: Hamburguesa https://sitio-caido.com/burger.jpg
```

**Resultado**: Se reemplaza automáticamente con un GIF de "Hamburguesa" de Giphy

### Caso 2: Error CORS

```markdown
Opción: Helado https://api-sin-cors.com/icecream.png
```

**Resultado**: Se reemplaza con GIF de "Helado" de Giphy

### Caso 3: Imagen 404

```markdown
Opción: Café https://ejemplo.com/imagen-inexistente.jpg
```

**Resultado**: Se reemplaza con GIF de "Café" de Giphy

### Caso 4: Timeout

```markdown
Opción: Donut https://servidor-lento.com/donut.gif
```

**Resultado**: Después del timeout, se reemplaza con GIF de "Donut" de Giphy

---

## ⚡ Ventajas del Sistema

1. ✅ **Automático**: No requiere intervención del usuario
2. ✅ **Transparente**: El usuario ve el reemplazo instantáneamente
3. ✅ **Inteligente**: Usa el texto de la opción para buscar contenido relevante
4. ✅ **Seguro**: Evita loops infinitos y errores
5. ✅ **Sin interrupciones**: La creación de la encuesta no se detiene
6. ✅ **Mejor UX**: Siempre hay contenido visual, nunca placeholders vacíos

---

## 🔄 Alternativas al Fallback

Si no quieres que se reemplace automáticamente:

### Opción 1: Usar Placeholder

Comenta el handler en CreatePollModal:

```svelte
<MediaEmbed 
  url={detectedUrl || option.imageUrl || ''} 
  mode="full"
  <!-- on:imageerror={(e) => handleImageLoadError(...)} -->
/>
```

### Opción 2: Validación Previa

Valida URLs antes de permitir crear la encuesta:

```typescript
async function validateAllUrls() {
  for (const option of options) {
    const url = extractUrlFromText(option.label);
    if (url) {
      const isValid = await checkIfUrlWorks(url);
      if (!isValid) {
        errors[option.id] = 'Esta URL no funciona';
      }
    }
  }
}
```

---

## 🧪 Testing

### Test Manual

1. Crea una encuesta con esta plantilla:

```markdown
Título: Comidas del mundo

Opciones:
1. Pizza https://sitio-inexistente-123456789.com/pizza.jpg
2. Sushi https://ejemplo-404.net/sushi.png
3. Tacos https://broken-link.org/tacos.gif
```

2. Observa la consola (F12):
   - Deberías ver logs de `[Giphy Fallback]`
   - Las URLs se reemplazan automáticamente

3. Verifica visualmente:
   - Todas las opciones muestran GIFs animados
   - No hay placeholders grises

### Test Programático

```typescript
// En la consola del navegador
const testOption = {
  id: 'test-1',
  label: 'Pizza https://fake-url-123.com/pizza.jpg'
};

// Simular fallo de imagen
handleImageLoadError('test-1', testOption.label, 'https://fake-url-123.com/pizza.jpg');

// Espera ~500ms, luego revisa:
console.log(testOption.label);
// Debería contener URL de Giphy ahora
```

---

## 📈 Métricas y Logs

Para monitorear el uso del fallback:

```typescript
let fallbackStats = {
  totalFailures: 0,
  successfulReplacements: 0,
  failedReplacements: 0
};

// En replaceWithGiphyFallback():
fallbackStats.totalFailures++;

if (gifUrl) {
  fallbackStats.successfulReplacements++;
} else {
  fallbackStats.failedReplacements++;
}

console.log('[Giphy Fallback] Stats:', fallbackStats);
```

---

## 🔒 Consideraciones de Seguridad

1. ✅ **URLs Validadas**: Giphy solo retorna URLs de su propio CDN
2. ✅ **Sin XSS**: El sistema de proxy valida todas las URLs
3. ✅ **Rate Limiting**: Giphy tiene límites propios (42k requests/día)
4. ✅ **No Expone Datos**: Solo se envía el término de búsqueda a Giphy

---

## 🎉 Resumen

**Este sistema convierte URLs rotas en GIFs de Giphy automáticamente**, mejorando la experiencia del usuario y asegurando que las encuestas siempre tengan contenido visual atractivo.

**No requiere configuración adicional** - solo funciona. 🚀

---

**Archivos Modificados**:
1. `src/lib/CreatePollModal.svelte` - Lógica de fallback
2. `src/lib/components/MediaEmbed.svelte` - Evento imageerror
3. `src/lib/services/giphy.ts` - API de Giphy (ya existía)

**Última actualización**: Octubre 2024
