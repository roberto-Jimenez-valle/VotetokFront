# Sistema de Búsqueda y Exploración Implementado

## Endpoints Creados

### 1. `/api/search` - Búsqueda y Exploración
**Accesible sin autenticación** ✅

Busca en encuestas, usuarios y lugares según los filtros aplicados. **También funciona sin query** para explorar contenido reciente/popular por categoría.

**Parámetros:**
- `q` (string): Query de búsqueda (opcional - si está vacío, devuelve contenido reciente)
- `filter` (string): 'all' | 'polls' | 'users' | 'places'
- `limit` (number): Límite de resultados (default: 20)

**Ejemplo:**
```bash
GET /api/search?q=españa&filter=all&limit=10
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "polls": [
      {
        "id": 1,
        "title": "¿Mejor ciudad de España?",
        "description": "...",
        "category": "Geografía",
        "votesCount": 1234,
        "commentsCount": 56,
        "user": { ... },
        "options": [ ... ]
      }
    ],
    "users": [
      {
        "id": 1,
        "username": "usuario1",
        "displayName": "Usuario 1",
        "avatarUrl": "...",
        "bio": "...",
        "verified": true,
        "pollsCount": 10,
        "followersCount": 100
      }
    ],
    "places": [
      {
        "id": 1,
        "subdivisionId": "ESP",
        "name": "España",
        "level": 1,
        "type": "Country",
        "latitude": 40.4168,
        "longitude": -3.7038,
        "votesCount": 5000
      }
    ]
  },
  "query": "españa",
  "filter": "all"
}
```

### 2. `/api/search/trending` - Tendencias
**Accesible sin autenticación** ✅

Obtiene las encuestas más populares basadas en votos recientes.

**Parámetros:**
- `limit` (number): Límite de resultados (default: 20)
- `days` (number): Días a considerar para votos recientes (default: 7)

**Ejemplo:**
```bash
GET /api/search/trending?limit=15&days=7
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "¿Mejor película del año?",
      "votesCount": 15420,
      "recentVotesCount": 1234,
      "commentsCount": 234,
      "user": { ... },
      "options": [ ... ]
    }
  ],
  "period": {
    "days": 7,
    "from": "2025-01-16T09:22:00.000Z",
    "to": "2025-01-23T09:22:00.000Z"
  }
}
```

**Ejemplo sin query (exploración):**
```bash
GET /api/search?filter=polls&limit=20
GET /api/search?filter=users&limit=20
GET /api/search?filter=places&limit=20
```

## SearchModal Actualizado

### Nuevas Funcionalidades

#### 1. **Búsqueda en Tiempo Real**
- Debounce de 300ms para evitar sobrecarga
- Búsqueda mientras escribes
- Loading indicator durante búsqueda

#### 2. **Filtros Funcionales con Exploración**
- **Todo**: Busca/explora en encuestas, usuarios y lugares
- **Encuestas**: Solo encuestas (muestra recientes si no hay query)
- **Usuarios**: Solo usuarios (muestra activos si no hay query)
- **Lugares**: Solo subdivisiones geográficas (muestra principales si no hay query)
- ✨ **NUEVO**: Puedes cambiar filtros sin escribir nada para explorar contenido

#### 3. **Búsquedas Recientes**
- Almacenadas en localStorage
- Máximo 5 búsquedas recientes
- Íconos diferenciados por tipo
- Click para repetir búsqueda

#### 4. **Tendencias**
- Carga automáticamente al abrir la modal
- Muestra top 15 encuestas trending
- Votos recientes en últimos 7 días
- Ranking numerado

#### 5. **Resultados con Detalles**

**Encuestas:**
- Título y descripción
- Categoría
- Contador de votos
- Avatar del creador

**Usuarios:**
- Avatar
- Nombre y username
- Badge de verificado
- Bio
- Contadores de encuestas y seguidores

**Lugares:**
- Icono de ubicación
- Nombre y nombre local
- Tipo (Country, State, etc.)
- Contador de votos

#### 6. **Estados Vacíos**
- "Sin resultados" cuando no hay coincidencias
- Mensaje personalizado con query

## Características Técnicas

### Compatibilidad SQLite
- Búsqueda case-insensitive nativa de SQLite
- Sin necesidad de modo 'insensitive' de Prisma
- Optimizado para rendimiento

