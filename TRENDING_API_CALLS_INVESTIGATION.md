# 🔍 Investigación: Múltiples Llamadas API en Modo Trending

**Fecha:** 3 Nov 2025, 12:28 PM  
**Issue:** 15 llamadas a API cuando se hace click en un país en modo trending

---

## 🐛 PROBLEMA REPORTADO

### Síntomas
Cuando haces click en China (CHN) en modo trending:
```
GET /api/polls/127/votes-by-subdivisions
GET /api/polls/138/votes-by-subdivisions
GET /api/polls/140/votes-by-subdivisions
GET /api/polls/130/votes-by-subdivisions
... (15 llamadas en total)
```

**Impacto:**
- ⚠️ 15 peticiones HTTP simultáneas
- ⚠️ Carga innecesaria en el servidor
- ⚠️ Lentitud en la navegación
- ⚠️ Uso excesivo de bandwidth

---

## 🔎 ANÁLISIS INICIAL

### Sistema de Cache Existente

**Archivo:** `GlobeGL.svelte` (líneas 1167-1240)

El código YA TIENE un sistema de cache:

```typescript
// Cache key
const cacheKey = `${iso}_${pollIds}`;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Verificar cache
const cachedData = this.trendingPollsDataCache[cacheKey];
const isCacheValid = cachedData && (now - cachedData.timestamp) < CACHE_TTL;

if (isCacheValid) {
  console.log('[Trending] ♻️ Usando datos cacheados para', iso);
  aggregatedData = cachedData.data;
} else {
  console.log('[Trending] 📡 Cargando datos frescos para', iso);
  // Hacer 15 llamadas a la API...
}
```

**Problema:** El cache NO se está usando, las llamadas se hacen cada vez.

---

## 🔧 CAUSAS POSIBLES

### 1. Cache Key Inválido
```typescript
const cacheKey = `${iso}_${pollIds}`;
```
Si `pollIds` cambia entre llamadas, el cache no se encuentra.

**Ejemplo:**
- Primera vez: `CHN_125,126,127,...`
- Segunda vez: `CHN_127,128,129,...` ← Orden diferente = cache miss

### 2. Cache No Persistente
```typescript
this.trendingPollsDataCache = {}; // En constructor
```
Si `NavigationManager` se reinicia, el cache se pierde.

### 3. TTL Demasiado Corto
```typescript
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
```
Si pasan >5 minutos, el cache expira y se recargan los datos.

### 4. Orden de Ejecución
El cache se guarda DESPUÉS de cargar todos los datos:
```typescript
// Línea 1201-1229: Se hacen las 15 llamadas
// Línea 1233-1239: Se guarda en cache
```

Si hay un error durante las llamadas, el cache no se guarda.

---

## 🔍 DIAGNÓSTICO AGREGADO

He agregado logs detallados (líneas 1173-1181):

```typescript
console.log('[Trending Cache] 🔍 Verificando cache para', iso);
console.log('[Trending Cache] 🔑 Cache key:', cacheKey);
console.log('[Trending Cache] 📦 Cache keys disponibles:', Object.keys(this.trendingPollsDataCache));
console.log('[Trending Cache] cachedData existe?', !!cachedData);
console.log('[Trending Cache] isCacheValid?', isCacheValid);
```

### Qué Mostrarán los Logs:

**Si el cache NO existe (primera vez):**
```
[Trending Cache] 🔍 Verificando cache para CHN
[Trending Cache] 🔑 Cache key: CHN_125,126,127,...
[Trending Cache] 📦 Cache keys disponibles: []
[Trending Cache] cachedData existe? false
[Trending Cache] isCacheValid? false
[Trending] 📡 ⚠️ Cargando datos frescos para CHN (15 encuestas)
```

**Si el cache SÍ existe (segunda vez):**
```
[Trending Cache] 🔍 Verificando cache para CHN
[Trending Cache] 🔑 Cache key: CHN_125,126,127,...
[Trending Cache] 📦 Cache keys disponibles: ["CHN_125,126,127,..."]
[Trending Cache] cachedData existe? true
[Trending Cache] isCacheValid? true
[Trending] ♻️ ✅ Usando datos cacheados para CHN
```

**Si el cache existe pero la key cambió:**
```
[Trending Cache] 🔍 Verificando cache para CHN
[Trending Cache] 🔑 Cache key: CHN_127,128,129,...
[Trending Cache] 📦 Cache keys disponibles: ["CHN_125,126,127,..."]
[Trending Cache] cachedData existe? false
[Trending Cache] isCacheValid? false
[Trending] 📡 ⚠️ Cargando datos frescos para CHN (15 encuestas)
```

---

## 📋 PRÓXIMOS PASOS

### 1. Verificar Logs en Console
```bash
# Refrescar página
# Click en China
# Ver logs de [Trending Cache]
```

### 2. Identificar Problema Específico

**Si "cachedData existe? false":**
→ El cache no se está guardando o se está reiniciando

**Si cache key cambia:**
→ El orden de pollIds es inconsistente

**Si isCacheValid false pero cache existe:**
→ El TTL expiró

### 3. Soluciones Según Diagnóstico

#### Solución A: Ordenar Poll IDs
```typescript
// Ordenar para consistencia
const pollIds = trendingPolls
  .map((p: any) => p.id)
  .sort((a, b) => a - b)
  .join(',');
```

#### Solución B: Cache Persistente
```typescript
// Guardar en localStorage
const cacheKey = `trending_${iso}_${pollIds}`;
const cached = localStorage.getItem(cacheKey);
if (cached) {
  const data = JSON.parse(cached);
  if (Date.now() - data.timestamp < CACHE_TTL) {
    return data.polls;
  }
}
```

#### Solución C: Aumentar TTL
```typescript
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos
```

#### Solución D: Cache Global
```typescript
// Fuera de NavigationManager
const globalTrendingCache = new Map();
```

---

## 🎯 ACCIÓN INMEDIATA

**Paso 1:** Refrescar página y hacer click en China  
**Paso 2:** Revisar logs de `[Trending Cache]` en consola  
**Paso 3:** Reportar qué muestra:
- ¿cachedData existe?
- ¿isCacheValid?
- ¿Cache keys disponibles?

---

## 📊 IMPACTO ESPERADO DEL FIX

### Antes del Fix:
```
Click en China → 15 API calls (cada vez)
Click en India → 15 API calls (cada vez)
Click en USA → 15 API calls (cada vez)
Total: 45 API calls en 3 clicks
```

### Después del Fix:
```
Click en China → 15 API calls (primera vez) + cache guardado
Click en India → 0 API calls (usa cache de China si polls son iguales)
Click en USA → 0 API calls (usa cache)
Total: 15 API calls en 3 clicks
```

**Reducción: 67% menos API calls** ✅

---

## ✅ LOGS AGREGADOS

**Archivo:** `src/lib/GlobeGL.svelte`  
**Líneas:** 1173-1181

Los logs mostrarán exactamente por qué el cache no funciona.

---

*Investigación en progreso - Esperando logs del usuario*
