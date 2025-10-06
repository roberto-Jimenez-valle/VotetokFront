# Migración a IDs Jerárquicos

## 📋 Descripción

Este documento describe la migración del sistema de IDs de subdivisiones a un formato jerárquico que soporta múltiples niveles de subdivisiones.

## 🎯 Objetivo

Permitir que el sistema coloree correctamente los polígonos en los 3 niveles de navegación:
- **Nivel 1 (Mundo)**: Países (ESP, FRA, USA)
- **Nivel 2 (País)**: Subdivisiones nivel 1 (ESP.1 = Andalucía, ESP.2 = Aragón)
- **Nivel 3 (Subdivisión)**: Subdivisiones nivel 2 (ESP.1.1 = Sevilla, ESP.1.2 = Jaén)

## 🔄 Cambios Implementados

### 1. Estructura de IDs

**ANTES:**
```
subdivisionId: "1"           ← Solo número
subdivisionId2: null         ← No existe en BD
```

**DESPUÉS:**
```
subdivisionId: "ESP.1"       ← Nivel 1 (Andalucía)
subdivisionId: "ESP.1.1"     ← Nivel 2 (Sevilla)
subdivisionId: "ESP.1.2"     ← Nivel 2 (Jaén)
```

### 2. Ventajas del Nuevo Sistema

✅ **No requiere cambios en el schema** - Usa el campo existente `subdivisionId`
✅ **Soporta jerarquía ilimitada** - Puede extenderse a ESP.1.1.1, etc.
✅ **Consultas eficientes** - Usa `LIKE 'ESP.1.%'` para buscar sub-subdivisiones
✅ **Agregación automática** - El frontend puede extraer niveles fácilmente
✅ **Backward compatible** - Los IDs antiguos siguen funcionando

## 🚀 Scripts de Migración

### Script 1: Migración Básica
Convierte IDs simples a formato jerárquico nivel 1.

```bash
npx tsx scripts/migrate-to-hierarchical-ids.ts
```

**Qué hace:**
- Convierte `"1"` → `"ESP.1"`
- Convierte `"2"` → `"ESP.2"`
- Mantiene IDs ya migrados

**Ejemplo de salida:**
```
✅ Voto 1: "1" → "ESP.1" (Andalucía)
✅ Voto 2: "2" → "ESP.2" (Aragón)
📊 Migrados: 150 votos
```

### Script 2: Agregar Nivel 3
Agrega IDs de nivel 2 (sub-subdivisiones) basándose en ciudades.

```bash
npx tsx scripts/add-level3-subdivision-ids.ts
```

**Qué hace:**
- Convierte `"ESP.1"` → `"ESP.1.1"` (si cityName = "Sevilla")
- Convierte `"ESP.1"` → `"ESP.1.2"` (si cityName = "Jaén")
- Usa mapeo de ciudades predefinido

**Ejemplo de salida:**
```
✅ Voto 1: ESP.1 → ESP.1.1 (Sevilla)
✅ Voto 2: ESP.1 → ESP.1.5 (Jaén)
📊 Actualizados: 75 votos con IDs de nivel 3
```

### Script 3: Actualización de Ubicaciones (Ya existe)
Asigna subdivisiones y ciudades a votos existentes.

```bash
npx tsx scripts/update-vote-locations.ts
```

## 📊 Orden de Ejecución Recomendado

```bash
# 1. Actualizar ubicaciones (si los votos no tienen subdivisionId)
npx tsx scripts/update-vote-locations.ts

# 2. Migrar a IDs jerárquicos nivel 1
npx tsx scripts/migrate-to-hierarchical-ids.ts

# 3. Agregar IDs de nivel 2 (sub-subdivisiones)
npx tsx scripts/add-level3-subdivision-ids.ts
```

## 🔧 Cambios en el Backend

### Endpoint: `/api/polls/{id}/votes-by-subsubdivisions`

**ANTES:**
```typescript
// Buscaba en campo subdivisionId2 (no existe)
WHERE subdivisionId2 IS NOT NULL
```

**DESPUÉS:**
```typescript
// Usa SQL LIKE para buscar IDs jerárquicos
WHERE subdivision_id LIKE 'ESP.1.%'
```

**Ejemplo de uso:**
```
GET /api/polls/1/votes-by-subsubdivisions?country=ESP&subdivision=1

Response:
{
  "data": {
    "ESP.1.1": { "Opción A": 50, "Opción B": 30 },  // Sevilla
    "ESP.1.2": { "Opción A": 20, "Opción B": 40 }   // Jaén
  }
}
```

## 🎨 Cambios en el Frontend

### Función: `aggregateVotesByLevel()`

Ahora puede extraer cualquier nivel de la jerarquía:

