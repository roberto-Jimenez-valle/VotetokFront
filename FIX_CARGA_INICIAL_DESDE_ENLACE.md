# Fix: Carga Inicial desde Enlace de Poll

## Problema Reportado
Cuando se abre un enlace directo como `/poll/123`:
1. ❌ Cierra la encuesta
2. ❌ Intenta cargar trending
3. ❌ Cuando acaba, vuelve a cargar la encuesta

## Causa Raíz

### Flujo Problemático:

```
1. Usuario abre /poll/123 (desde WhatsApp, link compartido, etc.)
2. +page.svelte redirige a /?poll=123 (después de 100ms)
3. GlobeGL.svelte onMount ejecuta
4. lastProcessedPollId = "123"
5. handleOpenPollInGlobe ejecuta
6. isInitialMount = false (al final del onMount)
7. handleOpenPollInGlobe detecta que no viene del historial
8. ❌ Puede intentar cerrar encuestas previas
9. ❌ Puede hacer operaciones innecesarias
10. Watcher reactivo se dispara (porque isInitialMount ya es false)
11. ❌ Puede causar conflictos
```

### Problemas Específicos:

**1. handleOpenPollInGlobe sin contexto de carga inicial**

Cuando se llama desde `onMount`, no sabe que es la carga inicial:
```typescript
// En onMount (línea 6332)
await handleOpenPollInGlobe(syntheticEvent); // ❌ No marca isNavigatingFromHistory
```

En `handleOpenPollInGlobe` (línea 4551):
```typescript
if (activePoll && activePoll.id !== poll.id) {
  // ❌ Puede cerrar encuesta si hay algún estado residual
  await closePoll(true);
}
```

**2. isInitialMount se desactiva demasiado pronto**

```typescript
// Antes (❌)
if (pollIdParam) {
  await handleOpenPollInGlobe(...); // Todavía en proceso
}

// ❌ Se desactiva INMEDIATAMENTE después, aunque la encuesta no termine de abrir
isInitialMount = false;

// Watcher se ejecuta y puede causar conflictos
```

**3. Watcher puede ejecutarse durante la carga**

Como `isInitialMount = false` se ejecuta al final del `onMount`, pero la encuesta puede estar todavía abriéndose (es async), el watcher puede dispararse y detectar cambios de estado que causan cierres inesperados.

## Solución

### 1. Marcar isNavigatingFromHistory en Carga Inicial

**Archivo:** `src/lib/GlobeGL.svelte` (línea 6300-6302)

```typescript
if (pollIdParam) {
  console.log('[Init] 🔗 Detectado parámetro poll en URL:', pollIdParam);
  
  // Marcar como procesado
  lastProcessedPollId = pollIdParam;
  
  // ✅ NUEVO: Marcar que estamos en carga inicial
  isNavigatingFromHistory = true;
  
  try {
    // Cargar y abrir encuesta...
    await handleOpenPollInGlobe(syntheticEvent);
  } finally {
    // ✅ Limpiar flag DESPUÉS de completar
    isNavigatingFromHistory = false;
  }
}
```

**Por qué funciona:**

Con `isNavigatingFromHistory = true`, `handleOpenPollInGlobe` sabe que:
- NO debe hacer `pushState` (ya estamos en la URL correcta)
- NO debe cerrar encuestas previas innecesariamente
- Es una carga desde navegación/inicial

### 2. Mover isInitialMount = false al Final

**Archivo:** `src/lib/GlobeGL.svelte` (línea 6341-6352)

```typescript
if (pollIdParam) {
  try {
    // Cargar encuesta...
    await handleOpenPollInGlobe(syntheticEvent);
  } finally {
    isNavigatingFromHistory = false;
    
    // ✅ Marcar AQUÍ, DESPUÉS de que la encuesta se abra completamente
    isInitialMount = false;
    console.log('[Init] ✅ Carga inicial completada, watcher habilitado');
  }
} else {
  // Si no hay poll, marcar como terminado ahora
  isInitialMount = false;
  console.log('[Init] ✅ Carga inicial completada (sin poll), watcher habilitado');
}
```

**Por qué funciona:**

- `isInitialMount = false` solo se ejecuta DESPUÉS de que la encuesta termine de cargarse
- El watcher NO se ejecuta hasta que todo esté listo
- Previene race conditions entre onMount y watcher

## Flujo Correcto Ahora

### Abrir /poll/123:

```
1. Usuario abre /poll/123
2. +page.svelte redirige a /?poll=123 (100ms delay)
3. GlobeGL.svelte onMount ejecuta
4. lastProcessedPollId = "123" ✅
5. isNavigatingFromHistory = true ✅
6. Carga datos de la encuesta desde API
7. await handleOpenPollInGlobe(syntheticEvent)
8. handleOpenPollInGlobe detecta isNavigatingFromHistory = true
9. NO cierra encuestas previas ✅
10. NO hace pushState ✅
11. Abre la encuesta normalmente
12. isNavigatingFromHistory = false ✅
13. isInitialMount = false ✅ (DESPUÉS de completar)
14. console.log('[Init] ✅ Carga inicial completada, watcher habilitado')
15. Watcher ahora está habilitado pero pollIdParam === lastProcessedPollId
16. Watcher NO ejecuta ✅
17. ✅ Encuesta abierta sin conflictos
```

### Abrir /?poll=123 (URL directa):

```
Mismo flujo que arriba ✅
```

### Abrir / (sin poll):

```
1. GlobeGL.svelte onMount ejecuta
2. NO hay pollIdParam
3. Carga trending (con mi fix anterior)
4. isInitialMount = false ✅
5. Watcher habilitado ✅
```

## Comparación: Antes vs Ahora

### Antes (❌ Problemas):

