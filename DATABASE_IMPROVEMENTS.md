# 📊 Mejoras a la Base de Datos

## 🔍 Problemas Identificados

### 1. **Campos Redundantes Eliminados**

❌ **ELIMINADO** - Campos que se auto-calculan:
- `Poll.totalVotes` → Se calcula con `SELECT COUNT(*) FROM votes WHERE pollId = X`
- `Poll.totalViews` → No se usa actualmente
- `PollOption.voteCount` → Se calcula con `SELECT COUNT(*) FROM votes WHERE optionId = X`
- `Comment.likesCount` → No hay tabla de likes
- `Hashtag.usageCount` → Se calcula con `SELECT COUNT(*) FROM poll_hashtags WHERE hashtagId = X`
- `FeaturedUser.citationsCount` → No está implementado
- `VoteHistory` → Tabla completa eliminada (no se usa)

❌ **ELIMINADO** - Campos que se obtienen de relaciones:
- `PollOption.avatarUrl` → Se obtiene desde `createdBy.avatarUrl` (relación con User)
- Nota: `Poll.imageUrl` se MANTIENE porque es la imagen de la encuesta, no el avatar del creador

### 2. **Índices Mejorados**

✅ **AGREGADOS** - Índices compuestos para queries comunes:
- `Vote: @@unique([pollId, userId])` → Un voto por usuario por encuesta
- `Poll: @@index([status, createdAt])` → Listar polls activos ordenados
- `PollOption: @@unique([pollId, optionKey])` → optionKey único por poll
- `PollOption: @@index([pollId, displayOrder])` → Ordenar opciones
- `Comment: @@index([pollId, createdAt])` → Listar comentarios ordenados
- `UserInterest: @@index([userId, score])` → Recomendaciones ordenadas

### 3. **Constraints Mejorados**

✅ **AGREGADOS**:
- `Vote: @@unique([pollId, userId])` → Garantiza un solo voto por encuesta
- `PollOption: @@unique([pollId, optionKey])` → Evita opciones duplicadas

## 📋 Cambios Detallados

### **Tabla Vote**
```diff
model Vote {
  id              Int      @id @default(autoincrement())
- pollId          Int      @map("poll_id")  // ← Mantener solo para índices/queries
  optionId        Int      @map("option_id")  // ← FUENTE DE VERDAD
  userId          Int?     @map("user_id")
  
+ @@unique([pollId, userId])  // ← NUEVO: Un voto por encuesta
  @@index([optionId])
  @@index([userId])
  @@index([pollId])
}
```

### **Tabla Poll**
```diff
model Poll {
- totalVotes  Int       @default(0) @map("total_votes")  // ❌ ELIMINADO
- totalViews  Int       @default(0) @map("total_views")  // ❌ ELIMINADO
  
+ @@index([status, createdAt])  // ✅ NUEVO: Query polls activos
+ @@index([type])                // ✅ NUEVO: Query por tipo
}
```

### **Tabla PollOption**
```diff
model PollOption {
- voteCount    Int      @default(0) @map("vote_count")  // ❌ ELIMINADO
- avatarUrl    String?  @map("avatar_url")              // ❌ ELIMINADO (se obtiene de createdBy)
  
+ @@unique([pollId, optionKey])        // ✅ NUEVO: Evita duplicados
+ @@index([pollId, displayOrder])      // ✅ NUEVO: Ordena opciones
}
```

### **Tabla Comment**
```diff
model Comment {
- likesCount      Int       @default(0) @map("likes_count")  // ❌ ELIMINADO
  
+ @@index([pollId, createdAt])  // ✅ NUEVO: Ordena comentarios
+ @@index([parentCommentId])    // ✅ NUEVO: Query respuestas
}
```

### **Tabla Hashtag**
```diff
model Hashtag {
- usageCount Int      @default(0) @map("usage_count")  // ❌ ELIMINADO
  
+ @@index([tag])  // ✅ NUEVO: Búsqueda por tag
}
```

### **Tabla FeaturedUser**
```diff
model FeaturedUser {
- citationsCount Int      @default(0) @map("citations_count")  // ❌ ELIMINADO
  
+ @@index([isActive, featuredOrder])  // ✅ NUEVO: Lista usuarios destacados
}
```

## 🔄 Cómo Calcular los Campos Ahora

### **totalVotes (Poll)**
```typescript
// Antes (redundante):
poll.totalVotes

// Ahora (auto-calculado):
const poll = await prisma.poll.findUnique({
  where: { id: pollId },
  include: {
    _count: {
      select: { votes: true }
    }
  }
});
const totalVotes = poll._count.votes;
```

### **voteCount (PollOption)**
```typescript
// Antes (redundante):
option.voteCount

// Ahora (auto-calculado):
const option = await prisma.pollOption.findUnique({
  where: { id: optionId },
  include: {
    _count: {
      select: { votes: true }
    }
  }
});
const voteCount = option._count.votes;
```

