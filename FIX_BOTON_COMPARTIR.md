# Fix: Botón de Compartir en Mini y Maximized

## Problema Identificado
El botón de compartir no funcionaba en:
1. **Vista mini** (SinglePollSection) - Encuestas en el feed
2. **Vista maximizada** (PollMaximizedView) - Modal fullscreen

## Causa del Problema

### 1. Sintaxis incorrecta en SinglePollSection
- **Error:** Usaba `on:click` (sintaxis Svelte 4)
- **Solución:** Cambiar a `onclick` (sintaxis Svelte 5)

### 2. URL antigua en PollMaximizedView
- **Error:** Usaba `/?poll=123` sin fallback de portapapeles
- **Solución:** Actualizar a `/poll/123` con sistema completo de compartir

### 3. Función faltante en BottomSheet
- **Error:** Llamaba a `copyShareUrlToClipboard()` pero no existía
- **Solución:** Agregar funciones de copiar al portapapeles

## Cambios Realizados

### 1. SinglePollSection.svelte (Vista Mini)

**Antes:**
```svelte
<button 
  class="share-button"
  on:click={sharePoll}  <!-- ❌ Sintaxis Svelte 4 -->
>
```

**Después:**
```svelte
<button 
  class="share-button"
  onclick={(e) => sharePoll(e)}  <!-- ✅ Sintaxis Svelte 5 -->
>
```

**Función `sharePoll()` ya existente:**
- Usa URL: `${window.location.origin}/poll/${poll.id}`
- Web Share API en móviles
- Fallback a portapapeles en desktop
- Toast de confirmación

### 2. BottomSheet.svelte (Vista Maximizada)

**Agregadas funciones auxiliares (línea 1557):**
```typescript
function copyShareUrlToClipboard(url: string) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      console.log('[BottomSheet] ✅ Enlace copiado al portapapeles:', url);
    }).catch((err) => {
      fallbackCopyToClipboard(url);
    });
  } else {
    fallbackCopyToClipboard(url);
  }
}

function fallbackCopyToClipboard(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    console.log('[BottomSheet] ✅ Enlace copiado (fallback):', text);
  } catch (error) {
    console.error('[BottomSheet] Error copiando (fallback):', error);
  }
  document.body.removeChild(textarea);
}
```

**Actualizado handler `onShare` (línea 3640):**

**Antes:**
```typescript
onShare={() => {
  if (navigator.share && previewModalPoll) {
    navigator.share({
      title: previewModalPoll.question || previewModalPoll.title,
      text: 'Mira esta encuesta en voutop',
      url: window.location.origin + '/?poll=' + previewModalPoll.id  // ❌ URL antigua
    }).catch(err => console.log('Error sharing:', err));
  }
}}
```

**Después:**
```typescript
onShare={async () => {
  if (!previewModalPoll) return;
  
  const shareUrl = `${window.location.origin}/poll/${previewModalPoll.id}`;  // ✅ URL nueva
  const shareTitle = previewModalPoll.question || previewModalPoll.title;
  const shareText = previewModalPoll.description || `Vota en esta encuesta: ${shareTitle}`;

  // Intentar Web Share API
  if (navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl
      });
      console.log('[BottomSheet] ✅ Compartido exitosamente');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        copyShareUrlToClipboard(shareUrl);  // ✅ Fallback
      }
    }
  } else {
    copyShareUrlToClipboard(shareUrl);  // ✅ Fallback desktop
  }
}}
```

## Flujo Completo de Compartir

### Vista Mini (SinglePollSection)
1. Usuario hace click en botón 🔗 junto al avatar
2. `sharePoll()` se ejecuta
3. Si móvil con Web Share API → Menú nativo
4. Si desktop o falla → Copia al portapapeles
5. Toast verde: "✓ Enlace copiado" (2 segundos)

### Vista Maximizada (PollMaximizedView)
1. Usuario hace click en botón ⋯ (opciones)
2. Se abre bottom sheet con opciones
3. Click en "Compartir"
4. `onShare()` se ejecuta en BottomSheet
5. Si móvil con Web Share API → Menú nativo
6. Si desktop o falla → Copia al portapapeles
7. Console log: "✅ Enlace copiado"

## URLs Generadas

Ambas vistas ahora generan:
```
https://voutop.com/poll/123
```

Que incluye:
- Meta tags Open Graph completos
- Imagen de preview dinámica (SVG 1200x630px)
- Compatible con WhatsApp, Facebook, Twitter, etc.

## Testing

### Para probar en desarrollo:
```bash
npm run dev
```

1. **Vista Mini:**
   - Busca cualquier encuesta en el feed
   - Click en botón 🔗 junto al avatar
   - Debe abrir menú de compartir (móvil) o copiar enlace (desktop)

2. **Vista Maximizada:**
   - Click en cualquier opción de encuesta para expandir
   - Click en botón ⋯ (tres puntos)
   - Click en "Compartir"
   - Debe abrir menú de compartir (móvil) o copiar enlace (desktop)

### Verificar en consola:
```
[Share] Compartido exitosamente via Web Share API
// o
[BottomSheet] ✅ Enlace copiado al portapapeles: https://voutop.com/poll/123
```

## Archivos Modificados

1. **src/lib/globe/cards/sections/SinglePollSection.svelte**
   - Línea 777: Cambio de `on:click` a `onclick`

2. **src/lib/globe/BottomSheet.svelte**
   - Línea 1557: Agregadas funciones `copyShareUrlToClipboard()` y `fallbackCopyToClipboard()`
   - Línea 3640: Actualizado handler `onShare` con nueva URL y fallback completo

## Notas Técnicas

### Diferencias Svelte 4 vs Svelte 5
- **Svelte 4:** `on:click={handler}`
- **Svelte 5:** `onclick={handler}` o `onclick={(e) => handler(e)}`
- **Error si mezclas:** "Mixing old and new syntaxes for event handling is not allowed"

### Web Share API
- Disponible en: Chrome Android, Safari iOS, Edge Android, Samsung Internet
- No disponible en: Desktop browsers (la mayoría)
- Requiere HTTPS en producción
- `AbortError` = Usuario canceló, no mostrar error

### Clipboard API
- Moderna: `navigator.clipboard.writeText()`
- Fallback: `document.execCommand('copy')`
- Requiere interacción del usuario (click)
- HTTPS recomendado pero no obligatorio

## Compatibilidad

### Navegadores
- ✅ Chrome (desktop/mobile)
- ✅ Firefox (desktop/mobile)
- ✅ Safari (desktop/mobile)
- ✅ Edge (desktop/mobile)
- ✅ Samsung Internet
- ✅ Opera

### Sistemas operativos
- ✅ Windows
- ✅ macOS
- ✅ Linux
- ✅ Android
- ✅ iOS

## Mejoras Futuras (Opcional)

1. **Toast visual en vista maximizada:**
   - Mostrar confirmación visual similar a vista mini
   - Actualmente solo hay console.log

2. **Analytics:**
   - Trackear cuántas veces se comparte cada encuesta
   - Medir conversiones desde enlaces compartidos

3. **Personalización:**
   - Permitir al usuario elegir texto personalizado
   - Opciones de compartir con/sin descripción

## Conclusión

El botón de compartir ahora funciona correctamente en ambas vistas (mini y maximizada) con:
- ✅ Sintaxis correcta de Svelte 5
- ✅ URLs con Open Graph (`/poll/[id]`)
- ✅ Web Share API nativa en móviles
- ✅ Fallback robusto para desktop
- ✅ Manejo de errores apropiado
- ✅ Logging para debugging
