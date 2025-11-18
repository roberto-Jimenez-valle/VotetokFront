# Fix: Eliminar CASO 1 del Watcher

## Problema Reportado
La encuesta no se cerraba correctamente. El watcher estaba interfiriendo con el cierre manual.

## Causa Raíz

### El Problema del CASO 1:

El watcher tenía dos casos:
1. **CASO 1**: Detectar cuando se quita `?poll=` de la URL → Cerrar encuesta
2. **CASO 2**: Detectar cuando cambia de una encuesta a otra

**Flujo problemático con CASO 1:**

```
1. Usuario cierra encuesta (botón X)
2. closePoll(false) ejecuta
3. isClosingPoll = true ✅
4. lastProcessedPollId = null ✅
5. pushState a '/' (quita ?poll=)
6. Carga trending

PERO MIENTRAS TANTO:

7. Watcher detecta cambio de URL (!pollIdParam)
8. isClosingPoll puede haber cambiado a false si closePoll terminó rápido
9. Watcher CASO 1 ejecuta:
   - lastProcessedPollId = null
   - closePoll(true) ← ❌ SEGUNDA llamada
10. NO carga trending (skipTrendingLoad=true)
11. ❌ CONFLICTO: Dos procesos de cierre simultáneos
```

### Por Qué el CASO 1 Es Innecesario:

El CASO 1 intentaba detectar cuando se quitaba el parámetro `?poll=` para cerrar la encuesta. **PERO** esto ya lo maneja el botón X que llama directamente a `closePoll()`.

La única situación donde el watcher debe actuar es:
- **CASO 2**: Cambiar de una encuesta a otra (de `?poll=123` a `?poll=456`)

NO debe actuar cuando:
- Se cierra desde el botón X (ya se llama a `closePoll()` directamente)
- Se vuelve atrás con el navegador (lo maneja `popstate`)

## Solución: Eliminar CASO 1 Completamente

**Archivo:** `src/lib/GlobeGL.svelte` (línea 6378-6391)

### Antes (❌):

```typescript
$: {
  const pollIdParam = $page.url.searchParams.get('poll');
  
  if (isInitialMount) {
    // ignorar
  }
  else if (isClosingPoll) {
    // ignorar
  }
  // ❌ CASO 1: Cerrar cuando se quita parámetro
  else if (!pollIdParam && lastProcessedPollId && activePoll) {
    console.log('[Watcher] 🚪 CASO 1: Parámetro poll eliminado');
    lastProcessedPollId = null;
    isNavigatingFromHistory = true;
    
    closePoll(true).then(() => {  // ❌ Segunda llamada a closePoll
      isNavigatingFromHistory = false;
    });
  }
  // CASO 2: Cambiar de encuesta
  else if (pollIdParam && globe && pollIdParam !== lastProcessedPollId) {
    // cambiar encuesta...
  }
}
```

### Después (✅):

```typescript
$: {
  const pollIdParam = $page.url.searchParams.get('poll');
  
  console.log('[Watcher] 🔍 Ejecutando | pollIdParam:', pollIdParam, 
              'lastProcessed:', lastProcessedPollId, 
              'isInitialMount:', isInitialMount, 
              'isClosingPoll:', isClosingPoll,
              'activePoll:', !!activePoll);
  
  if (isInitialMount) {
    console.log('[Watcher] ⏭️ Ignorando (carga inicial)');
  }
  else if (isClosingPoll) {
    console.log('[Watcher] ⏸️ Ignorando (ya estamos cerrando)');
  }
  // ✅ ÚNICO CASO: Cambiar de encuesta
  else if (pollIdParam && globe && pollIdParam !== lastProcessedPollId) {
    console.log('[Watcher] 🔗 Detectado cambio de encuesta');
    // cambiar encuesta...
  }
  // ✅ NO hay CASO 1 - El cierre lo maneja closePoll() directo
}
```

## Cómo Funciona Ahora

### Flujo: Cerrar Encuesta (Botón X)

```
1. Usuario hace click en botón X
2. UI llama a closePoll(false)
3. closePoll() ejecuta:
   - isClosingPoll = true ✅
   - lastProcessedPollId = null ✅
   - pushState a '/' ✅
   - Limpia datos de encuesta
   - Carga trending (skipTrendingLoad=false) ✅
   - isClosingPoll = false ✅

4. Watcher detecta cambio de URL (poll desapareció)
5. Watcher evalúa condiciones:
   - isInitialMount? No
   - isClosingPoll? Puede ser true o false según timing
   - !pollIdParam && lastProcessedPollId && activePoll? 
     → lastProcessedPollId es null ✅
     → Condición NO se cumple ✅
6. Watcher NO ejecuta nada ✅

7. ✅ Trending cargado UNA vez
8. ✅ Encuesta cerrada correctamente
```

### Flujo: Cambiar de Encuesta

```
1. Usuario abre /poll/456 (teniendo /poll/123 abierta)
2. URL cambia a /?poll=456
3. Watcher detecta cambio
4. Watcher ejecuta ÚNICO CASO:
   - pollIdParam="456" ✅
   - lastProcessedPollId="123" ✅
   - pollIdParam !== lastProcessedPollId ✅
5. Watcher cierra encuesta anterior: closePoll(true)
6. Watcher carga nueva encuesta
7. ✅ Cambio limpio sin trending intermedio
```

