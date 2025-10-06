# Problemas de Coloreado por Niveles - Diagnóstico

## 🔍 Problemas Identificados

### 1. **La leyenda no cambia entre niveles**

**Problema:**
- `legendItems` solo se calcula a nivel mundial
- Cuando navegas a nivel 2 (país) o nivel 3 (subdivisión), la leyenda sigue mostrando datos mundiales
- `voteOptions` se deriva de `legendItems`, por lo que tampoco se actualiza

**Ubicación del código:**
```typescript
// GlobeGL.svelte línea 2499
$: voteOptions = legendItems.length > 0 ? legendItems.map(item => ({
  key: item.key,
  label: item.key,
  color: item.color,
  votes: item.count
})) : activePollOptions;
```

**Causa raíz:**
- `legendItems` solo se recalcula cuando se llama `computeGlobeViewModel()`
- `computeGlobeViewModel()` solo se llama:
  1. Al cargar datos iniciales (`initFrom()`)
  2. Al abrir una encuesta (`handleOpenPollInGlobe()`)
  3. Al cargar trending data (`loadTrendingData()`)
- **NUNCA se recalcula al navegar a nivel 2 o 3**

### 2. **Los polígonos no se colorean correctamente en niveles 2 y 3**

**Problema:**
- Nivel 1 (mundo): ✅ Funciona - usa `isoDominantKey` y `colorMap`
- Nivel 2 (país): ⚠️ A veces falla - depende de `_forcedColor`
- Nivel 3 (subdivisión): ❌ Falla - no hay datos o fallback no funciona

**Flujo actual:**

```
Nivel 1 (Mundo):
  answersData[ISO] → isoDominantKey[ISO] → colorMap[key] → Color ✅

Nivel 2 (País):
  API /votes-by-subdivisions → computeSubdivisionColorsFromDatabase()
  → Agrega a nivel 1 → Asigna _forcedColor → Color ⚠️

Nivel 3 (Subdivisión):
  API /votes-by-subsubdivisions → computeSubSubdivisionColorsFromDatabase()
  → Agrega a nivel 2 → Asigna _forcedColor → Color ❌
  → Si falla: Fallback proporcional
```

**Problemas específicos:**

1. **Endpoint nivel 3 puede no tener datos**
   - La BD puede no tener votos con IDs de nivel 3 (ESP.1.1, ESP.1.2)
   - El endpoint devuelve `data: {}`
   - El fallback se activa pero puede no funcionar correctamente

2. **El fallback usa datos del país completo**
   - No usa datos específicos de la subdivisión
   - Colorea proporcionalmente según datos de ESP, no de ESP.1

3. **`answersData` no se actualiza por nivel**
   - `answersData` siempre contiene datos a nivel país (ESP, FRA, USA)
   - Nunca contiene datos a nivel subdivisión (ESP.1, ESP.2)
   - Por eso `isoDominantKey` no funciona en niveles 2 y 3

## 🎯 Soluciones Propuestas

### Solución 1: Actualizar `answersData` por nivel

**Implementar:**
```typescript
// Cuando navegas a nivel 2 (país)
async function navigateToCountry(iso: string) {
  // ... código existente ...
  
  // Cargar datos de subdivisiones
  const response = await fetch(`/api/polls/${activePoll.id}/votes-by-subdivisions?country=${iso}`);
  const { data } = await response.json();
  
  // Agregar a nivel 1
  const level1Data = aggregateVotesByLevel(data, 1);
  
  // ACTUALIZAR answersData con datos de nivel 1
  answersData = level1Data; // ESP.1, ESP.2, etc.
  
  // RECALCULAR legendItems y isoDominantKey
  const geoData = { type: 'FeatureCollection', features: localPolygons };
  const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
  isoDominantKey = vm.isoDominantKey;
  legendItems = vm.legendItems; // ✅ Leyenda actualizada
}
```

**Ventajas:**
- ✅ La leyenda se actualiza automáticamente
- ✅ `isoDominantKey` funciona en todos los niveles
- ✅ No necesita `_forcedColor`
- ✅ Usa el mismo sistema en todos los niveles

### Solución 2: Crear `legendItems` específicos por nivel