### **usageCount (Hashtag)**
```typescript
// Antes (redundante):
hashtag.usageCount

// Ahora (auto-calculado):
const hashtag = await prisma.hashtag.findUnique({
  where: { id: hashtagId },
  include: {
    _count: {
      select: { polls: true }
    }
  }
});
const usageCount = hashtag._count.polls;
```

### **avatarUrl (PollOption)**
```typescript
// Antes (redundante):
option.avatarUrl

// Ahora (desde relación):
const option = await prisma.pollOption.findUnique({
  where: { id: optionId },
  include: {
    createdBy: {
      select: { avatarUrl: true, displayName: true }
    }
  }
});
const avatarUrl = option.createdBy?.avatarUrl;
```

### **user.avatarUrl (Poll)**
```typescript
// Poll.imageUrl se mantiene (es la imagen de la encuesta)
// El avatar del creador se obtiene desde la relación:
const poll = await prisma.poll.findUnique({
  where: { id: pollId },
  include: {
    user: {
      select: { avatarUrl: true, displayName: true }
    }
  }
});
const creatorAvatar = poll.user.avatarUrl;
const pollImage = poll.imageUrl;  // ← Imagen de la encuesta
```

## 🚀 Pasos para Migrar

### **Opción 1: Migración Limpia (Recomendado para desarrollo)**
```bash
# 1. Respaldar datos actuales
npm run backup-db

# 2. Reemplazar schema
cp prisma/schema-optimized.prisma prisma/schema.prisma

# 3. Resetear y crear nueva base de datos
npx prisma migrate reset --force

# 4. Generar client
npx prisma generate

# 5. Re-seed datos (si tienes seed script)
npx prisma db seed
```

### **Opción 2: Migración con Datos (Producción)**
```bash
# 1. Respaldar
npm run backup-db

# 2. Reemplazar schema
cp prisma/schema-optimized.prisma prisma/schema.prisma

# 3. Crear migración
npx prisma migrate dev --name optimize_database

# 4. Generar client
npx prisma generate

# Nota: Los campos eliminados seguirán en la DB pero no se usarán
# Eventualmente pueden eliminarse con una migración manual
```

## ✅ Beneficios

1. **🎯 Única Fuente de Verdad**: Solo la tabla `Vote` guarda votos
2. **⚡ Queries Más Rápidas**: Índices compuestos optimizados
3. **🔒 Integridad de Datos**: Constraints únicos evitan duplicados
4. **📊 Siempre Exacto**: Los contadores se calculan en tiempo real
5. **🧹 Código Más Limpio**: No hay que mantener contadores manualmente
6. **🐛 Menos Bugs**: No puede haber desincronización de contadores

## 📝 Ejemplos de Queries Optimizadas

### **Listar polls con votos totales**
```typescript
const polls = await prisma.poll.findMany({
  where: { status: 'active' },
  include: {
    _count: {
      select: { votes: true }
    },
    options: {
      include: {
        _count: {
          select: { votes: true }
        }
      }
    }
  },
  orderBy: { createdAt: 'desc' }
});

// Transformar para API
const pollsWithCounts = polls.map(poll => ({
  ...poll,
  totalVotes: poll._count.votes,
  options: poll.options.map(opt => ({
    ...opt,
    voteCount: opt._count.votes
  }))
}));
```

### **Votos por región**
```typescript
const votesByRegion = await prisma.vote.groupBy({
  by: ['countryIso3', 'subdivisionId'],
  where: { pollId: 123 },
  _count: true,
  orderBy: { _count: { _all: 'desc' } }
});
```

### **Hashtags más usados**
```typescript
const trendingHashtags = await prisma.hashtag.findMany({
  include: {
    _count: {
      select: { polls: true }
    }
  },
  orderBy: {
    polls: { _count: 'desc' }
  },
  take: 10
});
```

## ⚠️ Cambios Necesarios en el Código

### **Actualizar endpoints API**
- ✅ `/api/polls` - Ya actualizado para usar `_count`
- ✅ `/api/polls/[id]/vote` - Ya NO actualiza contadores
- ⚠️ Revisar otros endpoints que usen campos eliminados

### **Actualizar frontend**
- ⚠️ Verificar que el frontend mapee correctamente `_count.votes` → `totalVotes`
- ⚠️ Verificar que el frontend mapee correctamente `option._count.votes` → `voteCount`

## 🎯 Conclusión

Esta reestructuración hace la base de datos:
- ✅ **Más simple**: Menos campos redundantes
- ✅ **Más confiable**: Una sola fuente de verdad
- ✅ **Más rápida**: Índices optimizados
- ✅ **Más mantenible**: Menos código de sincronización
