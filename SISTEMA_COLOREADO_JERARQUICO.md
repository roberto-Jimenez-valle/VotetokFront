# Sistema de Coloreado Jerárquico de Polígonos

## 📋 Descripción General

Este documento describe el sistema implementado para colorear polígonos del globo 3D según los votos de encuestas, respetando la jerarquía de subdivisiones geográficas.

## 🎯 Problema Resuelto

**Problema Original:**
- La base de datos almacena votos con IDs granulares (ej: `ESP.1.1` para Sevilla)
- El frontend necesita mostrar colores diferentes según el nivel de navegación:
  - **Nivel Mundial**: Colorear países (ESP) según opción ganadora
  - **Nivel País**: Colorear subdivisiones nivel 1 (ESP.1 = Andalucía) según opción ganadora
  - **Nivel Subdivisión**: Colorear subdivisiones nivel 2 (ESP.1.1 = Sevilla) según opción ganadora

**Solución Implementada:**
Sistema de agregación de votos que recalcula automáticamente qué opción gana en cada nivel jerárquico.

## 🏗️ Arquitectura del Sistema

### 1. Estructura de IDs Jerárquicos

```
ESP           → País (España)
ESP.1         → Subdivisión nivel 1 (Andalucía)
ESP.1.1       → Subdivisión nivel 2 (Sevilla)
ESP.1.2       → Subdivisión nivel 2 (Jaén)
ESP.2         → Subdivisión nivel 1 (Cataluña)
ESP.2.1       → Subdivisión nivel 2 (Barcelona)
```

### 2. Flujo de Datos

```
┌─────────────────────────────────────────────────────────────┐
│ BASE DE DATOS                                               │
│ Votos con IDs granulares:                                   │
│ - ESP.1.1 → { "Opción A": 50, "Opción B": 30 }            │
│ - ESP.1.2 → { "Opción A": 20, "Opción B": 40 }            │
│ - ESP.2.1 → { "Opción A": 60, "Opción B": 25 }            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ ENDPOINT API                                                │
│ /api/polls/{id}/votes-by-subdivisions?country=ESP          │
│ Retorna votos tal como están en BD                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND - Función aggregateVotesByLevel()                 │
│ Agrega votos según nivel solicitado:                       │
│                                                             │
│ Nivel 1 (ESP.1):                                           │
│ - ESP.1.1 + ESP.1.2 → ESP.1                                │
│   { "Opción A": 70, "Opción B": 70 }                       │
│                                                             │
│ Nivel 2 (ESP.1.1):                                         │
│ - ESP.1.1 → ESP.1.1                                        │
│   { "Opción A": 50, "Opción B": 30 }                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND - Función findWinningOption()                     │
│ Encuentra la opción con más votos                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND - Colorear polígonos                              │
│ Asigna color de la opción ganadora a cada polígono         │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Funciones Principales

### 1. `aggregateVotesByLevel(rawVotes, targetLevel)`

**Propósito:** Agregar votos desde IDs granulares al nivel jerárquico deseado.

**Parámetros:**
- `rawVotes`: Record<string, Record<string, number>> - Votos con IDs granulares
- `targetLevel`: 1 | 2 - Nivel objetivo de agregación

**Ejemplo:**
```typescript
// Datos de entrada (IDs granulares)
const rawVotes = {
  "ESP.1.1": { "Opción A": 50, "Opción B": 30 },
  "ESP.1.2": { "Opción A": 20, "Opción B": 40 },
  "ESP.2.1": { "Opción A": 60, "Opción B": 25 }
};

// Agregar a nivel 1
const level1 = aggregateVotesByLevel(rawVotes, 1);
// Resultado:
// {
//   "ESP.1": { "Opción A": 70, "Opción B": 70 },
//   "ESP.2": { "Opción A": 60, "Opción B": 25 }
// }
```

### 2. `findWinningOption(votes)`

**Propósito:** Encontrar la opción con más votos.

**Parámetros:**
- `votes`: Record<string, number> - Votos por opción

**Retorna:** `{ option: string; count: number } | null`

**Ejemplo:**
```typescript
const votes = { "Opción A": 70, "Opción B": 30 };
const winner = findWinningOption(votes);
// Resultado: { option: "Opción A", count: 70 }
```

### 3. `computeSubdivisionColorsFromDatabase(countryIso, polygons)`

**Propósito:** Cargar y calcular colores para subdivisiones nivel 1.

**Flujo:**
1. Cargar votos desde `/api/polls/{id}/votes-by-subdivisions?country={iso}`
2. Agregar votos a nivel 1 usando `aggregateVotesByLevel(data, 1)`
3. Encontrar opción ganadora para cada subdivisión
4. Asignar color correspondiente a cada polígono

### 4. `computeSubSubdivisionColorsFromDatabase(countryIso, subdivisionId, polygons)`

**Propósito:** Cargar y calcular colores para subdivisiones nivel 2.

**Flujo:**
1. Cargar votos desde `/api/polls/{id}/votes-by-subsubdivisions?country={iso}&subdivision={id}`
2. Agregar votos a nivel 2 usando `aggregateVotesByLevel(data, 2)`
3. Encontrar opción ganadora para cada sub-subdivisión
4. Asignar color correspondiente a cada polígono

## 📊 Casos de Uso

### Caso 1: Vista Mundial → Clic en España

```
1. Usuario abre encuesta "¿Prefieres A o B?"
2. Vista mundial muestra países coloreados
3. Usuario hace clic en España
4. Sistema carga subdivisiones de España (Andalucía, Cataluña, etc.)
5. computeSubdivisionColorsFromDatabase() se ejecuta:
   - Carga votos granulares (ESP.1.1, ESP.1.2, ESP.2.1, etc.)
   - Agrega a nivel 1 (ESP.1, ESP.2, etc.)
   - Calcula ganador por subdivisión
   - Colorea polígonos
