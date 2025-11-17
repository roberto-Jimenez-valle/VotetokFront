# Fix: Doble Carga de Trending

## Problema Reportado
Después de corregir el cierre y cambio de encuestas, el trending se cargaba dos veces cuando se cerraba una encuesta desde el botón X.

## Causa Raíz

### Flujo Problemático:
```
1. Usuario cierra encuesta (botón X)
2. closePoll() ejecuta
3. closePoll() limpia datos
4. closePoll() resetea lastProcessedPollId = null (línea 4106)
5. closePoll() hace pushState → URL cambia a / (línea 4097)
6. closePoll() carga trending (skipTrendingLoad=false)
7. Watcher detecta cambio: !pollIdParam && lastProcessedPollId="123" ❌
8. Watcher llama a closePoll(true) de nuevo
9. ❌ Doble carga de trending
```

### El Problema:
`lastProcessedPollId` se reseteaba DESPUÉS del `pushState`, entonces cuando el watcher reaccionaba al cambio de URL, todavía veía el ID anterior y ejecutaba el cierre de nuevo.

## Solución

### Mover el Reset ANTES del pushState

**Archivo:** `src/lib/GlobeGL.svelte` (línea 4090)

**Antes (❌):**
```typescript
async function closePoll(skipTrendingLoad = false) {
  console.log('[closePoll] 🔄 Cerrando encuesta');
  
  // HISTORY API: pushState primero
  if (!isNavigatingFromHistory && !skipTrendingLoad) {
    history.pushState(historyState, '', '/'); // 1️⃣ Cambia URL
    console.log('[History] 🔄 Volviendo a modo trending');
  }
  
  // Limpiar contexto
  globalActivePoll.close();
  activePollOptions = [];
  
  // ❌ Resetear DESPUÉS del pushState
  lastProcessedPollId = null; // 2️⃣ Resetea (muy tarde)
  
  // Resto de limpieza...
}
```

**Ahora (✅):**
```typescript
async function closePoll(skipTrendingLoad = false) {
  console.log('[closePoll] 🔄 Cerrando encuesta | skipTrendingLoad:', skipTrendingLoad);
  
  // ✅ Resetear ANTES de hacer pushState para evitar que el watcher reaccione
  lastProcessedPollId = null; // 1️⃣ Resetea PRIMERO
  
  // HISTORY API: pushState después
  if (!isNavigatingFromHistory && !skipTrendingLoad) {
    history.pushState(historyState, '', '/'); // 2️⃣ Cambia URL
    console.log('[History] 🔄 Volviendo a modo trending');
  }
  
  // FASE 3: Limpiar contexto de encuesta usando store
  globalActivePoll.close();
  activePollOptions = [];
  
  // Resto de limpieza...
}
```

## Cómo Funciona Ahora

### Flujo Correcto:
```
1. Usuario cierra encuesta (botón X)
2. closePoll() ejecuta
3. lastProcessedPollId = null ✅ (ANTES del pushState)
4. pushState cambia URL a /
5. Watcher reactivo detecta cambio de URL
6. Watcher evalúa: !pollIdParam && lastProcessedPollId && activePoll
7. lastProcessedPollId es null → Condición FALSE ✅
8. Watcher NO ejecuta closePoll de nuevo ✅
9. ✅ Trending se carga UNA sola vez
```

### Por Qué Funciona:

**Condición del Watcher (línea 6339):**
```typescript
else if (!pollIdParam && lastProcessedPollId && activePoll) {
  //                      ↑
  //                      Esta condición requiere que lastProcessedPollId NO sea null
  //                      Si ya es null, NO ejecuta
  console.log('[Watcher] 🚪 Parámetro poll eliminado, cerrando encuesta actual');
  closePoll(true);
}
```

Como `lastProcessedPollId` se resetea a `null` ANTES del `pushState`, cuando el watcher reacciona al cambio de URL, la condición `lastProcessedPollId && activePoll` es `false` y no ejecuta.

## Comparación: Antes vs Ahora

### Antes (❌ Doble Carga)

```typescript
async function closePoll(skipTrendingLoad = false) {
  // pushState primero → Dispara watcher
  if (!isNavigatingFromHistory && !skipTrendingLoad) {
    history.pushState(..., '/'); // Watcher detecta cambio
  }
  
  // ... limpieza ...
  
  // Reset después (muy tarde)
  lastProcessedPollId = null; // Watcher ya se ejecutó
}

// Watcher reacciona:
// lastProcessedPollId todavía es "123" → Ejecuta closePoll de nuevo ❌
```

### Ahora (✅ Una Sola Carga)

```typescript
async function closePoll(skipTrendingLoad = false) {
  // Reset PRIMERO
  lastProcessedPollId = null; // ✅ Se resetea ANTES
  
  // pushState después → Dispara watcher
  if (!isNavigatingFromHistory && !skipTrendingLoad) {
    history.pushState(..., '/'); // Watcher detecta cambio
  }
  
  // ... limpieza ...
}

// Watcher reacciona:
// lastProcessedPollId ya es null → NO ejecuta closePoll ✅
```

