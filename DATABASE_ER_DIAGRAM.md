# Diagrama Entidad-Relación - VouTop Database

## 📊 Diagrama Visual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BASE DE DATOS VOTETOK                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│       USER           │
├──────────────────────┤
│ PK id (INT)          │
│ UK username (STR)    │
│ UK email (STR)       │
│    displayName (STR) │
│    avatarUrl (STR?)  │
│    bio (STR?)        │
│    role (STR)        │
│    verified (BOOL)   │
│    createdAt (DT)    │
│    updatedAt (DT)    │
└──────────────────────┘
         │
         │ 1:N
         ├──────────────────────────────────────────┐
         │                                          │
         ▼                                          ▼
┌──────────────────────┐                  ┌──────────────────────┐
│       POLL           │                  │   FEATURED_USER      │
├──────────────────────┤                  ├──────────────────────┤
│ PK id (INT)          │                  │ PK id (INT)          │
│ FK userId (INT)      │                  │ UK userId (INT)      │
│    title (STR)       │                  │    roleTitle (STR?)  │
│    description (STR?)│                  │    citationsCount    │
│    category (STR?)   │                  │    displaySize (INT) │
│    imageUrl (STR?)   │                  │    highlightColor    │
│    type (STR)        │                  │    featuredOrder     │
│    status (STR)      │                  │    isActive (BOOL)   │
│    totalVotes (INT)  │                  │    createdAt (DT)    │
│    totalViews (INT)  │                  └──────────────────────┘
│    createdAt (DT)    │
│    updatedAt (DT)    │
│    closedAt (DT?)    │
└──────────────────────┘
         │
         │ 1:N
         ├─────────────────────────────────────────────────────┐
         │                                                     │
         ▼                                                     ▼
┌──────────────────────┐                            ┌──────────────────────┐
│    POLL_OPTION       │                            │   POLL_INTERACTION   │
├──────────────────────┤                            ├──────────────────────┤
│ PK id (INT)          │                            │ PK id (INT)          │
│ FK pollId (INT)      │                            │ FK pollId (INT)      │
│    optionKey (STR)   │                            │ FK userId (INT)      │
│    optionLabel (STR) │                            │    interactionType   │
│    color (STR)       │                            │    createdAt (DT)    │
│    avatarUrl (STR?)  │                            └──────────────────────┘
│    voteCount (INT)   │                            UK: [pollId, userId, type]
│    displayOrder (INT)│
│    createdAt (DT)    │
└──────────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────────────────────────────────────┐
│                    VOTE                          │
├──────────────────────────────────────────────────┤
│ PK id (INT)                                      │
│ FK pollId (INT)                                  │
│ FK optionId (INT)                                │
│ FK userId (INT?)                                 │
│    latitude (FLOAT)                              │
│    longitude (FLOAT)                             │
│    countryIso3 (STR)        ← ISO país (ESP)    │
│    countryName (STR?)                            │
│    subdivisionId (STR?)     ← Nivel 1 (1, 2...) │
│    subdivisionName (STR?)   ← Nombre región     │
│    cityName (STR?)                               │
│    ipAddress (STR?)                              │
│    userAgent (STR?)                              │
│    createdAt (DT)                                │
└──────────────────────────────────────────────────┘
│
│ ÍNDICES:
│ - [pollId]
│ - [latitude, longitude]
│ - [countryIso3]
│ - [countryIso3, subdivisionId]
│ - [createdAt]


┌──────────────────────┐
│      COMMENT         │
├──────────────────────┤
│ PK id (INT)          │
│ FK pollId (INT)      │
│ FK userId (INT)      │
│ FK parentCommentId?  │  ← Auto-referencia (respuestas)
│    content (STR)     │
│    likesCount (INT)  │
│    createdAt (DT)    │
│    updatedAt (DT)    │
└──────────────────────┘


