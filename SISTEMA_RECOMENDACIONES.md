# Sistema de Recomendaciones "Para ti" vs "Tendencias"

## 📋 Descripción General

Este documento describe el sistema completo de recomendaciones personalizadas implementado en VouTop, que diferencia entre encuestas **"Para ti"** (personalizadas) y **"Tendencias"** (globales).

---

## 🎯 Funcionalidad

### **Para ti** (Personalizado)
Muestra encuestas recomendadas basadas en los intereses y comportamiento del usuario autenticado:
- ✅ Categorías de encuestas con las que ha interactuado
- ✅ Hashtags que sigue
- ✅ Usuarios que sigue
- ✅ Ubicación geográfica del usuario
- ✅ Historial de votos y patrones de comportamiento

### **Tendencias** (Global)
Muestra las encuestas más populares a nivel mundial:
- ✅ Basado en votos recientes
- ✅ Engagement (comentarios, likes, shares)
- ✅ Factor de recencia (encuestas más recientes tienen más peso)

---

## 🗄️ Base de Datos

### Schema Extendido

#### **Modelo User** (modificado)
```prisma
model User {
  // ... campos existentes ...
  countryIso3  String?   @map("country_iso3")      // País del usuario
  subdivisionId String?  @map("subdivision_id")    // Región/estado del usuario
  
  interests          UserInterest[]
  hashtagFollows     UserHashtagFollow[]
}
```

#### **Nuevas Tablas**

**UserInterest** - Rastrear categorías de interés del usuario
```prisma
model UserInterest {
  id         Int      @id @default(autoincrement())
  userId     Int      @map("user_id")
  category   String   // Categoría de interés
  score      Float    @default(1.0) // Score de interés (aumenta con interacciones)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, category])
  @@index([userId])
  @@map("user_interests")
}
```

**UserHashtagFollow** - Hashtags seguidos por el usuario
```prisma
model UserHashtagFollow {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  hashtagId Int      @map("hashtag_id")
  createdAt DateTime @default(now()) @map("created_at")

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  hashtag Hashtag @relation(fields: [hashtagId], references: [id], onDelete: Cascade)

  @@unique([userId, hashtagId])
  @@index([userId])
  @@index([hashtagId])
  @@map("user_hashtag_follows")
}
```

### Migración Necesaria

Para aplicar los cambios al schema:
```bash
npx prisma migrate dev --name add_recommendation_system
npx prisma generate
```

---

## 🔌 APIs Implementadas

### 1. `/api/polls/for-you` (GET)

**Endpoint de recomendaciones personalizadas**

#### Query Parameters:
- `userId` (requerido): ID del usuario autenticado
- `limit` (opcional, default: 10): Número de encuestas a retornar

#### Ejemplo de Request:
```typescript
const response = await fetch('/api/polls/for-you?userId=123&limit=10');
const { data, meta } = await response.json();
```

#### Response:
```json
{
  "data": [
    {
      "id": 45,
      "title": "¿Cuál es tu lenguaje favorito?",
      "category": "tecnologia",
      "personalizedScore": 85.5,
      "user": { ... },
      "options": [ ... ],
      "_count": { ... }
    }
  ],
  "meta": {
    "userId": 123,
    "totalRecommendations": 10,
    "categoriesTracked": ["tecnologia", "deportes"],
    "followedHashtags": 5,
    "followedUsers": 12
  }
}
```

#### Algoritmo de Score Personalizado:

```javascript
personalizedScore = 
  (categoryScore * 5.0) +           // Categorías de interés
  (followedUser ? 10.0 : 0) +       // Usuario seguido
  (matchingHashtags * 3.0) +        // Hashtags coincidentes
  (locationMatch * 4.0) +            // Misma ubicación geográfica
  (engagementScore * 0.5) +          // Engagement general
  (recencyFactor * 0.5)              // Factor de recencia
```

**Factores de peso:**
- **Usuario seguido**: 10.0 (más importante)
- **Categoría de interés**: 5.0
- **Ubicación geográfica**: 4.0
- **Hashtag seguido**: 3.0 por hashtag
- **Engagement general**: 0.5
- **Recencia**: Factor multiplicador

---

### 2. `/api/users/track-interest` (POST)

**Endpoint para rastrear interacciones y actualizar intereses**

#### Request Body:
```json
{
  "userId": 123,
  "pollId": 45,
  "interactionType": "vote" | "view" | "comment" | "share" | "like"
}
```

#### Pesos de Interacción:
```javascript
const interactionWeights = {
  view: 0.1,      // Bajo peso: solo ver
  vote: 1.0,      // Alto peso: votar es acción principal
  comment: 0.8,   // Alto peso: engagement activo
  share: 0.6,     // Medio peso: difusión
  like: 0.4,      // Medio peso: interacción simple
};
```

#### Ejemplo de Uso:
```typescript
// Cuando el usuario vota en una encuesta
await fetch('/api/users/track-interest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 123,
    pollId: 45,
    interactionType: 'vote'
  })
});
```