## Casos de Uso

### Caso 1: Cerrar con Botón X (UI)
```
✅ closePoll() ejecuta (skipTrendingLoad=false)
✅ lastProcessedPollId = null ANTES del pushState
✅ pushState cambia URL a /
✅ Watcher NO reacciona (lastProcessedPollId=null)
✅ Trending carga UNA vez
```

### Caso 2: Cerrar con Botón Atrás (History)
```
✅ popstate detecta cambio
✅ isNavigatingFromHistory = true
✅ closePoll() ejecuta (skipTrendingLoad=true)
✅ lastProcessedPollId = null
✅ NO hace pushState (isNavigatingFromHistory=true)
✅ Watcher NO reacciona
✅ Trending carga UNA vez
```

### Caso 3: Cambiar de Encuesta (Watcher)
```
✅ Watcher detecta cambio de ?poll=123 a ?poll=456
✅ isNavigatingFromHistory = true
✅ closePoll(true) ejecuta
✅ lastProcessedPollId = null primero
✅ NO hace pushState (isNavigatingFromHistory=true)
✅ Carga nueva encuesta
✅ Sin doble carga
```

## Logs de Debug

### Antes (❌ Doble Carga):
```
[closePoll] 🔄 Cerrando encuesta | skipTrendingLoad: false
[History] 🔄 Volviendo a modo trending
[Watcher] 🚪 Parámetro poll eliminado, cerrando encuesta actual ❌
[closePoll] 🔄 Cerrando encuesta | skipTrendingLoad: true ❌
```

### Ahora (✅ Una Sola Carga):
```
[closePoll] 🔄 Cerrando encuesta | skipTrendingLoad: false
[History] 🔄 Volviendo a modo trending
(Watcher NO ejecuta porque lastProcessedPollId=null) ✅
```

## Testing

### Test 1: Cerrar con Botón X
```
1. Abre /?poll=1
2. Cierra con botón X
3. Verifica en consola:
   ✅ Solo un log [closePoll]
   ❌ NO aparece [Watcher] 🚪
4. Verifica en Network:
   ✅ Solo una carga de trending
```

### Test 2: Cerrar con Botón Atrás
```
1. Abre /?poll=1
2. Presiona botón atrás
3. Verifica en consola:
   ✅ Solo un log [closePoll]
   ❌ NO aparece [Watcher] 🚪
4. Verifica en Network:
   ✅ Solo una carga de trending
```

### Test 3: Cerrar y Abrir Varias Veces
```
1. Abre /poll/1
2. Cierra
3. Abre /poll/2
4. Cierra
5. Abre /poll/3
6. Cierra
7. Verifica:
   ✅ Cada cierre = 1 carga de trending
   ✅ Sin doble cargas
   ✅ Sin race conditions
```

## Archivos Modificados

### src/lib/GlobeGL.svelte

**Línea 4090-4091**: Mover reset de `lastProcessedPollId` ANTES del `pushState`

```typescript
async function closePoll(skipTrendingLoad = false) {
  console.log('[closePoll] 🔄 Cerrando encuesta | skipTrendingLoad:', skipTrendingLoad);
  
  // ✅ Resetear ANTES de hacer pushState
  lastProcessedPollId = null;
  
  // HISTORY API
  if (!isNavigatingFromHistory && !skipTrendingLoad) {
    history.pushState(historyState, '', '/');
  }
  
  // Resto de limpieza...
}
```

## Resumen de Fixes Relacionados

Esta es la tercera corrección en la serie de fixes para la funcionalidad de compartir y URLs directas:

### 1. FIX_DOBLE_CARGA_POLL.md
- **Problema:** Doble carga simultánea de la misma encuesta
- **Solución:** Variables `isInitialMount` y `lastProcessedPollId`

### 2. FIX_CIERRE_Y_CAMBIO_ENCUESTAS.md
- **Problema:** No cerraba al quitar parámetro, no cerraba anterior al cambiar
- **Solución:** Watcher con CASO 1 y CASO 2

### 3. FIX_DOBLE_CARGA_TRENDING.md (Este fix)
- **Problema:** Trending se cargaba dos veces al cerrar
- **Solución:** Resetear `lastProcessedPollId` ANTES del `pushState`

## Conclusión

El problema de la doble carga de trending estaba causado por el **orden de ejecución** en `closePoll()`. El `lastProcessedPollId` se reseteaba DESPUÉS del `pushState`, permitiendo que el watcher reaccionara y ejecutara otro cierre.

La solución es simple pero crítica: **resetear `lastProcessedPollId = null` ANTES del `pushState`**. Esto previene que el watcher ejecute cuando detecta el cambio de URL.

✅ **Resultado:** Trending se carga UNA sola vez al cerrar encuestas. 🎉
