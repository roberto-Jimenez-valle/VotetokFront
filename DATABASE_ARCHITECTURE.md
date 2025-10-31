# 📊 Análisis y Arquitectura de Base de Datos - VouTop

## 🔍 ANÁLISIS DE DATOS DE PRUEBA ACTUALES

### 1. **Datos Mock Identificados**

#### 📍 **Ubicación de Datos de Prueba:**

1. **`src/lib/poll-data.ts`** (105 líneas)
   - 64 encuestas generadas con `Math.random()`
   - Usuarios ficticios con avatares placeholder
   - Porcentajes aleatorios de votos
   - Likes y comentarios aleatorios

2. **`src/lib/data/featured-users.ts`** (22 líneas)
   - 19 usuarios destacados con datos hardcodeados
   - Imágenes de Unsplash
   - Roles, citaciones y colores ficticios

3. **`src/lib/globe/BottomSheet.svelte`** (38 ocurrencias de `Math.random()`)
   - Datos históricos de gráficos generados aleatoriamente
   - Nombres de creadores ficticios
   - Avatares con `i.pravatar.cc`
   - Estadísticas de votos/vistas aleatorias
   - Encuestas adicionales mock

4. **`src/lib/GlobeGL.svelte`** (10 ocurrencias de `Math.random()`)
   - Datos de votación simulados
   - Colores y opacidades aleatorias

5. **`src/lib/header.svelte`** (5 ocurrencias de `Math.random()`)
   - Usuarios de ejemplo con `randomuser.me`

6. **`src/routes/+page.svelte`** (10 ocurrencias)
   - Lista de usuarios top con `randomuser.me`

7. **`static/data/votes-example.json`** (161 líneas)
   - 160 votos de ejemplo geolocalizados
   - Principalmente en España (Madrid)
   - Tags: "Si", "No", "Tal vez", "La Muerte"

---

## 🗄️ PROPUESTA DE ARQUITECTURA DE BASE DE DATOS

### **Tecnología Recomendada: SQLite + Prisma ORM**

**Ventajas:**
- ✅ Sin servidor, archivo local
- ✅ Perfecto para desarrollo inicial
- ✅ Fácil migración a PostgreSQL/MySQL en producción
- ✅ Prisma ORM con TypeScript type-safety
- ✅ Migraciones automáticas

---

## 📐 ESQUEMA DE BASE DE DATOS

### **1. Tabla: `users` (Usuarios)**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'user', -- 'user', 'admin', 'moderator'
  verified BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **2. Tabla: `polls` (Encuestas)**
```sql
CREATE TABLE polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'Politics', 'Food', 'Work', 'Science', etc.
  image_url TEXT,
  type TEXT DEFAULT 'poll', -- 'poll', 'hashtag', 'trending'
  status TEXT DEFAULT 'active', -- 'active', 'closed', 'draft'
  total_votes INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### **3. Tabla: `poll_options` (Opciones de Encuesta)**
```sql
CREATE TABLE poll_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL,
  option_key TEXT NOT NULL, -- 'Si', 'No', 'Tal vez', etc.
  option_label TEXT NOT NULL,
  color TEXT NOT NULL, -- Hex color
  avatar_url TEXT,
  vote_count INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);
```

### **4. Tabla: `votes` (Votos Geolocalizados)**
```sql
CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL,
  option_id INTEGER NOT NULL,
  user_id INTEGER, -- NULL si es voto anónimo
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  country_iso3 TEXT NOT NULL, -- 'ESP', 'FRA', 'USA', etc.
  country_name TEXT,
  subdivision_name TEXT, -- Estado/Comunidad Autónoma
  city_name TEXT,
  ip_address TEXT, -- Para prevenir duplicados
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
  FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

### **5. Tabla: `poll_interactions` (Likes, Guardados, Compartidos)**
```sql
CREATE TABLE poll_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  interaction_type TEXT NOT NULL, -- 'like', 'save', 'share', 'repost'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(poll_id, user_id, interaction_type)
);
```

