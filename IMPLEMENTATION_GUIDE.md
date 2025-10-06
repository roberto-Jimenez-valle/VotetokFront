# 🚀 Guía de Implementación - Base de Datos VoteTok

## 📋 Pasos para Implementar la Base de Datos

### **Paso 1: Instalar Dependencias**

```bash
# Instalar Prisma y dependencias
npm install -D prisma tsx
npm install @prisma/client

# Inicializar Prisma (ya está hecho)
# npx prisma init --datasource-provider sqlite
```

### **Paso 2: Configurar package.json**

Agregar el script de seed a `package.json`:

```json
{
  "scripts": {
    "db:migrate": "npx prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "npx prisma studio",
    "db:reset": "npx prisma migrate reset",
    "db:generate": "npx prisma generate"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

### **Paso 3: Crear la Base de Datos**

```bash
# Generar la migración inicial
npx prisma migrate dev --name init

# Esto creará:
# - prisma/dev.db (base de datos SQLite)
# - prisma/migrations/ (carpeta con migraciones)
# - node_modules/.prisma/client (cliente generado)
```

### **Paso 4: Ejecutar el Seed**

```bash
# Poblar la base de datos con datos de ejemplo
npm run db:seed
```

Esto creará:
- ✅ 5 usuarios
- ✅ 3 usuarios destacados
- ✅ 3 encuestas
- ✅ 15 votos geolocalizados
- ✅ 4 hashtags
- ✅ 120 registros de historial

### **Paso 5: Verificar la Base de Datos**

```bash
# Abrir Prisma Studio (interfaz visual)
npm run db:studio
```

Navega a `http://localhost:5555` para ver y editar los datos.

---

## 🔄 Migración del Frontend

### **Archivos Creados:**

1. ✅ `prisma/schema.prisma` - Esquema de la base de datos
2. ✅ `prisma/seed.ts` - Datos iniciales
3. ✅ `src/lib/server/prisma.ts` - Cliente Prisma singleton
4. ✅ `src/lib/services/polls.ts` - Servicio de encuestas
5. ✅ `src/lib/services/users.ts` - Servicio de usuarios

### **Próximos Pasos:**

#### **1. Crear API Endpoints**

**Ejemplo: `/api/polls/+server.ts`**

```typescript
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const page = Number(url.searchParams.get('page') || '1');
  const limit = Number(url.searchParams.get('limit') || '20');
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search');

  const where = {
    status: 'active',
    ...(category && { category }),
    ...(search && {
      OR: [
        { title: { contains: search } },
        { description: { contains: search } },
      ],
    }),
  };

  const [polls, total] = await Promise.all([
    prisma.poll.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            verified: true,
          },
        },
        options: {
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: {
            votes: true,
            comments: true,
            interactions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.poll.count({ where }),
  ]);

  return json({
    data: polls,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
};
```

**Crear estos endpoints:**

- [ ] `src/routes/api/polls/+server.ts` - GET lista de encuestas
- [ ] `src/routes/api/polls/[id]/+server.ts` - GET/PUT/DELETE encuesta
- [ ] `src/routes/api/polls/[id]/vote/+server.ts` - POST votar
- [ ] `src/routes/api/polls/[id]/stats/+server.ts` - GET estadísticas
- [ ] `src/routes/api/polls/[id]/history/+server.ts` - GET historial
- [ ] `src/routes/api/users/+server.ts` - GET usuarios
- [ ] `src/routes/api/users/[id]/+server.ts` - GET/PUT usuario
- [ ] `src/routes/api/featured/+server.ts` - GET usuarios destacados
- [ ] `src/routes/api/votes/geo/+server.ts` - GET votos geolocalizados

#### **2. Actualizar Componentes**

**Ejemplo: Actualizar `header.svelte`**