**Implementar:**
```typescript
// Función para generar leyenda desde datos de subdivisión
function generateLegendFromSubdivisionData(
  data: Record<string, Record<string, number>>,
  colorMap: Record<string, string>
): Array<{ key: string; color: string; count: number }> {
  const counts: Record<string, number> = {};
  
  // Contar cuántas subdivisiones gana cada opción
  for (const [subdivisionId, votes] of Object.entries(data)) {
    const winner = findWinningOption(votes);
    if (winner) {
      counts[winner.option] = (counts[winner.option] || 0) + 1;
    }
  }
  
  // Convertir a formato legendItems
  return Object.entries(counts)
    .map(([key, count]) => ({
      key,
      color: colorMap[key] || '#9ca3af',
      count
    }))
    .sort((a, b) => b.count - a.count);
}

// Usar al navegar a nivel 2
async function navigateToCountry(iso: string) {
  const response = await fetch(`/api/polls/${activePoll.id}/votes-by-subdivisions?country=${iso}`);
  const { data } = await response.json();
  
  const level1Data = aggregateVotesByLevel(data, 1);
  
  // Generar leyenda específica para este nivel
  legendItems = generateLegendFromSubdivisionData(level1Data, colorMap);
}
```

### Solución 3: Mejorar el fallback de nivel 3

**Problema actual:**
```typescript
// Usa datos del país completo (ESP)
const countryRecord = answersData?.[countryIso];
```

**Solución:**
```typescript
// Usar datos de la subdivisión específica (ESP.1)
async function computeSubdivisionColorsFromVotesLevel3(...) {
  // Intentar obtener datos de la subdivisión padre
  const subdivisionData = await fetch(
    `/api/polls/${activePoll.id}/votes-by-subdivisions?country=${countryIso}`
  );
  
  const { data } = await subdivisionData.json();
  const level1Data = aggregateVotesByLevel(data, 1);
  
  // Usar datos de ESP.1 en lugar de ESP
  const subdivisionRecord = level1Data[`${countryIso}.${subdivisionId}`];
  
  if (subdivisionRecord) {
    const segments = generateCountryChartSegments([subdivisionRecord]);
    // Colorear proporcionalmente con datos de ESP.1
  }
}
```

## 📊 Flujo Correcto Propuesto

