# 🐛 Debug: Colores de Subdivisiones no se Muestran Correctamente

## 🔍 Pasos de Diagnóstico

### 1. Verificar que la Base de Datos tiene Datos

```bash
# Ejecutar script de diagnóstico
npx tsx scripts/diagnose-subdivision-data.ts
```

**Deberías ver:**
```
📊 Total votes with subdivision_id: 850
🌍 Votes by country:
   ESP: 850 votes
🇪🇸 Spain subdivisions:
   ID 1: Andalucía (50 votes)
   ID 2: Aragón (50 votes)
   ...
```

**Si ves 0 votos:**
```bash
# Ejecutar seed
npx tsx scripts/seed-subdivision-votes.ts
```

---

### 2. Verificar que los Endpoints Funcionan

```bash
# Terminal 1: Iniciar servidor
npm run dev

# Terminal 2: Probar endpoints
curl http://localhost:5173/api/polls/1/votes-by-subdivisions?country=ESP
```

**Respuesta esperada:**
```json
{
  "data": {
    "1": { "option1": 50, "option2": 75, "option3": 25 },
    "2": { "option1": 30, "option2": 40, "option3": 20 },
    ...
  }
}
```

**Si ves `{ "data": {} }`:**
- La encuesta no tiene votos con `subdivision_id`
- Ejecutar seed: `npx tsx scripts/seed-subdivision-votes.ts`

---

### 3. Verificar Logs en la Consola del Navegador

Abre la consola del navegador (F12) y busca estos logs:

#### ✅ Logs Correctos:

```
[GlobeGL] 🔒 MODO EXCLUSIVO: ENCUESTA ESPECÍFICA
[GlobeGL]   Poll ID: 1
[Click] 🌍 Country clicked from world: ESP Spain
[Click] 🔒 Mode: ENCUESTA 1
[CountryView] 🎨 Calculating subdivision colors with chart: 3 segments
[CountryView] Active poll: 1
[CountryView] 📡 Loading REAL subdivision colors from database...
[Colors] 📡 Loading real subdivision votes from database for poll 1 country ESP
[Colors] ✅ Loaded real subdivision votes: { "1": {...}, "2": {...}, ... }
[Colors] Subdivision 1 → option2 ( 75 votes) → #4ecdc4
[Colors] Subdivision 2 → option2 ( 40 votes) → #4ecdc4
[Colors] ✅ Assigned real colors to 17 subdivisions from database
[CountryView] 🔍 Mapping colors to polygons...
[CountryView] Available colors: ["1", "2", "3", "4", "5", ...]
[CountryView]   ✓ Polygon 1 → #4ecdc4
[CountryView]   ✓ Polygon 2 → #4ecdc4
[CountryView]   ✓ Polygon 9 → #ff6b6b
[CountryView] 📊 Colors applied: 17 / 17 polygons
[CountryView] 🎨 Applying colors from database...
[CountryView] ✅ Colors applied from 17 subdivisions
```

#### ❌ Logs de Error:

**Error 1: No hay encuesta activa**
```
[CountryView] Active poll: none
[CountryView] No database colors, trying vote markers...
```
**Solución**: Asegúrate de abrir una encuesta con "Ver en globo"

**Error 2: API retorna error**
```
[Colors] ⚠️ API returned error: 404
```
**Solución**: Verificar que el endpoint existe y el servidor está corriendo

**Error 3: No hay datos en BD**
```
[Colors] ✅ Loaded real subdivision votes: {}
[CountryView] No database colors, trying vote markers...
```
**Solución**: Ejecutar seed: `npx tsx scripts/seed-subdivision-votes.ts`

**Error 4: IDs no coinciden**
```
[CountryView] Available colors: ["1", "2", "3", ...]
[CountryView]   ✗ Polygon ESP.1_1 → NO COLOR FOUND
[CountryView]   ✗ Polygon ESP.2_1 → NO COLOR FOUND
[CountryView] 📊 Colors applied: 0 / 17 polygons
```
**Solución**: Los IDs de los polígonos no coinciden con los de la BD. Ver sección "Mapeo de IDs"

---

### 4. Verificar Mapeo de IDs

Los IDs de los polígonos TopoJSON deben coincidir con los `subdivision_id` en la BD.

#### Verificar IDs de Polígonos:

```javascript
// En consola del navegador, después de hacer click en España:
const polygons = globe.polygonsData();
polygons.forEach(p => {
  const id = p.properties.ID_1 || p.properties.id_1;
  });
```

**Deberías ver:**
```
Polygon ID: 1 Name: Andalucía
Polygon ID: 2 Name: Aragón
Polygon ID: 3 Name: Asturias
...
```

#### Verificar IDs en BD:

```bash
npx prisma studio
```

