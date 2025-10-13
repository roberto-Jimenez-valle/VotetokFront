# ✅ Sistema de Contador de Tiempo Implementado

## 🎉 Resumen

Se ha implementado completamente el sistema de contador de tiempo para encuestas en vivo. Ahora las encuestas con límite de tiempo muestran un indicador visual que se actualiza automáticamente.

---

## 📋 Cambios Realizados

### 1. **Backend - API de Creación de Encuestas** ✅

**Archivo**: `src/routes/api/polls/+server.ts`

- **Endpoint POST agregado** para crear encuestas
- **Cálculo automático de `closedAt`** basado en el campo `duration`
- Soporte para duraciones: `1d`, `3d`, `7d`, `30d`, `never`
- Transacciones seguras con Prisma para crear encuesta + opciones + hashtags

```typescript
// Ejemplo de cálculo
if (duration === '7d') {
  closedAt = new Date();
  closedAt.setDate(closedAt.getDate() + 7); // 7 días desde ahora
}
```

### 2. **Frontend - Funciones Helper** ✅

**Archivo**: `src/lib/globe/BottomSheet.svelte`

**Funciones agregadas:**

#### `getTimeRemaining(closedAt)`
Calcula el tiempo restante en formato legible:
- `> 1 día`: "3d 12h"
- `< 1 día, > 1 hora`: "5h 30m"
- `< 1 hora`: "45m"
- Expirada: "Cerrada"

#### `getTimeRemainingColor(closedAt)`
Determina el color del indicador:
- 🟢 **Verde**: > 6 horas restantes
- 🟡 **Amarillo**: 1-6 horas restantes
- 🔴 **Rojo**: < 1 hora restante (con animación pulsante)
- ⚪ **Gris**: Encuesta cerrada

#### `isPollExpired(closedAt)`
Verifica si una encuesta ha expirado

#### `canVoteOnPoll(poll)`
Verifica si una encuesta acepta votos (activa y no expirada)

**Auto-actualización:**
- Intervalo de 60 segundos para actualizar todos los contadores
- Se ejecuta automáticamente en `onMount()`

### 3. **UI - Indicadores Visuales** ✅

**Ubicaciones donde aparece el contador:**

#### A) Encuesta activa principal
```svelte
<div class="header-title-row">
  <h3>Título de la encuesta</h3>
  <div class="time-remaining-badge red">
    🔴 <span>2h 15m</span>
  </div>
</div>
```

#### B) Encuestas adicionales (todas)
- Encuestas tipo 'hashtag'
- Encuestas tipo 'trending'
- Encuestas normales

Todas muestran el indicador junto al título.

### 4. **Estilos CSS** ✅

**Clases agregadas:**

```css
.time-remaining-badge {
  /* Badge redondeado con padding */
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

/* Estados con colores específicos */
.time-remaining-badge.green { /* > 6h */ }
.time-remaining-badge.yellow { /* 1-6h */ }
.time-remaining-badge.red { /* < 1h - con animación */ }
.time-remaining-badge.expired { /* Cerrada */ }
```

**Animación de urgencia:**
```css
@keyframes pulse-badge {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(0.98); }
}
```

---

## 🎨 Ejemplos Visuales

### Estado Normal (> 6 horas)
```
┌─────────────────────────────────────┐
│ ¿Cuál es tu comida favorita?  🟢 2d │
├─────────────────────────────────────┤
│ Encuesta • España                   │
└─────────────────────────────────────┘
```

### Estado Advertencia (1-6 horas)
```
┌─────────────────────────────────────┐
│ ¿Prefieres perros o gatos?  🟡 3h 20m│
├─────────────────────────────────────┤
│ Encuesta • Madrid                   │
└─────────────────────────────────────┘
```

### Estado Urgente (< 1 hora) - Animado
```
┌─────────────────────────────────────┐
│ ¿Mejor equipo 2025?  🔴 45m [pulsa] │
├─────────────────────────────────────┤
│ Encuesta • Barcelona                │
└─────────────────────────────────────┘
```

### Estado Cerrada
```
┌─────────────────────────────────────┐
│ Encuesta histórica  ⏱️ Cerrada      │
├─────────────────────────────────────┤
│ Encuesta • Global                   │
└─────────────────────────────────────┘
```

---

## 🚀 Cómo Probar

### 1. **Crear una encuesta de prueba**

Abre el modal de crear encuesta y:
1. Escribe un título: "¿Pizza o Hamburguesa?"
2. Agrega 2 opciones: "Pizza" y "Hamburguesa"
3. Selecciona duración: **"1 día"** o **"3 días"**
4. Crea la encuesta

### 2. **Verificar el contador**

La encuesta debería aparecer con:
- Badge verde mostrando tiempo restante (ej: "1d 0h")
- El contador se actualiza cada minuto

