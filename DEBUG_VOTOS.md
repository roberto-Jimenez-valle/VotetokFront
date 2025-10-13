# 🐛 Debug: Votos No se Guardan

## ✅ Backend Funciona Correctamente

Ejecuté `test-vote.mjs` y el resultado fue:
```
✅ Voto registrado exitosamente!
✅ ¡Contador incrementado correctamente!
Votos antes: 456 → Votos después: 457
```

**Conclusión**: El endpoint `/api/polls/[id]/vote` funciona perfectamente.

---

## ❌ Problema: Frontend No Envía el Voto

El problema está en que **desde el navegador NO se llama al endpoint**.

### Causa Probable:

En `BottomSheet.svelte` la función `handleVote()` llama a `onVote(optionKey)`, pero esta función `onVote` **no está conectada** con `sendVoteToServer()` de `GlobeGL.svelte`.

---

## 🔧 Pasos para Debuggear

### 1. Abre la Consola del Navegador (F12)

### 2. Vota en una Encuesta

### 3. Busca estos mensajes:

**Si ves esto ✅:**
```
[handleVote] 🗳️ Votando por: option_1
[sendVote] 📤 Enviando al servidor: { ... }
[sendVote] ✅ Voto registrado en servidor
```
→ **Está funcionando**

**Si ves esto ❌:**
```
[handleVote] 🗳️ Votando por: option_1
(y nada más)
```
→ **NO se está enviando al servidor**

**Si no ves nada ❌:**
→ **La función handleVote no se está llamando**

---

## 🔍 Posibles Causas

### Causa 1: `onVote` no está conectado
**Archivo**: `BottomSheet.svelte` línea ~1444

El `onVote(optionKey)` llama a una función prop, pero GlobeGL.svelte necesita ejecutar `sendVoteToServer()`.

### Causa 2: activePoll no tiene datos
La función `sendVoteToServer()` necesita `activePoll.id` y `activePoll.options`.

Si `activePoll` es null o no tiene opciones, falla silenciosamente.

### Causa 3: La opción no tiene ID
El voto necesita el `option.id` numérico para enviarlo al backend.

---

## ✅ Solución Rápida

### Opción A: Verificar la conexión

1. Abre `GlobeGL.svelte`
2. Busca donde se pasa `onVote` al BottomSheet
3. Verifica que apunte a `handleVote`

```svelte
<BottomSheet
  ...
  onVote={handleVote}  ← Debe estar aquí
  ...
/>
```

### Opción B: Agregar logging

Agrega esto al inicio de `handleVote` en GlobeGL.svelte:

```typescript
function handleVote(optionKey: string) {
  console.log('[handleVote] 🗳️ Votando por:', optionKey);
  console.log('[handleVote] activePoll:', activePoll);
  console.log('[handleVote] voteOptions:', voteOptions);
  
  // ... resto del código
}
```

---

## 🧪 Test Manual en Consola

Abre la consola del navegador y ejecuta:

```javascript
// Ver si activePoll existe
console.log('activePoll:', window.activePoll || 'No disponible');

// Simular un voto directamente
fetch('/api/polls/31/vote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    optionId: 120,
    latitude: 40.4168,
    longitude: -3.7038,
    countryIso3: 'ESP',
    countryName: 'España',
    subdivisionId: null,
    subdivisionName: null,
    cityName: 'Madrid'
  })
})
.then(r => r.json())
.then(d => console.log('Voto manual:', d))
.catch(e => console.error('Error:', e));
```

Si esto funciona → El problema es la conexión entre componentes.

---

## 📋 Checklist de Verificación

- [ ] ¿La consola muestra `[handleVote]` al votar?
- [ ] ¿La consola muestra `[sendVote]` después?
- [ ] ¿`activePoll` tiene datos cuando votas?
- [ ] ¿Las opciones tienen `id` numérico?
- [ ] ¿El fetch se completa sin errores?
- [ ] ¿El terminal del servidor muestra `[API Vote] 📥 Voto recibido`?

---

## 🎯 Próximos Pasos

1. **Vota en una encuesta** y observa la consola
2. **Copia y pega aquí** lo que ves en la consola
3. Te diré exactamente cuál es el problema

**Pega la salida de la consola aquí** 👇
