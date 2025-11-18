# 📚 GUÍA DE REFACTORIZACIÓN DE voutop

**Fecha:** 3 de Noviembre, 2025
**Estado:** En Progreso

---

## 🎯 RESUMEN DE CAMBIOS

Esta refactorización busca mejorar la mantenibilidad, performance y escalabilidad del proyecto sin cambiar funcionalidades existentes.

### Mejoras Implementadas

✅ **1. Optimización de Base de Datos**
- 15+ índices compuestos añadidos
- Queries críticas optimizadas (votos por subdivisión, trending, etc.)
- Script de verificación de índices incluido
- Mejora estimada: 40-60% en queries frecuentes

✅ **2. Code Splitting Avanzado**
- Chunks separados para dependencias pesadas (Three.js ~750KB, D3 ~250KB)
- Modals con lazy loading
- Bundle size reducido estimado: 30-40%
- Mejor caching con hashes en nombres de archivos

✅ **3. Event Listener Management**
- Sistema centralizado para cleanup automático
- Prevención de memory leaks
- Utilidades: throttle, debounce, addListener
- Clase `EventListenerManager` reutilizable

✅ **4. Stores Centralizados (Svelte 5)**
- Estado global organizado en `globalState.ts`
- 10+ stores con derived stores
- Elimina props drilling
- Debug helpers incluidos

✅ **5. Servicios Extraídos**
- `GeocodeService`: Geolocalización y geocoding
- `PollDataService`: Carga y agregación de datos de encuestas
- `LabelManager`: Gestión de etiquetas del globo con LOD
- Código testeable y reutilizable

---

## 📁 NUEVA ESTRUCTURA DE ARCHIVOS

```
src/lib/
├── services/                    # 🆕 Servicios reutilizables
│   ├── GeocodeService.ts        # Geolocalización (GPS → IP → Default)
│   ├── PollDataService.ts       # Carga de datos de encuestas
│   └── LabelManager.ts          # Generación de etiquetas LOD
├── stores/                      # 🆕 Estado centralizado
│   └── globalState.ts           # Stores Svelte 5 + derived
├── utils/                       # 🆕 Utilidades
│   └── eventListenerCleanup.ts  # Event listener manager
├── components/                  # Componentes existentes
├── api/                         # Cliente API existente
└── ...
```

---

## 🔄 GUÍA DE MIGRACIÓN

### 1. Usar Stores Centralizados

**❌ ANTES (Props Drilling):**
```svelte
<!-- +page.svelte -->
<GlobeGL 
  bind:activePoll 
  bind:navigationState
  {answersData}
  {colorMap}
/>

<!-- Dentro de GlobeGL.svelte -->
let activePoll = $state(null);
let navigationState = $state({ level: 'world' });
```

**✅ DESPUÉS (Stores):**
```svelte
<!-- +page.svelte -->
<GlobeGL />

<!-- Dentro de GlobeGL.svelte -->
<script lang="ts">
  import { activePoll, navigationState, answersData } from '$lib/stores/globalState';
  
  // Usar directamente
  $: console.log('Poll activo:', $activePoll);
  
  // Modificar
  activePoll.open(newPoll);
  navigationState.navigateToCountry('ESP', 'España');
</script>
```

### 2. Usar Event Listener Manager

**❌ ANTES (Manual Cleanup):**
```svelte
<script>
  onMount(() => {
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  });
  
  onDestroy(() => {
    document.removeEventListener('pointermove', handleMove);
    document.removeEventListener('pointerup', handleUp);
  });
</script>
```

**✅ DESPUÉS (Manager Automático):**
```svelte
<script>
  import { createEventListenerManager } from '$lib/utils/eventListenerCleanup';
  
  const listeners = createEventListenerManager();
  
  onMount(() => {
    listeners.add(document, 'pointermove', handleMove);
    listeners.add(document, 'pointerup', handleUp);
  });
  
  onDestroy(() => {
    listeners.cleanup(); // Remueve TODOS automáticamente
  });
</script>
```

### 3. Usar Servicios

**❌ ANTES (Lógica en Componente):**
```svelte
<script>
  async function getUserLocation() {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      return { lat: position.coords.latitude, lon: position.coords.longitude };
    } catch (error) {
      // Fallback a IP...
      // 50+ líneas más...
    }
  }
</script>
```