```typescript
// onMount
if (pollIdParam) {
  lastProcessedPollId = pollIdParam;
  // ❌ NO marca isNavigatingFromHistory
  await handleOpenPollInGlobe(syntheticEvent);
}
// ❌ Desactiva inmediatamente
isInitialMount = false;

// handleOpenPollInGlobe
if (activePoll && activePoll.id !== poll.id) {
  // ❌ Puede cerrar si hay estado residual
  await closePoll(true);
}
```

### Ahora (✅ Correcto):

```typescript
// onMount
if (pollIdParam) {
  lastProcessedPollId = pollIdParam;
  
  // ✅ Marca flag para carga inicial
  isNavigatingFromHistory = true;
  
  try {
    await handleOpenPollInGlobe(syntheticEvent);
  } finally {
    isNavigatingFromHistory = false;
    // ✅ Desactiva DESPUÉS de completar
    isInitialMount = false;
  }
}

// handleOpenPollInGlobe
if (!isNavigatingFromHistory && activePoll && activePoll.id !== poll.id) {
  // ✅ NO ejecuta en carga inicial
  await closePoll(true);
}
```

## Logs de Debug

### Carga desde /poll/123 (Correcta):

```
[Init] ⏭️ Saltando trending inicial, hay poll en URL: 123
[Init] 🔗 Detectado parámetro poll en URL: 123
[Init] 📊 Encuesta cargada desde URL: 123 "Título de la encuesta"
[Init] 🎨 Opciones con colores: [...colores]
[HandleOpenPoll] 🔵 Llamada recibida: { pollId: 123, fromHistory: true }
[OpenPoll] 📊 Encuesta abierta: 123 | Países con datos: 45
[Init] ✅ Encuesta abierta desde URL con colores aplicados
[Init] ✅ Carga inicial completada, watcher habilitado

[Watcher] 🔍 Ejecutando | pollIdParam: "123", lastProcessed: "123", isInitialMount: false
(Watcher NO ejecuta porque pollIdParam === lastProcessedPollId) ✅
```

### Carga desde / (Sin poll):

```
[Init] 🌍 Cargando trending inicial (no hay poll en URL)...
[loadTrendingData] 🚀 Iniciando carga de datos...
[Init] ✅ Carga inicial completada (sin poll), watcher habilitado

[Watcher] 🔍 Ejecutando | pollIdParam: null, lastProcessed: null, isInitialMount: false
(Watcher NO ejecuta) ✅
```

## Testing

### Test 1: Abrir Enlace Directo
```
Acción: Abrir /poll/1 en navegador
Logs esperados:
✅ [Init] ⏭️ Saltando trending inicial
✅ [Init] 🔗 Detectado parámetro poll
✅ [HandleOpenPoll] fromHistory: true
✅ [Init] ✅ Encuesta abierta
✅ [Init] ✅ Carga inicial completada
❌ NO debe aparecer cierre de encuesta
❌ NO debe cargar trending
❌ NO debe cargar la encuesta dos veces
```

### Test 2: Compartir y Abrir desde WhatsApp
```
Acción: Compartir poll, abrir desde WhatsApp
Flujo:
1. Preview de WhatsApp muestra imagen ✅
2. Click abre /poll/123
3. Redirige a /?poll=123
4. Encuesta se abre directamente ✅
5. Sin cargas intermedias de trending ✅
```

### Test 3: Refresh en /?poll=123
```
Acción: F5 en /?poll=123
Logs esperados:
✅ Mismo flujo que Test 1
✅ Encuesta se abre directamente
✅ Sin trending intermedio
```

## Archivos Modificados

### src/lib/GlobeGL.svelte

**Línea 6300-6302**: Marcar isNavigatingFromHistory en carga inicial
```typescript
// CRÍTICO: Marcar que estamos navegando desde carga inicial
isNavigatingFromHistory = true;
```

**Línea 6341-6352**: Mover isInitialMount = false al final
```typescript
} finally {
  isNavigatingFromHistory = false;
  // Marcar que la carga inicial ha terminado DESPUÉS de cargar la encuesta
  isInitialMount = false;
  console.log('[Init] ✅ Carga inicial completada, watcher habilitado');
}
} else {
  // Si no hay poll en URL, marcar como terminado ahora
  isInitialMount = false;
  console.log('[Init] ✅ Carga inicial completada (sin poll), watcher habilitado');
}
```

## Serie Completa de Fixes

Esta es la **sexta corrección** en la serie:

1. **FIX_DOBLE_CARGA_POLL** - Doble carga simultánea
2. **FIX_CIERRE_Y_CAMBIO_ENCUESTAS** - Cerrar/cambiar encuestas
3. **FIX_DOBLE_CARGA_TRENDING** - Reset timing
4. **FIX_DOBLE_CARGA_TRENDING_FINAL** - Flag isClosingPoll
5. **FIX_TRENDING_INICIAL_Y_LOGS** - No cargar trending si hay poll en URL
6. **FIX_CARGA_INICIAL_DESDE_ENLACE** (Este) - Flag en carga inicial + timing correcto

## Conclusión

El problema de que se cerraba y volvía a abrir la encuesta al venir de un enlace estaba causado por:

1. ❌ `handleOpenPollInGlobe` no sabía que era carga inicial → podía cerrar encuestas
2. ❌ `isInitialMount = false` se ejecutaba antes de completar la carga → watcher se disparaba prematuramente

La solución:

1. ✅ Marcar `isNavigatingFromHistory = true` durante la carga inicial
2. ✅ Mover `isInitialMount = false` al final (después de `await handleOpenPollInGlobe`)
3. ✅ Usar `finally` para asegurar cleanup correcto

**Ahora los enlaces directos `/poll/123` funcionan perfectamente sin cargas intermedias, cierres o doble carga.** 🎉