### **6. Tabla: `comments` (Comentarios)**
```sql
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  parent_comment_id INTEGER, -- Para respuestas
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE
);
```

### **7. Tabla: `featured_users` (Usuarios Destacados)**
```sql
CREATE TABLE featured_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role_title TEXT, -- 'Frontend Dev', 'Data Scientist', etc.
  citations_count INTEGER DEFAULT 0,
  display_size INTEGER DEFAULT 30,
  highlight_color TEXT,
  featured_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### **8. Tabla: `user_followers` (Seguidores)**
```sql
CREATE TABLE user_followers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id INTEGER NOT NULL,
  following_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(follower_id, following_id)
);
```

### **9. Tabla: `vote_history` (Historial de Votos para Gráficos)**
```sql
CREATE TABLE vote_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL,
  option_id INTEGER NOT NULL,
  vote_count INTEGER NOT NULL,
  percentage REAL NOT NULL,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
  FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE
);
```

### **10. Tabla: `hashtags` (Hashtags)**
```sql
CREATE TABLE hashtags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag TEXT UNIQUE NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **11. Tabla: `poll_hashtags` (Relación Encuestas-Hashtags)**
```sql
CREATE TABLE poll_hashtags (
  poll_id INTEGER NOT NULL,
  hashtag_id INTEGER NOT NULL,
  PRIMARY KEY (poll_id, hashtag_id),
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
  FOREIGN KEY (hashtag_id) REFERENCES hashtags(id) ON DELETE CASCADE
);
```

---

## 🔗 ÍNDICES RECOMENDADOS

```sql
-- Índices para optimizar consultas geoespaciales
CREATE INDEX idx_votes_location ON votes(latitude, longitude);
CREATE INDEX idx_votes_country ON votes(country_iso3);
CREATE INDEX idx_votes_poll ON votes(poll_id);
CREATE INDEX idx_votes_created ON votes(created_at);

-- Índices para encuestas
CREATE INDEX idx_polls_user ON polls(user_id);
CREATE INDEX idx_polls_category ON polls(category);
CREATE INDEX idx_polls_status ON polls(status);
CREATE INDEX idx_polls_created ON polls(created_at);

-- Índices para opciones
CREATE INDEX idx_options_poll ON poll_options(poll_id);

-- Índices para interacciones
CREATE INDEX idx_interactions_poll ON poll_interactions(poll_id);
CREATE INDEX idx_interactions_user ON poll_interactions(user_id);

-- Índices para comentarios
CREATE INDEX idx_comments_poll ON comments(poll_id);
CREATE INDEX idx_comments_user ON comments(user_id);

-- Índices para seguidores
CREATE INDEX idx_followers_follower ON user_followers(follower_id);
CREATE INDEX idx_followers_following ON user_followers(following_id);
```

---

## 📦 PRISMA SCHEMA (schema.prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model User {
  id           Int       @id @default(autoincrement())
  username     String    @unique
  email        String    @unique
  displayName  String    @map("display_name")
  avatarUrl    String?   @map("avatar_url")
  bio          String?
  role         String    @default("user")
  verified     Boolean   @default(false)
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  polls              Poll[]
  votes              Vote[]
  interactions       PollInteraction[]
  comments           Comment[]
  featuredProfile    FeaturedUser?
  followers          UserFollower[]    @relation("UserFollowers")
  following          UserFollower[]    @relation("UserFollowing")

  @@map("users")
}