### Seguridad
- Todos los endpoints son públicos (sin auth requerida)
- Validación de parámetros
- Manejo de errores robusto

### Performance
- Debounce en búsqueda (300ms)
- Límites configurables
- Queries optimizadas con índices de Prisma
- Paginación lista para implementar

### UX/UI
- Loading spinners
- Transiciones suaves
- Responsive design
- Hover effects
- Estados vacíos elegantes

## Eventos Dispatched

La modal dispara estos eventos que pueden ser escuchados:

```javascript
// Cuando se selecciona un resultado
dispatch('select', { 
  type: 'poll' | 'user' | 'place', 
  item: { ... } 
});

// Cuando se selecciona una encuesta trending
dispatch('selectPoll', { 
  poll: { ... } 
});
```

## Testing

### 1. Probar búsqueda de encuestas
```javascript
// En consola del navegador o API client
fetch('/api/search?q=tecnología&filter=polls')
  .then(r => r.json())
  .then(console.log);
```

### 2. Probar búsqueda de usuarios
```javascript
fetch('/api/search?q=admin&filter=users')
  .then(r => r.json())
  .then(console.log);
```

### 3. Probar búsqueda de lugares
```javascript
fetch('/api/search?q=madrid&filter=places')
  .then(r => r.json())
  .then(console.log);
```

### 4. Probar tendencias
```javascript
fetch('/api/search/trending?limit=10&days=7')
  .then(r => r.json())
  .then(console.log);
```

## Próximas Mejoras (Opcionales)

- [ ] Paginación infinita en resultados
- [ ] Highlights en texto coincidente
- [ ] Historial de búsquedas sincronizado con cuenta
- [ ] Sugerencias de autocompletado
- [ ] Búsqueda por hashtags
- [ ] Filtros avanzados (fecha, categoría, etc.)
- [ ] Búsqueda por voz
- [ ] Resultados geolocalizados (más cercanos primero)

## Archivos Modificados/Creados

### Nuevos Endpoints
- ✅ `src/routes/api/search/+server.ts`
- ✅ `src/routes/api/search/trending/+server.ts`

### Componentes Actualizados
- ✅ `src/lib/SearchModal.svelte`

### Dependencias Utilizadas
- `$lib/api/client` - apiCall para fetch
- `@prisma/client` - Queries a la base de datos
- `lucide-svelte` - Iconos
- `svelte/transition` - Animaciones

## Notas Importantes

1. **SQLite**: Las búsquedas son case-insensitive por defecto con LIKE
2. **Sin Autenticación**: Todos los endpoints son públicos como solicitado
3. **LocalStorage**: Las búsquedas recientes se guardan localmente
4. **Svelte 5 Runes**: Código compatible con nueva sintaxis
5. **Lint Warnings**: Autofocus es intencional para UX

## Flujos de Uso en la UI

### Flujo 1: Exploración sin Búsqueda ✨
1. **Abrir modal** de búsqueda (no escribir nada)
2. **Filtro "Todo"** → Muestra contenido reciente de todas las categorías
3. **Cambiar a "Encuestas"** → Ver encuestas recientes ordenadas por fecha
4. **Cambiar a "Usuarios"** → Ver usuarios activos
5. **Cambiar a "Lugares"** → Ver lugares principales

### Flujo 2: Búsqueda Específica
1. Abrir modal
2. Escribir "tecnología"
3. Ver resultados en tiempo real (debounce 300ms)
4. Cambiar filtros para refinar resultados
5. Click en resultado → Navegar al contenido

### Flujo 3: Usar Búsquedas Recientes
1. Abrir modal (sin escribir)
2. Ver "Búsquedas recientes" (solo si no hay resultados)
3. Click en búsqueda reciente → Se repite automáticamente

### Para Probar Rápidamente:

1. 🔍 **Abre la modal** (botón de lupa en nav-bottom)
2. 🎯 **SIN ESCRIBIR** → Cambia entre filtros para explorar contenido
3. ⌨️ **Escribe** → Ver resultados en tiempo real
4. 🧹 **Limpia el texto** (X) → Vuelve a modo exploración
5. 🕐 **Búsquedas recientes** → Se guardan automáticamente en localStorage