### Flujo: Botón Atrás del Navegador

```
1. Usuario presiona atrás
2. popstate handler se ejecuta
3. popstate cierra encuesta con: isNavigatingFromHistory=true
4. closePoll() NO hace pushState (isNavigatingFromHistory=true)
5. Watcher NO se dispara (no hay cambio de URL adicional)
6. ✅ Funciona correctamente
```

## Responsabilidades Claras

### closePoll() - Llamado Directamente:
- ✅ Botón X de cerrar encuesta
- ✅ Botón atrás del navegador (popstate)
- ✅ Cambio de tab (trending/para ti)
- ✅ Abrir encuesta nula (trending)

### Watcher - Solo Cambios de Encuesta:
- ✅ De `?poll=123` → `?poll=456`
- ❌ De `?poll=123` → `/` (ya lo maneja closePoll)
- ❌ De `/` → `?poll=123` (ya lo maneja onMount)

## Beneficios

1. **Sin Doble Cierre:** Solo una llamada a `closePoll()` por acción
2. **Trending Se Carga:** `skipTrendingLoad=false` en cierre manual
3. **Lógica Clara:** Cada componente tiene su responsabilidad
4. **Sin Race Conditions:** No hay conflictos entre botón X y watcher
5. **Logs Más Limpios:** Solo un flujo de cierre en consola

## Testing

### Test 1: Cerrar con Botón X
```
Acción: Click en botón X
Logs esperados:
✅ [closePoll] 🔄 INICIO | skipTrendingLoad: false
✅ [closePoll] 🚫 Flag isClosingPoll activado
✅ [closePoll] 🔄 lastProcessedPollId reseteado a null
✅ [History] 🔄 Volviendo a modo trending
✅ [Watcher] 🔍 Ejecutando | pollIdParam: null
❌ NO debe aparecer: [Watcher] 🚪 CASO 1
✅ [closePoll] 📊 Cargando trending
✅ [loadTrendingData] 🚀 Iniciando
✅ [closePoll] ✅ FIN
```

### Test 2: Cambiar de Encuesta
```
Acción: Abrir /poll/2 (teniendo /poll/1)
Logs esperados:
✅ [Watcher] 🔗 Detectado cambio: 2 (anterior: 1)
✅ [Watcher] 🔄 Cerrando encuesta anterior
✅ [closePoll] INICIO | skipTrendingLoad: true
✅ [closePoll] ⏭️ Saltando trending
✅ [Watcher] 📊 Cargando encuesta 2
✅ Sin trending intermedio
```

### Test 3: Botón Atrás
```
Acción: Presionar botón atrás del navegador
Logs esperados:
✅ [History] popstate detectado
✅ [closePoll] INICIO | skipTrendingLoad: false/true
✅ [loadTrendingData] (si corresponde)
❌ NO debe aparecer: [Watcher] ejecutando después
```

## Código Eliminado

```typescript
// ❌ ELIMINADO - CASO 1 innecesario
else if (!pollIdParam && lastProcessedPollId && activePoll) {
  console.log('[Watcher] 🚪 CASO 1: Parámetro poll eliminado, cerrando encuesta actual');
  lastProcessedPollId = null;
  
  isNavigatingFromHistory = true;
  
  closePoll(true).then(() => {
    isNavigatingFromHistory = false;
  });
}
```

## Archivos Modificados

### src/lib/GlobeGL.svelte

**Línea 6378**: Eliminar CASO 1 completo
```typescript
// Antes tenía:
// - CASO 1: Cerrar cuando se quita parámetro
// - CASO 2: Cambiar de encuesta

// Ahora solo:
// - ÚNICO CASO: Cambiar de encuesta
else if (pollIdParam && globe && pollIdParam !== lastProcessedPollId) {
  // cambiar encuesta...
}
```

## Serie Completa de Fixes

Esta es la **séptima corrección**:

1. FIX_DOBLE_CARGA_POLL - Doble carga simultánea
2. FIX_CIERRE_Y_CAMBIO_ENCUESTAS - Watcher con dos casos
3. FIX_DOBLE_CARGA_TRENDING - Reset timing
4. FIX_DOBLE_CARGA_TRENDING_FINAL - Flag isClosingPoll
5. FIX_TRENDING_INICIAL_Y_LOGS - No cargar trending inicial
6. FIX_CARGA_INICIAL_DESDE_ENLACE - Flag en carga inicial
7. **FIX_ELIMINAR_CASO1_WATCHER** (Este) - Eliminar CASO 1 innecesario

## Conclusión

El CASO 1 del watcher era **innecesario y problemático**:
- ❌ Causaba doble cierre de encuesta
- ❌ Usaba `skipTrendingLoad=true` (no cargaba trending)
- ❌ Creaba race conditions con `closePoll()` directo
- ❌ Duplicaba responsabilidades

La solución es **eliminar el CASO 1 completamente**:
- ✅ El watcher solo maneja cambios entre encuestas
- ✅ El cierre lo maneja `closePoll()` directo (botón X, popstate, etc.)
- ✅ Sin conflictos ni race conditions
- ✅ Trending se carga correctamente

**Ahora el cierre de encuestas funciona correctamente y carga el trending.** 🎉