```typescript
// Datos de entrada
const rawVotes = {
  "ESP.1.1": { "A": 50, "B": 30 },
  "ESP.1.2": { "A": 20, "B": 40 },
  "ESP.2.1": { "A": 60, "B": 25 }
};

// Agregar a nivel 1
aggregateVotesByLevel(rawVotes, 1)
// → { "ESP.1": { "A": 70, "B": 70 }, "ESP.2": { "A": 60, "B": 25 } }

// Agregar a nivel 2
aggregateVotesByLevel(rawVotes, 2)
// → { "ESP.1.1": { "A": 50, "B": 30 }, "ESP.1.2": { "A": 20, "B": 40 }, ... }
```

## 📈 Consultas SQL Útiles

### Ver distribución de niveles
```sql
SELECT 
  CASE 
    WHEN subdivision_id LIKE '%.%.%' THEN 'Nivel 2'
    WHEN subdivision_id LIKE '%.%' THEN 'Nivel 1'
    ELSE 'Sin formato'
  END as nivel,
  COUNT(*) as votos
FROM votes
WHERE subdivision_id IS NOT NULL
GROUP BY nivel;
```

### Ver votos por subdivisión nivel 1
```sql
SELECT 
  SUBSTR(subdivision_id, 1, INSTR(subdivision_id || '.', '.', INSTR(subdivision_id, '.') + 1) - 1) as nivel1,
  COUNT(*) as votos
FROM votes
WHERE subdivision_id LIKE '%.%'
GROUP BY nivel1
ORDER BY votos DESC;
```

### Ver votos por subdivisión nivel 2
```sql
SELECT 
  subdivision_id,
  subdivision_name,
  city_name,
  COUNT(*) as votos
FROM votes
WHERE subdivision_id LIKE '%.%.%'
GROUP BY subdivision_id
ORDER BY votos DESC
LIMIT 20;
```

## 🧪 Verificación Post-Migración

### 1. Verificar formato de IDs
```bash
npx prisma studio
```
Abre la tabla `votes` y verifica que `subdivisionId` tenga formato:
- ✅ `ESP.1` (nivel 1)
- ✅ `ESP.1.1` (nivel 2)
- ❌ `1` (formato antiguo)

### 2. Probar endpoints
```bash
# Nivel 1 (subdivisiones de España)
curl http://localhost:5173/api/polls/1/votes-by-subdivisions?country=ESP

# Nivel 2 (sub-subdivisiones de Andalucía)
curl http://localhost:5173/api/polls/1/votes-by-subsubdivisions?country=ESP&subdivision=1
```

### 3. Probar en el globo 3D
1. Abre una encuesta
2. Haz clic en España → Deberías ver Andalucía, Cataluña, etc. coloreadas
3. Haz clic en Andalucía → Deberías ver Sevilla, Jaén, etc. coloreadas ✅

## 🐛 Troubleshooting

### Problema: Los polígonos de nivel 3 siguen en gris

**Causa**: No hay votos con IDs de nivel 2 en la BD

**Solución**:
```bash
npx tsx scripts/add-level3-subdivision-ids.ts
```

### Problema: El endpoint devuelve datos vacíos

**Causa**: Los IDs en la BD no coinciden con el patrón de búsqueda

**Verificar**:
```sql
SELECT DISTINCT subdivision_id 
FROM votes 
WHERE country_iso3 = 'ESP' 
  AND subdivision_id LIKE 'ESP.1.%'
LIMIT 10;
```

**Solución**: Ejecutar script de migración

### Problema: Error en SQL LIKE

**Causa**: Prisma puede tener problemas con `$queryRaw`

**Solución alternativa**: Usar `findMany` con `startsWith`:
```typescript
const votes = await prisma.vote.findMany({
  where: {
    subdivisionId: { startsWith: `${normalizedSubdivisionId}.` }
  }
});
```

## 📚 Referencias

- **Diagrama ER**: `DATABASE_ER_DIAGRAM.md`
- **Sistema de coloreado**: `SISTEMA_COLOREADO_JERARQUICO.md`
- **Lógica de aplicación**: `LOGICA_APLICACION.md`

## ✅ Checklist de Migración

- [ ] Ejecutar `migrate-to-hierarchical-ids.ts`
- [ ] Ejecutar `add-level3-subdivision-ids.ts`
- [ ] Verificar IDs en Prisma Studio
- [ ] Probar endpoint `votes-by-subdivisions`
- [ ] Probar endpoint `votes-by-subsubdivisions`
- [ ] Probar navegación en globo 3D nivel 2
- [ ] Probar navegación en globo 3D nivel 3
- [ ] Verificar colores en todos los niveles
- [ ] Revisar logs de consola para errores
- [ ] Actualizar documentación si es necesario

## 🎉 Resultado Esperado

Después de la migración:

✅ **Nivel 1 (Mundo)**: Países coloreados según opción ganadora
✅ **Nivel 2 (País)**: Subdivisiones (Andalucía, Cataluña) coloreadas según opción ganadora
✅ **Nivel 3 (Subdivisión)**: Sub-subdivisiones (Sevilla, Jaén) coloreadas según opción ganadora

**Sin necesidad de cambios en el schema de la base de datos** 🚀
