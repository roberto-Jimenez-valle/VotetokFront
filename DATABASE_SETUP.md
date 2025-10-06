# 🗄️ Configuración de Base de Datos para Sistema de Colores Reales

Este documento explica cómo configurar la base de datos para que el globo 3D muestre colores basados en datos reales de votos.

---

## 📋 Cambios Realizados

### 1. **Schema de Base de Datos**

Se agregó el campo `subdivisionId` al modelo `Vote`:

```prisma
model Vote {
  // ... otros campos
  subdivisionId   String?  @map("subdivision_id")   // ID_1 del polígono (ej: "1", "2", "3")
  // ... otros campos
  
  @@index([countryIso3, subdivisionId])  // Índice para consultas rápidas
}
```

### 2. **Endpoints de API Creados**

#### `/api/polls/{id}/votes-by-country`
Retorna votos agrupados por país:
```json
{
  "data": {
    "ESP": { "option1": 150, "option2": 200, "option3": 100 },
    "FRA": { "option1": 300, "option2": 250, "option3": 200 }
  }
}
```

#### `/api/polls/{id}/votes-by-subdivisions?country={iso}`
Retorna votos agrupados por subdivisión:
```json
{
  "data": {
    "1": { "option1": 50, "option2": 75, "option3": 25 },
    "2": { "option1": 30, "option2": 40, "option3": 20 }
  }
}
```

#### `/api/users/trending?limit=10`
Retorna usuarios trending independientes:
```json
{
  "data": [
    {
      "id": 1,
      "username": "user1",
      "displayName": "Usuario 1",
      "avatarUrl": "https://...",
      "verified": true
    }
  ]
}
```

---

## 🚀 Pasos para Configurar

### Paso 1: Aplicar Migración de Base de Datos

```bash
# Generar migración
npx prisma migrate dev --name add_subdivision_id

# O aplicar la migración SQL directamente
npx prisma db push
```

### Paso 2: Generar Cliente de Prisma

```bash
npx prisma generate
```

### Paso 3: Poblar con Datos de Prueba

```bash
# Ejecutar script de seed
npx tsx scripts/seed-subdivision-votes.ts
```

Este script:
- ✅ Crea votos de prueba para todas las subdivisiones de España
- ✅ Asigna `subdivisionId` correcto (1-17 para las comunidades autónomas)
- ✅ Genera coordenadas lat/lng realistas
- ✅ Distribuye votos de forma realista entre opciones
- ✅ Actualiza contadores de votos

### Paso 4: Verificar Datos

```bash
# Abrir Prisma Studio para ver los datos
npx prisma studio
```

Verifica que:
1. Los votos tienen `subdivision_id` poblado
2. Los votos tienen `country_iso3 = "ESP"`
3. Los `subdivision_id` van del "1" al "17"

---

## 📊 Estructura de Datos Requerida

### Para que el sistema funcione correctamente, cada voto debe tener:

```typescript
{
  pollId: number,           // ID de la encuesta
  optionId: number,         // ID de la opción votada
  latitude: number,         // Coordenada geográfica
  longitude: number,        // Coordenada geográfica
  countryIso3: string,      // Código ISO del país (ej: "ESP", "FRA", "USA")
  subdivisionId: string,    // ID de la subdivisión (debe coincidir con ID_1 del polígono)
  subdivisionName: string,  // Nombre de la subdivisión (ej: "Andalucía")
  // ... otros campos opcionales
}
```

### Mapeo de Subdivisiones de España

| ID | Nombre |
|----|--------|
| 1  | Andalucía |
| 2  | Aragón |
| 3  | Asturias |
| 4  | Baleares |
| 5  | Canarias |
| 6  | Cantabria |
| 7  | Castilla y León |
| 8  | Castilla-La Mancha |
| 9  | Cataluña |
| 10 | Comunidad Valenciana |
| 11 | Extremadura |
| 12 | Galicia |
| 13 | Madrid |
| 14 | Murcia |
| 15 | Navarra |
| 16 | País Vasco |
| 17 | La Rioja |

**IMPORTANTE**: Estos IDs deben coincidir con los `ID_1` de los polígonos TopoJSON en `/static/geojson/ESP/ESP.topojson`

---

## 🔍 Cómo Funciona el Sistema

### 1. Usuario Abre una Encuesta

```
Usuario click "Ver en globo" en encuesta #123
  ↓
Frontend: activePoll = { id: 123, ... }
  ↓
Modo Exclusivo Activado
```

