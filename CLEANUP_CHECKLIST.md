# 🧹 Checklist de Limpieza - Eliminar Datos Mock

## ✅ Base de Datos Creada

- [x] Prisma instalado
- [x] Migración ejecutada
- [x] Seed completado
- [x] Base de datos con 5 usuarios, 3 encuestas, 15 votos

---

## 📁 Archivos a ELIMINAR

### **Datos Mock:**
- [ ] `src/lib/poll-data.ts` (64 encuestas fake)
- [ ] `src/lib/data/featured-users.ts` (19 usuarios fake)
- [ ] `static/data/votes-example.json` (160 votos fake)

**Comando para eliminar:**
```bash
rm src/lib/poll-data.ts
rm src/lib/data/featured-users.ts
rm static/data/votes-example.json
```

---

## 🔄 Archivos a MODIFICAR

### **1. src/lib/header.svelte**

**ANTES (líneas 30-49):**
```typescript
onMount(async () => {
  try {
    const res = await fetch('/api/featured-users');
    if (res.ok) {
      const { data } = await res.json();
      users = (Array.isArray(data) ? data : []).map((u: any) => ({ name: u.name, avatar: u.image || u.avatar }));
    }
  } catch (e) {
    console.warn('No se pudieron cargar featured users:', e);
    // Fallback: usar usuarios de ejemplo si falla la API
    users = [
      { name: 'Emma', avatar: 'https://randomuser.me/api/portraits/women/10.jpg' },
      { name: 'Marisol', avatar: 'https://randomuser.me/api/portraits/women/11.jpg' },
      // ... más usuarios mock
    ];
  }
});
```

**DESPUÉS:**
```typescript
onMount(async () => {
  try {
    const res = await fetch('/api/featured-users');
    if (res.ok) {
      const { data } = await res.json();
      users = (Array.isArray(data) ? data : []).map((u: any) => ({ 
        name: u.name, 
        avatar: u.image || u.avatar 
      }));
    }
  } catch (e) {
    console.error('Error loading featured users:', e);
    users = []; // Sin fallback mock
  }
});
```

**Acción:** Eliminar el fallback con usuarios de randomuser.me

---

### **2. src/routes/+page.svelte**

**ANTES (líneas 8-19):**
```typescript
const topUsers = [
  { name: 'Emma', avatar: 'https://randomuser.me/api/portraits/women/10.jpg' },
  { name: 'Marisol', avatar: 'https://randomuser.me/api/portraits/women/11.jpg' },
  // ... más usuarios
];
```

**DESPUÉS:**
```typescript
// Eliminar completamente - ya no se usa
```

**Acción:** Eliminar la variable `topUsers` (no se usa en el componente)

---

### **3. src/lib/globe/BottomSheet.svelte**

#### **Eliminar generación de datos históricos mock (líneas 59-108):**

**ANTES:**
```typescript
function generateHistoricalData(days: number, targetPct?: number): {x: number, y: number, votes: number}[] {
  const data = [];
  const now = Date.now();
  const baseValue = targetPct !== undefined ? targetPct : (30 + Math.random() * 40);
  const baseVotes = 5000 + Math.random() * 10000;
  // ... más código con Math.random()
  return data;
}
```

**DESPUÉS:**
```typescript
async function loadHistoricalData(pollId: number, days: number) {
  try {
    const response = await fetch(`/api/polls/${pollId}/history?days=${days}`);
    if (!response.ok) throw new Error('Failed to load history');
    const { data } = await response.json();
    return data.map((item: any) => ({
      x: new Date(item.recordedAt).getTime(),
      y: item.percentage,
      votes: item.voteCount,
    }));
  } catch (error) {
    console.error('Error loading historical data:', error);
    return [];
  }
}
```

#### **Eliminar nombres de creadores mock (líneas 1316-1400+):**

**BUSCAR y REEMPLAZAR:**
```typescript
// ANTES:
{@const creatorNames = ['María González', 'Carlos Ruiz', 'Ana López', 'Pedro Martínez']}
{@const creatorName = creatorNames[Math.floor(Math.random() * creatorNames.length)]}
{@const avatarHue = Math.floor(Math.random() * 360)}

// DESPUÉS: Usar datos reales del poll
{#if poll.creator}
  <img src={poll.creator.avatarUrl} alt={poll.creator.name} />
  <span>{poll.creator.name}</span>
{/if}
```

#### **Eliminar avatares con pravatar.cc:**

**BUSCAR:** `i.pravatar.cc`
**REEMPLAZAR:** Usar avatares de la base de datos

