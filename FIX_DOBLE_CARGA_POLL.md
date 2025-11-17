# Fix: Doble Carga de Encuesta (Polígonos No Se Pintaban Correctamente)

## Problema Reportado
Al abrir una URL directa de poll (`/poll/123`):
- ✅ La encuesta se abría
- ❌ Los polígonos no se pintaban correctamente
- ❌ Comportamiento errático en la visualización

## Causa Raíz

### Flujo Problemático:
```
1. Usuario abre /poll/123
2. Redirige a /?poll=123
3. GlobeGL onMount detecta ?poll=123 → CARGA 1️⃣
4. Watcher reactivo ($:) también detecta ?poll=123 → CARGA 2️⃣
5. ❌ Dos cargas simultáneas interfieren entre sí
6. ❌ Race condition en la actualización de polígonos
7. ❌ Colores y datos se corrompen
```

### Por Qué Ocurría:

**1. Watcher Reactivo Inmediato:**
```typescript
// Este código se ejecuta CADA VEZ que cambia $page.url
$: {
  const pollIdParam = $page.url.searchParams.get('poll');
  
  if (pollIdParam && globe) {
    // ❌ Se ejecuta incluso en la primera carga
    // ❌ Se ejecuta justo después del onMount
    cargarEncuesta(pollIdParam);
  }
}
```

**2. Sin Control de Estado:**
- No había flag para distinguir entre:
  - Primera carga (onMount)
  - Cambio posterior de URL (navegación interna)
- Resultado: **doble procesamiento del mismo poll**

**3. Race Condition:**
```
onMount carga poll #123 → Actualiza polígonos → 50% completado
Watcher carga poll #123 → Actualiza polígonos → Sobrescribe
Result: ❌ Polígonos en estado inconsistente
```

## Solución Implementada

### 1. Variables de Control de Estado

**Archivo:** `src/lib/GlobeGL.svelte` (línea 293)

```typescript
// Control para evitar doble carga de encuestas desde URL
let isInitialMount = true;
let lastProcessedPollId: string | null = null;
```

**Propósito:**
- `isInitialMount`: Indica si estamos en la primera carga del componente
- `lastProcessedPollId`: Guarda el ID de la última encuesta procesada para evitar duplicados

### 2. Marcar Poll Procesado en onMount

**Archivo:** `src/lib/GlobeGL.svelte` (línea 6276)

```typescript
if (pollIdParam) {
  console.log('[Init] 🔗 Detectado parámetro poll en URL:', pollIdParam);
  
  // ✅ Marcar como procesado ANTES de cargar
  lastProcessedPollId = pollIdParam;
  
  // Esperar y cargar encuesta...
  await handleOpenPollInGlobe(syntheticEvent);
}

// ✅ Marcar que la carga inicial ha terminado
isInitialMount = false;
```

### 3. Watcher con Condiciones Estrictas

**Archivo:** `src/lib/GlobeGL.svelte` (línea 6335)

```typescript
$: {
  const pollIdParam = $page.url.searchParams.get('poll');
  
  // ✅ Solo procesar si:
  // 1. NO es la carga inicial (isInitialMount = false)
  // 2. Hay un pollId en la URL
  // 3. El globo está listo
  // 4. Es diferente al último procesado
  if (!isInitialMount && pollIdParam && globe && pollIdParam !== lastProcessedPollId) {
    console.log('[Watcher] 🔗 Detectado cambio en parámetro poll:', pollIdParam);
    
    // ✅ Marcar como procesado ANTES de cargar
    lastProcessedPollId = pollIdParam;
    
    // Cargar encuesta...
    apiCall(`/api/polls/${pollIdParam}`)...
  }
}
```

### 4. Resetear Estado al Cerrar

**Archivo:** `src/lib/GlobeGL.svelte` (línea 4106)

```typescript
async function closePoll(skipTrendingLoad = false) {
  // Limpiar contexto de encuesta
  globalActivePoll.close();
  activePollOptions = [];
  
  // ✅ Resetear el ID para permitir re-abrir la misma encuesta
  lastProcessedPollId = null;
  
  // Resto de limpieza...
}
```