1. Ir a tabla `votes`
2. Filtrar por `country_iso3 = "ESP"`
3. Ver columna `subdivision_id`
4. Verificar que los IDs sean: "1", "2", "3", etc. (como strings)

**Si los IDs no coinciden:**

Opción A: Actualizar los IDs en la BD
```sql
-- Ejemplo: si los IDs en polígonos son "ESP.1_1" pero en BD son "1"
UPDATE votes SET subdivision_id = '1' WHERE subdivision_id = 'ESP.1_1';
```

Opción B: Normalizar IDs en el código
```typescript
// En computeSubdivisionColorsFromDatabase
const normalizedId = subdivisionId.split('.').pop()?.split('_')[0];
byId[normalizedId] = colorMap[winningOption];
```

---

### 5. Verificar que `_forcedColor` se Aplica

```javascript
// En consola del navegador:
const polygons = globe.polygonsData();
polygons.forEach(p => {
  if (p.properties._isChild) {
    console.log(
      'Subdivision:', p.properties.NAME_1,
      'ID:', p.properties.ID_1,
      'Color:', p.properties._forcedColor
    );
  }
});
```

**Deberías ver:**
```
Subdivision: Andalucía ID: 1 Color: #4ecdc4
Subdivision: Aragón ID: 2 Color: #4ecdc4
Subdivision: Cataluña ID: 9 Color: #ff6b6b
```

**Si `_forcedColor` es undefined:**
- Los IDs no coinciden
- Los colores no se asignaron correctamente
- Ver logs de "[CountryView] 🔍 Mapping colors to polygons..."

---

### 6. Verificar Refresh de Colores

El refresh debe ocurrir DESPUÉS de asignar `_forcedColor`:

```
[CountryView] 📊 Colors applied: 17 / 17 polygons
[CountryView] 🎨 Applying colors from database...  ← AQUÍ
[CountryView] ✅ Colors applied from 17 subdivisions
```

Si el refresh ocurre ANTES, los colores no se aplicarán.

---

## 🔧 Soluciones Rápidas

### Problema: Colores siguen siendo aleatorios

**Causa**: Sistema usa fallback proporcional

**Solución**:
1. Verificar que `activePoll` existe
2. Verificar que el endpoint retorna datos
3. Verificar que los IDs coinciden

### Problema: Colores cambian después del zoom

**Causa**: Múltiples refreshes compitiendo

**Solución**: Ya está corregido en el código. Si persiste:
1. Buscar otros `refreshPolyColors()` en el código
2. Eliminar refreshes duplicados
3. Mantener solo el refresh en `renderCountryView`

### Problema: Algunas subdivisiones tienen color, otras no

**Causa**: Algunas subdivisiones no tienen votos en BD

**Solución**:
```bash
# Verificar qué subdivisiones tienen votos
npx tsx scripts/diagnose-subdivision-data.ts
```

Si faltan subdivisiones, el seed solo crea votos para las 17 comunidades autónomas de España. Para otros países, necesitas:
1. Mapear las subdivisiones del país
2. Actualizar el script de seed
3. Ejecutar el seed

---

## 📊 Checklist de Verificación

- [ ] BD tiene votos con `subdivision_id` poblado
- [ ] Endpoint `/api/polls/{id}/votes-by-subdivisions` funciona
- [ ] Consola muestra "Loading REAL subdivision votes from database"
- [ ] Consola muestra "Loaded real subdivision votes: { ... }"
- [ ] Consola muestra "Assigned real colors to X subdivisions"
- [ ] Consola muestra "Colors applied: X / X polygons" (X > 0)
- [ ] IDs de polígonos coinciden con IDs de BD
- [ ] `_forcedColor` está definido en los polígonos
- [ ] Refresh ocurre DESPUÉS de asignar colores
- [ ] No hay logs de "No database colors"
- [ ] No hay logs de "using proportional distribution"

---

## 🆘 Si Nada Funciona

1. **Limpiar y reiniciar todo:**
```bash
# Limpiar BD
rm prisma/dev.db

# Aplicar migración
npx prisma migrate dev

# Ejecutar seed
npx tsx scripts/seed-subdivision-votes.ts

# Reiniciar servidor
npm run dev
```

2. **Verificar paso a paso:**
```bash
# 1. Diagnóstico
npx tsx scripts/diagnose-subdivision-data.ts

# 2. Probar endpoint
curl http://localhost:5173/api/polls/1/votes-by-subdivisions?country=ESP

# 3. Abrir aplicación y ver consola
```

3. **Contactar con logs:**
- Copiar todos los logs de la consola
- Copiar resultado del diagnóstico
- Copiar respuesta del endpoint

---

**Última actualización**: 2025-10-05
