# Fix: Cierre y Cambio de Encuestas - Carga Continua

## Problema Reportado
Después de corregir la doble carga:
- Al cerrar una encuesta, se seguía cargando
- Al abrir otra encuesta, la anterior seguía cargándose

## Causa Raíz

### Problema 1: No Detectaba Cuando Se Quitaba el Parámetro
```typescript
// Watcher anterior (incompleto)
$: {
  const pollIdParam = $page.url.searchParams.get('poll');
  
  if (pollIdParam && ...) {
    // ✅ Abría encuesta cuando aparecía el parámetro
  }
  
  // ❌ NO manejaba cuando el parámetro desaparecía
}
```

**Flujo problemático:**
```
1. Usuario está en /?poll=123
2. Cierra la encuesta → URL cambia a /
3. Watcher NO detecta que se quitó el parámetro
4. Encuesta sigue visible ❌
5. Datos quedan cargados ❌
```

### Problema 2: No Cerraba Encuesta Anterior al Cambiar

```typescript
// Watcher anterior (sin cierre previo)
if (pollIdParam && pollIdParam !== lastProcessedPollId) {
  // ❌ Abre nueva encuesta sin cerrar anterior
  cargarEncuesta(pollIdParam);
}
```

**Flujo problemático:**
```
1. Usuario está en /?poll=123
2. Abre /poll/456 → URL cambia a /?poll=456
3. Watcher empieza a cargar #456
4. ❌ Encuesta #123 sigue activa
5. ❌ Race condition: dos encuestas cargándose
6. ❌ Polígonos se mezclan
```

### Problema 3: Doble pushState

Cuando el watcher llamaba a `handleOpenPollInGlobe`, este hacía otro `pushState`, creando duplicados en el historial:

```
URL inicial: /?poll=123
Watcher detecta cambio → Llama handleOpenPollInGlobe
handleOpenPollInGlobe hace pushState → /?poll=123 (duplicado)
Historial: [/?poll=123, /?poll=123] ❌
```

## Solución Implementada

### 1. Detectar Cuando Se Quita el Parámetro (CASO 1)

**Archivo:** `src/lib/GlobeGL.svelte` (línea 6339)

```typescript
$: {
  const pollIdParam = $page.url.searchParams.get('poll');
  
  // CASO 1: Se quitó el parámetro poll (cerrar encuesta)
  else if (!pollIdParam && lastProcessedPollId && activePoll) {
    console.log('[Watcher] 🚪 Parámetro poll eliminado, cerrando encuesta actual');
    lastProcessedPollId = null;
    
    // Marcar que estamos navegando desde el watcher
    isNavigatingFromHistory = true;
    
    // Cerrar la encuesta sin volver a cargar trending
    closePoll(true).then(() => {
      isNavigatingFromHistory = false;
    });
  }
}
```

**Cómo funciona:**
- ✅ Detecta cuando `pollIdParam` es `null` pero había uno antes
- ✅ Verifica que `lastProcessedPollId` no sea `null` (había una encuesta activa)
- ✅ Verifica que `activePoll` exista (realmente hay una encuesta abierta)
- ✅ Cierra la encuesta con `skipTrendingLoad=true` (no recargar datos)
- ✅ Usa `isNavigatingFromHistory` para evitar `pushState` duplicado

### 2. Cerrar Anterior Antes de Abrir Nueva (CASO 2)

**Archivo:** `src/lib/GlobeGL.svelte` (línea 6353)

```typescript
// CASO 2: Cambió a otra encuesta (cerrar anterior y abrir nueva)
else if (pollIdParam && globe && pollIdParam !== lastProcessedPollId) {
  console.log('[Watcher] 🔗 Detectado cambio en parámetro poll:', pollIdParam);
  
  // Marcar como procesado ANTES de cargar
  lastProcessedPollId = pollIdParam;
  
  // Función async para manejar el flujo completo
  const loadNewPoll = async () => {
    // Marcar que estamos navegando desde el watcher
    isNavigatingFromHistory = true;
    
    try {
      // ✅ PRIMERO: Cerrar encuesta anterior si existe
      if (activePoll) {
        console.log('[Watcher] 🔄 Cerrando encuesta anterior antes de abrir nueva');
        await closePoll(true);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      
      console.log('[Watcher] 📊 Cargando encuesta desde URL:', pollIdParam);
      
      // ✅ SEGUNDO: Cargar nueva encuesta
      const response = await apiCall(`/api/polls/${pollIdParam}`);
      const pollData = await response.json();
      const poll = pollData.data || pollData;
      
      // Recrear opciones...
      const options = poll.options?.map(...) || [];
      
      // ✅ TERCERO: Abrir nueva encuesta
      await handleOpenPollInGlobe(syntheticEvent);
      
    } catch (error) {
      console.error('[Watcher] ❌ Error:', error);
    } finally {
      // ✅ Limpiar flag
      isNavigatingFromHistory = false;
    }
  };
  
  // Ejecutar de manera asíncrona
  loadNewPoll();
}
```