```
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 1 (MUNDO)                                             │
├─────────────────────────────────────────────────────────────┤
│ 1. Cargar: /api/polls/{id}/votes-by-country                │
│ 2. answersData = { ESP: {...}, FRA: {...}, USA: {...} }    │
│ 3. computeGlobeViewModel() → isoDominantKey, legendItems   │
│ 4. Colorear: colorMap[isoDominantKey[ISO]]                 │
│ 5. Leyenda: legendItems (Opción A: 50 países, B: 30...)    │
└─────────────────────────────────────────────────────────────┘
                            ↓ Click en España
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 2 (PAÍS - ESPAÑA)                                     │
├─────────────────────────────────────────────────────────────┤
│ 1. Cargar: /api/polls/{id}/votes-by-subdivisions?country=ESP│
│ 2. Datos raw: { ESP.1.1: {...}, ESP.1.2: {...} }           │
│ 3. Agregar a nivel 1: { ESP.1: {...}, ESP.2: {...} }       │
│ 4. answersData = { ESP.1: {...}, ESP.2: {...} } ← NUEVO    │
│ 5. computeGlobeViewModel() → isoDominantKey, legendItems   │
│ 6. Colorear: colorMap[isoDominantKey[ESP.1]]               │
│ 7. Leyenda: legendItems (Opción A: 8 regiones, B: 9...)    │
└─────────────────────────────────────────────────────────────┘
                            ↓ Click en Andalucía
┌─────────────────────────────────────────────────────────────┐
│ NIVEL 3 (SUBDIVISIÓN - ANDALUCÍA)                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Cargar: /api/polls/{id}/votes-by-subsubdivisions?       │
│    country=ESP&subdivision=1                                │
│ 2. Datos raw: { ESP.1.1: {...}, ESP.1.2: {...} }           │
│ 3. Agregar a nivel 2: { ESP.1.1: {...}, ESP.1.2: {...} }   │
│ 4. answersData = { ESP.1.1: {...}, ESP.1.2: {...} } ← NUEVO│
│ 5. computeGlobeViewModel() → isoDominantKey, legendItems   │
│ 6. Colorear: colorMap[isoDominantKey[ESP.1.1]]             │
│ 7. Leyenda: legendItems (Opción A: 4 provincias, B: 4...)  │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Cambios Necesarios

### 1. Modificar `NavigationManager.navigateToCountry()`

```typescript
async navigateToCountry(iso: string, countryName: string) {
  // ... código existente de carga de polígonos ...
  
  // 🔥 NUEVO: Cargar y actualizar datos de subdivisiones
  if (activePoll && activePoll.id) {
    const response = await fetch(`/api/polls/${activePoll.id}/votes-by-subdivisions?country=${iso}`);
    if (response.ok) {
      const { data } = await response.json();
      const level1Data = aggregateVotesByLevel(data, 1);
      
      // Actualizar answersData con datos de nivel 1
      answersData = level1Data;
      
      // Recalcular leyenda
      const geoData = { type: 'FeatureCollection', features: countryPolygons };
      const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
      isoDominantKey = vm.isoDominantKey;
      legendItems = vm.legendItems;
      
          }
  }
  
  // ... resto del código ...
}
```

### 2. Modificar `NavigationManager.navigateToSubdivision()`

```typescript
async navigateToSubdivision(iso: string, subdivisionId: string, subdivisionName: string) {
  // ... código existente de carga de polígonos ...
  
  // 🔥 NUEVO: Cargar y actualizar datos de sub-subdivisiones
  if (activePoll && activePoll.id) {
    const response = await fetch(
      `/api/polls/${activePoll.id}/votes-by-subsubdivisions?country=${iso}&subdivision=${subdivisionId}`
    );
    if (response.ok) {
      const { data } = await response.json();
      const level2Data = aggregateVotesByLevel(data, 2);
      
      // Actualizar answersData con datos de nivel 2
      answersData = level2Data;
      
      // Recalcular leyenda
      const geoData = { type: 'FeatureCollection', features: subdivisionPolygons };
      const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
      isoDominantKey = vm.isoDominantKey;
      legendItems = vm.legendItems;
      
          }
  }
  
  // ... resto del código ...
}
```

### 3. Modificar `NavigationManager.navigateToWorld()`

```typescript
async navigateToWorld() {
  // ... código existente ...
  
  // 🔥 NUEVO: Restaurar datos mundiales
  if (activePoll && activePoll.id) {
    const response = await fetch(`/api/polls/${activePoll.id}/votes-by-country`);
    if (response.ok) {
      const { data } = await response.json();
      
      // Restaurar answersData a nivel mundial
      answersData = data;
      
      // Recalcular leyenda
      const geoData = { type: 'FeatureCollection', features: worldPolygons };
      const vm = computeGlobeViewModel(geoData, { ANSWERS: answersData, colors: colorMap });
      isoDominantKey = vm.isoDominantKey;
      legendItems = vm.legendItems;
      
          }
  }
  
  // ... resto del código ...
}
```

## ✅ Resultado Esperado

Después de implementar estos cambios:

1. **Leyenda dinámica por nivel:**
   - Nivel 1: "Opción A: 50 países, Opción B: 30 países"
   - Nivel 2: "Opción A: 8 regiones, Opción B: 9 regiones"
   - Nivel 3: "Opción A: 4 provincias, Opción B: 4 provincias"

2. **Coloreado consistente:**
   - Todos los niveles usan el mismo sistema (`isoDominantKey` + `colorMap`)
   - No depende de `_forcedColor`
   - Fallback solo si no hay datos

3. **Datos correctos por nivel:**
   - `answersData` siempre contiene datos del nivel actual
   - `isoDominantKey` funciona en todos los niveles
   - `legendItems` se actualiza automáticamente

## 🐛 Debugging

Para verificar que funciona:

```javascript
// En consola del navegador
```

Deberías ver:
- **Nivel 1**: `answersData` tiene claves como "ESP", "FRA", "USA"
- **Nivel 2**: `answersData` tiene claves como "ESP.1", "ESP.2", "ESP.3"
- **Nivel 3**: `answersData` tiene claves como "ESP.1.1", "ESP.1.2", "ESP.1.3"
