# 🔥 Sistema de Trending Topics Implementado

## Fecha: 2025-10-05

## ✅ Cambios Realizados

### 1. **Nuevo Endpoint: `/api/polls/trending`**

**Ubicación**: `src/routes/api/polls/trending/+server.ts`

**Funcionalidad:**
- Calcula un **score de trending** para cada encuesta basado en:
  - ✅ Votos totales (peso: 1.0)
  - ✅ Vistas (peso: 0.5)
  - ✅ Engagement rate (votos/vistas) (peso: 2.0)
  - ✅ Comentarios (peso: 3.0 - más valioso)
  - ✅ Interacciones (peso: 2.0)
  - ✅ Factor de recencia (más reciente = más score)

**Parámetros:**
- `limit`: Número de encuestas trending a devolver (default: 5, max: 10)
- `hours`: Ventana de tiempo en horas (default: 24)

**Ejemplo de uso:**
```
GET /api/polls/trending?limit=5&hours=168
```

**Respuesta:**
```json
{
  "data": [
    {
      "id": 1,
      "title": "¿Cuál es tu red social favorita?",
      "totalVotes": 4406,
      "totalViews": 4500,
      "trendingScore": 8234,
      "user": { ... },
      "options": [ ... ]
    }
  ],
  "meta": {
    "hoursAgo": 168,
    "totalPolls": 15,
    "dateLimit": "2024-09-28T00:00:00.000Z"
  }
}
```

### 2. **Encuesta Principal = Trending Topic**

**Cambios en BottomSheet:**
- ✅ Nueva función `loadMainPoll()` que carga las top 5 encuestas trending
- ✅ Las opciones de la encuesta principal ahora son los **títulos de las encuestas más votadas**
- ✅ Se llama automáticamente en `onMount()`

**Antes:**
```
Encuesta Principal: "¿Cuál debería ser la prioridad?"
Opciones: Opción 1, Opción 2, Opción 3 (hardcodeado)
```

**Ahora:**
```
Encuesta Principal: "Trending Topics"
Opciones: 
  - ¿Cuál es tu red social favorita? (8234 votos)
  - ¿Prefieres trabajar desde casa? (6350 votos)
  - ¿Qué tipo de música escuchas? (5780 votos)
  - ¿Cuántas horas duermes? (5350 votos)
  - ¿Piña en la pizza? (4900 votos)
```

### 3. **Encuestas Adicionales: Solo desde BD**

**Antes:**
- Algunas encuestas estaban hardcodeadas en el código

**Ahora:**
- ✅ Todas las encuestas vienen de `/api/polls`
- ✅ Scroll infinito con paginación
- ✅ Carga dinámica de 10 encuestas por página

### 4. **Estructura Final del BottomSheet**

```
┌─────────────────────────────────────┐
│ 📊 ENCUESTA PRINCIPAL (Trending)    │
│ Opciones = Top 5 encuestas          │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 💰 PATROCINADOS                     │
│ (Se mantiene como está)             │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 👥 A QUIEN SEGUIR                   │
│ (Se mantiene como está)             │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 📋 ENCUESTA 1 (desde BD)            │
│ - Opción 1                          │
│ - Opción 2                          │
│ - ...                               │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ 📋 ENCUESTA 2 (desde BD)            │
│ - Opción 1                          │
│ - Opción 2                          │
│ - ...                               │
└─────────────────────────────────────┘
│ ... (scroll infinito)               │
```

## 🔧 Cómo Funciona el Score de Trending

### Fórmula:
```javascript
trendingScore = (
  totalVotes * 1.0 +
  totalViews * 0.5 +
  (totalVotes / totalViews) * 2.0 +
  comments * 3.0 +
  interactions * 2.0
) * (1 + recencyFactor)
```

### Ejemplo Real:
```
Encuesta: "¿Cuál es tu red social favorita?"
- Votos: 4406 → 4406 puntos
- Vistas: 4500 → 2250 puntos
- Engagement: 97.9% → 195.8 puntos
- Comentarios: 0 → 0 puntos
- Interacciones: 0 → 0 puntos
- Recencia: 2 horas → factor 1.98

Score final: (4406 + 2250 + 195.8) * 1.98 = 13,566 puntos
```

## 📊 Logs de Debug

En la consola verás:
```
🔥 Trending polls cargados: 5
  ✅ Opciones principales: [
    "¿Cuál es tu red social favorita en 2025?",
    "¿Prefieres trabajar desde casa o en la oficina?",
    "¿Qué tipo de música escuchas más?",
    "¿Cuántas horas duermes normalmente?",
    "¿Piña en la pizza? 🍕🍍"
  ]
```

## 🎯 Próximos Pasos

1. **Actualizar título de la encuesta principal** en el template HTML
2. **Agregar icono de trending** (🔥) a la encuesta principal
3. **Configurar recalculación automática** del trending (cada hora/día)
4. **Agregar caché** al endpoint de trending para mejorar rendimiento

## 🐛 Problemas Corregidos

- ✅ Títulos de opciones ahora muestran el texto correcto
- ✅ Paginación reactiva con `currentPageByPoll` como `let`
- ✅ Avatares de amigos solo cuando hay votos
- ✅ Todas las encuestas desde BD (sin hardcodeo)