**Nota:** Este endpoint actualiza automáticamente el score de interés en la categoría de la encuesta.

---

### 3. `/api/polls/trending` (GET) - Existente

**Endpoint de encuestas trending globales**

#### Query Parameters:
- `limit` (opcional, default: 5): Número de encuestas
- `hours` (opcional, default: 24): Ventana temporal en horas

#### Algoritmo de Trending Score:

```javascript
trendingScore = (
  votesScore +                  // votos totales * 1.0
  (viewsScore * 0.5) +          // vistas * 0.5
  (engagementRate * 2.0) +      // (votos/vistas) * 2.0
  (comments * 3.0) +            // comentarios * 3.0
  (interactions * 2.0)          // interacciones * 2.0
) * (1 + recencyFactor)         // multiplicador por recencia
```

---

## 🎨 Frontend Implementation

### Store de Usuario Actual

**Archivo:** `src/lib/stores.ts`

```typescript
import { writable } from 'svelte/store';

export interface CurrentUser {
  id: number;
  username: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  verified: boolean;
  countryIso3?: string;
  subdivisionId?: string;
  role: string;
}

export const currentUser = writable<CurrentUser | null>(null);
export const isAuthenticated = writable<boolean>(false);

export function setCurrentUser(user: CurrentUser | null) {
  currentUser.set(user);
  isAuthenticated.set(user !== null);
}

export function logout() {
  currentUser.set(null);
  isAuthenticated.set(false);
}
```

### Integración en GlobeGL.svelte

**Variables de Estado:**
```typescript
import { currentUser } from './stores';

// Tab activo
let activeTopTab: 'Para ti' | 'Tendencias' | 'Live' = 'Para ti';

// Usuario actual
let userData: typeof $currentUser = null;
$: userData = $currentUser;
```

**Handler de Cambio de Tab:**
```typescript
async function handleTopTabChange(event: CustomEvent<string>) {
  const newTab = event.detail as 'Para ti' | 'Tendencias' | 'Live';
  
  if (newTab === activeTopTab) return;
  
  console.log('[GlobeGL] 🔄 Cambiando tab a:', newTab);
  activeTopTab = newTab;
  
  // Recargar datos según el nuevo tab
  if (!activePoll && navigationState.level === 'world') {
    await loadTrendingData();
    await updateGlobeColors(true); // Con fade
  }
}
```

**Función de Carga de Datos Modificada:**
```typescript
async function loadTrendingData() {
  try {
    // Determinar qué API usar según el tab activo
    let apiUrl = '/api/polls/trending-by-region?region=Global&limit=20';
    
    if (activeTopTab === 'Para ti' && userData?.id) {
      // API personalizada para usuario autenticado
      apiUrl = `/api/polls/for-you?userId=${userData.id}&limit=20`;
      console.log('[GlobeGL] 🎯 Cargando recomendaciones personalizadas');
    } else if (activeTopTab === 'Para ti' && !userData) {
      // Fallback a trending si no hay usuario
      console.log('[GlobeGL] ℹ️ "Para ti" requiere usuario autenticado');
    } else {
      console.log('[GlobeGL] 🌍 Cargando encuestas trending globales');
    }
    
    const response = await fetch(apiUrl);
    // ... procesar respuesta
  } catch (error) {
    console.error('[GlobeGL] Error cargando datos:', error);
  }
}
```

**Template:**
```svelte
<TopTabs
  bind:active={activeTopTab}
  options={["Para ti", "Tendencias", "Live"]}
  on:change={handleTopTabChange}
/>
```

---

## 🔄 Flujo de Usuario

### Escenario 1: Usuario Autenticado - "Para ti"

1. Usuario inicia sesión → `setCurrentUser(userData)` actualiza el store
2. Usuario selecciona tab "Para ti"
3. `handleTopTabChange` detecta el cambio
4. `loadTrendingData()` llama a `/api/polls/for-you?userId=123`
5. API calcula score personalizado basado en:
   - Intereses del usuario (`UserInterest`)
   - Hashtags seguidos (`UserHashtagFollow`)
   - Usuarios seguidos (`UserFollower`)
   - Historial de votos (`Vote`)
6. Encuestas se ordenan por `personalizedScore`
7. Globo se actualiza con fade-in suave

### Escenario 2: Usuario Autenticado - "Tendencias"

1. Usuario selecciona tab "Tendencias"
2. `handleTopTabChange` detecta el cambio
3. `loadTrendingData()` llama a `/api/polls/trending-by-region`
4. API calcula trending score global
5. Encuestas se ordenan por `trendingScore`
6. Globo se actualiza con fade-in suave

### Escenario 3: Usuario No Autenticado - "Para ti"

1. Usuario sin login selecciona "Para ti"
2. `userData` es `null`
3. Sistema muestra mensaje en consola
4. Fallback automático a trending como alternativa
5. *(Opcional)* Mostrar mensaje UI sugiriendo login

