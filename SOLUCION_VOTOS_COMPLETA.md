# ✅ Solución Completa: Sistema de Votos

## 🎯 Estado Actual

### ✅ Lo que FUNCIONA:
1. **Voto se guarda en BD** - tabla `votes` recibe el registro
2. **Backend funciona** - endpoint `/api/polls/[id]/vote` responde OK
3. **Validaciones funcionan** - detecta votos duplicados por IP

### ❌ Lo que NO funciona:
1. **Contadores no se actualizan** en la UI después de votar
2. **El mapa NO refleja los votos** - no cambia colores
3. **Algunos campos están vacíos** - subdivisionId, ipAddress

---

## 🔧 Problemas y Soluciones

### Problema 1: Contadores No se Actualizan ❌

**Causa**: Después de votar, la UI actualiza contadores localmente pero cuando recargas o cambias de vista, trae los datos viejos del servidor.

**Solución**: Después de votar, recargar las encuestas desde el servidor.

```typescript
// En BottomSheet.svelte, después de votar exitosamente:
if (response.ok) {
  const result = await response.json();
  
  // Actualizar local inmediatamente
  poll.totalVotes++;
  option.votes++;
  
  // NUEVO: Recargar encuestas desde servidor
  await loadTrendingPolls();
}
```

### Problema 2: El Mapa No se Actualiza ❌

**Causa**: El mapa se colorea basándose en `answersData` que se carga al inicio. Cuando votas, el mapa NO sabe que hay nuevos votos.

**Solución**: Emitir un evento al padre (GlobeGL) para recargar los datos del mapa.

```typescript
// Agregar en BottomSheet después de votar:
dispatch('voteRecorded', {
  pollId: numericPollId,
  optionId,
  subdivisionId: selectedSubdivisionId,
  countryIso3: selectedCountryIso
});

// En GlobeGL.svelte, escuchar el evento:
<BottomSheet
  on:voteRecorded={handleVoteRecorded}
/>

function handleVoteRecorded(event) {
  const { pollId, optionId, subdivisionId, countryIso3 } = event.detail;
  
  // Recargar datos de votos para el mapa
  if (activePoll && activePoll.id === pollId) {
    loadPollVotesForMap(pollId);
  }
}
```

### Problema 3: Campos Vacíos (subdivisionId, IP) ❌

**Causas**:
- `selectedSubdivisionId` está undefined si no has seleccionado una subdivisión
- `ipAddress` se obtiene en el backend con `getClientAddress()`

**Solución para subdivisionId**:
```typescript
// Si no hay subdivisión seleccionada, usar el país actual
const voteData = {
  optionId,
  latitude: 40.4168,
  longitude: -3.7038,
  countryIso3: selectedCountryIso || 'ESP',
  countryName: selectedCountryName || 'España',
  subdivisionId: selectedSubdivisionId || null, // OK que sea null
  subdivisionName: selectedSubdivisionName || null,
  cityName: selectedCityName || null
};
```

**Solución para IP**: El backend ya lo hace correctamente con `getClientAddress()`. No necesitas enviarlo desde el frontend.

---

## 🚀 Implementación Completa

### 1. Agregar Evento en BottomSheet

```typescript
// En sendVoteToBackend(), después de guardar exitosamente:
if (response.ok) {
  const result = await response.json();
  console.log('[BottomSheet sendVote] ✅ Voto guardado exitosamente:', result);
  
  // Actualizar contadores localmente
  if (poll.totalVotes !== undefined) {
    poll.totalVotes++;
  }
  if (option.votes !== undefined) {
    option.votes++;
  }
  
  // Forzar actualización de la UI
  additionalPolls = [...additionalPolls];
  if (activePoll) {
    activePoll = { ...activePoll };
  }
  
  // NUEVO: Notificar al padre que se registró un voto
  dispatch('voteRecorded', {
    pollId: numericPollId,
    optionKey,
    optionId,
    subdivisionId: selectedSubdivisionId,
    countryIso3: selectedCountryIso || 'ESP',
    vote: result.vote
  });
  
  // NUEVO: Recargar trending para actualizar contadores
  setTimeout(() => {
    loadTrendingPolls();
  }, 1000);
}
```

### 2. Escuchar Evento en GlobeGL

```typescript
// En GlobeGL.svelte, agregar handler:
async function handleVoteRecorded(event: CustomEvent) {
  const { pollId, optionKey, subdivisionId, countryIso3, vote } = event.detail;
  
  console.log('[GlobeGL] 🗳️ Voto registrado, actualizando mapa:', vote);
  
  // Actualizar answersData para el mapa
  if (activePoll && activePoll.id === pollId) {
    // Incrementar contador en answersData
    if (subdivisionId && answersData[countryIso3]) {
      const current = answersData[countryIso3][optionKey] || 0;
      answersData[countryIso3][optionKey] = current + 1;
      answersData = { ...answersData }; // Forzar reactividad
    }
    
    // Actualizar voteOptions
    voteOptions = voteOptions.map(opt => 
      opt.key === optionKey 
        ? { ...opt, votes: opt.votes + 1 }
        : opt
    );
  }
}

// En el BottomSheet:
<BottomSheet
  ...
  on:voteRecorded={handleVoteRecorded}
/>
```

### 3. Función para Recargar Datos del Mapa

```typescript
// En GlobeGL.svelte
async function loadPollVotesForMap(pollId: number) {
  try {
    const response = await fetch(`/api/polls/${pollId}/votes-by-region`);
    if (response.ok) {
      const { data } = await response.json();
      
      // Actualizar answersData con los votos reales
      answersData = data;
      
      console.log('[GlobeGL] Datos de votos actualizados:', answersData);
    }
  } catch (error) {
    console.error('[GlobeGL] Error recargando votos:', error);
  }
}
```

---

## 🧪 Verificación

### Test 1: Contador se Actualiza
1. Vota en una encuesta
2. El contador debe aumentar +1 inmediatamente
3. Después de 1 segundo, debe recargar desde el servidor
4. Si recargas la página, el contador debe mantener el valor

### Test 2: El Mapa se Actualiza
1. Abre una encuesta en el globo (que tenga colores por región)
2. Vota por una opción
3. El color de tu región debe cambiar/intensificarse
4. Verifica en consola: `[GlobeGL] 🗳️ Voto registrado, actualizando mapa`

### Test 3: Campos en BD
```bash
node check-votes.mjs
```

Deberías ver:
```
📊 Encuesta: "Tu encuesta"
   ✅ Opción A
      - voteCount: 1
      - Votos reales en BD: 1

🗳️  Últimos votos:
   1. Opción A
      - IP: ::1 (o tu IP)
      - subdivisionId: (puede ser null)
      - Fecha: 2025-10-12...
```

---

## 📋 Checklist

- [ ] Voto se guarda en BD ✅ (ya funciona)
- [ ] Contador aumenta en UI inmediatamente
- [ ] Contador persiste al recargar
- [ ] Mapa actualiza colores después de votar
- [ ] subdivisionId se guarda cuando hay subdivisión seleccionada
- [ ] ipAddress se guarda automáticamente
- [ ] No permite votos duplicados

---

## 🎯 Próximos Pasos

1. **Implementar eventos** (dispatch/listen)
2. **Agregar recarga** de trending después de votar
3. **Actualizar answersData** en GlobeGL
4. **Probar** todo el flujo end-to-end

¿Quieres que implemente estos cambios ahora?