```typescript
// ANTES:
src={`https://i.pravatar.cc/40?u=${encodeURIComponent(option.key)}`}

// DESPUÉS:
src={option.avatarUrl || '/default-avatar.png'}
```

#### **Eliminar estadísticas aleatorias:**

**BUSCAR:** `Math.floor(Math.random() * 2000)`, `Math.floor(Math.random() * 300)`, etc.

**REEMPLAZAR:** Usar datos reales de `poll.totalVotes`, `poll.totalViews`, etc.

---

### **4. src/lib/GlobeGL.svelte**

#### **Eliminar generación de datos mock:**

**BUSCAR todas las ocurrencias de `Math.random()` y reemplazar con datos de la API**

Ejemplo:
```typescript
// ANTES:
const mockData = {
  votes: Math.floor(Math.random() * 1000),
  // ...
};

// DESPUÉS:
const pollData = await fetch(`/api/polls/${pollId}/stats`).then(r => r.json());
```

---

## 🔍 Búsqueda Global de Math.random()

**Comando para encontrar todas las ocurrencias:**
```bash
grep -r "Math.random()" src/ --include="*.svelte" --include="*.ts"
```

**Archivos afectados:**
- `src/lib/globe/BottomSheet.svelte` - 38 ocurrencias
- `src/lib/GlobeGL.svelte` - 10 ocurrencias  
- `src/lib/header.svelte` - 5 ocurrencias
- `src/routes/+page.svelte` - 10 ocurrencias

---

## 🌐 URLs Externas a Reemplazar

### **1. pravatar.cc**
```bash
grep -r "pravatar.cc" src/
```
**Reemplazar con:** Avatares desde la base de datos

### **2. randomuser.me**
```bash
grep -r "randomuser.me" src/
```
**Reemplazar con:** Usuarios desde `/api/featured-users`

### **3. unsplash.com**
```bash
grep -r "unsplash.com" src/
```
**Mantener:** Son imágenes reales, pero considerar moverlas a un CDN propio

---

## 📝 Script de Limpieza Automática

Crear `scripts/cleanup.sh`:

```bash
#!/bin/bash

echo "🧹 Iniciando limpieza de datos mock..."

# Eliminar archivos de datos mock
echo "📁 Eliminando archivos mock..."
rm -f src/lib/poll-data.ts
rm -f src/lib/data/featured-users.ts
rm -f static/data/votes-example.json

echo "✅ Archivos eliminados"

# Buscar Math.random()
echo "🔍 Buscando Math.random()..."
grep -r "Math.random()" src/ --include="*.svelte" --include="*.ts" || echo "✅ No se encontró Math.random()"

# Buscar pravatar.cc
echo "🔍 Buscando pravatar.cc..."
grep -r "pravatar.cc" src/ || echo "✅ No se encontró pravatar.cc"

# Buscar randomuser.me
echo "🔍 Buscando randomuser.me..."
grep -r "randomuser.me" src/ || echo "✅ No se encontró randomuser.me"

echo "🎉 Limpieza completada!"
```

---

## ✅ Verificación Final

Después de la limpieza, verificar:

- [ ] No hay referencias a `Math.random()`
- [ ] No hay URLs de `pravatar.cc`
- [ ] No hay URLs de `randomuser.me`
- [ ] Todos los componentes usan datos de la API
- [ ] Las encuestas se cargan desde `/api/polls`
- [ ] Los votos se obtienen desde `/api/votes/geo`
- [ ] Los usuarios destacados vienen de `/api/featured-users`

**Comando de verificación:**
```bash
npm run dev
# Abrir http://localhost:5173
# Verificar que todo funciona con datos reales
```

---

## 🚀 Próximos Pasos

1. **Implementar votación real** en GlobeGL.svelte
2. **Agregar geolocalización** del usuario
3. **Implementar autenticación** (opcional)
4. **Optimizar queries** de la base de datos
5. **Agregar caché** para mejorar rendimiento

---

## 📊 Estado Actual

✅ **Completado:**
- Base de datos creada
- API endpoints funcionando
- Seed con datos de ejemplo

⏳ **Pendiente:**
- Limpiar datos mock de componentes
- Conectar frontend con API
- Implementar votación real
- Agregar geolocalización

---

## 🆘 Ayuda

Si encuentras errores después de la limpieza:

1. **Verificar que la API funciona:**
   ```bash
   curl http://localhost:5173/api/polls
   ```

2. **Ver logs de Prisma:**
   ```bash
   # Agregar a .env
   DEBUG="prisma:*"
   ```

3. **Resetear base de datos:**
   ```bash
   npx prisma migrate reset
   npx tsx prisma/seed.ts
   ```
