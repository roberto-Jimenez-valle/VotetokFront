# 🔄 Guía de Migración Manual - Cliente API Seguro

## 📝 Cambios Pendientes

### 1. Agregar Import en Cada Archivo

```typescript
import { apiGet, apiPost } from '$lib/api/client'
```

---

## 📂 Archivo por Archivo

### ✅ GlobeGL.svelte (YA ACTUALIZADO PARCIALMENTE)

**Estado**: Tiene 1 línea duplicada que eliminar

**Línea 2861**: Eliminar esta línea (está duplicada)
```typescript
const { data: trendingPolls } = trendingPolls; // ← ELIMINAR ESTA LÍNEA
```

---

### ⚠️ BottomSheet.svelte

**Import necesario:**
```typescript
import { apiGet } from '$lib/api/client';
```

**Cambios:**

#### Cambio 1 (línea ~188):
```typescript
// ANTES:
const response = await fetch('/api/polls/' + pollId + '/history?days=' + days);
if (!response.ok) throw new Error('Failed to load history');
const { data } = await response.json();

// DESPUÉS:
const { data } = await apiGet(`/api/polls/${pollId}/history?days=${days}`);
```

#### Cambio 2 (línea ~230):
```typescript
// ANTES:
const response = await fetch('/api/users/suggestions?limit=8');
if (!response.ok) throw new Error('Failed to load suggestions');
const { data } = await response.json();

// DESPUÉS:
const { data } = await apiGet('/api/users/suggestions?limit=8');
```

#### Cambio 3 (línea ~304):
```typescript
// ANTES:
const response = await fetch('/api/polls?page=' + page + '&limit=10');
if (!response.ok) throw new Error('Failed to load polls');
const { data, pagination } = await response.json();

// DESPUÉS:
const { data, pagination } = await apiGet(`/api/polls?page=${page}&limit=10`);
```

#### Cambio 4 (línea ~320):
```typescript
// ANTES:
const friendsResponse = await fetch('/api/polls/' + poll.id + '/friends-votes?userId=' + currentUserId);
if (friendsResponse.ok) {
  const friendsData = await friendsResponse.json();
  friendsByOption = friendsData.data || {};
}

// DESPUÉS:
try {
  const friendsData = await apiGet(`/api/polls/${poll.id}/friends-votes?userId=${currentUserId}`);
  friendsByOption = friendsData.data || {};
} catch (e) {
  console.error('Error loading friends votes:', e);
}
```

---

### 📄 CreatePollModal.svelte

**Import necesario:**
```typescript
import { apiPost } from '$lib/api/client';
```

**Cambios:**

#### Cambio 1 (línea ~396 - Upload de imagen):
```typescript
// ANTES:
const uploadResponse = await fetch('/api/upload/image', {
  method: 'POST',
  body: formData
});

// DESPUÉS:
// Upload de imagen requiere FormData, usar fetch directo pero con headers de app signature
// O crear función especial apiUpload en client.ts
// Por ahora MANTENER COMO ESTÁ (upload es caso especial)
```

#### Cambio 2 (línea ~410):
```typescript
// ANTES:
const response = await fetch('/api/polls', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(pollData)
});

if (!response.ok) {
  const errorData = await response.json();
  throw new Error(errorData.message || 'Error creating poll');
}

const result = await response.json();

// DESPUÉS:
const result = await apiPost('/api/polls', pollData);
```

---

### 📄 globeData.ts

**Import necesario:**
```typescript
import { apiGet } from '$lib/api/client';
```

**Cambios (4 fetch calls):**

```typescript
// Buscar todos los fetch('/api/polls...) y reemplazar con apiGet

// Ejemplo:
// ANTES:
const response = await fetch('/api/polls/trending');
const data = await response.json();

// DESPUÉS:
const data = await apiGet('/api/polls/trending');
```

---

### 📄 users.ts

**Import necesario:**
```typescript
import { apiGet } from '$lib/api/client';
```

**Cambio:**

```typescript
// ANTES:
const response = await fetch('/api/users/...');
const data = await response.json();

// DESPUÉS:
const data = await apiGet('/api/users/...');
```

---

## 🎯 Patrón General

### Reemplazo de GET:
```typescript
// ANTES:
const response = await fetch(url);
if (!response.ok) throw new Error('...');
const data = await response.json();

// DESPUÉS:
const data = await apiGet(url);
```

### Reemplazo de POST:
```typescript
// ANTES:
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
const result = await response.json();

// DESPUÉS:
const result = await apiPost(url, data);
```

---

## ✅ Testing Rápido

Después de aplicar los cambios:

1. Reinicia el servidor: `npm run dev`

2. Abre la consola del navegador

3. Prueba que falla desde Postman:
```bash
curl http://localhost:5173/api/polls/trending
# Debe retornar: "App authentication required"
```

4. Prueba que funciona desde tu app (abre en navegador)
   - Debería cargar encuestas normalmente

---

## 🚨 Si Hay Errores

### Error: "Cannot find module apiGet"
**Solución**: Verifica que agregaste el import correcto en la parte superior del archivo

### Error: "APP_AUTH_MISSING"
**Solución**: El cliente API no está funcionando. Verifica que:
1. Importaste correctamente `apiGet` o `apiPost`
2. Reemplazaste el `fetch()` con la función correcta

### Error: "INVALID_SIGNATURE"
**Solución**: Los secrets no coinciden:
1. Verifica `.env`
2. Reinicia el servidor

---

## 📊 Checklist Final

- [ ] Todos los archivos tienen el import correcto
- [ ] Todos los `fetch('/api/...)` reemplazados
- [ ] Servidor reiniciado
- [ ] Prueba desde Postman falla ✅
- [ ] Prueba desde navegador funciona ✅

---

**Tiempo estimado**: 15-20 minutos de cambios manuales