**✅ DESPUÉS (Servicio):**
```svelte
<script>
  import { geocodeService } from '$lib/services/GeocodeService';
  
  async function getUserLocation() {
    const { location, geocode } = await geocodeService.getLocationAndGeocode();
    return { lat: location.latitude, lon: location.longitude };
  }
</script>
```

### 4. Usar PollDataService

**❌ ANTES:**
```svelte
<script>
  async function loadPollData(pollId: number) {
    const response = await apiCall(`/api/polls/${pollId}/votes-by-country`);
    const { data } = await response.json();
    // Procesar datos...
    answersData = data;
  }
</script>
```

**✅ DESPUÉS:**
```svelte
<script>
  import { pollDataService } from '$lib/services/PollDataService';
  import { answersData } from '$lib/stores/globalState';
  
  async function loadPollData(pollId: number) {
    const data = await pollDataService.loadVotesByCountry(pollId);
    answersData.set(data);
  }
</script>
```

---

## 🧪 TESTING

### Verificar Stores

```javascript
// En la consola del navegador
import { debugStores } from '$lib/stores/globalState';
debugStores();
```

### Verificar Event Listeners

```javascript
// En componente
console.log('Listeners activos:', listeners.count);
console.log('Lista:', listeners.list());
```

### Verificar Índices de BD

```bash
# Ejecutar en PostgreSQL
psql -d voutop -f scripts/check-db-indices.sql
```

---

## 📊 MÉTRICAS ESPERADAS

### Performance

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Bundle size (gzip) | ~1.2MB | ~800KB | 33% ↓ |
| Query de votos por subdivisión | ~200ms | ~80ms | 60% ↓ |
| Query trending polls | ~150ms | ~60ms | 60% ↓ |
| Memory leaks (listeners) | Sí (posibles) | No | ✅ |
| Re-renders innecesarios | Frecuentes | Reducidos | ~40% ↓ |

### Mantenibilidad

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| GlobeGL.svelte líneas | 6,071 | ~4,500* | 25% ↓ |
| Código duplicado | Alto | Bajo | ✅ |
| Testabilidad | Baja | Alta | ✅ |
| Complejidad ciclomática | >15 | <10* | ✅ |

*Objetivos tras refactorización completa (en progreso)

---

## 🚧 PRÓXIMOS PASOS

### Fase Actual: Refactorización de GlobeGL.svelte

**Pendiente:**
1. [ ] Extraer NavigationManager como servicio
2. [ ] Extraer ColorManager para cálculo de colores
3. [ ] Simplificar funciones >100 líneas
4. [ ] Migrar a stores centralizados
5. [ ] Añadir memoización con $derived

### Fase Futura

1. [ ] Refactorizar CreatePollModal.svelte (4908 líneas)
2. [ ] Implementar testing suite (Vitest + Playwright)
3. [ ] Mejorar accesibilidad (ARIA, keyboard nav)
4. [ ] Documentación con JSDoc/TSDoc
5. [ ] Performance monitoring (Real User Monitoring)

---

## ⚠️ CONSIDERACIONES

### Compatibilidad

- ✅ Svelte 5 runes (`$state`, `$derived`, `$effect`)
- ✅ TypeScript strict mode
- ✅ Node 18+ required
- ✅ PostgreSQL 14+

### Breaking Changes

**Ninguno.** Todos los cambios son internos y no afectan la API pública de componentes.

### Rollback

Cada mejora está aislada y puede revertirse independientemente:
- Stores: Volver a props drilling
- Services: Código inline en componentes
- Event listeners: Cleanup manual
- Code splitting: Configuración anterior de Vite

---

## 📚 RECURSOS

### Documentación

- [Svelte 5 Runes](https://svelte.dev/docs/svelte/what-are-runes)
- [SvelteKit Stores](https://svelte.dev/docs/svelte-store)
- [Vite Code Splitting](https://vitejs.dev/guide/build.html#chunking-strategy)

### Scripts Útiles

```bash
# Aplicar migración de índices
npm run db:migrate

# Verificar índices
npm run db:check-indices

# Build con análisis de bundle
npm run build -- --mode analyze

# Linting
npm run lint
```

---

## 🤝 CONTRIBUCIÓN

Al trabajar en esta refactorización:

1. **No cambiar funcionalidad**: Solo estructura interna
2. **Mantener compatibilidad**: No breaking changes
3. **Testing obligatorio**: Verificar que todo funciona igual
4. **Documentar cambios**: Actualizar este archivo

---

*Documento en progreso - Se actualizará con cada fase completada*
