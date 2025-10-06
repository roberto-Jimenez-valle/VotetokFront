# Checklist de Debug - Sistema de Coloreado

## 🔍 Qué Buscar en la Consola del Navegador

### 1. Al Abrir una Encuesta

Deberías ver:
```
[GlobeGL] 🎯 Opening poll in globe: [ID] with [N] options
[GlobeGL] 🔒 MODO EXCLUSIVO: ENCUESTA ESPECÍFICA
[GlobeGL]   Poll ID: [ID]
[GlobeGL]   Options: [N]
[GlobeGL] Updated colorMap: { ... }
[GlobeGL] 📡 Loading real poll data from API for poll: [ID]
[GlobeGL] ✅ Loaded real data from API: { ... }
[GlobeGL] ✅ Updated answersData for [N] countries
[computeGlobeViewModel] 🔄 Computing view model...
[computeGlobeViewModel] 📊 answersData keys: [...]
[computeGlobeViewModel] 🎨 colorMap keys: [...]
[computeGlobeViewModel] ✅ Computed [N] dominant keys
[computeGlobeViewModel] 📊 Legend items: [N]
[computeGlobeViewModel] 🎨 Legend: [...]
[GlobeGL] ✅ Recalculated globe view model for active poll
[GlobeGL] 🎨 Refreshing polygon colors...
[GlobeGL] ✅ Polygon colors refreshed for poll [ID]
```

**❌ Si NO ves esto:**
- Problema: La encuesta no se está abriendo
- Solución: Verificar que el evento `openPollInGlobe` se está disparando

**❌ Si ves "API returned error":**
- Problema: El endpoint no existe o no tiene datos
- Solución: Verificar que `/api/polls/[id]/votes-by-country` funciona

**❌ Si `answersData keys` está vacío:**
- Problema: No hay votos en la BD
- Solución: Ejecutar script para agregar votos de prueba

### 2. Al Hacer Clic en un País (Nivel 2)

Deberías ver:
```
[Click] 🌍 Country clicked from world: [ISO] [Name]
[Click] 🔒 Mode: ENCUESTA [ID]
[Navigation] Navigating to country: [ISO]
[Navigation] 📡 Loading subdivision data for country level...
[Navigation] ✅ Loaded subdivision votes: [N] subdivisions
[Navigation] 📊 Aggregated to level 1: [N] subdivisions
[computeGlobeViewModel] 🔄 Computing view model...
[computeGlobeViewModel] 📊 answersData keys: [ESP.1, ESP.2, ...]
[computeGlobeViewModel] 🎨 Legend: [...]
[Navigation] ✅ Updated legend for country level: [N] items
[Navigation] 🎨 Legend: [...]
```

**❌ Si NO ves "Loading subdivision data":**
- Problema: `activePoll` es null
- Solución: Verificar que la encuesta se abrió correctamente

**❌ Si ves "0 subdivisions":**
- Problema: El endpoint no devuelve datos
- Solución: Verificar que hay votos con `subdivisionId` en la BD

**❌ Si `answersData keys` sigue siendo países (ESP, FRA):**
- Problema: `answersData` no se está actualizando
- Solución: Verificar que la asignación `answersData = level1Data` se ejecuta

### 3. Al Hacer Clic en una Subdivisión (Nivel 3)

Deberías ver:
```
[Click] 🗺️ Subdivision clicked from country: [ID] [Name]
[Navigation] Navigating to subdivision: [ID]
[Navigation] 📡 Loading sub-subdivision data for subdivision level...
[Navigation] ✅ Loaded sub-subdivision votes: [N] sub-subdivisions
[Navigation] 📊 Aggregated to level 2: [N] sub-subdivisions
[computeGlobeViewModel] 🔄 Computing view model...
[computeGlobeViewModel] 📊 answersData keys: [ESP.1.1, ESP.1.2, ...]
[computeGlobeViewModel] 🎨 Legend: [...]
[Navigation] ✅ Updated legend for subdivision level: [N] items
[SubdivisionView] 📡 Loading sub-subdivision colors from database...
[Colors L3] 📡 Loading sub-subdivision votes for poll [ID]
```