---

## 📊 Tracking de Interacciones

### Cuándo Llamar `/api/users/track-interest`

```typescript
// 1. Al votar en una encuesta
async function handleVote(pollId: number, optionId: number) {
  // ... lógica de voto
  
  if ($currentUser) {
    await fetch('/api/users/track-interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: $currentUser.id,
        pollId,
        interactionType: 'vote'
      })
    });
  }
}

// 2. Al ver una encuesta (abrir BottomSheet)
async function handlePollView(pollId: number) {
  if ($currentUser) {
    await fetch('/api/users/track-interest', {
      method: 'POST',
      body: JSON.stringify({
        userId: $currentUser.id,
        pollId,
        interactionType: 'view'
      })
    });
  }
}

// 3. Al comentar
async function handleComment(pollId: number) {
  if ($currentUser) {
    await fetch('/api/users/track-interest', {
      method: 'POST',
      body: JSON.stringify({
        userId: $currentUser.id,
        pollId,
        interactionType: 'comment'
      })
    });
  }
}
```

---

## 🧪 Testing

### 1. Crear Usuario de Prueba

```typescript
// Seed script o consola del navegador
await fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'testuser',
    email: 'test@example.com',
    displayName: 'Test User',
    countryIso3: 'ESP',
    subdivisionId: '1' // Andalucía
  })
});
```

### 2. Simular Interacciones

```typescript
// Votar en varias encuestas de categoría "tecnologia"
for (const pollId of [1, 2, 3]) {
  await fetch('/api/users/track-interest', {
    method: 'POST',
    body: JSON.stringify({
      userId: 1,
      pollId,
      interactionType: 'vote'
    })
  });
}
```

### 3. Verificar Recomendaciones

```typescript
const response = await fetch('/api/polls/for-you?userId=1&limit=10');
const { data, meta } = await response.json();

console.log('Recomendaciones:', data);
console.log('Categorías rastreadas:', meta.categoriesTracked);
// Debería mostrar alta prioridad en encuestas de "tecnologia"
```

### 4. Setear Usuario en Frontend

```typescript
import { setCurrentUser } from '$lib/stores';

// En +page.svelte o +layout.svelte
onMount(async () => {
  // Simular login (en producción, esto vendría de tu sistema de auth)
  setCurrentUser({
    id: 1,
    username: 'testuser',
    displayName: 'Test User',
    email: 'test@example.com',
    verified: false,
    countryIso3: 'ESP',
    subdivisionId: '1',
    role: 'user'
  });
});
```

---

## 🚀 Próximas Mejoras

### Corto Plazo
- [ ] **Sistema de autenticación real** (OAuth, JWT, etc.)
- [ ] **UI para seguir hashtags** desde el TagBar
- [ ] **Indicador visual** cuando "Para ti" requiere login
- [ ] **Cache de recomendaciones** (Redis/memoria)

### Medio Plazo
- [ ] **Machine Learning** para mejorar predicciones
- [ ] **A/B Testing** de algoritmos de recomendación
- [ ] **Filtros avanzados** (idioma, región, tipo de contenido)
- [ ] **Notificaciones push** de encuestas relevantes

### Largo Plazo
- [ ] **Collaborative filtering** entre usuarios similares
- [ ] **Time-series analysis** para detectar tendencias emergentes
- [ ] **Análisis de sentimiento** en comentarios
- [ ] **Recomendaciones multi-objetivo** (diversidad + relevancia)

---

## 📝 Notas Técnicas

### Performance
- Las consultas a `/api/polls/for-you` incluyen múltiples JOINs
- Para bases de datos grandes, considerar:
  - **Índices** en columnas frecuentes (`userId`, `category`, `hashtagId`)
  - **Caché** de intereses del usuario (actualizar async)
  - **Paginación** eficiente
  - **Precálculo** de scores en background jobs

### Privacidad
- Los datos de ubicación (`countryIso3`, `subdivisionId`) son opcionales
- El historial de votos se usa solo para recomendaciones internas
- Considerar permitir usuarios "opt-out" de recomendaciones personalizadas

### Escalabilidad
- Para millones de usuarios, migrar el sistema de recomendaciones a:
  - **Servicio dedicado** (microservicio)
  - **Base de datos NoSQL** para grafos de seguimiento
  - **Message Queue** para procesamiento async de interacciones
  - **CDN** para cachear resultados de trending

---

## 📚 Referencias

- [Algoritmos de Recomendación](https://developers.google.com/machine-learning/recommendation)
- [Collaborative Filtering](https://en.wikipedia.org/wiki/Collaborative_filtering)
- [Trending Score Algorithms](https://medium.com/hacking-and-gonzo/how-reddit-ranking-algorithms-work-ef111e33d0d9)

---

**Última actualización:** 2025-01-11
**Versión:** 1.0
**Autor:** Sistema de Desarrollo VouTop