**Cómo funciona:**
- ✅ Marca `isNavigatingFromHistory = true` al inicio
- ✅ Cierra la encuesta anterior con `await closePoll(true)`
- ✅ Espera un frame para que se complete el cierre
- ✅ Carga la nueva encuesta desde la API
- ✅ Abre la nueva encuesta
- ✅ Limpia el flag en el `finally` (siempre se ejecuta)

### 3. Prevenir Doble pushState

Usando `isNavigatingFromHistory = true`, prevenimos que:
- `closePoll()` haga `pushState` → línea 4091 verifica el flag
- `handleOpenPollInGlobe()` haga `pushState` → verifica el flag

```typescript
// En closePoll (línea 4091)
if (!isNavigatingFromHistory && !skipTrendingLoad) {
  history.pushState(...); // ❌ NO ejecuta si viene del watcher
}

// En handleOpenPollInGlobe
if (!isNavigatingFromHistory) {
  history.pushState(...); // ❌ NO ejecuta si viene del watcher
}
```

## Flujos Completos

### Flujo 1: Cerrar Encuesta

**Antes (❌):**
```
1. Usuario en /?poll=123
2. Cierra encuesta → URL cambia a /
3. Watcher NO detecta cambio
4. Encuesta sigue visible ❌
```

**Ahora (✅):**
```
1. Usuario en /?poll=123
2. Cierra encuesta → URL cambia a /
3. Watcher detecta: pollIdParam=null, lastProcessedPollId="123"
4. [Watcher] 🚪 Parámetro poll eliminado
5. isNavigatingFromHistory = true
6. closePoll(true) ejecuta
7. Encuesta se cierra correctamente ✅
8. isNavigatingFromHistory = false
```

### Flujo 2: Cambiar de Encuesta

**Antes (❌):**
```
1. Usuario en /?poll=123
2. Abre /poll/456
3. URL cambia a /?poll=456
4. Watcher carga #456
5. ❌ Encuesta #123 todavía cargándose
6. ❌ Race condition
```

**Ahora (✅):**
```
1. Usuario en /?poll=123
2. Abre /poll/456
3. URL cambia a /?poll=456
4. Watcher detecta: pollIdParam="456", lastProcessedPollId="123"
5. [Watcher] 🔗 Detectado cambio: 456 (anterior: 123)
6. lastProcessedPollId = "456"
7. isNavigatingFromHistory = true
8. [Watcher] 🔄 Cerrando encuesta anterior
9. await closePoll(true) → Espera que termine
10. await requestAnimationFrame() → Espera un frame
11. [Watcher] 📊 Cargando encuesta 456
12. Carga datos de la API
13. [Watcher] ✅ Encuesta cargada
14. await handleOpenPollInGlobe → Abre encuesta
15. isNavigatingFromHistory = false ✅
```

### Flujo 3: Abrir Encuesta (Primera Vez)

**Sin cambios - sigue funcionando:**
```
1. Usuario abre /poll/123
2. Redirige a /?poll=123
3. onMount detecta parámetro
4. lastProcessedPollId = "123"
5. Carga y abre encuesta
6. isInitialMount = false
7. Watcher NO se ejecuta (pollIdParam === lastProcessedPollId)
```

## Comparación: Antes vs Ahora

### Cerrar Encuesta

**Antes:**
```typescript
$: {
  const pollIdParam = $page.url.searchParams.get('poll');
  if (pollIdParam && ...) {
    // Solo maneja cuando HAY parámetro
  }
  // ❌ No maneja cuando se quita
}
```

**Ahora:**
```typescript
$: {
  const pollIdParam = $page.url.searchParams.get('poll');
  
  if (!pollIdParam && lastProcessedPollId && activePoll) {
    // ✅ Detecta cuando se quita el parámetro
    closePoll(true);
  }
}
```

### Cambiar de Encuesta

**Antes:**
```typescript
if (pollIdParam && pollIdParam !== lastProcessedPollId) {
  lastProcessedPollId = pollIdParam;
  // ❌ Abre nueva SIN cerrar anterior
  cargarNuevaEncuesta(pollIdParam);
}
```

**Ahora:**
```typescript
if (pollIdParam && pollIdParam !== lastProcessedPollId) {
  lastProcessedPollId = pollIdParam;
  
  const loadNewPoll = async () => {
    if (activePoll) {
      // ✅ Cerrar anterior primero
      await closePoll(true);
      await requestAnimationFrame();
    }
    // ✅ Luego abrir nueva
    await cargarNuevaEncuesta(pollIdParam);
  };
  
  loadNewPoll();
}
```

