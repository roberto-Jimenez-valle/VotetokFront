# Fix: Trending Inicial + Logs de Debug

## Problemas Reportados

1. **Trending se carga antes de la encuesta:** Al abrir `/poll/123`, primero carga trending y luego la encuesta
2. **Doble carga persiste:** A pesar del flag `isClosingPoll`, el trending todavía se cargaba dos veces

## Fix 1: No Cargar Trending si Hay `?poll=` en URL

### Problema

En el `onMount`, el código cargaba trending ANTES de verificar si había un parámetro `?poll=` en la URL:

**Antes (❌):**
```typescript
// Línea 6138 - onMount
// Inicializar polígonos
await initFrom(g, { ANSWERS: {}, colors: {} });

// ❌ Cargar trending sin verificar URL
if (!activePoll) {
  await loadTrendingData(); // Se ejecuta SIEMPRE
}

// ... más código ...

// Línea 6279 - DESPUÉS
const urlParams = new URLSearchParams(window.location.search);
const pollIdParam = urlParams.get('poll'); // Verifica TARDE

if (pollIdParam) {
  // Cargar encuesta
}
```

**Flujo problemático:**
```
1. Usuario abre /poll/123
2. Redirige a /?poll=123
3. onMount ejecuta
4. loadTrendingData() ejecuta ← ❌ Carga trending primero
5. Verifica parámetro poll
6. Carga encuesta ← Carga DESPUÉS
7. Usuario ve trending → encuesta (flasheo)
```

### Solución

Verificar parámetro `?poll=` ANTES de cargar trending:

**Ahora (✅):**
```typescript
// Línea 6138 - onMount
// Inicializar polígonos
await initFrom(g, { ANSWERS: {}, colors: {} });

// ✅ Verificar URL ANTES de cargar trending
const urlParams = new URLSearchParams(window.location.search);
const hasPollParam = urlParams.get('poll');

// Cargar trending SOLO si NO hay poll en URL
if (!activePoll && !hasPollParam) {
  console.log('[Init] 🌍 Cargando trending inicial (no hay poll en URL)...');
  await loadTrendingData();
  await updateGlobeColors();
} else if (hasPollParam) {
  console.log('[Init] ⏭️ Saltando trending inicial, hay poll en URL:', hasPollParam);
}
```

**Flujo correcto:**
```
1. Usuario abre /poll/123
2. Redirige a /?poll=123
3. onMount ejecuta
4. Verifica URL → encuentra "123"
5. NO carga trending ✅
6. Continúa inicialización
7. Verifica parámetro poll (más adelante)
8. Carga encuesta directamente ✅
9. Sin flasheo
```

### Beneficios

✅ **Sin doble carga:** No carga trending si hay poll en URL
✅ **Sin flasheo:** Usuario ve directamente la encuesta
✅ **Mejor UX:** Transición directa a la encuesta
✅ **Menos requests:** Ahorra una llamada a la API

## Fix 2: Logs de Debug Detallados

### Problema

No teníamos visibilidad de cuándo y por qué se ejecutaba el watcher o `closePoll`, haciendo difícil debuggear la doble carga.

### Solución: Logs Completos

**En closePoll (línea 4089):**
```typescript
async function closePoll(skipTrendingLoad = false) {
  console.log('[closePoll] 🔄 INICIO | skipTrendingLoad:', skipTrendingLoad, 
              'isClosingPoll:', isClosingPoll, 
              'isNavigatingFromHistory:', isNavigatingFromHistory);
  
  isClosingPoll = true;
  console.log('[closePoll] 🚫 Flag isClosingPoll activado');
  
  lastProcessedPollId = null;
  console.log('[closePoll] 🔄 lastProcessedPollId reseteado a null');
  
  // ... proceso de cierre ...
  
  console.log('[closePoll] ✅ Desactivando flag isClosingPoll');
  isClosingPoll = false;
  console.log('[closePoll] ✅ FIN | isClosingPoll:', isClosingPoll);
}
```