```typescript
// ANTES (datos mock)
const users = [
  { name: 'Emma', avatar: 'https://randomuser.me/api/portraits/women/10.jpg' },
  // ...
];

// DESPUÉS (datos reales)
import { getFeaturedUsers } from '$lib/services/users';

let users = $state<FeaturedUser[]>([]);

onMount(async () => {
  try {
    users = await getFeaturedUsers();
  } catch (error) {
    console.error('Error loading featured users:', error);
  }
});
```

**Componentes a actualizar:**

- [ ] `src/lib/header.svelte` - Cargar usuarios destacados desde DB
- [ ] `src/lib/globe/BottomSheet.svelte` - Eliminar Math.random(), usar datos reales
- [ ] `src/lib/GlobeGL.svelte` - Cargar votos desde API
- [ ] `src/routes/+page.svelte` - Usar servicios en lugar de datos mock

#### **3. Implementar Votación Real**

**Ejemplo en GlobeGL.svelte:**

```typescript
import { votePoll } from '$lib/services/polls';

async function handleVote(optionKey: string) {
  try {
    // Obtener geolocalización del usuario
    const position = await getCurrentPosition();
    
    // Enviar voto
    const result = await votePoll(currentPollId, {
      optionId: getOptionIdByKey(optionKey),
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      countryIso3: await getCountryFromCoords(position.coords),
      cityName: await getCityFromCoords(position.coords),
    });
    
        
    // Actualizar visualización
    await refreshPollData();
  } catch (error) {
    console.error('Vote failed:', error);
  }
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });
}
```

---

## 🗑️ Archivos a Eliminar

Una vez migrado todo a la base de datos:

### **Datos Mock:**
- [ ] `src/lib/poll-data.ts` (64 encuestas fake)
- [ ] `src/lib/data/featured-users.ts` (19 usuarios fake)
- [ ] `static/data/votes-example.json` (160 votos fake)

### **Limpiar Código:**
- [ ] Buscar y eliminar todas las referencias a `Math.random()`
- [ ] Reemplazar URLs de `i.pravatar.cc` con avatares desde DB
- [ ] Reemplazar URLs de `randomuser.me` con usuarios desde DB
- [ ] Reemplazar URLs de `images.unsplash.com` con imágenes subidas

**Comando para buscar Math.random():**
```bash
grep -r "Math.random()" src/
```

---

## 📊 Queries Útiles

### **1. Obtener votos por país**

```typescript
const votesByCountry = await prisma.vote.groupBy({
  by: ['countryIso3', 'optionId'],
  where: { pollId: 1 },
  _count: true,
});
```

### **2. Obtener encuestas trending**

```typescript
const trending = await prisma.poll.findMany({
  where: {
    createdAt: {
      gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // última semana
    },
  },
  orderBy: { totalVotes: 'desc' },
  take: 10,
  include: {
    user: true,
    options: true,
  },
});
```

### **3. Obtener historial para gráficos**

```typescript
const history = await prisma.voteHistory.findMany({
  where: {
    pollId: 1,
    recordedAt: {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // últimos 30 días
    },
  },
  orderBy: { recordedAt: 'asc' },
  include: { option: true },
});
```

### **4. Buscar encuestas**

```typescript
const results = await prisma.poll.findMany({
  where: {
    OR: [
      { title: { contains: searchQuery, mode: 'insensitive' } },
      { description: { contains: searchQuery, mode: 'insensitive' } },
    ],
    status: 'active',
  },
  include: {
    user: true,
    options: true,
  },
});
```

---

## 🔐 Seguridad y Validación

### **1. Validación de Datos con Zod**

```bash
npm install zod
```

```typescript
// src/lib/schemas/vote.ts
import { z } from 'zod';

export const voteSchema = z.object({
  optionId: z.number().int().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  countryIso3: z.string().length(3),
  countryName: z.string().optional(),
  cityName: z.string().optional(),
});

export type VoteInput = z.infer<typeof voteSchema>;
```

**Uso en endpoint:**