### 2. Usuario Click en España

```
Click en España
  ↓
Fetch: /api/polls/123/votes-by-country
  ↓
Response: { "ESP": { "option1": 150, "option2": 200, ... } }
  ↓
España se pinta del color de option2 (ganadora)
```

### 3. Usuario Click en Andalucía

```
Click en Andalucía
  ↓
Fetch: /api/polls/123/votes-by-subdivisions?country=ESP
  ↓
Response: {
  "1": { "option1": 50, "option2": 75, "option3": 25 },  // Andalucía
  "2": { "option1": 30, "option2": 40, "option3": 20 },  // Aragón
  ...
}
  ↓
Sistema calcula:
  - Andalucía (ID=1): option2 gana con 75 votos → Color AZUL
  - Aragón (ID=2): option2 gana con 40 votos → Color AZUL
  - etc.
  ↓
Cada subdivisión se pinta del color de su opción ganadora
```

---

## 🧪 Testing

### Verificar que los Endpoints Funcionan

```bash
# 1. Votos por país
curl http://localhost:5173/api/polls/1/votes-by-country

# 2. Votos por subdivisión
curl http://localhost:5173/api/polls/1/votes-by-subdivisions?country=ESP

# 3. Usuarios trending
curl http://localhost:5173/api/users/trending?limit=10
```

### Verificar en el Globo

1. Abre la aplicación
2. Abre una encuesta con "Ver en globo"
3. Click en España
4. Verifica en la consola:
   ```
   [Colors] 📡 Loading real subdivision votes from database for poll 1 country ESP
   [Colors] ✅ Loaded real subdivision votes: { "1": {...}, "2": {...}, ... }
   [Colors] Subdivision 1 → option2 ( 75 votes) → #4ecdc4
   [Colors] ✅ Assigned real colors to 17 subdivisions from database
   ```
5. Las subdivisiones deben pintarse de colores diferentes según los votos reales
6. **NO debe haber parpadeos ni cambios de color**

---

## 🐛 Troubleshooting

### Problema: "No database colors, trying vote markers..."

**Causa**: El endpoint no retorna datos o la encuesta no tiene votos con `subdivisionId`

**Solución**:
```bash
# Verificar que hay votos con subdivision_id
npx prisma studio
# Ir a tabla "votes" y verificar que subdivision_id no es null

# Si no hay datos, ejecutar seed
npx tsx scripts/seed-subdivision-votes.ts
```

### Problema: "API returned error: 404"

**Causa**: El endpoint no existe o la ruta está mal

**Solución**:
```bash
# Verificar que los archivos existen
ls src/routes/api/polls/[id]/votes-by-subdivisions/+server.ts
ls src/routes/api/polls/[id]/votes-by-country/+server.ts

# Reiniciar el servidor
npm run dev
```

### Problema: Colores siguen siendo proporcionales/aleatorios

**Causa**: El sistema está usando fallback porque no encuentra datos reales

**Solución**:
1. Abrir consola del navegador
2. Buscar logs: `[Colors] 📡 Loading real subdivision votes`
3. Si dice "No active poll", verificar que `activePoll` esté definido
4. Si dice "API returned error", verificar el endpoint
5. Si dice "No database colors", ejecutar seed

---

## 📝 Notas Importantes

1. **IDs de Subdivisión**: Deben coincidir exactamente con los `ID_1` de los polígonos TopoJSON
2. **Índices de BD**: El índice compuesto `(country_iso3, subdivision_id)` es crítico para performance
3. **Modo Exclusivo**: El sistema solo carga datos reales si hay una encuesta activa (`activePoll`)
4. **Fallbacks**: Si no hay datos reales, el sistema usa distribución proporcional temporalmente
5. **Logging**: Todos los pasos están logueados en consola para debugging

---

## ✅ Checklist de Verificación

- [ ] Migración aplicada (`subdivision_id` existe en tabla `votes`)
- [ ] Cliente de Prisma generado
- [ ] Script de seed ejecutado
- [ ] Datos verificados en Prisma Studio
- [ ] Endpoints responden correctamente
- [ ] Globo muestra colores basados en datos reales
- [ ] No hay parpadeos ni cambios de color
- [ ] Logging muestra "Loading REAL subdivision votes"
- [ ] Cada subdivisión tiene su color según votos reales

---

**Última actualización**: 2025-10-05
**Versión**: 1.0
