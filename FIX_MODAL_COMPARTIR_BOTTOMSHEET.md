# Fix: Modal Bottom Sheet de Compartir

## Problema Reportado
El usuario mencionó que antes había un modal bottom sheet para compartir, pero ya no funcionaba.

## Análisis
El modal de opciones existe en `BottomSheet.svelte` y se abre correctamente, pero los botones dentro del modal no hacían nada:
- **"Compartir encuesta"** → Solo cerraba el modal sin compartir
- **"Copiar enlace"** → Solo cerraba el modal sin copiar

## Solución Implementada

### 1. Botón "Compartir encuesta" (Línea 3539)

**Antes:**
```svelte
<button class="poll-option-item" onclick={closePollOptionsModal} type="button">
  <svg>...</svg>
  Compartir encuesta
</button>
```

**Después:**
```svelte
<button class="poll-option-item" onclick={async () => {
  if (!selectedPollForOptions) return;
  
  const shareUrl = `${window.location.origin}/poll/${selectedPollForOptions.id}`;
  const shareTitle = selectedPollForOptions.question || selectedPollForOptions.title;
  const shareText = selectedPollForOptions.description || `Vota en esta encuesta: ${shareTitle}`;

  // Web Share API o fallback
  if (navigator.share) {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      console.log('[BottomSheet] ✅ Compartido exitosamente');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        copyShareUrlToClipboard(shareUrl);
      }
    }
  } else {
    copyShareUrlToClipboard(shareUrl);
  }
  
  closePollOptionsModal();
}} type="button">
  <svg>...</svg>
  Compartir encuesta
</button>
```

### 2. Botón "Copiar enlace" (Línea 3576)

**Antes:**
```svelte
<button class="poll-option-item" onclick={closePollOptionsModal} type="button">
  <svg>...</svg>
  Copiar enlace
</button>
```

**Después:**
```svelte
<button class="poll-option-item" onclick={() => {
  if (!selectedPollForOptions) return;
  
  const shareUrl = `${window.location.origin}/poll/${selectedPollForOptions.id}`;
  copyShareUrlToClipboard(shareUrl);
  closePollOptionsModal();
}} type="button">
  <svg>...</svg>
  Copiar enlace
</button>
```

## Flujo Completo Ahora

### En Vista Mini (Feed):
1. Usuario hace click en el **botón de 3 puntos (⋯)** en una encuesta
2. Se abre el **modal bottom sheet** con opciones:
   - Ver encuesta completa
   - Guardar para después
   - **Compartir encuesta** ← AHORA FUNCIONA
   - **Copiar enlace** ← AHORA FUNCIONA
   - Seguir a usuario
   - Silenciar notificaciones
   - Reportar
   - Cancelar

3. Si hace click en **"Compartir encuesta"**:
   - **Móvil con Web Share API:** Abre menú nativo (WhatsApp, Instagram, etc.)
   - **Desktop o sin Web Share API:** Copia enlace al portapapeles
   - Console log: "✅ Compartido exitosamente"

4. Si hace click en **"Copiar enlace"**:
   - Copia directamente al portapapeles
   - Console log: "✅ Enlace copiado"

### URLs Generadas
Ambas opciones generan:
```
https://votetok.com/poll/123
```

Con Open Graph completo para preview en redes sociales.

## Resumen de Todas las Formas de Compartir

Ahora hay **4 formas** de compartir una encuesta:

### 1. Botón de compartir en header (Vista Mini)
- Icono 🔗 junto al avatar del creador
- Usa Web Share API o copia al portapapeles
- Toast de confirmación verde

### 2. Modal de opciones - "Compartir encuesta" (Vista Mini)
- Click en ⋯ → Modal bottom sheet → "Compartir encuesta"
- Usa Web Share API o copia al portapapeles
- Console log de confirmación

### 3. Modal de opciones - "Copiar enlace" (Vista Mini)
- Click en ⋯ → Modal bottom sheet → "Copiar enlace"
- Copia directamente al portapapeles
- Console log de confirmación

### 4. Modal de opciones en Vista Maximizada
- Click en ⋯ cuando la encuesta está en fullscreen
- Botón "Compartir" en el modal
- Usa Web Share API o copia al portapapeles

## Testing

### Para probar el modal:
1. Inicia `npm run dev`
2. Ve al feed de encuestas (vista mini)
3. Busca el **botón de 3 puntos (⋯)** en cualquier encuesta
4. Click en el botón → Se abre modal bottom sheet
5. Click en **"Compartir encuesta"** o **"Copiar enlace"**
6. Verificar que funciona:
   - En móvil: Debe abrir el menú nativo
   - En desktop: Debe copiar al portapapeles
   - En consola: Debe aparecer "✅ Compartido exitosamente" o "✅ Enlace copiado"

### Verificar en consola del navegador:
```
[BottomSheet] ✅ Compartido exitosamente via Web Share API
// o
[BottomSheet] ✅ Enlace copiado al portapapeles: https://votetok.com/poll/123
```

## Archivos Modificados

**src/lib/globe/BottomSheet.svelte**
- Línea 3539: Actualizado botón "Compartir encuesta" con lógica completa
- Línea 3576: Actualizado botón "Copiar enlace" con función de copiar

## Notas Adicionales

### Por qué hay múltiples formas de compartir
- **Botón en header:** Acceso rápido, siempre visible
- **Modal de opciones - Compartir:** Para usuarios que buscan más opciones
- **Modal de opciones - Copiar enlace:** Para cuando solo quieren el enlace sin abrir menú de compartir
- **Vista maximizada:** Contexto diferente, necesita sus propias opciones

Todas usan la misma URL con Open Graph para máxima compatibilidad.

### Reutilización de funciones
Las funciones `copyShareUrlToClipboard()` y `fallbackCopyToClipboard()` se definieron una vez (línea 1557) y se reutilizan en todos los lugares que necesitan copiar al portapapeles.

## Conclusión

✅ El modal bottom sheet de opciones ahora funciona correctamente
✅ Tanto "Compartir encuesta" como "Copiar enlace" tienen funcionalidad
✅ Usa Web Share API en móviles con fallback robusto
✅ URLs con Open Graph completo para previews ricos
✅ Console logs para debugging