model Poll {
  id          Int       @id @default(autoincrement())
  userId      Int       @map("user_id")
  title       String
  description String?
  category    String?
  imageUrl    String?   @map("image_url")
  type        String    @default("poll")
  status      String    @default("active")
  totalVotes  Int       @default(0) @map("total_votes")
  totalViews  Int       @default(0) @map("total_views")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  closedAt    DateTime? @map("closed_at")

  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  options      PollOption[]
  votes        Vote[]
  interactions PollInteraction[]
  comments     Comment[]
  hashtags     PollHashtag[]
  history      VoteHistory[]

  @@index([userId])
  @@index([category])
  @@index([status])
  @@index([createdAt])
  @@map("polls")
}

model PollOption {
  id           Int      @id @default(autoincrement())
  pollId       Int      @map("poll_id")
  optionKey    String   @map("option_key")
  optionLabel  String   @map("option_label")
  color        String
  avatarUrl    String?  @map("avatar_url")
  voteCount    Int      @default(0) @map("vote_count")
  displayOrder Int      @default(0) @map("display_order")
  createdAt    DateTime @default(now()) @map("created_at")

  poll    Poll          @relation(fields: [pollId], references: [id], onDelete: Cascade)
  votes   Vote[]
  history VoteHistory[]

  @@index([pollId])
  @@map("poll_options")
}

model Vote {
  id              Int      @id @default(autoincrement())
  pollId          Int      @map("poll_id")
  optionId        Int      @map("option_id")
  userId          Int?     @map("user_id")
  latitude        Float
  longitude       Float
  countryIso3     String   @map("country_iso3")
  countryName     String?  @map("country_name")
  subdivisionName String?  @map("subdivision_name")
  cityName        String?  @map("city_name")
  ipAddress       String?  @map("ip_address")
  userAgent       String?  @map("user_agent")
  createdAt       DateTime @default(now()) @map("created_at")

  poll   Poll       @relation(fields: [pollId], references: [id], onDelete: Cascade)
  option PollOption @relation(fields: [optionId], references: [id], onDelete: Cascade)
  user   User?      @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([pollId])
  @@index([latitude, longitude])
  @@index([countryIso3])
  @@index([createdAt])
  @@map("votes")
}