### 3. **Probar estados de urgencia**

Para probar estados de urgencia sin esperar, puedes:

**Opción A:** Modificar manualmente una encuesta en la base de datos:
```javascript
// En prisma studio o sqlite
UPDATE polls 
SET closedAt = datetime('now', '+30 minutes') 
WHERE id = [ID_DE_TU_ENCUESTA];
```

**Opción B:** Crear encuestas con `closedAt` específico:
```typescript
// Modificar temporalmente el código para testing
closedAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
```

### 4. **Observar la actualización automática**

- El contador se actualiza cada 60 segundos
- No necesitas recargar la página
- Los cambios de color son automáticos

---

## 🔧 Configuración Técnica

### Intervalos de Tiempo

```typescript
const TIME_THRESHOLDS = {
  URGENT: 1 * 60 * 60 * 1000,      // 1 hora en ms
  WARNING: 6 * 60 * 60 * 1000,     // 6 horas en ms
  UPDATE_INTERVAL: 60 * 1000       // Actualizar cada 60s
};
```

### Formato de Duración

En el backend, la duración se recibe como string:
- `"1d"` → 1 día
- `"3d"` → 3 días
- `"7d"` → 7 días
- `"30d"` → 30 días
- `"never"` → Sin límite (closedAt = null)

---

## 📊 Datos en la Base de Datos

### Tabla `polls`

```sql
CREATE TABLE polls (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  closedAt DATETIME,  -- ← Nuevo campo calculado
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- ... otros campos
);
```

### Consultas Útiles

**Ver encuestas con tiempo:**
```sql
SELECT id, title, closedAt, 
       datetime(closedAt, 'localtime') as cierra_a_las,
       CAST((julianday(closedAt) - julianday('now')) * 24 AS INTEGER) as horas_restantes
FROM polls 
WHERE closedAt IS NOT NULL
ORDER BY closedAt ASC;
```

**Encuestas que cierran pronto:**
```sql
SELECT id, title, closedAt
FROM polls 
WHERE closedAt IS NOT NULL 
  AND closedAt > datetime('now')
  AND closedAt < datetime('now', '+1 hour')
ORDER BY closedAt ASC;
```

---

## 🎯 Próximos Pasos (Opcional)

### 1. Auto-cierre de encuestas
Crear un cron job o middleware que cierre automáticamente encuestas expiradas:

```typescript
// Ejecutar periódicamente
async function closeExpiredPolls() {
  await prisma.poll.updateMany({
    where: {
      status: 'active',
      closedAt: { lte: new Date() }
    },
    data: { status: 'closed' }
  });
}
```

### 2. Bloquear votación en encuestas cerradas
Agregar validación en el endpoint de voto:

```typescript
// src/routes/api/polls/[id]/vote/+server.ts
if (poll.closedAt && new Date(poll.closedAt) <= new Date()) {
  return error(400, 'Esta encuesta ya cerró');
}
```

### 3. Filtrar encuestas expiradas en trending
Modificar queries para excluir encuestas expiradas:

```typescript
where: {
  status: 'active',
  OR: [
    { closedAt: null },
    { closedAt: { gt: new Date() } }
  ]
}
```

### 4. Notificaciones
Mostrar notificación cuando una encuesta está por cerrar:
- Toast: "⏰ Esta encuesta cierra en 15 minutos"
- Badge en notificaciones

---

## ✅ Checklist de Funcionalidad

- [x] Backend calcula `closedAt` correctamente
- [x] Contador muestra tiempo restante
- [x] Formato legible (días, horas, minutos)
- [x] Colores según urgencia (verde/amarillo/rojo)
- [x] Animación en estado urgente (< 1h)
- [x] Auto-actualización cada minuto
- [x] Indicador en encuesta activa
- [x] Indicador en todas las encuestas adicionales
- [x] Estado "Cerrada" para encuestas expiradas
- [ ] Auto-cierre de encuestas (opcional)
- [ ] Bloqueo de votos en cerradas (opcional)
- [ ] Filtrado en trending (opcional)

---

## 🐛 Debugging

### Ver contadores en consola
```javascript
// En el navegador, inspecciona cualquier encuesta
console.log('Polls con tiempo:', trendingPollsData.filter(p => p.closedAt));
```

### Forzar actualización
```javascript
// Forzar re-render inmediato
additionalPolls = [...additionalPolls];
```

### Verificar cálculos
```javascript
const testDate = new Date('2025-01-13T20:00:00');
console.log('Tiempo restante:', getTimeRemaining(testDate));
console.log('Color:', getTimeRemainingColor(testDate));
```

---

## 📝 Notas

- Los timestamps están en **UTC** en la base de datos
- La conversión a hora local se hace en el frontend
- El intervalo de 60s es un balance entre UX y performance
- Para encuestas muy cortas (< 5 min), considera reducir el intervalo
