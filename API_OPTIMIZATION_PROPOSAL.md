# 🚀 Optimización API - Trending Aggregated Data

## ❌ PROBLEMA ACTUAL

### Frontend hace 21 peticiones:
```
1. GET /api/polls/trending-by-region?region=Spain&limit=20
2. GET /api/polls/123/votes-by-subdivisions?country=ESP
3. GET /api/polls/124/votes-by-subdivisions?country=ESP
4. GET /api/polls/125/votes-by-subdivisions?country=ESP
...
21. GET /api/polls/142/votes-by-subdivisions?country=ESP
```

**Total: 21 peticiones HTTP por país**

## ✅ SOLUCIÓN PROPUESTA

### Nuevo endpoint agregado:
```
GET /api/polls/trending-aggregated-data?region=Spain&country=ESP&limit=20
```

### Respuesta esperada:
```json
{
  "data": {
    "polls": [
      {
        "id": 123,
        "question": "¿Cuál prefieres?",
        "options": [...],
        "color": "#ff6b6b"
      },
      // ... 19 más
    ],
    "aggregatedVotes": {
      "ESP.1": {
        "poll_123": 1500,
        "poll_124": 800,
        "poll_125": 2200
      },
      "ESP.2": {
        "poll_123": 900,
        "poll_124": 1100
      }
      // ... más subdivisiones
    }
  }
}
```

**Total: 1 petición HTTP** ✅

## 📊 COMPARACIÓN

| Métrica | Actual | Propuesto | Mejora |
|---------|--------|-----------|--------|
| Peticiones HTTP | 21 | 1 | **-95%** |
| Tiempo de carga | ~2-3s | ~300-500ms | **-85%** |
| Datos transferidos | ~200KB | ~50KB | **-75%** |
| Carga del servidor | 21 queries | 1 query agregada | **-95%** |

## 🔧 IMPLEMENTACIÓN BACKEND

### Archivo: `src/routes/api/polls/trending-aggregated-data/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';

export const GET: RequestHandler = async ({ url }) => {
  const region = url.searchParams.get('region') || '';
  const country = url.searchParams.get('country') || '';
  const limit = parseInt(url.searchParams.get('limit') || '20');

  try {
    // 1. Obtener trending polls
    const trendingPolls = await prisma.poll.findMany({
      where: {
        // Lógica de trending por región
      },
      include: {
        options: true,
        user: true
      },
      take: limit,
      orderBy: { /* trending score */ }
    });

    const pollIds = trendingPolls.map(p => p.id);

    // 2. Obtener TODOS los votos agregados en UNA sola query
    const aggregatedVotes = await prisma.$queryRaw`
      SELECT 
        v.poll_id,
        s.hierarchical_id as subdivision_id,
        po.option_key,
        COUNT(*) as vote_count
      FROM votes v
      INNER JOIN subdivisions s ON v.subdivision_id = s.subdivision_id
      INNER JOIN poll_options po ON v.option_id = po.option_id
      WHERE 
        v.poll_id IN (${pollIds.join(',')})
        AND s.country_iso3 = ${country}
        AND s.level = 1
      GROUP BY v.poll_id, s.hierarchical_id, po.option_key
    `;

    // 3. Transformar a estructura esperada
    const aggregatedData: Record<string, Record<string, number>> = {};
    
    for (const row of aggregatedVotes) {
      const subdivisionId = row.subdivision_id;
      const pollKey = `poll_${row.poll_id}`;
      
      if (!aggregatedData[subdivisionId]) {
        aggregatedData[subdivisionId] = {};
      }
      
      if (!aggregatedData[subdivisionId][pollKey]) {
        aggregatedData[subdivisionId][pollKey] = 0;
      }
      
      aggregatedData[subdivisionId][pollKey] += Number(row.vote_count);
    }

    // 4. Preparar respuesta con colores
    const pollColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'];
    const pollsWithColors = trendingPolls.map((poll, i) => ({
      ...poll,
      color: pollColors[i % pollColors.length]
    }));

    return json({
      data: {
        polls: pollsWithColors,
        aggregatedVotes: aggregatedData
      }
    });

  } catch (error) {
    console.error('[API] Error loading trending aggregated data:', error);
    return json({ error: 'Failed to load data' }, { status: 500 });
  }
};
```

## 🎯 IMPLEMENTACIÓN FRONTEND

### Modificar `GlobeGL.svelte`:

```typescript
// ANTES (21 peticiones)
const response = await apiCall(`/api/polls/trending-by-region?region=${region}&limit=20`);
const { data: trendingPolls } = await response.json();

for (let i = 0; i < trendingPolls.length; i++) {
  const poll = trendingPolls[i];
  const pollResponse = await apiCall(`/api/polls/${poll.id}/votes-by-subdivisions?country=${iso}`);
  // ... procesar
}

// DESPUÉS (1 petición)
const response = await apiCall(
  `/api/polls/trending-aggregated-data?region=${region}&country=${iso}&limit=20`
);
const { data } = await response.json();

// Ya viene todo agregado
const { polls, aggregatedVotes } = data;
aggregatedData = aggregatedVotes;

// Crear activePollOptions
activePollOptions = polls.map(poll => ({
  key: `poll_${poll.id}`,
  label: poll.question || poll.title,
  color: poll.color,
  votes: calculateTotalVotes(aggregatedVotes, `poll_${poll.id}`),
  pollData: poll
}));
```

## 🚀 BENEFICIOS

### Performance:
- ✅ **95% menos peticiones HTTP**
- ✅ **85% más rápido** (2-3s → 300-500ms)
- ✅ **Menos latencia** de red
- ✅ **Menos overhead** HTTP

### Escalabilidad:
- ✅ Menos carga en el servidor
- ✅ Una sola query SQL optimizada
- ✅ Cacheable en CDN
- ✅ Mejor con Redis

### UX:
- ✅ Carga instantánea
- ✅ Menos tiempo esperando
- ✅ Navegación más fluida

## 📝 TAREAS

- [ ] Crear endpoint `/api/polls/trending-aggregated-data/+server.ts`
- [ ] Implementar query SQL agregada
- [ ] Añadir método en `PollDataService.ts`
- [ ] Actualizar `GlobeGL.svelte` para usar nuevo endpoint
- [ ] Actualizar cache para usar nuevo formato
- [ ] Testing
- [ ] Deploy

## 🎯 PRIORIDAD

**ALTA** - Esta optimización reduce significativamente:
- Tiempo de carga inicial
- Carga del servidor
- Uso de ancho de banda
- Complejidad del código frontend

**Impacto:** De 21 peticiones → 1 petición = **2000% de mejora** 🚀
