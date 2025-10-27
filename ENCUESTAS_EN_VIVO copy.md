# Encuestas en Vivo - Sistema de Límite de Tiempo

## 📋 Estado Actual

### Implementado ✅
- **Frontend**: Selector de duración en `CreatePollModal.svelte`
  - Opciones: 1 día, 3 días, 7 días, 30 días, "nunca"
  - Se envía el campo `duration` al crear una encuesta
- **Schema**: Campo `closedAt` en el modelo `Poll` (nullable)

### No Implementado ❌
- Cálculo del `closedAt` cuando se crea una encuesta
- Filtrado de encuestas expiradas en las consultas
- Indicadores visuales de tiempo restante en las cards
- Auto-cierre de encuestas al expirar
- Bloqueo de votos en encuestas cerradas

---

## 🎯 Funcionamiento Esperado

### 1. **Creación de Encuesta**

Cuando un usuario crea una encuesta con límite de tiempo:

```typescript
// En el backend (src/routes/api/polls/+server.ts - método POST)
export const POST: RequestHandler = async ({ request }) => {
  const data = await request.json();
  const { duration } = data; // '1d', '3d', '7d', '30d', 'never'
  
  // Calcular closedAt basado en duration
  let closedAt = null;
  if (duration && duration !== 'never') {
    const days = parseInt(duration); // '7d' -> 7
    closedAt = new Date();
    closedAt.setDate(closedAt.getDate() + days);
  }
  
  const poll = await prisma.poll.create({
    data: {
      // ... otros campos
      closedAt: closedAt,
      status: 'active'
    }
  });
};
```

### 2. **Visualización en las Cards**

Las cards de encuestas en vivo deberían mostrar:

#### **Indicador de tiempo restante** (parte superior derecha)
```
┌─────────────────────────────────┐
│ ¿Título de la encuesta?    🔴 2h│ <- Indicador en vivo
├─────────────────────────────────┤
│                                 │
│   [Opciones de votación]        │
│                                 │
└─────────────────────────────────┘
```

**Colores del indicador:**
- 🔴 Rojo: < 1 hora restante
- 🟡 Amarillo: < 6 horas restantes
- 🟢 Verde: > 6 horas restantes
- ⚪ Gris: Sin límite de tiempo

#### **Barra de progreso temporal** (opcional)
```
┌─────────────────────────────────┐
│ ¿Título?                   🔴 2h│
├─────────────────────────────────┤
│ ████████████░░░░░░░░░░░░░░ 60% │ <- Barra: tiempo transcurrido
│                                 │
│   [Opciones]                    │
└─────────────────────────────────┘
```

### 3. **Estados de una Encuesta en Vivo**

```typescript
type PollStatus = 'active' | 'closed' | 'expired';

interface Poll {
  id: string;
  status: string;
  closedAt: Date | null;
  
  // Propiedades calculadas
  isLive: boolean;          // closedAt !== null && status === 'active'
  timeRemaining: number;    // ms hasta closedAt
  timeRemainingText: string; // "2h 30m", "45m", "Cerrada"
  isExpired: boolean;       // closedAt < now
  canVote: boolean;         // !isExpired && status === 'active'
}
```

### 4. **Filtrado en las Consultas**

#### **Trending/For You - Priorizar encuestas en vivo:**
```typescript
// src/routes/api/polls/trending/+server.ts
export const GET: RequestHandler = async ({ url }) => {
  const polls = await prisma.poll.findMany({
    where: {
      status: 'active',
      OR: [
        { closedAt: null }, // Sin límite
        { closedAt: { gt: new Date() } } // Aún no expirada
      ]
    },
    orderBy: [
      // Priorizar encuestas que expiran pronto
      { closedAt: 'asc' }, // Las que cierran antes primero
      { createdAt: 'desc' }
    ]
  });
};
```

#### **Auto-actualización de estado:**
```typescript
// Tarea programada o middleware para cerrar encuestas expiradas
async function closeExpiredPolls() {
  await prisma.poll.updateMany({
    where: {
      status: 'active',
      closedAt: {
        lte: new Date() // closedAt <= now
      }
    },
    data: {
      status: 'closed'
    }
  });
}
```

### 5. **Componente de Card en Vivo**