┌──────────────────────┐
│   VOTE_HISTORY       │
├──────────────────────┤
│ PK id (INT)          │
│ FK pollId (INT)      │
│ FK optionId (INT)    │
│    voteCount (INT)   │
│    percentage (FLOAT)│
│    recordedAt (DT)   │
└──────────────────────┘


┌──────────────────────┐              ┌──────────────────────┐
│      HASHTAG         │              │    POLL_HASHTAG      │
├──────────────────────┤              ├──────────────────────┤
│ PK id (INT)          │◄─────────────│ PK pollId (INT)      │
│ UK tag (STR)         │     N:M      │ PK hashtagId (INT)   │
│    usageCount (INT)  │              └──────────────────────┘
│    createdAt (DT)    │              (Tabla intermedia)
└──────────────────────┘


┌──────────────────────┐
│   USER_FOLLOWER      │
├──────────────────────┤
│ PK id (INT)          │
│ FK followerId (INT)  │──┐
│ FK followingId (INT) │  │  Auto-relación USER
│    createdAt (DT)    │  │
└──────────────────────┘  │
UK: [followerId, followingId]
         │
         └──► USER (followers/following)
```

## 📋 Descripción de Entidades

### 1. **USER** (Usuarios)
- **Propósito**: Almacena información de usuarios registrados
- **Relaciones**:
  - 1:N con Poll (un usuario puede crear muchas encuestas)
  - 1:N con Vote (un usuario puede votar en muchas encuestas)
  - 1:N con Comment (un usuario puede comentar en muchas encuestas)
  - 1:N con PollInteraction (likes, saves, shares)
  - 1:1 con FeaturedUser (perfil destacado opcional)
  - N:M con User (seguidores/seguidos via UserFollower)

### 2. **POLL** (Encuestas)
- **Propósito**: Almacena las encuestas creadas por usuarios
- **Campos clave**:
  - `status`: "active", "closed", "draft"
  - `type`: "poll", "survey", etc.
  - `totalVotes`: Contador de votos totales
  - `totalViews`: Contador de visualizaciones
- **Relaciones**:
  - N:1 con User (creador)
  - 1:N con PollOption (opciones de la encuesta)
  - 1:N con Vote (votos recibidos)
  - 1:N con Comment (comentarios)
  - 1:N con PollInteraction (interacciones)
  - N:M con Hashtag (via PollHashtag)
  - 1:N con VoteHistory (historial de votos)

### 3. **POLL_OPTION** (Opciones de Encuesta)
- **Propósito**: Opciones disponibles para votar en una encuesta
- **Campos clave**:
  - `optionKey`: Identificador único de la opción
  - `optionLabel`: Texto mostrado al usuario
  - `color`: Color hexadecimal para visualización
  - `avatarUrl`: Avatar opcional para la opción
  - `voteCount`: Contador de votos (desnormalizado)
- **Relaciones**:
  - N:1 con Poll
  - 1:N con Vote (votos recibidos)
  - 1:N con VoteHistory

### 4. **VOTE** (Votos) 🔥 **ENTIDAD CLAVE PARA GEOLOCALIZACIÓN**
- **Propósito**: Almacena cada voto individual con su ubicación geográfica
- **Campos geográficos**:
  - `latitude`, `longitude`: Coordenadas exactas del voto
  - `countryIso3`: Código ISO del país (ej: "ESP", "USA", "FRA")
  - `countryName`: Nombre del país
  - `subdivisionId`: ID de subdivisión nivel 1 (ej: "1" para Andalucía)
  - `subdivisionName`: Nombre de la subdivisión
  - `cityName`: Nombre de la ciudad
- **Índices importantes**:
  - `[countryIso3]`: Para consultas por país
  - `[countryIso3, subdivisionId]`: Para consultas por subdivisión
  - `[latitude, longitude]`: Para consultas espaciales
- **Relaciones**:
  - N:1 con Poll
  - N:1 con PollOption
  - N:1 con User (opcional, puede ser anónimo)

### 5. **COMMENT** (Comentarios)
- **Propósito**: Comentarios en encuestas con soporte para respuestas
- **Auto-relación**: `parentCommentId` permite respuestas anidadas
- **Relaciones**:
  - N:1 con Poll
  - N:1 con User
  - 1:N con Comment (respuestas)

### 6. **POLL_INTERACTION** (Interacciones)
- **Propósito**: Likes, saves, shares de encuestas
- **Campos**:
  - `interactionType`: "like", "save", "share"
- **Constraint único**: Un usuario solo puede tener una interacción de cada tipo por encuesta

### 7. **FEATURED_USER** (Usuarios Destacados)
- **Propósito**: Perfiles destacados en la aplicación
- **Campos**:
  - `roleTitle`: Título del rol (ej: "Experto en Política")
  - `citationsCount`: Número de citas/menciones
  - `displaySize`: Tamaño de visualización del avatar
  - `highlightColor`: Color de resaltado
  - `featuredOrder`: Orden de aparición

### 8. **USER_FOLLOWER** (Seguidores)
- **Propósito**: Relación de seguimiento entre usuarios
- **Auto-relación**: Ambos campos apuntan a User
- **Constraint único**: No se puede seguir al mismo usuario dos veces

### 9. **VOTE_HISTORY** (Historial de Votos)
- **Propósito**: Snapshots históricos de resultados de encuestas
- **Uso**: Para gráficos de evolución temporal
- **Campos**:
  - `voteCount`: Número de votos en ese momento
  - `percentage`: Porcentaje en ese momento
  - `recordedAt`: Timestamp del snapshot

### 10. **HASHTAG** (Hashtags)
- **Propósito**: Etiquetas para categorizar encuestas
- **Campo único**: `tag` (no puede repetirse)
- **Relación N:M con Poll via PollHashtag**

### 11. **POLL_HASHTAG** (Tabla Intermedia)
- **Propósito**: Relaciona encuestas con hashtags
- **Clave primaria compuesta**: [pollId, hashtagId]

## 🗺️ Estructura Geográfica de Votos

```
VOTE.countryIso3 = "ESP"
    ↓
