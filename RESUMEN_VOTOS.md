# ✅ RESUMEN: Fuente Única de Votos

## 🎯 CONCLUSIÓN

**TODO está correcto.** Los votos se obtienen ÚNICAMENTE de la tabla `votes`. No hay campos redundantes en la base de datos.

## 📊 Estado de la Base de Datos

### ✅ Campos Redundantes ELIMINADOS (13 Oct 2025)

La migración `20251013205037_optimize_database_remove_redundant_fields` ya eliminó:

```diff
model Poll {
-  totalVotes  Int  ❌ ELIMINADO
-  totalViews  Int  ❌ ELIMINADO
}

model PollOption {
-  voteCount   Int     ❌ ELIMINADO
-  avatarUrl   String  ❌ ELIMINADO
}
```

### ✅ Única Fuente de Verdad

```prisma
model Vote {
  id              Int      @id @default(autoincrement())
  pollId          Int      // FK a Poll
  optionId        Int      // FK a PollOption
  userId          Int?     
  latitude        Float
  longitude       Float
  countryIso3     String
  subdivisionId   String?
  // ... más campos geo
  createdAt       DateTime
}
```

## 🔄 Flujo de Datos Actual

```
┌─────────────────────────────────────────────────────────┐
│                   TABLA votes                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │  id | pollId | optionId | userId | country ... │   │
│  └─────────────────────────────────────────────────┘   │
│                         ↓                                │
│              (única fuente de verdad)                    │
└─────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────────────┴─────────────────┐
        ↓                                     ↓
┌──────────────────┐              ┌──────────────────────┐
│   Backend APIs   │              │  Queries Directas    │
│  (usa _count)    │              │  (count/groupBy)     │
└──────────────────┘              └──────────────────────┘
        ↓                                     ↓
┌────────────────────────────────────────────────────────┐
│  Transformación: agrega campos virtuales              │
│  • voteCount = option._count.votes                    │
│  • totalVotes = poll._count.votes                     │
└────────────────────────────────────────────────────────┘
        ↓
┌────────────────────────────────────────────────────────┐
│  Frontend recibe JSON con campos calculados           │
│  (NO existen en BD, son calculados en tiempo real)    │
└────────────────────────────────────────────────────────┘
```

## 📍 Dónde se Usan los Votos

### Backend APIs (todos usan `_count.votes` o queries directas)

1. ✅ `/api/polls` - Lista encuestas
2. ✅ `/api/polls/[id]` - Detalle encuesta  
3. ✅ `/api/polls/[id]/vote` - Registrar voto (crea Vote)
4. ✅ `/api/polls/[id]/stats` - Estadísticas (vote.count, vote.groupBy)
5. ✅ `/api/polls/trending` - Trending (_count.votes)
6. ✅ `/api/polls/trending-by-region` - Trending regional (_count.votes)
7. ✅ `/api/polls/for-you` - Recomendaciones (_count.votes)
8. ✅ `/api/polls/[id]/votes-by-country` - vote.groupBy(['countryIso3'])
9. ✅ `/api/polls/[id]/votes-by-subdivisions` - vote.groupBy(['subdivisionId'])
10. ✅ `/api/votes/geo` - Query directa a votes

### Frontend

Recibe campos **virtuales** calculados en backend:
- `voteCount` (por opción)
- `totalVotes` (por encuesta)
- `votes` (en gráficos y mapas)

Estos campos **NO existen en BD**, son transformaciones temporales para compatibilidad.

## 🛠️ Scripts Disponibles

### Verificar que todo esté correcto:

```bash
npm run db:verify-votes
```

Este script verifica:
- ✅ No hay campos redundantes en schema
- ✅ `_count.votes` funciona correctamente
- ✅ Datos consistentes entre diferentes queries
- ✅ Queries geográficas funcionan

### Otros scripts útiles:

```bash
npm run db:studio      # Ver datos en Prisma Studio
npm run db:migrate     # Aplicar migraciones
npm run db:seed        # Poblar con datos de prueba
```

## 📈 Cómo Obtener Votos

### Votos totales de una encuesta:
```typescript
// Opción 1: Via _count
const poll = await prisma.poll.findUnique({
  where: { id: 123 },
  include: { _count: { select: { votes: true } } }
});
const total = poll._count.votes;

// Opción 2: Count directo
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
  where: { pollId: 123, subdivisionId: { not: null } },
  _count: true
});
```

## ⚠️ REGLAS A SEGUIR

### ❌ NUNCA hacer esto:
```typescript
// Estos campos NO existen en BD
poll.totalVotes      ❌
option.voteCount     ❌
option.avatarUrl     ❌
```

### ✅ SIEMPRE hacer esto:
```typescript
// Usar _count o queries directas
poll._count.votes           ✅
option._count.votes         ✅
prisma.vote.count(...)      ✅
prisma.vote.groupBy(...)    ✅
```

## 🎉 TODO CORRECTO

✅ Schema limpio (sin campos redundantes)  
✅ Migración aplicada (13 Oct 2025)  
✅ APIs usando _count correctamente  
✅ Frontend recibe datos transformados  
✅ Script de verificación disponible  
✅ Documentación completa  

**No hay nada que arreglar. El sistema ya está usando la tabla votes como única fuente de verdad.**

---

📚 **Documentos relacionados:**
- `VOTE_DATA_SOURCE.md` - Documentación técnica detallada
- `scripts/verify-vote-data-source.ts` - Script de verificación

🔧 **Para verificar:** 
```bash
npm run db:verify-votes
```