```

### Caso 2: Vista País → Clic en Andalucía

```
1. Usuario está viendo España con subdivisiones coloreadas
2. Usuario hace clic en Andalucía (ESP.1)
3. Sistema carga sub-subdivisiones de Andalucía (Sevilla, Jaén, etc.)
4. computeSubSubdivisionColorsFromDatabase() se ejecuta:
   - Carga votos granulares (ESP.1.1, ESP.1.2, etc.)
   - Agrega a nivel 2 (ESP.1.1, ESP.1.2, etc.)
   - Calcula ganador por sub-subdivisión
   - Colorea polígonos
```

## 🔍 Normalización de IDs

El sistema normaliza IDs para garantizar coincidencias correctas:

```typescript
// Polígono puede tener ID en diferentes formatos:
// - "1" (solo número)
// - "ESP.1" (completo)

// Sistema normaliza ambos formatos:
const normalizedId1 = String(id1).includes('.') 
  ? id1 
  : `${countryIso}.${id1}`;

// Ahora ambos coinciden con "ESP.1"
```

## 🎨 Asignación de Colores

1. **Obtener colorMap** de las opciones de la encuesta activa
2. **Encontrar opción ganadora** para cada región
3. **Buscar color** en colorMap usando la opción ganadora como clave
4. **Asignar color** al polígono mediante `_forcedColor` property

```typescript
if (winner && colorMap?.[winner.option]) {
  const color = colorMap[winner.option];
  poly.properties._forcedColor = color;
}
```

## 📝 Logging y Debug

El sistema incluye logging detallado para facilitar el debug:

```
[Colors] 📡 Loading real subdivision votes from database for poll 1 country ESP
[Colors] ✅ Loaded raw subdivision votes: { "ESP.1.1": {...}, ... }
[Colors] 📊 Aggregated to level 1: { "ESP.1": {...}, ... }
[Colors] ✅ Subdivision ESP.1 → Opción A (70 votes) → #ff5733
[Colors] ✅ Assigned real colors to 17 subdivisions from database
```

## 🚀 Integración con NavigationManager

El sistema se integra automáticamente con el NavigationManager:

```typescript
// En navigateToCountry()
const subdivisionColorById = await computeSubdivisionColorsFromDatabase(
  countryIso, 
  countryPolygons
);

// En navigateToSubdivision()
const subSubdivisionColorById = await computeSubSubdivisionColorsFromDatabase(
  countryIso, 
  subdivisionId, 
  subdivisionPolygons
);
```

## ⚠️ Consideraciones Importantes

1. **Solo funciona con encuesta activa**: Si no hay `activePoll`, no se colorean polígonos
2. **Requiere colorMap**: Las opciones de la encuesta deben tener colores asignados
3. **Depende de estructura de IDs**: Los IDs deben seguir el formato `PAIS.NIVEL1.NIVEL2`
4. **Agregación en frontend**: La agregación se hace en el cliente, no en el servidor

## 🔄 Flujo Completo de Ejemplo

```
1. Usuario abre encuesta ID=5 con opciones:
   - Opción A (color: #ff5733)
   - Opción B (color: #3357ff)

2. BD tiene votos:
   - ESP.1.1: { "Opción A": 50, "Opción B": 30 }
   - ESP.1.2: { "Opción A": 20, "Opción B": 40 }

3. Usuario hace clic en España → Vista país

4. Sistema ejecuta computeSubdivisionColorsFromDatabase("ESP", polygons):
   a. Fetch /api/polls/5/votes-by-subdivisions?country=ESP
   b. Recibe: { "ESP.1.1": {...}, "ESP.1.2": {...} }
   c. Agrega a nivel 1: { "ESP.1": { "A": 70, "B": 70 } }
   d. Encuentra ganador: Empate → toma primero = "Opción A"
   e. Busca color: colorMap["Opción A"] = "#ff5733"
   f. Asigna a polígono Andalucía: _forcedColor = "#ff5733"

5. Polígono de Andalucía se muestra en rojo (#ff5733)
```

## 📚 Referencias

- **Archivo principal**: `src/lib/GlobeGL.svelte`
- **Funciones clave**: Líneas 849-1047
- **APIs relacionadas**:
  - `/api/polls/{id}/votes-by-country`
  - `/api/polls/{id}/votes-by-subdivisions?country={iso}`
  - `/api/polls/{id}/votes-by-subsubdivisions?country={iso}&subdivision={id}`