model PollInteraction {
  id              Int      @id @default(autoincrement())
  pollId          Int      @map("poll_id")
  userId          Int      @map("user_id")
  interactionType String   @map("interaction_type")
  createdAt       DateTime @default(now()) @map("created_at")

  poll Poll @relation(fields: [pollId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([pollId, userId, interactionType])
  @@index([pollId])
  @@index([userId])
  @@map("poll_interactions")
}

model Comment {
  id              Int       @id @default(autoincrement())
  pollId          Int       @map("poll_id")
  userId          Int       @map("user_id")
  parentCommentId Int?      @map("parent_comment_id")
  content         String
  likesCount      Int       @default(0) @map("likes_count")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  poll          Poll      @relation(fields: [pollId], references: [id], onDelete: Cascade)
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  parentComment Comment?  @relation("CommentReplies", fields: [parentCommentId], references: [id], onDelete: Cascade)
  replies       Comment[] @relation("CommentReplies")

  @@index([pollId])
  @@index([userId])
  @@map("comments")
}

model FeaturedUser {
  id             Int      @id @default(autoincrement())
  userId         Int      @unique @map("user_id")
  roleTitle      String?  @map("role_title")
  citationsCount Int      @default(0) @map("citations_count")
  displaySize    Int      @default(30) @map("display_size")
  highlightColor String?  @map("highlight_color")
  featuredOrder  Int      @default(0) @map("featured_order")
  isActive       Boolean  @default(true) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("featured_users")
}

model UserFollower {
  id          Int      @id @default(autoincrement())
  followerId  Int      @map("follower_id")
  followingId Int      @map("following_id")
  createdAt   DateTime @default(now()) @map("created_at")

  follower  User @relation("UserFollowers", fields: [followerId], references: [id], onDelete: Cascade)
  following User @relation("UserFollowing", fields: [followingId], references: [id], onDelete: Cascade)

  @@unique([followerId, followingId])
  @@index([followerId])
  @@index([followingId])
  @@map("user_followers")
}

model VoteHistory {
  id         Int      @id @default(autoincrement())
  pollId     Int      @map("poll_id")
  optionId   Int      @map("option_id")
  voteCount  Int      @map("vote_count")
  percentage Float
  recordedAt DateTime @default(now()) @map("recorded_at")

  poll   Poll       @relation(fields: [pollId], references: [id], onDelete: Cascade)
  option PollOption @relation(fields: [optionId], references: [id], onDelete: Cascade)

  @@index([pollId])
  @@index([recordedAt])
  @@map("vote_history")
}

model Hashtag {
  id         Int      @id @default(autoincrement())
  tag        String   @unique
  usageCount Int      @default(0) @map("usage_count")
  createdAt  DateTime @default(now()) @map("created_at")

  polls PollHashtag[]

  @@map("hashtags")
}

model PollHashtag {
  pollId    Int @map("poll_id")
  hashtagId Int @map("hashtag_id")

  poll    Poll    @relation(fields: [pollId], references: [id], onDelete: Cascade)
  hashtag Hashtag @relation(fields: [hashtagId], references: [id], onDelete: Cascade)

  @@id([pollId, hashtagId])
  @@map("poll_hashtags")
}
```

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### **Fase 1: Setup de Base de Datos (1-2 días)**

1. **Instalar Prisma**
```bash
npm install -D prisma
npm install @prisma/client
npx prisma init --datasource-provider sqlite
```

2. **Crear schema.prisma** (copiar el schema de arriba)

3. **Generar migración inicial**
```bash
npx prisma migrate dev --name init
```

4. **Generar cliente Prisma**
```bash
npx prisma generate
```

### **Fase 2: Seed de Datos Iniciales (1 día)**

Crear `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Crear usuarios de ejemplo
  const users = await Promise.all([
    prisma.user.create({
      data: {
        username: 'maria_gonzalez',
        email: 'maria@example.com',
        displayName: 'María González',
        avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80',
        verified: true,
      },
    }),
    // ... más usuarios
  ]);

  // Crear encuesta de ejemplo
  const poll = await prisma.poll.create({
    data: {
      userId: users[0].id,
      title: '¿Cuál debería ser la prioridad del gobierno para 2024?',
      category: 'Politics',
      type: 'poll',
      options: {
        create: [
          { optionKey: 'economia', optionLabel: 'Economía', color: '#3b82f6', displayOrder: 0 },
          { optionKey: 'sanidad', optionLabel: 'Sanidad', color: '#10b981', displayOrder: 1 },
          { optionKey: 'educacion', optionLabel: 'Educación', color: '#f59e0b', displayOrder: 2 },
          { optionKey: 'medio_ambiente', optionLabel: 'Medio Ambiente', color: '#22c55e', displayOrder: 3 },
        ],
      },
    },
  });

  // Crear votos geolocalizados
  await prisma.vote.createMany({
    data: [
      {
        pollId: poll.id,
        optionId: 1,
        latitude: 40.4168,
        longitude: -3.7038,
        countryIso3: 'ESP',
        countryName: 'España',
        cityName: 'Madrid',
      },
      // ... más votos
    ],
  });

  }

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Agregar a `package.json`:
```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

### **Fase 3: Crear API Endpoints (2-3 días)**

#### **Estructura de carpetas:**
```
src/routes/api/
├── polls/
│   ├── +server.ts          # GET /api/polls (lista)
│   ├── [id]/
│   │   ├── +server.ts      # GET/PUT/DELETE /api/polls/[id]
│   │   ├── vote/
│   │   │   └── +server.ts  # POST /api/polls/[id]/vote
│   │   ├── stats/
│   │   │   └── +server.ts  # GET /api/polls/[id]/stats
│   │   └── history/
│   │       └── +server.ts  # GET /api/polls/[id]/history
├── users/
│   ├── +server.ts          # GET /api/users
│   ├── [id]/
│   │   ├── +server.ts      # GET/PUT /api/users/[id]
│   │   ├── polls/
│   │   │   └── +server.ts  # GET /api/users/[id]/polls
│   │   └── followers/
│   │       └── +server.ts  # GET/POST /api/users/[id]/followers
├── votes/
│   ├── geo/
│   │   └── +server.ts      # GET /api/votes/geo?country=ESP&poll=1
│   └── stats/
│       └── +server.ts      # GET /api/votes/stats
└── featured/
    └── +server.ts          # GET /api/featured
```

#### **Ejemplo: GET /api/polls**

```typescript
// src/routes/api/polls/+server.ts
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
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
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

#### **Ejemplo: POST /api/polls/[id]/vote**

```typescript
// src/routes/api/polls/[id]/vote/+server.ts
import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
  const { id } = params;
  const body = await request.json();
  const { optionId, latitude, longitude, countryIso3, countryName, cityName } = body;

  // Validar que la opción pertenece a la encuesta
  const option = await prisma.pollOption.findFirst({
    where: { id: optionId, pollId: Number(id) },
  });

  if (!option) {
    throw error(404, 'Opción no encontrada');
  }

  // Prevenir votos duplicados por IP (opcional)
  const ipAddress = getClientAddress();
  const existingVote = await prisma.vote.findFirst({
    where: {
      pollId: Number(id),
      ipAddress,
    },
  });

  if (existingVote) {
    throw error(400, 'Ya has votado en esta encuesta');
  }

  // Crear voto
  const vote = await prisma.vote.create({
    data: {
      pollId: Number(id),
      optionId,
      latitude,
      longitude,
      countryIso3,
      countryName,
      cityName,
      ipAddress,
      userAgent: request.headers.get('user-agent'),
    },
  });

  // Actualizar contadores
  await Promise.all([
    prisma.pollOption.update({
      where: { id: optionId },
      data: { voteCount: { increment: 1 } },
    }),
    prisma.poll.update({
      where: { id: Number(id) },
      data: { totalVotes: { increment: 1 } },
    }),
  ]);

  return json({ success: true, vote });
};
```

### **Fase 4: Migrar Frontend (3-4 días)**

1. **Reemplazar datos mock en componentes**
2. **Crear servicios de API en `$lib/services/`**
3. **Actualizar tipos TypeScript**
4. **Implementar caché con SvelteKit load functions**

#### **Ejemplo de servicio:**

```typescript
// src/lib/services/polls.ts
import type { Poll } from '@prisma/client';

export async function getPolls(params?: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);

  const response = await fetch(`/api/polls?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch polls');
  return response.json();
}