VOTE.subdivisionId = "1"  (Andalucía - Nivel 1)
    ↓
VOTE.subdivisionId = "1.1" (Sevilla - Nivel 2) ← NO EXISTE EN BD ACTUAL
    ↓
VOTE.cityName = "Sevilla"
```

### ⚠️ LIMITACIÓN ACTUAL:
- **Solo existe `subdivisionId` (nivel 1)**
- **NO existe `subdivisionId2` (nivel 2)**
- Por eso el endpoint `/api/polls/{id}/votes-by-subsubdivisions` no puede funcionar correctamente

### 💡 SOLUCIÓN PROPUESTA:
Almacenar IDs jerárquicos completos en `subdivisionId`:
- `"ESP.1"` para Andalucía (nivel 1)
- `"ESP.1.1"` para Sevilla (nivel 2)
- `"ESP.1.2"` para Jaén (nivel 2)

Esto permitiría:
```sql
-- Votos de Andalucía (nivel 1)
WHERE subdivisionId LIKE 'ESP.1%'

-- Votos de Sevilla (nivel 2)
WHERE subdivisionId = 'ESP.1.1'
```

## 📊 Cardinalidades

| Relación | Tipo | Descripción |
|----------|------|-------------|
| User → Poll | 1:N | Un usuario crea muchas encuestas |
| Poll → PollOption | 1:N | Una encuesta tiene muchas opciones |
| Poll → Vote | 1:N | Una encuesta recibe muchos votos |
| PollOption → Vote | 1:N | Una opción recibe muchos votos |
| User → Vote | 1:N | Un usuario emite muchos votos |
| Poll → Comment | 1:N | Una encuesta tiene muchos comentarios |
| User → Comment | 1:N | Un usuario escribe muchos comentarios |
| Comment → Comment | 1:N | Un comentario tiene muchas respuestas |
| User → PollInteraction | 1:N | Un usuario hace muchas interacciones |
| Poll → PollInteraction | 1:N | Una encuesta recibe muchas interacciones |
| User → FeaturedUser | 1:1 | Un usuario puede ser destacado |
| User → User (followers) | N:M | Usuarios se siguen entre sí |
| Poll → Hashtag | N:M | Encuestas tienen múltiples hashtags |
| Poll → VoteHistory | 1:N | Una encuesta tiene múltiples snapshots |

## 🔑 Claves e Índices Importantes

### Índices de Performance:
```sql
-- VOTE (tabla más consultada)
INDEX idx_vote_poll ON votes(poll_id)
INDEX idx_vote_location ON votes(latitude, longitude)
INDEX idx_vote_country ON votes(country_iso3)
INDEX idx_vote_subdivision ON votes(country_iso3, subdivision_id)
INDEX idx_vote_created ON votes(created_at)

