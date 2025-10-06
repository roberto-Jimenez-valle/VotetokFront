# 🌍 Lógica del Globo 3D - Sistema de Visualización de Encuestas

## 📋 Índice
1. [Estados del Globo](#estados-del-globo)
2. [Sistema de Colores](#sistema-de-colores)
3. [Sistema de Navegación y Zoom](#sistema-de-navegación-y-zoom)
4. [Flujo de Datos](#flujo-de-datos)
5. [Casos de Uso](#casos-de-uso)

---

## 🎯 Estados del Globo

El globo 3D puede estar en **DOS estados principales EXCLUYENTES**:

### 1. **Estado Global Trending** (Sin encuesta abierta)
- **Cuándo**: Al iniciar la app, o cuando cierras/sales de una encuesta
- **Datos mostrados**: Agregación de múltiples encuestas trending
- **Colores**: Cada país se colorea según la encuesta trending más popular en ese país
- **Header**: Avatares de usuarios trending (sin círculos de colores)
- **BottomSheet**: Feed de encuestas trending en modo expandido
- **Comportamiento**: Muestra datos agregados de TODAS las encuestas trending

### 2. **Estado Encuesta Específica** (Encuesta abierta)
- **Cuándo**: Usuario hace clic en "Ver en globo" desde una encuesta
- **Datos mostrados**: **EXCLUSIVAMENTE** datos de esa encuesta específica
- **Colores**: Cada país/región se colorea según la opción más votada de **ESA ENCUESTA ÚNICAMENTE**
- **Header**: Avatares permanecen igual (independientes)
- **BottomSheet**: Datos de la encuesta abierta en modo collapsed
- **Comportamiento**: **TODO trabaja sobre esa encuesta hasta que salgas de ella**

---

## 🔒 REGLA FUNDAMENTAL: MODO EXCLUSIVO

### ⚠️ CRÍTICO: Una vez abierta una encuesta, el globo trabaja EXCLUSIVAMENTE con ella

```
Estado Trending:
  - Datos: Agregación de múltiples encuestas
  - Colores: Basados en encuestas trending por país
  - Navegación: Muestra datos agregados en todos los niveles
  
  ↓ Usuario hace clic en "Ver en globo" en una encuesta
  
Estado Encuesta Específica:
  - Datos: SOLO de esa encuesta (activePoll)
  - Colores: SOLO opciones de esa encuesta
  - Navegación: TODOS los niveles usan datos de esa encuesta
  - Click en país: Datos de ESA encuesta para ese país
  - Click en subdivisión: Datos de ESA encuesta para esa subdivisión
  - Click en ciudad: Datos de ESA encuesta para esa ciudad
  
  ↓ Usuario cierra/sale de la encuesta
  
Estado Trending:
  - Vuelve a mostrar datos agregados de trending
```

### 🚫 LO QUE NUNCA DEBE PASAR

1. **NUNCA** mezclar datos de trending con datos de encuesta específica
2. **NUNCA** cambiar a datos trending mientras una encuesta está abierta
3. **NUNCA** mostrar colores de otras encuestas cuando hay una abierta
4. **NUNCA** perder el contexto de la encuesta activa al navegar por niveles

### ✅ LO QUE SIEMPRE DEBE PASAR

1. **SIEMPRE** verificar si `activePoll` existe antes de decidir qué datos usar
2. **SIEMPRE** usar `answersData` filtrado por la encuesta activa
3. **SIEMPRE** mantener el contexto de encuesta durante toda la navegación
4. **SIEMPRE** volver a trending SOLO cuando se cierra explícitamente la encuesta

---

## 🎨 Sistema de Colores

### Regla de Oro: **UN COLOR = UNA OPCIÓN GANADORA**

#### Nivel Mundial (Vista Global)
```
Para cada país:
  1. Obtener votos de la encuesta activa para ese país
  2. Calcular opción con más votos
  3. Pintar país del COLOR de esa opción
  
Ejemplo: España tiene 3 opciones en la encuesta
  - Opción A (Rojo): 150 votos
  - Opción B (Azul): 200 votos ← GANADORA
  - Opción C (Verde): 100 votos
  → España se pinta de AZUL
```

#### Nivel País (Vista de Subdivisiones)
```
Al hacer clic en un país:
  1. El país padre se atenúa (opacity: 0.25)
  2. Las subdivisiones se muestran en primer plano
  3. Cada subdivisión se pinta según DATOS REALES de la base de datos:
  
PRIORIDAD 1: Datos REALES de la base de datos
  - Fetch /api/polls/{pollId}/votes-by-subdivisions?country={iso}
  - Obtener votos reales por subdivisión
  - Calcular opción ganadora por subdivisión
  - Pintar cada subdivisión del color de su opción ganadora
  
PRIORIDAD 2: Fallback a marcadores (legacy)
  - Usar regionVotes si existen
  
PRIORIDAD 3: Fallback a distribución proporcional (último recurso)
  - Solo si no hay datos reales disponibles
  - ⚠️ Esto es temporal hasta que haya datos en BD
  
Ejemplo: Andalucía en España
  - BD tiene 75 votos opción A, 150 votos opción B, 50 votos opción C
  - Opción B gana con 150 votos
  - Andalucía se pinta del color de la opción B
```

#### Nivel Subdivisión (Vista de Sub-subdivisiones)
```
Al hacer clic en una subdivisión:
  1. Mostrar SOLO esa subdivisión (sin fondo)
  2. Elevar polígonos (elevation: 0.05)
  3. Cada sub-subdivisión se pinta según sus datos
  4. Zoom muy cercano (altitude: 0.06 máximo)
```

### Prioridades de Color (onPolyCapColor)
```typescript
PRIORIDAD 1: _forcedColor (color asignado explícitamente)
   ↓
PRIORIDAD 2: País seleccionado → Color de opción más votada
   ↓
PRIORIDAD 3: Otros países → Atenuados (rgba con alpha 0.15)
   ↓
PRIORIDAD 4: Vista global → Color dominante por país
```

---

## 🔍 Sistema de Navegación y Zoom

### Principio Fundamental: **UN SOLO ZOOM POR ACCIÓN**

#### Sistema de Control Centralizado: `scheduleZoom()`
```typescript
function scheduleZoom(lat, lng, altitude, duration, delay)
```

**Características:**
- Cancela automáticamente zooms pendientes
- Detecta si hay un zoom en progreso
- Espera a que termine antes de ejecutar el siguiente
- Logging detallado para debugging

#### Flujo de Navegación Correcto

##### Click en País (Mundo → País)
```
1. Actualizar countryChartSegments con datos de la encuesta
2. await tick() → Propagar cambios reactivos
3. navigationManager.navigateToCountry() → Carga polígonos
4. scheduleZoom() con delay 150ms → Espera que polígonos estén listos
5. setTimeout 200ms → Refresh final de colores
```

##### Click en Subdivisión (País → Subdivisión)
```
1. Cargar datos de subdivisión desde API (si hay encuesta activa)
2. navigationManager.navigateToSubdivision() → Carga polígonos nivel 3
3. scheduleZoom() con delay 150ms → Zoom adaptativo
4. setTimeout 900ms → Refresh visual
```

##### Click en Espacio Vacío (Volver Atrás)
```
1. navigationManager.navigateBack() → Vuelve al nivel anterior
2. scheduleZoom() → Zoom out apropiado
3. Limpiar variables del nivel abandonado
```

### Zoom Adaptativo

#### Para Países
```
Área > 1000°²  → altitude: 1.2  (Rusia, Canadá, China)
Área 500-1000°² → altitude: 0.8  (Brasil, Australia, India)
Área 100-500°²  → altitude: 0.5  (Francia, España, Alemania)
Área 10-100°²   → altitude: 0.3  (Países europeos medianos)
Área 1-10°²     → altitude: 0.2  (Bélgica, Holanda, Suiza)
Área < 1°²      → altitude: 0.15 (Luxemburgo, Malta, Mónaco)
```

#### Para Subdivisiones
```
Área > 50°²     → altitude: 0.6  (Alaska, Territorios grandes)
Área 10-50°²    → altitude: 0.4  (Texas, California, Quebec)
Área 1-10°²     → altitude: 0.25 (Comunidades españolas, regiones francesas)
Área 0.1-1°²    → altitude: 0.15 (Delaware, Rhode Island)
Área < 0.1°²    → altitude: 0.08 (Washington D.C., ciudades-estado)
```

**Límites de Zoom:**
- MIN_ZOOM_ALTITUDE: 0.05 (más cercano posible)
- MAX_ZOOM_ALTITUDE: 2.5 (más alejado posible)

---

## 📊 Flujo de Datos

### Estructura de Datos Principal

```typescript
// Encuesta activa
activePoll: {
  id: number,
  title: string,
  question: string,
  options: Array<{
    key: string,
    label: string,
    color: string,
    votes: number
  }>
}

// Datos de votos por país
answersData: Record<string, Record<string, number>>
// Ejemplo: { "ESP": { "option1": 150, "option2": 200, "option3": 100 } }

// Mapa de colores
colorMap: Record<string, string>
// Ejemplo: { "option1": "#ff6b6b", "option2": "#4ecdc4", "option3": "#45b7d1" }

// Clave dominante por país (opción más votada)
isoDominantKey: Record<string, string>
// Ejemplo: { "ESP": "option2", "FRA": "option1", "USA": "option3" }
```

### APIs Necesarias

#### 1. Datos de Encuesta por País
```
GET /api/polls/{pollId}/votes-by-country

Response:
{
  "data": {
    "ESP": { "option1": 150, "option2": 200, "option3": 100 },
    "FRA": { "option1": 300, "option2": 250, "option3": 200 },
    ...
  }
}
```

#### 2. **Datos REALES de Subdivisiones (NUEVO - CRÍTICO)**
```
GET /api/polls/{pollId}/votes-by-subdivisions?country={iso}

Response:
{
  "data": {
    "1": { "option1": 50, "option2": 75, "option3": 25 },    // Andalucía
    "2": { "option1": 30, "option2": 40, "option3": 20 },    // Cataluña
    "3": { "option1": 20, "option2": 60, "option3": 15 },    // Madrid
    ...
  }
}

IMPORTANTE:
- La clave es el ID de la subdivisión (ID_1 del polígono)
- Los valores son votos REALES de la base de datos
- Cada voto debe tener: país, región, subdivisión, lat, lng
- El sistema calcula automáticamente la opción ganadora por subdivisión
```

#### 3. Datos de Subdivisión Individual (para BottomSheet)
```
GET /api/polls/{pollId}/votes-by-subdivision?country={iso}&subdivision={id}

Response:
{
  "data": {
    "option1": 50,
    "option2": 75,
    "option3": 25
  }
}
```

#### 3. Usuarios Trending (Header)
```
GET /api/users/trending?limit=10

Response:
{
  "data": [
    {
      "id": 1,
      "username": "user1",
      "displayName": "Usuario 1",
      "avatarUrl": "https://..."
    },
    ...
  ]
}
```

---

## 🎬 Casos de Uso

### Caso 1: Inicio de la Aplicación

```
1. Usuario abre la app
   ↓
2. onMount() en GlobeGL
   ↓
3. Cargar geometría del globo (worldMap$, worldData$)
   ↓
4. initFrom(geo, dataJson) - Cargar polígonos mundiales
   ↓
5. 🔥 loadTrendingData() - AUTOMÁTICO AL INICIO
   ↓
6. Fetch /api/polls/trending-by-region?region=Global&limit=20
   ↓
7. Para cada encuesta trending:
   - Fetch /api/polls/{id}/votes-by-country
   - Agregar votos al total por país
   ↓
8. Actualizar answersData con datos agregados
   ↓
9. Recalcular isoDominantKey (opción dominante por país)
   ↓
10. refreshPolyColors() → Pintar globo con colores dominantes
   ↓
11. BottomSheet en modo "peek" mostrando encuestas trending
   ↓
12. Estado: TRENDING (activePoll = null)
```

### Caso 2: Abrir Encuesta Específica

```
1. Usuario hace clic en "Ver en globo" en una encuesta
   ↓
2. Evento: openPollInGlobe con { poll, options }
   ↓
3. Guardar contexto: activePoll = poll, activePollOptions = options
   ↓
4. Cargar datos SOLO de esa encuesta desde API
   ↓
5. Actualizar answersData con datos de la encuesta
   ↓
6. Recalcular isoDominantKey para esa encuesta
   ↓
7. Actualizar colorMap con colores de las opciones
   ↓
8. refreshPolyColors() → Aplicar nuevos colores
   ↓
9. scheduleZoom() → Zoom out para vista global (altitude: 2.5)
   ↓
10. BottomSheet en modo "collapsed" mostrando datos de la encuesta
```

### Caso 3: Navegar a un País

```
1. Usuario hace clic en España
   ↓
2. VERIFICAR: ¿Hay encuesta activa (activePoll)?
   
   SI activePoll existe:
     - Obtener datos de España SOLO de esa encuesta: answersData["ESP"]
     - answersData ya está filtrado por la encuesta activa
   
   SI NO hay activePoll:
     - Obtener datos agregados de trending para España
   ↓
3. Calcular countryChartSegments (opciones ordenadas por votos)
   - Si es encuesta específica: opciones de ESA encuesta
   - Si es trending: opciones agregadas de trending
   ↓
4. await tick() → Propagar cambios
   ↓
5. navigationManager.navigateToCountry("ESP", "Spain")
   - Cargar polígono del país
   - Cargar subdivisiones (Andalucía, Cataluña, etc.)
   - 🔥 NUEVO: Cargar colores REALES desde la base de datos
     * Fetch /api/polls/{pollId}/votes-by-subdivisions?country=ESP
     * Para cada subdivisión: calcular opción ganadora
     * Asignar color de la opción ganadora a cada subdivisión
   - Propagar _forcedColor a cada polígono
   - setPolygonsData([país atenuado, subdivisiones])
   ↓
6. scheduleZoom() → Zoom adaptativo según tamaño de España
   ↓
7. setTimeout 200ms → refreshPolyColors() final
   ↓
8. BottomSheet muestra datos de España
   - Si activePoll: Datos de la encuesta para España
   - Si trending: Datos agregados para España
```

### Caso 4: Navegar a Subdivisión

```
1. Usuario hace clic en Andalucía
   ↓
2. VERIFICAR: ¿Hay encuesta activa (activePoll)?
   
   SI activePoll existe:
     - Cargar datos específicos de ESA ENCUESTA desde API
     - /api/polls/{activePoll.id}/votes-by-subdivision?country=ESP&subdivision=1
     - IMPORTANTE: Solo datos de la encuesta activa
   
   SI NO hay activePoll (modo trending):
     - Cargar datos agregados de trending para Andalucía
   ↓
3. Si NO hay datos específicos de subdivisión:
   - Usar datos del país (España) de la encuesta activa
   - O datos agregados si es modo trending
   ↓
4. Actualizar countryChartSegments con datos de Andalucía
   - Opciones de la encuesta activa (si existe)
   - O datos agregados (si es trending)
   ↓
5. navigationManager.navigateToSubdivision("ESP", "1", "Andalucía")
   - Cargar polígonos nivel 3 (provincias)
   - Elevar polígonos (elevation: 0.05)
   - Asignar colores BASADOS EN LA ENCUESTA ACTIVA
   - setPolygonsData([solo Andalucía])
   ↓
6. scheduleZoom() → Zoom muy cercano (altitude: 0.25)
   ↓
7. setTimeout 900ms → refreshPolyAltitudes() + refreshPolyStrokes()
   ↓
8. BottomSheet muestra datos de Andalucía
   - Si activePoll: Datos de ESA encuesta para Andalucía
   - Si trending: Datos agregados para Andalucía
```

### Caso 5: Volver Atrás (Click en Espacio Vacío)

```
1. Usuario hace clic en espacio vacío
   ↓
2. Detectar nivel actual
   ↓
3. Si nivel = subdivisión:
   - navigationManager.navigateBack() → Volver a país
   - scheduleZoom() → Zoom out a nivel país
   - Limpiar selectedSubdivisionName, selectedCityId
   ↓
4. Si nivel = país:
   - navigationManager.navigateBack() → Volver a mundo
   - scheduleZoom() → Zoom out a vista global (altitude: 2.5)
   - Limpiar selectedCountryName, selectedCountryIso
   ↓
5. Si nivel = mundo:
   - No hacer nada (ya en nivel más alto)
```

### Caso 6: Cerrar Encuesta (Volver a Trending)

```
1. Usuario cierra la encuesta abierta
   ↓
2. Limpiar contexto:
   - activePoll = null
   - activePollOptions = []
   ↓
3. Recargar datos de trending global
   ↓
4. Agregar datos de múltiples encuestas
   ↓
5. Recalcular colores dominantes
   ↓
6. refreshPolyColors() → Volver a colores trending
   ↓
7. scheduleZoom() → Vista global
   ↓
8. BottomSheet en modo "expanded" con feed de encuestas
```

---

## ⚠️ Reglas Críticas

### 🚫 LO QUE NO DEBE PASAR

1. **NUNCA** cambiar colores después del zoom
2. **NUNCA** hacer múltiples zooms para la misma acción
3. **NUNCA** actualizar avatares del header cuando se abre una encuesta
4. **NUNCA** mezclar datos de diferentes encuestas
5. **NUNCA** hacer refreshPolyColors() antes de que los datos estén listos
6. **NUNCA** mostrar datos trending cuando hay una encuesta abierta
7. **NUNCA** perder el contexto de activePoll durante la navegación
8. **NUNCA** cambiar entre trending y encuesta específica sin acción explícita del usuario

### ✅ LO QUE DEBE PASAR

1. **SIEMPRE** actualizar datos ANTES de navegar
2. **SIEMPRE** esperar (await tick()) antes de navegar
3. **SIEMPRE** usar scheduleZoom() para controlar el zoom
4. **SIEMPRE** hacer UN SOLO refresh de colores al final
5. **SIEMPRE** trabajar con la encuesta activa (activePoll) si existe
6. **SIEMPRE** verificar if (activePoll) antes de decidir qué datos usar
7. **SIEMPRE** mantener activePoll durante toda la navegación por niveles
8. **SIEMPRE** volver a trending SOLO cuando el usuario cierra la encuesta explícitamente

---

## 🔧 Sistema de Debugging

### Logs Importantes

```
[GlobeGL] 🎯 Opening poll in globe: {pollId}
[GlobeGL] 📡 Loading real poll data from API
[GlobeGL] ✅ Updated answersData for X countries
[Click] 🌍 Country clicked from world: {iso}
[Click] 📊 Country data for {iso}: {data}
[Click] ✅ Chart segments ready: [...]
[CountryView] 🎨 Calculating subdivision colors
[CountryView] ✅ Assigned colors to X subdivisions
[Zoom] 🎯 Scheduled zoom: {lat, lng, altitude, delay}
[Zoom] ▶️ Executing zoom to: {params}
[Zoom] ✅ Zoom complete
[Click] 🎨 Final color refresh complete
```

### Funciones de Testing

```javascript
// En consola del navegador:
testAdaptiveZoom("ESP")  // Probar zoom de España
testAdaptiveZoomSubdivision("ESP", "Andalucía")  // Probar zoom de Andalucía
testAltitude(0.5)  // Probar altitud específica
```

---

## 📝 Resumen Ejecutivo

### Flujo Principal
```
Abrir Encuesta → Cargar Datos → Pintar Globo
    ↓
Click País → Actualizar Datos → Navegar → Zoom → Refresh
    ↓
Click Subdivisión → Cargar Datos API → Navegar → Zoom → Refresh
    ↓
Click Vacío → Volver Atrás → Zoom Out
```

### Principios Fundamentales

1. **Un Color = Una Opción Ganadora**
2. **Un Zoom = Una Acción**
3. **Datos Primero, Navegación Después**
4. **Refresh al Final, No al Principio**
5. **Encuesta Activa = Fuente Única de Verdad**
6. **Modo Exclusivo: Trending O Encuesta Específica (NUNCA ambos)**
7. **activePoll Dicta el Comportamiento: Si existe, TODO trabaja sobre ella**

---

## 🎯 Estado Ideal

Cuando todo funciona correctamente:

### Modo Trending (Sin encuesta abierta)
- ✅ Globo muestra datos agregados de encuestas trending
- ✅ Colores basados en encuestas más populares por país
- ✅ Navegación por niveles usa datos agregados
- ✅ BottomSheet en modo expandido con feed de encuestas

### Modo Encuesta Específica (Encuesta abierta)
- ✅ Abres encuesta → Globo se pinta EXCLUSIVAMENTE con colores de esa encuesta
- ✅ Click en país → Zoom suave, color estable (opción ganadora DE ESA ENCUESTA)
- ✅ Click en subdivisión → Zoom cercano, colores específicos DE ESA ENCUESTA
- ✅ Navegas por todos los niveles → SIEMPRE datos de la misma encuesta
- ✅ Cierras encuesta → Vuelve a modo trending

### General
- ✅ Sin parpadeos de colores
- ✅ Sin cambios de zoom erráticos
- ✅ Sin mezcla de datos de diferentes encuestas
- ✅ Avatares del header siempre independientes
- ✅ Transiciones suaves y predecibles
- ✅ Logging claro para debugging
- ✅ **NUNCA mezcla trending con encuesta específica**

---

**Última actualización**: 2025-10-05
**Versión**: 1.0