## Comparación: Antes vs Ahora

### Antes (❌ Doble Carga)

```typescript
// onMount
onMount(async () => {
  const pollIdParam = urlParams.get('poll');
  if (pollIdParam) {
    cargarEncuesta(pollIdParam); // 1️⃣ Primera carga
  }
});

// Watcher (sin control)
$: {
  const pollIdParam = $page.url.searchParams.get('poll');
  if (pollIdParam && globe) {
    cargarEncuesta(pollIdParam); // 2️⃣ Segunda carga (inmediata)
  }
}

// ❌ Resultado: Doble carga, race condition
```

### Ahora (✅ Carga Única)

```typescript
// Variables de control
let isInitialMount = true;
let lastProcessedPollId: string | null = null;

// onMount
onMount(async () => {
  const pollIdParam = urlParams.get('poll');
  if (pollIdParam) {
    lastProcessedPollId = pollIdParam; // ✅ Marcar
    cargarEncuesta(pollIdParam); // 1️⃣ Primera carga
  }
  isInitialMount = false; // ✅ Fin de carga inicial
});

// Watcher (con control)
$: {
  const pollIdParam = $page.url.searchParams.get('poll');
  
  // ✅ Solo si NO es carga inicial Y es diferente al anterior
  if (!isInitialMount && pollIdParam && pollIdParam !== lastProcessedPollId) {
    lastProcessedPollId = pollIdParam; // ✅ Marcar
    cargarEncuesta(pollIdParam); // Solo en cambios reales
  }
}

// ✅ Resultado: Una sola carga por cambio de URL
```

## Flujos Soportados

### 1. Primera Carga con Poll en URL
```
Flujo: /poll/123 → /?poll=123

1. GlobeGL se monta
2. isInitialMount = true
3. onMount detecta ?poll=123
4. lastProcessedPollId = "123"
5. Carga encuesta ✅
6. isInitialMount = false
7. Watcher se ejecuta pero:
   - isInitialMount = false ✅
   - pollIdParam = "123"
   - lastProcessedPollId = "123"
   - pollIdParam === lastProcessedPollId ✅
   - NO carga de nuevo ✅
```

### 2. Cambio de Encuesta (Navegación Interna)
```
Flujo: /?poll=123 → /?poll=456

1. isInitialMount = false ✅
2. lastProcessedPollId = "123"
3. URL cambia a ?poll=456
4. Watcher detecta cambio:
   - isInitialMount = false ✅
   - pollIdParam = "456"
   - lastProcessedPollId = "123"
   - "456" !== "123" ✅
   - Carga encuesta #456 ✅
5. lastProcessedPollId = "456"
```

### 3. Cerrar y Re-abrir Misma Encuesta
```
Flujo: /?poll=123 → / → /?poll=123

1. En /?poll=123
   - lastProcessedPollId = "123"
2. Usuario cierra encuesta
   - closePoll() ejecuta
   - lastProcessedPollId = null ✅
3. Usuario abre /poll/123 de nuevo
   - URL cambia a ?poll=123
   - Watcher:
     - isInitialMount = false ✅
     - pollIdParam = "123"
     - lastProcessedPollId = null
     - "123" !== null ✅
     - Carga encuesta #123 ✅
```

### 4. Compartir en WhatsApp (Sin Cambios)
```
Flujo: Bot accede /poll/123

1. Bot lee HTML (SSR)
2. Meta tags presentes ✅
3. Bot NO ejecuta JavaScript
4. Preview funciona ✅
```

## Logs de Debug

### Primera Carga:
```
[Init] 🔗 Detectado parámetro poll en URL: 123
[Init] 📊 Encuesta cargada desde URL: 123 "¿Cuál es tu color favorito?"
[Init] 🎨 Opciones con colores: [...]
[Init] ✅ Encuesta abierta desde URL con colores aplicados
```

**NO aparece log del Watcher** porque `isInitialMount = true` o `pollIdParam === lastProcessedPollId`