-- POLL
INDEX idx_poll_user ON polls(user_id)
INDEX idx_poll_category ON polls(category)
INDEX idx_poll_status ON polls(status)
INDEX idx_poll_created ON polls(created_at)

-- POLL_OPTION
INDEX idx_option_poll ON poll_options(poll_id)

-- COMMENT
INDEX idx_comment_poll ON comments(poll_id)
INDEX idx_comment_user ON comments(user_id)

-- POLL_INTERACTION
INDEX idx_interaction_poll ON poll_interactions(poll_id)
INDEX idx_interaction_user ON poll_interactions(user_id)

-- USER_FOLLOWER
INDEX idx_follower ON user_followers(follower_id)
INDEX idx_following ON user_followers(following_id)

-- VOTE_HISTORY
INDEX idx_history_poll ON vote_history(poll_id)
INDEX idx_history_recorded ON vote_history(recorded_at)
```

## 🔒 Constraints de Integridad

1. **Unique Constraints**:
   - User: username, email
   - Hashtag: tag
   - PollInteraction: [pollId, userId, interactionType]
   - UserFollower: [followerId, followingId]
   - FeaturedUser: userId

2. **Foreign Key Cascades**:
   - Poll → User: ON DELETE CASCADE
   - PollOption → Poll: ON DELETE CASCADE
   - Vote → Poll: ON DELETE CASCADE
   - Vote → PollOption: ON DELETE CASCADE
   - Vote → User: ON DELETE SET NULL (permite votos anónimos)
   - Comment → Poll: ON DELETE CASCADE
   - Comment → User: ON DELETE CASCADE
   - PollInteraction → Poll/User: ON DELETE CASCADE
   - FeaturedUser → User: ON DELETE CASCADE
   - UserFollower → User: ON DELETE CASCADE
   - VoteHistory → Poll/Option: ON DELETE CASCADE
   - PollHashtag → Poll/Hashtag: ON DELETE CASCADE

## 📈 Consultas Típicas

### 1. Obtener votos por país:
```sql
SELECT country_iso3, option_id, COUNT(*) as votes
FROM votes
WHERE poll_id = ?
GROUP BY country_iso3, option_id
```

### 2. Obtener votos por subdivisión:
```sql
SELECT subdivision_id, option_id, COUNT(*) as votes
FROM votes
WHERE poll_id = ? AND country_iso3 = ?
GROUP BY subdivision_id, option_id
```

### 3. Trending polls:
```sql
SELECT p.*, COUNT(v.id) as recent_votes
FROM polls p
LEFT JOIN votes v ON p.id = v.poll_id 
  AND v.created_at > datetime('now', '-7 days')
WHERE p.status = 'active'
GROUP BY p.id
ORDER BY recent_votes DESC, p.total_views DESC
LIMIT 10
```

### 4. Historial de una encuesta:
```sql
SELECT recorded_at, option_id, vote_count, percentage
FROM vote_history
WHERE poll_id = ?
ORDER BY recorded_at ASC
```