```svelte
<!-- src/lib/globe/BottomSheet.svelte -->
<script>
  function getTimeRemaining(closedAt: Date | null): string {
    if (!closedAt) return '';
    
    const now = Date.now();
    const end = new Date(closedAt).getTime();
    const diff = end - now;
    
    if (diff <= 0) return 'Cerrada';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
  
  function getTimeRemainingColor(closedAt: Date | null): string {
    if (!closedAt) return 'gray';
    
    const diff = new Date(closedAt).getTime() - Date.now();
    const hours = diff / (1000 * 60 * 60);
    
    if (hours <= 1) return 'red';
    if (hours <= 6) return 'yellow';
    return 'green';
  }
  
  // Actualizar cada minuto
  onMount(() => {
    const interval = setInterval(() => {
      // Forzar re-render para actualizar tiempos
      additionalPolls = [...additionalPolls];
    }, 60000); // 60 segundos
    
    return () => clearInterval(interval);
  });
</script>

{#each additionalPolls as poll}
  <div class="poll-card">
    <div class="poll-header">
      <h3>{poll.question}</h3>
      {#if poll.closedAt}
        <div class="time-badge" class:red={getTimeRemainingColor(poll.closedAt) === 'red'}>
          🔴 {getTimeRemaining(poll.closedAt)}
        </div>
      {/if}
    </div>
    
    <!-- Opciones de voto -->
    {#if poll.canVote}
      <!-- Mostrar opciones normales -->
    {:else}
      <div class="expired-overlay">
        ⏱️ Encuesta cerrada
      </div>
    {/if}
  </div>
{/each}

<style>
  .time-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }
  
  .time-badge.red {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  .expired-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-weight: 600;
    backdrop-filter: blur(4px);
  }
</style>
```

### 6. **Notificaciones y Comportamiento**

#### **Cuando una encuesta está por cerrar:**
- **< 1 hora**: Mostrar animación pulsante en el indicador
- **< 15 minutos**: Marcar como "URGENTE" en trending
- **Al cerrar**: Actualizar automáticamente el estado sin recargar

#### **Tipo de encuestas en vivo populares:**
- ⚡ **Flash Polls**: 1-3 horas (eventos en tiempo real)
- 📅 **Daily Polls**: 24 horas (votación diaria)
- 📊 **Weekly Polls**: 7 días (opinión semanal)
- 🗳️ **Campaign Polls**: 30 días (decisiones importantes)

---

## 🛠️ Implementación Recomendada

### Fase 1: Backend ✅
1. Modificar endpoint POST `/api/polls` para calcular `closedAt`
2. Agregar middleware para cerrar encuestas expiradas
3. Actualizar queries para filtrar encuestas activas

### Fase 2: Frontend - Datos 📊
1. Agregar propiedades calculadas a los datos de polls:
   ```typescript
   interface PollWithTimeData extends Poll {
     timeRemaining: number;
     timeRemainingText: string;
     isExpired: boolean;
     canVote: boolean;
   }
   ```

### Fase 3: Frontend - UI 🎨
1. Agregar indicador de tiempo en las cards
2. Implementar contador en tiempo real
3. Agregar estados visuales (activa/cerrada)
4. Deshabilitar votación en encuestas cerradas

### Fase 4: Optimización ⚡
1. Auto-actualización mediante WebSocket o polling
2. Notificaciones push cuando una encuesta va a cerrar
3. Caché de encuestas en vivo
4. Animaciones de transición al cerrar

---

## 📱 Ejemplo de Uso

```typescript
// Usuario crea encuesta en vivo
createPoll({
  title: "¿Qué prefieren para cenar hoy?",
  duration: "3h",
  options: ["Pizza", "Sushi", "Tacos"]
});

// Sistema calcula:
closedAt = now + 3 horas  // 2025-01-12T21:50:00Z

// En la UI:
🔴 2h 45m  <- Contador en vivo que se actualiza

// Cuando closedAt <= now:
status = 'closed'
canVote = false
UI muestra: "⏱️ Encuesta cerrada"
```

---

## 🎯 Beneficios

1. **Mayor engagement**: Urgencia genera más participación
2. **Contenido fresco**: Encuestas relevantes en el momento
3. **Trending más dinámico**: Priorización de contenido temporal
4. **Experiencia gamificada**: "Última oportunidad para votar"
5. **Datos de calidad**: Respuestas concentradas en un periodo específico

---

## ⚠️ Consideraciones

- **Timezone**: Usar UTC para `closedAt` y convertir en cliente
- **Notificaciones**: No saturar con notificaciones de cierre
- **Caché**: Invalidar caché al cerrar encuestas
- **Performance**: Indexar `closedAt` en la base de datos
- **UX**: Avisar antes de que expire si el usuario está votando