**❌ Si NO ves "Loading sub-subdivision data":**
- Problema: `activePoll` es null
- Solución: La encuesta se cerró o no está activa

**❌ Si ves "0 sub-subdivisions":**
- Problema: No hay datos de nivel 3 en la BD
- Solución: Ejecutar `add-level3-subdivision-ids.ts`

**❌ Si los polígonos siguen grises:**
- Problema: `_forcedColor` no se está aplicando o `isoDominantKey` está vacío
- Solución: Verificar que `computeGlobeViewModel` está generando datos correctos

## 🐛 Problemas Comunes y Soluciones

### Problema 1: Todo está gris
**Causa:** No hay datos en la BD o `answersData` está vacío

**Verificar:**
```javascript
// En consola del navegador
```

**Solución:**
```bash
# Verificar datos
npx tsx scripts/check-poll-data.ts

# Si no hay votos, agregar datos de prueba
npx tsx scripts/update-vote-locations.ts
```

### Problema 2: La leyenda no cambia
**Causa:** `legendItems` no se está recalculando

**Verificar en consola:**
```
[computeGlobeViewModel] 📊 Legend items: [N]
[Navigation] ✅ Updated legend for country level: [N] items
```

**Si NO aparece:** El código de actualización no se está ejecutando

**Solución:** Verificar que `activePoll` no es null

### Problema 3: Los colores no coinciden con la leyenda
**Causa:** `colorMap` tiene claves diferentes a las opciones

**Verificar:**
```javascript
// En consola
```

**Deben coincidir:** Las claves de `colorMap` deben ser las mismas que `option.key`

### Problema 4: Nivel 2 no colorea
**Causa:** Los IDs de polígonos no coinciden con `answersData`

**Verificar:**
```javascript
// En consola después de hacer clic en país
// Debe mostrar: ["ESP.1", "ESP.2", "ESP.3", ...]

// Debe mostrar los mismos IDs
```

**Si no coinciden:** Problema de normalización de IDs

## 📋 Comandos Útiles para Debug

### 1. Verificar datos en BD
```bash
npx tsx scripts/check-poll-data.ts
```

### 2. Ver estructura de votos
```bash
npx prisma studio
# Ir a tabla "votes"
# Verificar campos: subdivisionId, countryIso3, optionId
```

### 3. Probar endpoint manualmente
```bash
# En navegador o curl
http://localhost:5173/api/polls/1/votes-by-country
http://localhost:5173/api/polls/1/votes-by-subdivisions?country=ESP
http://localhost:5173/api/polls/1/votes-by-subsubdivisions?country=ESP&subdivision=1
```

### 4. Verificar IDs jerárquicos
```bash
npx tsx scripts/verify-hierarchical-ids.ts
```

## 🎯 Flujo Esperado Completo

```
1. Usuario abre encuesta
   ↓
2. [GlobeGL] Carga datos de países
   ↓
3. [computeGlobeViewModel] Calcula colores y leyenda
   ↓
4. Polígonos se colorean ✅
   ↓
5. Usuario hace clic en España
   ↓
6. [Navigation] Carga datos de subdivisiones
   ↓
7. [Navigation] Actualiza answersData con ESP.1, ESP.2, etc.
   ↓
8. [computeGlobeViewModel] Recalcula colores y leyenda
   ↓
9. Polígonos de subdivisiones se colorean ✅
   ↓
10. Leyenda se actualiza ✅
```

## 🔧 Si Nada Funciona

1. **Limpiar caché del navegador** (Ctrl+Shift+Delete)
2. **Reiniciar servidor de desarrollo**
3. **Verificar que no hay errores en consola** (errores rojos)
4. **Verificar que la BD tiene datos**
5. **Copiar TODOS los logs de consola** y compartirlos

## 📊 Datos Mínimos Necesarios

Para que funcione, necesitas:

1. **Al menos 1 encuesta activa** con 2+ opciones
2. **Al menos 10 votos** con `countryIso3` válido
3. **Al menos 5 votos** con `subdivisionId` en formato jerárquico (ESP.1, ESP.2)
4. **Opciones con colores** asignados

Si falta algo de esto, el sistema no funcionará correctamente.
