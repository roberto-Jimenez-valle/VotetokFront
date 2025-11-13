# 🔄 Mejora en Navegación Vertical de Encuestas (Maximized View)

## Problema Identificado

Cuando navegabas verticalmente entre encuestas en la vista maximizada (`PollMaximizedView`), solo podías navegar entre 2 encuestas, aunque hubiera muchas más disponibles. Esto causaba que:

- **Síntoma**: Solo podías pasar entre 2 encuestas en loop, aunque hubiera muchas más disponibles
- **Causa raíz**: `previewModalPollIndex` nunca se actualizaba correctamente:
  - En `handleOpenPreviewModal`: No se establecía el índice de la encuesta
  - En `navigateToNextPollWithPreview` y `navigateToPreviousPollWithPreview`: Siempre usaba índice 0
- **Limitación secundaria**: Las encuestas que aún no se habían cargado (por no haber hecho scroll) no estaban disponibles para navegación vertical

## Solución Implementada

### Cambios en `BottomSheet.svelte`

#### 1. Función `handleOpenPreviewModal()` - CORREGIDA

**Antes (problema):**
```typescript
previewModalPoll = poll;
previewModalOption = transformedOptions;
previewModalOptionIndex = activeId;
// ❌ previewModalPollIndex NO se establecía
showPreviewModal = true;
```

**Ahora (arreglado):**
```typescript
// Encontrar el índice de esta encuesta en allPolls
const allPolls = activePoll ? [activePoll, ...additionalPolls] : additionalPolls;
const pollIndex = allPolls.findIndex(p => p.id.toString() === poll.id.toString());

previewModalPoll = poll;
previewModalOption = transformedOptions;
previewModalOptionIndex = activeId;
previewModalPollIndex = pollIndex >= 0 ? pollIndex : 0; // ✅ AHORA SE ESTABLECE
showPreviewModal = true;

console.log('[BottomSheet] 📊 Modal data:', { 
  pollIndex: previewModalPollIndex,
  totalPolls: allPolls.length
});
```

#### 2. Función `navigateToNextPollWithPreview()` - MEJORADA

**Antes (problema):**
```typescript
const currentIndex = previewModalPollIndex === -1 ? 0 : previewModalPollIndex + 1;
// ❌ Siempre sumaba 1 al índice, causando saltos incorrectos
```

**Ahora (arreglado):**
```typescript
async function navigateToNextPollWithPreview() {
  const allPolls = activePoll ? [activePoll, ...additionalPolls] : additionalPolls;
  const currentIndex = previewModalPollIndex >= 0 ? previewModalPollIndex : 0;
  // ✅ Usa el índice correcto sin sumar 1
  
  console.log('[BottomSheet] 🔍 Buscando siguiente desde índice:', currentIndex, 'de', allPolls.length);
  
  // 1. Buscar siguiente encuesta en las ya cargadas
  for (let i = currentIndex + 1; i < allPolls.length; i++) {
    const poll = allPolls[i];
    const optionsWithPreview = (poll.options || []).filter((opt: any) => opt.imageUrl);
    if (optionsWithPreview.length > 0) {
      // ✅ Encontrada - abrir
      handleOpenPreviewModal({...});
      return;
    }
  }
  
  // 2. 🆕 Si no hay más encuestas cargadas, cargar automáticamente la siguiente página
  if (hasMorePolls && !isLoadingPolls && !activePoll) {
    console.log('[BottomSheet] 📥 Cargando más encuestas para navegación...');
    await loadAdditionalPolls(currentPollsPage + 1);
    
    // 3. 🆕 Intentar de nuevo después de cargar
    const newAllPolls = activePoll ? [activePoll, ...additionalPolls] : additionalPolls;
    for (let i = currentIndex + 1; i < newAllPolls.length; i++) {
      const poll = newAllPolls[i];
      const optionsWithPreview = (poll.options || []).filter((opt: any) => opt.imageUrl);
      if (optionsWithPreview.length > 0) {
        handleOpenPreviewModal({...});
        return;
      }
    }
  }
  
  console.log('[BottomSheet] No hay más encuestas con preview');
}
```

### Beneficios

✅ **Carga automática**: Cuando llegas al final de las encuestas cargadas, automáticamente carga la siguiente página

✅ **Navegación continua**: Puedes navegar verticalmente entre TODAS las encuestas disponibles, no solo las que ya están en pantalla

✅ **Experiencia fluida**: La carga es transparente para el usuario, solo tarda un momento

✅ **Compatible con scroll infinito**: Respeta el sistema existente de paginación

### Flujo de Navegación

```
Usuario hace swipe vertical ⬆️
        ↓
¿Hay siguiente encuesta cargada?
        ↓
    NO → ¿Hay más páginas disponibles? (hasMorePolls)
        ↓
       SÍ → 📥 Cargar siguiente página (loadAdditionalPolls)
        ↓
    ¿Encontró encuesta con preview?
        ↓
       SÍ → ✅ Navegar a esa encuesta
        ↓
       NO → 🛑 "No hay más encuestas"
```

### Condiciones de Carga

La carga automática solo ocurre si:
1. ✅ `hasMorePolls === true` (hay más páginas en la API)
2. ✅ `!isLoadingPolls` (no hay otra carga en progreso)
3. ✅ `!activePoll` (estamos en modo trending, no viendo una encuesta específica)

### Logs de Debug

```
[BottomSheet] 📥 Cargando más encuestas para navegación...
[BottomSheet] ⬇️ Siguiente encuesta (después de cargar): 12
```

## Archivos Modificados

- `src/lib/globe/BottomSheet.svelte` - Función `navigateToNextPollWithPreview()`
- `GIPHY_PICKER_INTEGRATION.md` - Documentación actualizada del GiphyPicker

## Testing

### Caso de Prueba 1: Navegación con encuestas ya cargadas
1. Abrir BottomSheet en modo trending
2. Hacer scroll hacia abajo hasta cargar 3-4 encuestas
3. Abrir una en vista maximizada
4. Hacer swipe vertical hacia arriba
5. **Resultado**: Navega instantáneamente a la siguiente

### Caso de Prueba 2: Navegación con carga automática
1. Abrir BottomSheet en modo trending (solo 1-2 encuestas visibles)
2. Abrir la primera encuesta en vista maximizada
3. Hacer swipe vertical hacia arriba repetidamente
4. **Resultado**: Cuando llega al final de las cargadas, automáticamente carga más y continúa navegando

### Caso de Prueba 3: Final de encuestas
1. Navegar hasta la última encuesta disponible en la API
2. Hacer swipe vertical hacia arriba
3. **Resultado**: Mensaje "No hay más encuestas con preview"

## Mejoras Futuras Posibles

- 🔮 Precargar siguiente página cuando estés cerca del final
- 🔮 Indicador visual cuando está cargando más encuestas
- 🔮 Cache de encuestas ya visitadas para navegación más rápida
- 🔮 Soporte para navegación hacia atrás con carga de páginas anteriores