**En Watcher (línea 6347):**
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
    console.log('[Watcher] ⏸️ Ignorando (ya estamos cerrando)', 
                { pollIdParam, lastProcessedPollId });
  }
  else if (!pollIdParam && lastProcessedPollId && activePoll) {
    console.log('[Watcher] 🚪 CASO 1: Parámetro poll eliminado');
    // ...
  }
  // ... más casos ...
}
```

### Logs Esperados

#### Cerrar Encuesta (Botón X) - Flujo Correcto:
```
[closePoll] 🔄 INICIO | skipTrendingLoad: false, isClosingPoll: false, isNavigatingFromHistory: false
[closePoll] 🚫 Flag isClosingPoll activado
[closePoll] 🔄 lastProcessedPollId reseteado a null
[History] 🔄 Volviendo a modo trending

[Watcher] 🔍 Ejecutando | pollIdParam: null, lastProcessed: null, isInitialMount: false, isClosingPoll: true, activePoll: true
[Watcher] ⏸️ Ignorando (ya estamos cerrando) { pollIdParam: null, lastProcessedPollId: null }

[closePoll] 📊 Cargando trending después de cerrar
[loadTrendingData] 🚀 Iniciando carga de datos...
[closePoll] ✅ Desactivando flag isClosingPoll
[closePoll] ✅ FIN | isClosingPoll: false
```

#### Abrir URL Directa - Flujo Correcto:
```
[Init] ⏭️ Saltando trending inicial, hay poll en URL: 123
[Init] 🔗 Detectado parámetro poll en URL: 123
[Init] 📊 Encuesta cargada desde URL: 123 "Título de la encuesta"
[Init] ✅ Encuesta abierta desde URL con colores aplicados

[Watcher] 🔍 Ejecutando | pollIdParam: "123", lastProcessed: "123", isInitialMount: false, isClosingPoll: false, activePoll: true
(Watcher NO ejecuta porque pollIdParam === lastProcessedPollId)
```

#### Cambiar de Encuesta - Flujo Correcto:
```
[Watcher] 🔍 Ejecutando | pollIdParam: "456", lastProcessed: "123", isInitialMount: false, isClosingPoll: false, activePoll: true
[Watcher] 🔗 Detectado cambio en parámetro poll: 456 (anterior: 123)
[Watcher] 🔄 Cerrando encuesta anterior antes de abrir nueva

[closePoll] 🔄 INICIO | skipTrendingLoad: true, isClosingPoll: false, isNavigatingFromHistory: true
[closePoll] 🚫 Flag isClosingPoll activado
[closePoll] 🔄 lastProcessedPollId reseteado a null
[closePoll] ⏭️ Saltando carga de trending (se abrirá otra encuesta)
[closePoll] ✅ Desactivando flag isClosingPoll
[closePoll] ✅ FIN | isClosingPoll: false