```typescript
import { voteSchema } from '$lib/schemas/vote';

export const POST: RequestHandler = async ({ request, params }) => {
  const body = await request.json();
  
  // Validar datos
  const validatedData = voteSchema.parse(body);
  
  // Crear voto
  const vote = await prisma.vote.create({
    data: {
      pollId: Number(params.id),
      ...validatedData,
    },
  });
  
  return json({ success: true, vote });
};
```

### **2. Rate Limiting**

```bash
npm install @upstash/ratelimit @upstash/redis
```

### **3. Prevenir Votos Duplicados**

```typescript
// Verificar por IP
const existingVote = await prisma.vote.findFirst({
  where: {
    pollId: Number(id),
    ipAddress: getClientAddress(),
  },
});

if (existingVote) {
  throw error(400, 'Ya has votado en esta encuesta');
}
```

---

## 🚀 Migración a Producción

### **Cambiar a PostgreSQL:**

1. **Actualizar `schema.prisma`:**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. **Crear base de datos en Supabase/Neon/Railway**

3. **Configurar variable de entorno:**

```bash
# .env
DATABASE_URL="postgresql://user:password@host:5432/database"
```

4. **Ejecutar migración:**

```bash
npx prisma migrate deploy
```

---

## ✅ Checklist de Implementación

### **Setup Inicial:**
- [x] Instalar Prisma y dependencias
- [x] Crear schema.prisma
- [x] Crear seed.ts
- [x] Crear cliente Prisma
- [x] Crear servicios (polls.ts, users.ts)
- [ ] Ejecutar migración inicial
- [ ] Ejecutar seed

### **API Endpoints:**
- [ ] GET /api/polls
- [ ] GET /api/polls/[id]
- [ ] POST /api/polls/[id]/vote
- [ ] GET /api/polls/[id]/stats
- [ ] GET /api/polls/[id]/history
- [ ] GET /api/featured
- [ ] GET /api/votes/geo

### **Frontend:**
- [ ] Actualizar header.svelte
- [ ] Actualizar BottomSheet.svelte
- [ ] Actualizar GlobeGL.svelte
- [ ] Actualizar +page.svelte
- [ ] Implementar votación real
- [ ] Implementar geolocalización

### **Limpieza:**
- [ ] Eliminar poll-data.ts
- [ ] Eliminar featured-users.ts
- [ ] Eliminar votes-example.json
- [ ] Eliminar Math.random()
- [ ] Reemplazar URLs externas

### **Testing:**
- [ ] Probar creación de encuestas
- [ ] Probar votación
- [ ] Probar geolocalización
- [ ] Probar gráficos históricos
- [ ] Probar búsqueda

---

## 📚 Recursos Adicionales

- [Prisma Docs](https://www.prisma.io/docs)
- [SvelteKit Docs](https://kit.svelte.dev/docs)
- [SQLite Docs](https://www.sqlite.org/docs.html)
- [Zod Docs](https://zod.dev)

---

## 🆘 Troubleshooting

### **Error: Prisma Client not generated**
```bash
npx prisma generate
```

### **Error: Migration failed**
```bash
npx prisma migrate reset
npx prisma migrate dev --name init
```

### **Error: Seed failed**
```bash
# Verificar que tsx esté instalado
npm install -D tsx

# Ejecutar seed manualmente
npx tsx prisma/seed.ts
```

### **Ver logs de Prisma**
```bash
# Agregar a .env
DEBUG="prisma:*"
```

---

## 🎯 Próximos Pasos Recomendados

1. **Ejecutar migración y seed** (10 min)
2. **Crear endpoint GET /api/polls** (30 min)
3. **Actualizar header.svelte** (20 min)
4. **Crear endpoint POST /api/polls/[id]/vote** (45 min)
5. **Implementar votación en GlobeGL.svelte** (1 hora)
6. **Crear endpoint GET /api/votes/geo** (45 min)
7. **Actualizar visualización del globo** (1 hora)
8. **Limpiar datos mock** (30 min)

**Tiempo total estimado: 5-6 horas**