### Cambio de Encuesta:
```
[Watcher] 🔗 Detectado cambio en parámetro poll: 456 (anterior: 123)
[Watcher] 📊 Cargando encuesta desde URL: 456
[Watcher] ✅ Encuesta cargada: 456 "¿Cuál es tu deporte favorito?"
```

### Cerrar Encuesta:
```
[closePoll] 🔄 Cerrando encuesta | skipTrendingLoad: false
[History] 🔄 Volviendo a modo trending
```

**lastProcessedPollId se resetea a `null`**

## Beneficios de la Solución

### ✅ 1. Una Sola Carga
- Elimina doble procesamiento
- Previene race conditions
- Polígonos se actualizan correctamente

### ✅ 2. Control Preciso
- Distingue entre carga inicial y cambios posteriores
- Rastrea el último poll procesado
- Evita re-procesamiento innecesario

### ✅ 3. Permite Re-apertura
- `lastProcessedPollId = null` en `closePoll()`
- Se puede cerrar y volver a abrir la misma encuesta

### ✅ 4. Sin Efectos Secundarios
- No afecta a crawlers (no ejecutan JavaScript)
- No interfiere con History API
- Funciona con navegación interna y externa

### ✅ 5. Debug Claro
- Logs distinguen entre `[Init]` y `[Watcher]`
- Fácil identificar qué flujo se está ejecutando

## Testing

### Test 1: Primera Carga
```
1. Abre nueva pestaña
2. Visita: /poll/1
3. Verifica en consola:
   ✅ Solo aparece log [Init]
   ❌ NO aparece log [Watcher]
4. Verifica visualmente:
   ✅ Polígonos pintados correctamente
   ✅ Colores aplicados
   ✅ Datos cargados
```

### Test 2: Cambio de Encuesta
```
1. Ya estás en /?poll=1
2. Abre /poll/2
3. Verifica en consola:
   ✅ Aparece log [Watcher]
   ✅ Indica anterior: 1
4. Verifica visualmente:
   ✅ Polígonos se actualizan
   ✅ Nuevos colores aplicados
```

### Test 3: Cerrar y Re-abrir
```
1. Abre /?poll=1
2. Cierra la encuesta
3. Verifica en consola:
   ✅ [closePoll] ejecuta
4. Abre /poll/1 de nuevo
5. Verifica en consola:
   ✅ [Watcher] detecta cambio
   ✅ Carga la encuesta de nuevo
```

### Test 4: Compartir WhatsApp
```
1. Deploy a producción
2. Comparte: https://tu-app.com/poll/1
3. Verifica en WhatsApp:
   ✅ Preview con imagen
4. Click en el enlace:
   ✅ Se abre correctamente
   ✅ Polígonos pintados
```

## Archivos Modificados

### 1. src/lib/GlobeGL.svelte

**Línea 293-295**: Variables de control
```typescript
let isInitialMount = true;
let lastProcessedPollId: string | null = null;
```

**Línea 6276**: Marcar poll en onMount
```typescript
lastProcessedPollId = pollIdParam;
```

**Línea 6319**: Marcar fin de carga inicial
```typescript
isInitialMount = false;
```

**Línea 6335**: Watcher con condiciones estrictas
```typescript
if (!isInitialMount && pollIdParam && globe && pollIdParam !== lastProcessedPollId) {
  lastProcessedPollId = pollIdParam;
  // ...cargar encuesta
}
```

**Línea 4106**: Resetear en closePoll
```typescript
lastProcessedPollId = null;
```

## Conclusión

El problema de los polígonos que no se pintaban correctamente estaba causado por una **doble carga simultánea** de la misma encuesta. La solución implementa un **sistema de control de estado** que:

1. ✅ Distingue entre carga inicial y cambios posteriores
2. ✅ Previene procesamiento duplicado
3. ✅ Permite re-apertura de encuestas
4. ✅ Mantiene compatibilidad con todas las funcionalidades existentes

Ahora las encuestas se cargan **una sola vez** por cambio de URL, eliminando race conditions y asegurando que los polígonos se pinten correctamente. 🎉