export async function votePoll(pollId: number, data: {
  optionId: number;
  latitude: number;
  longitude: number;
  countryIso3: string;
  countryName?: string;
  cityName?: string;
}) {
  const response = await fetch(`/api/polls/${pollId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to vote');
  return response.json();
}
```

### **Fase 5: Limpieza de Código (1-2 días)**

#### **Archivos a ELIMINAR:**
- ✅ `src/lib/poll-data.ts`
- ✅ `src/lib/data/featured-users.ts`
- ✅ Todas las referencias a `Math.random()` en componentes
- ✅ URLs hardcodeadas de `pravatar.cc`, `randomuser.me`, `unsplash.com`

#### **Archivos a MODIFICAR:**
- ✅ `src/lib/globe/BottomSheet.svelte` - Eliminar datos mock
- ✅ `src/lib/GlobeGL.svelte` - Usar datos reales de API
- ✅ `src/lib/header.svelte` - Cargar usuarios desde DB
- ✅ `src/routes/+page.svelte` - Usar API endpoints

---

## 📊 QUERIES ÚTILES

### **1. Obtener votos por país para una encuesta**
```typescript
const votesByCountry = await prisma.vote.groupBy({
  by: ['countryIso3', 'optionId'],
  where: { pollId: 1 },
  _count: true,
});
```

### **2. Obtener historial de votos para gráficos**
```typescript
const history = await prisma.voteHistory.findMany({
  where: {
    pollId: 1,
    recordedAt: {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // últimos 30 días
    },
  },
  orderBy: { recordedAt: 'asc' },
});
```

### **3. Obtener encuestas trending**
```typescript
const trending = await prisma.poll.findMany({
  where: {
    createdAt: {
      gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // última semana
    },
  },
  orderBy: { totalVotes: 'desc' },
  take: 10,
});
```

### **4. Obtener votos de amigos (si hay sistema de amigos)**
```typescript
const friendVotes = await prisma.vote.findMany({
  where: {
    pollId: 1,
    userId: {
      in: friendIds, // Array de IDs de amigos
    },
  },
  include: {
    user: {
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
      },
    },
    option: true,
  },
});
```

---

## 🔄 MIGRACIÓN A PRODUCCIÓN

Cuando estés listo para producción, cambiar a PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Servicios recomendados:
- **Supabase** (PostgreSQL gratis con 500MB)
- **Neon** (PostgreSQL serverless)
- **PlanetScale** (MySQL serverless)
- **Railway** (PostgreSQL con plan gratis)

---

## 📈 MEJORAS FUTURAS

1. **Caché con Redis** para consultas frecuentes
2. **WebSockets** para votos en tiempo real
3. **Índices geoespaciales** con PostGIS (PostgreSQL)
4. **CDN** para imágenes de usuarios/encuestas
5. **Rate limiting** para prevenir spam
6. **Análisis de sentimiento** en comentarios
7. **Notificaciones push** para nuevas encuestas

---

## ✅ CHECKLIST DE LIMPIEZA

### **Datos Mock a Eliminar:**
- [ ] `src/lib/poll-data.ts` (64 encuestas fake)
- [ ] `src/lib/data/featured-users.ts` (19 usuarios fake)
- [ ] `static/data/votes-example.json` (160 votos fake)
- [ ] Referencias a `Math.random()` en:
  - [ ] `BottomSheet.svelte` (38 ocurrencias)
  - [ ] `GlobeGL.svelte` (10 ocurrencias)
  - [ ] `header.svelte` (5 ocurrencias)
  - [ ] `+page.svelte` (10 ocurrencias)

### **URLs Externas a Reemplazar:**
- [ ] `i.pravatar.cc` → Avatares desde DB
- [ ] `randomuser.me` → Usuarios desde DB
- [ ] `images.unsplash.com` → Imágenes subidas o CDN
- [ ] `/placeholder.svg` → Imágenes reales

### **Funcionalidad a Implementar:**
- [ ] Sistema de autenticación (NextAuth/Lucia)
- [ ] Upload de imágenes (Cloudinary/S3)
- [ ] Geolocalización real del usuario
- [ ] Sistema de permisos y roles
- [ ] Validación de datos con Zod
- [ ] Tests unitarios y E2E

---

## 🎯 RESUMEN EJECUTIVO

**Situación Actual:**
- 100% de datos son mock/fake
- Sin persistencia real
- Datos generados con `Math.random()`
- Imágenes de servicios externos

**Solución Propuesta:**
- Base de datos SQLite con Prisma ORM
- 11 tablas relacionales bien estructuradas
- API REST completa con SvelteKit
- Migración gradual del frontend
- Path claro hacia producción (PostgreSQL)

**Tiempo Estimado:**
- Setup DB: 1-2 días
- Seed inicial: 1 día
- API endpoints: 2-3 días
- Migración frontend: 3-4 días
- Limpieza: 1-2 días
- **TOTAL: 8-12 días**

**Beneficios:**
- ✅ Datos persistentes y reales
- ✅ Escalabilidad garantizada
- ✅ Type-safety completo
- ✅ Queries optimizadas
- ✅ Fácil migración a producción
