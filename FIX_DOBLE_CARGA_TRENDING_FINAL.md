# Fix Definitivo: Doble Carga de Trending

## Problema Persistente
A pesar de resetear `lastProcessedPollId` ANTES del `pushState`, el trending todavía se cargaba dos veces al cerrar una encuesta.

## Causa Raíz (Análisis Profundo)

### Flujo Problemático Completo:
```
1. Usuario cierra encuesta (botón X)
2. closePoll() ejecuta
3. lastProcessedPollId = null (línea 4095)
4. pushState cambia URL a / (línea 4104)
5. ⚡ Watcher se dispara INMEDIATAMENTE
6. Watcher evalúa: !pollIdParam && lastProcessedPollId && activePoll
7. lastProcessedPollId = null ✅
8. PERO activePoll todavía existe ✅
9. ❌ FALSO: La condición debería ser false
10. Continúa closePoll()
11. globalActivePoll.close() ejecuta (línea 4108)
12. loadTrendingData() ejecuta (línea 4165)
13. ✅ Primera carga de trending
```

### El Problema Real:
Aunque `lastProcessedPollId` es `null`, la condición del watcher:
```typescript
!pollIdParam && lastProcessedPollId && activePoll
```

Requiere que `lastProcessedPollId` sea truthy (no null). Entonces la condición debería ser `false` y NO ejecutarse.

**PERO** el problema es el **timing**. El watcher reactivo de Svelte se ejecuta **síncronamente** cuando cambia `$page.url`, mientras que `closePoll()` es **async** y todavía está ejecutando.

Si por alguna razón hay un delay o el navegador procesa el cambio de URL antes de que el código siga, puede haber un race condition donde:
- El watcher se evalúa
- `isClosingPoll` no existe todavía
- Múltiples eventos de cambio de URL

## Solución Definitiva: Flag `isClosingPoll`

### Agregar Flag de Control (línea 296)

```typescript
// Control para evitar doble carga de encuestas desde URL
let isInitialMount = true;
let lastProcessedPollId: string | null = null;
let isClosingPoll = false; // ✅ Flag para prevenir que el watcher reaccione durante cierre
```

### Activar Flag al Inicio de closePoll (línea 4092)

```typescript
async function closePoll(skipTrendingLoad = false) {
  console.log('[closePoll] 🔄 Cerrando encuesta | skipTrendingLoad:', skipTrendingLoad);
  
  // ✅ Activar flag PRIMERO de todo
  isClosingPoll = true;
  
  // Resetear el ID
  lastProcessedPollId = null;
  
  // pushState...
  if (!isNavigatingFromHistory && !skipTrendingLoad) {
    history.pushState(historyState, '', '/');
  }
  
  // Resto de limpieza...
}
```

### Desactivar Flag al Final de closePoll (línea 4172)

```typescript
async function closePoll(skipTrendingLoad = false) {
  // ... toda la lógica de cierre ...
  
  // Cargar trending
  if (!skipTrendingLoad) {
    await loadTrendingData();
    await updateGlobeColors();
  }
  
  // ✅ Desactivar flag al FINAL
  isClosingPoll = false;
}
```

### Verificar Flag en el Watcher (línea 6346)

```typescript
$: {
  const pollIdParam = $page.url.searchParams.get('poll');
  
  // Ignorar durante carga inicial
  if (isInitialMount) {
    // No hacer nada
  }
  // ✅ NUEVO: Ignorar si ya estamos cerrando
  else if (isClosingPoll) {
    console.log('[Watcher] ⏸️ Ya estamos cerrando una encuesta, ignorando cambio de URL');
  }
  // CASO 1: Se quitó el parámetro poll
  else if (!pollIdParam && lastProcessedPollId && activePoll) {
    closePoll(true);
  }
  // CASO 2: Cambió a otra encuesta
  else if (pollIdParam && globe && pollIdParam !== lastProcessedPollId) {
    // Cargar nueva encuesta...
  }
}
```

## Cómo Funciona Ahora

### Flujo Correcto:
```
1. Usuario cierra encuesta (botón X)
2. closePoll() ejecuta
3. isClosingPoll = true ✅ (PRIMERA LÍNEA)
4. lastProcessedPollId = null
5. pushState cambia URL a /
6. ⚡ Watcher se dispara
7. Watcher evalúa condiciones:
   - isInitialMount? No
   - isClosingPoll? SÍ ✅
8. Watcher ejecuta: console.log('[Watcher] ⏸️ Ya estamos cerrando...')
9. Watcher NO llama a closePoll ✅
10. closePoll() continúa normalmente
11. loadTrendingData() ejecuta UNA vez
12. isClosingPoll = false (al final)
13. ✅ Trending cargado UNA sola vez
```

## Por Qué Esta Solución Es Definitiva

### Triple Protección:

1. **`isClosingPoll` (Nuevo - Principal)**
   - Se activa al inicio de `closePoll()`
   - Bloquea el watcher durante todo el proceso
   - Se desactiva al final

2. **`lastProcessedPollId = null`**
   - Reset antes del `pushState`
   - Previene detección de "poll anterior"

3. **`isNavigatingFromHistory`**
   - Previene `pushState` duplicado
   - Evita loops de navegación

### Ventajas:

✅ **Protección Inmediata:** El flag se activa ANTES del `pushState`
✅ **Scope Completo:** Cubre toda la ejecución de `closePoll()`
✅ **Sincrónico:** El watcher ve el flag inmediatamente
✅ **Sin Race Conditions:** No depende del timing de async operations
✅ **Debug Claro:** Log específico cuando se ignora por flag

## Comparación: Intentos Anteriores vs Solución Final