## Logs de Debug

### Cerrar Encuesta:
```
[Watcher] 🚪 Parámetro poll eliminado, cerrando encuesta actual
[closePoll] 🔄 Cerrando encuesta | skipTrendingLoad: true
```

### Cambiar de Encuesta:
```
[Watcher] 🔗 Detectado cambio en parámetro poll: 456 (anterior: 123)
[Watcher] 🔄 Cerrando encuesta anterior antes de abrir nueva
[closePoll] 🔄 Cerrando encuesta | skipTrendingLoad: true
[Watcher] 📊 Cargando encuesta desde URL: 456
[Watcher] ✅ Encuesta cargada: 456 "Nueva encuesta"
```

## Beneficios de la Solución

### ✅ 1. Cierre Completo
- Detecta cuando se quita el parámetro `?poll=`
- Limpia todos los datos y polígonos
- Resetea el estado correctamente

### ✅ 2. Cambio Secuencial
- Cierra la encuesta anterior ANTES de abrir la nueva
- Espera a que el cierre termine (`await`)
- Previene race conditions

### ✅ 3. Sin Duplicados en Historial
- Usa `isNavigatingFromHistory` para prevenir `pushState`
- Un solo registro por acción
- Botón "atrás" funciona correctamente

### ✅ 4. Manejo de Errores
- `try/catch` en la carga
- `finally` limpia el flag siempre
- No deja el estado inconsistente

### ✅ 5. Debug Claro
- Logs distinguen acciones: 🚪 cerrar, 🔗 cambiar, 🔄 limpiando
- Fácil rastrear el flujo en consola

## Testing

### Test 1: Cerrar Encuesta
```
1. Abre /?poll=1
2. Verifica que la encuesta está abierta
3. Cierra la encuesta (botón X)
4. Verifica en consola:
   ✅ [Watcher] 🚪 Parámetro poll eliminado
   ✅ [closePoll] ejecuta
5. Verifica visualmente:
   ✅ Encuesta cerrada
   ✅ Polígonos en modo trending
   ✅ Sin datos de encuesta anterior
```

### Test 2: Cambiar de Encuesta
```
1. Abre /?poll=1
2. Verifica que encuesta #1 está abierta
3. Abre /poll/2
4. Verifica en consola:
   ✅ [Watcher] 🔗 Detectado cambio: 2 (anterior: 1)
   ✅ [Watcher] 🔄 Cerrando encuesta anterior
   ✅ [Watcher] 📊 Cargando encuesta 2
   ✅ [Watcher] ✅ Encuesta cargada: 2
5. Verifica visualmente:
   ✅ Encuesta #1 cerrada completamente
   ✅ Encuesta #2 abierta correctamente
   ✅ Polígonos pintados correctamente
   ✅ Sin datos mezclados
```

### Test 3: Cambio Rápido (Spam)
```
1. Abre /?poll=1
2. Rápidamente abre /poll/2
3. Inmediatamente abre /poll/3
4. Verifica:
   ✅ Solo la última encuesta (#3) visible
   ✅ No hay encuestas mezcladas
   ✅ No hay race conditions
   ✅ Polígonos correctos
```

## Archivos Modificados

### src/lib/GlobeGL.svelte

**Línea 6339-6350**: CASO 1 - Cerrar cuando se quita el parámetro
```typescript
else if (!pollIdParam && lastProcessedPollId && activePoll) {
  lastProcessedPollId = null;
  isNavigatingFromHistory = true;
  closePoll(true).then(() => {
    isNavigatingFromHistory = false;
  });
}
```

**Línea 6353-6406**: CASO 2 - Cerrar anterior antes de abrir nueva
```typescript
else if (pollIdParam && globe && pollIdParam !== lastProcessedPollId) {
  lastProcessedPollId = pollIdParam;
  
  const loadNewPoll = async () => {
    isNavigatingFromHistory = true;
    try {
      if (activePoll) {
        await closePoll(true);
        await requestAnimationFrame();
      }
      // Cargar y abrir nueva...
    } finally {
      isNavigatingFromHistory = false;
    }
  };
  
  loadNewPoll();
}
```

## Conclusión

El problema de las encuestas que se seguían cargando estaba causado por:
1. ❌ No detectar cuando se quitaba el parámetro `?poll=`
2. ❌ No cerrar la encuesta anterior antes de abrir una nueva
3. ❌ Doble `pushState` en el historial

La solución implementa:
1. ✅ Detección de parámetro eliminado (CASO 1)
2. ✅ Cierre secuencial antes de abrir nueva (CASO 2)
3. ✅ Flag `isNavigatingFromHistory` para prevenir duplicados
4. ✅ Manejo async con `await` para esperar que termine cada paso

Ahora las encuestas se cierran correctamente y los cambios son secuenciales y limpios. 🎉