[Watcher] 📊 Cargando encuesta desde URL: 456
[Watcher] ✅ Encuesta cargada: 456 "Nueva encuesta"
```

### Cómo Usar los Logs para Debug

1. **Abrir consola del navegador** (F12)
2. **Filtrar por:** `[closePoll]` o `[Watcher]` o `[Init]`
3. **Verificar secuencia:**
   - Flag se activa ANTES del pushState
   - Watcher detecta el flag y NO ejecuta
   - Solo UNA carga de trending
4. **Si hay doble carga:**
   - Buscar dos `[loadTrendingData]`
   - Ver qué watcher ejecutó
   - Verificar valores de flags

## Testing con Logs

### Test 1: Abrir URL Directa
```
Acción: Abrir /poll/1
Logs esperados:
✅ [Init] ⏭️ Saltando trending inicial
✅ [Init] 🔗 Detectado parámetro poll
✅ [Init] ✅ Encuesta abierta
❌ NO debe aparecer [loadTrendingData] inicial
```

### Test 2: Cerrar Encuesta
```
Acción: Cerrar con botón X
Logs esperados:
✅ [closePoll] 🔄 INICIO
✅ [closePoll] 🚫 Flag activado
✅ [Watcher] ⏸️ Ignorando (ya estamos cerrando)
✅ [closePoll] 📊 Cargando trending
✅ Solo UN [loadTrendingData]
```

### Test 3: Cambiar de Encuesta
```
Acción: De /poll/1 a /poll/2
Logs esperados:
✅ [Watcher] 🔗 Detectado cambio
✅ [closePoll] INICIO | skipTrendingLoad: true
✅ [closePoll] ⏭️ Saltando trending
✅ [Watcher] Cargando nueva encuesta
❌ NO debe cargar trending intermedio
```

## Archivos Modificados

### src/lib/GlobeGL.svelte

**Línea 6138-6152**: Verificar poll antes de cargar trending
```typescript
const urlParams = new URLSearchParams(window.location.search);
const hasPollParam = urlParams.get('poll');

if (!activePoll && !hasPollParam) {
  console.log('[Init] 🌍 Cargando trending inicial (no hay poll en URL)...');
  await loadTrendingData();
  await updateGlobeColors();
} else if (hasPollParam) {
  console.log('[Init] ⏭️ Saltando trending inicial, hay poll en URL:', hasPollParam);
}
```

**Línea 4089-4099**: Logs en closePoll
```typescript
async function closePoll(skipTrendingLoad = false) {
  console.log('[closePoll] 🔄 INICIO | skipTrendingLoad:', skipTrendingLoad, 
              'isClosingPoll:', isClosingPoll, 
              'isNavigatingFromHistory:', isNavigatingFromHistory);
  
  isClosingPoll = true;
  console.log('[closePoll] 🚫 Flag isClosingPoll activado');
  
  lastProcessedPollId = null;
  console.log('[closePoll] 🔄 lastProcessedPollId reseteado a null');
  // ...
}
```

**Línea 4176-4178**: Logs al finalizar closePoll
```typescript
console.log('[closePoll] ✅ Desactivando flag isClosingPoll');
isClosingPoll = false;
console.log('[closePoll] ✅ FIN | isClosingPoll:', isClosingPoll);
```

**Línea 6347-6360**: Logs en watcher
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
    console.log('[Watcher] ⏸️ Ignorando (ya estamos cerrando)', 
                { pollIdParam, lastProcessedPollId });
  }
  // ... casos ...
}
```

## Resumen de Fixes

### Serie Completa (5 Fixes):

1. **FIX_DOBLE_CARGA_POLL.md**
   - Doble carga simultánea → `isInitialMount` + `lastProcessedPollId`

2. **FIX_CIERRE_Y_CAMBIO_ENCUESTAS.md**
   - No cerraba/no cambiaba → Watcher CASO 1 y CASO 2

3. **FIX_DOBLE_CARGA_TRENDING.md**
   - Reset timing → `lastProcessedPollId` antes de pushState

4. **FIX_DOBLE_CARGA_TRENDING_FINAL.md**
   - Race condition → Flag `isClosingPoll`

5. **FIX_TRENDING_INICIAL_Y_LOGS.md** (Este)
   - Trending inicial innecesario → Verificar URL antes
   - Debug difícil → Logs detallados

## Conclusión

Los dos problemas están resueltos:

1. ✅ **No carga trending inicial** si hay `?poll=` en la URL
2. ✅ **Logs completos** para debuggear cualquier doble carga

Con estos logs, podemos ver exactamente:
- Cuándo se activa/desactiva `isClosingPoll`
- Si el watcher detecta correctamente el flag
- Qué caso del watcher se ejecuta
- Cuántas veces se carga trending

**Si todavía hay doble carga después de este fix, los logs mostrarán exactamente dónde está el problema.** 🔍