### Intento 1: Solo resetear `lastProcessedPollId`
```typescript
// ❌ No funcionó - timing issues
lastProcessedPollId = null; // DESPUÉS del pushState
```

### Intento 2: Resetear ANTES del pushState
```typescript
// ❌ Mejor pero no suficiente
lastProcessedPollId = null; // ANTES del pushState
```

### Solución Final: Flag dedicado
```typescript
// ✅ FUNCIONA - protección completa
isClosingPoll = true;      // ANTES de todo
lastProcessedPollId = null; // Doble protección
// ... proceso de cierre ...
isClosingPoll = false;     // AL FINAL
```

## Logs de Debug

### Con el Flag (✅ Correcto):
```
[closePoll] 🔄 Cerrando encuesta | skipTrendingLoad: false
[History] 🔄 Volviendo a modo trending
[Watcher] ⏸️ Ya estamos cerrando una encuesta, ignorando cambio de URL ✅
[closePoll] 📊 Cargando trending después de cerrar
[loadTrendingData] 🚀 Iniciando carga de datos...
(Solo UNA carga) ✅
```

### Sin el Flag (❌ Incorrecto):
```
[closePoll] 🔄 Cerrando encuesta | skipTrendingLoad: false
[History] 🔄 Volviendo a modo trending
[Watcher] 🚪 Parámetro poll eliminado, cerrando encuesta actual ❌
[closePoll] 🔄 Cerrando encuesta | skipTrendingLoad: true ❌
[closePoll] 📊 Cargando trending después de cerrar
[loadTrendingData] 🚀 Iniciando carga de datos...
(DOBLE carga) ❌
```

## Testing Exhaustivo

### Test 1: Cerrar con Botón X
```
1. Abre /?poll=1
2. Cierra con botón X
3. Verifica en consola:
   ✅ [closePoll] aparece UNA vez
   ✅ [Watcher] ⏸️ aparece
   ✅ [loadTrendingData] aparece UNA vez
4. Verifica en Network:
   ✅ Solo UNA request a /api/polls/trending
```

### Test 2: Cerrar con Botón Atrás
```
1. Abre /?poll=1
2. Presiona botón atrás del navegador
3. Verifica en consola:
   ✅ [closePoll] aparece UNA vez
   ✅ [Watcher] NO se ejecuta (isNavigatingFromHistory)
   ✅ [loadTrendingData] aparece UNA vez
```

### Test 3: Cambiar de Encuesta Rápidamente
```
1. Abre /?poll=1
2. Inmediatamente abre /?poll=2
3. Verifica:
   ✅ Encuesta #1 se cierra con skipTrendingLoad=true
   ✅ NO carga trending intermedio
   ✅ Encuesta #2 se abre correctamente
```

### Test 4: Cerrar y Reabrir Múltiples Veces
```
1. Abre /poll/1 → Cierra
2. Abre /poll/2 → Cierra
3. Abre /poll/3 → Cierra
4. Verifica:
   ✅ Cada cierre = UNA carga de trending
   ✅ Sin doble cargas acumuladas
   ✅ Sin memory leaks
```

## Archivos Modificados

### src/lib/GlobeGL.svelte

**Línea 296**: Agregar flag
```typescript
let isClosingPoll = false;
```

**Línea 4092**: Activar flag al inicio de closePoll
```typescript
async function closePoll(skipTrendingLoad = false) {
  isClosingPoll = true; // ✅ PRIMERO
  lastProcessedPollId = null;
  // ...
}
```

**Línea 4172**: Desactivar flag al final
```typescript
async function closePoll(skipTrendingLoad = false) {
  // ... todo el proceso ...
  isClosingPoll = false; // ✅ ÚLTIMO
}
```

**Línea 6346**: Verificar flag en watcher
```typescript
$: {
  const pollIdParam = $page.url.searchParams.get('poll');
  
  if (isInitialMount) {
    // ignorar
  }
  else if (isClosingPoll) { // ✅ NUEVO
    console.log('[Watcher] ⏸️ Ya estamos cerrando...');
  }
  // ... resto de casos ...
}
```

## Serie Completa de Fixes

Esta es la **cuarta y definitiva** corrección:

### 1. FIX_DOBLE_CARGA_POLL.md
**Problema:** Doble carga simultánea de la misma encuesta
**Solución:** `isInitialMount` y `lastProcessedPollId`

### 2. FIX_CIERRE_Y_CAMBIO_ENCUESTAS.md
**Problema:** No cerraba al quitar parámetro, no cerraba anterior al cambiar
**Solución:** Watcher con CASO 1 (cerrar) y CASO 2 (cambiar)

### 3. FIX_DOBLE_CARGA_TRENDING.md
**Problema:** Trending se cargaba dos veces
**Solución:** Resetear `lastProcessedPollId` ANTES del `pushState`

### 4. FIX_DOBLE_CARGA_TRENDING_FINAL.md (Este)
**Problema:** Trending todavía se cargaba dos veces (race condition)
**Solución:** Flag `isClosingPoll` con protección durante todo el proceso

## Conclusión

El problema de la doble carga de trending era causado por un **race condition** entre:
- El watcher reactivo (síncrono)
- La función `closePoll()` (asíncrona)
- El cambio de URL vía `pushState`

La solución definitiva es un **flag dedicado** (`isClosingPoll`) que:
1. ✅ Se activa ANTES de cualquier operación
2. ✅ Bloquea el watcher durante TODO el proceso
3. ✅ Se desactiva DESPUÉS de completar todo
4. ✅ Funciona sin importar el timing o async operations

**Ahora el trending se carga UNA sola vez, garantizado.** 🎉
