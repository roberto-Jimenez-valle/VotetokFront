# 📊 Fuente de Datos de Votos - Única Fuente de Verdad

## ✅ PRINCIPIO FUNDAMENTAL

**TODA la información de votos se obtiene ÚNICAMENTE de la tabla `votes`**

## 🗄️ Schema de Base de Datos

### ❌ Campos Redundantes ELIMINADOS

Los siguientes campos NO existen en el schema (correctamente):
- ❌ `Poll.totalVotes` - ELIMINADO
- ❌ `Poll.totalViews` - ELIMINADO  
- ❌ `PollOption.voteCount` - ELIMINADO
- ❌ `PollOption.avatarUrl` - ELIMINADO

### ✅ Única Fuente de Verdad

```prisma
model Vote {
  id              Int      @id @default(autoincrement())
  pollId          Int      // FK a Poll
  optionId        Int      // FK a PollOption
  userId          Int?     // Usuario que votó (nullable para anónimos)
  latitude        Float
  longitude       Float
  countryIso3     String
  countryName     String?
  subdivisionId   String?
  subdivisionName String?
  cityName        String?
  ipAddress       String?
  userAgent       String?
  createdAt       DateTime
}
```

## 🔄 Flujo de Datos

### Backend (APIs)

Todas las APIs siguen este patrón:

```typescript
// 1. Query con _count
const polls = await prisma.poll.findMany({
  include: {
    options: {
      include: {
        _count: {
          select: { votes: true }  // ← Cuenta votos desde tabla votes
        }
      }
    },
    _count: {
      select: { votes: true }  // ← Cuenta votos totales de la encuesta
    }
  }
});

// 2. Transformación para frontend
const transformed = polls.map(poll => ({
  ...poll,
  totalVotes: poll._count.votes,  // ← Campo virtual calculado
  options: poll.options.map(option => ({
    ...option,
    voteCount: option._count.votes  // ← Campo virtual calculado
  }))
}));
```

### Frontend

El frontend recibe campos **virtuales** calculados desde votes:
- `totalVotes` - suma de todos los votos de la encuesta
- `voteCount` - votos de una opción específica

Estos campos NO existen en BD, son calculados en tiempo real.

## 📍 Archivos que CALCULAN desde votes

### APIs que usan `_count.votes`:

1. **`/api/polls` (GET)** - Lista de encuestas
2. **`/api/polls` (POST)** - Crear encuesta (sin votos iniciales)
3. **`/api/polls/[id]` (GET)** - Detalle de encuesta
4. **`/api/polls/[id]/options` (POST)** - Añadir opción colaborativa
5. **`/api/polls/[id]/stats` (GET)** - Estadísticas (usa `prisma.vote.count()` y `vote.groupBy()`)
6. **`/api/polls/[id]/vote` (POST)** - Registrar voto (crea Vote directamente)
7. **`/api/polls/trending` (GET)** - Trending (usa `_count.votes`)
8. **`/api/polls/trending-by-region` (GET)** - Trending regional (usa `_count.votes`)
9. **`/api/polls/for-you` (GET)** - Recomendaciones (usa `_count.votes`)

### Queries Geográficas (directas a tabla votes):

10. **`/api/polls/[id]/votes-by-country`** - `vote.groupBy(['countryIso3'])`
11. **`/api/polls/[id]/votes-by-subdivisions`** - `vote.groupBy(['subdivisionId'])`
12. **`/api/polls/[id]/votes-by-subsubdivisions`** - Similar groupBy
13. **`/api/votes/geo`** - Query directa a votes con filtros geo

## 🎯 Queries de Ejemplo

### Votos totales de una encuesta:
```typescript
const total = await prisma.vote.count({
  where: { pollId: 123 }
});
```

### Votos por opción:
```typescript
const byOption = await prisma.vote.groupBy({
  by: ['optionId'],
  where: { pollId: 123 },
  _count: true
});
```

### Votos por país:
```typescript
const byCountry = await prisma.vote.groupBy({
  by: ['countryIso3'],
  where: { pollId: 123 },
  _count: true
});
```

### Votos por subdivisión:
```typescript
const bySubdivision = await prisma.vote.groupBy({
  by: ['subdivisionId'],
  where: { pollId: 123 },
  _count: true
});
```

## ⚠️ NUNCA Hacer Esto

```typescript
❌ poll.totalVotes  // Este campo NO existe en BD
❌ option.voteCount // Este campo NO existe en BD

✅ poll._count.votes     // Correcto
✅ option._count.votes   // Correcto
```

## 🔍 Cómo Verificar

Para verificar que un endpoint está usando la fuente correcta:

1. Busca `_count: { select: { votes: true } }` en el query
2. Verifica que se transforme a `voteCount` o `totalVotes` antes de enviar al frontend
3. Confirma que NO se lean campos `voteCount` o `totalVotes` directamente del modelo Prisma

## ✅ Estado Actual

**Todos los endpoints están correctamente configurados para leer ÚNICAMENTE desde la tabla votes.**

La única fuente de verdad es:
- Tabla `votes` en la base de datos
- Accedida vía `_count.votes` o queries directas (count, groupBy, findMany)
- Nunca desde campos redundantes (que ya no existen)
