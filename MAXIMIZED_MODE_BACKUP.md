# BACKUP: Código de Modo Maximizado - CreatePollModal

**Fecha**: 5 de Noviembre, 2025
**Motivo**: Funcionalidad de maximizado causaba problemas de renderizado y se decidió simplificar el modal

---

## Variables de Estado (Script)

```typescript
// Modo maximizado
let maximizedOption = $state<string | null>(null);
let previousMaximizedOption = $state<string | null>(null);

// Swipe/Drag para slider horizontal
let isDragging = $state(false);
let isSwiping = $state(false);
let swipeStartX = $state(0);
let swipeStartY = $state(0);
let swipeCurrentX = $state(0);

// Ref para el grid
let gridRef: HTMLDivElement;
```

---

## Efectos Reactivos ($effect)

### 1. Efecto de Slider Horizontal (Transform3D)

```typescript
$effect(() => {
  if (typeof document !== 'undefined' && gridRef && maximizedOption) {
    // Encontrar el índice de la opción maximizada
    const currentIdx = options.findIndex(opt => opt.id === maximizedOption);
    console.log('[CreatePoll Slider] 🎯 Efecto ejecutado, maximizedOption:', maximizedOption);
    console.log('[CreatePoll Slider] 📍 currentIdx encontrado:', currentIdx);
    
    if (currentIdx >= 0) {
      if (previousMaximizedOption && previousMaximizedOption !== maximizedOption) {
        console.log('[CreatePoll Slider] 🎬 Cambiando de card, pausando videos...');
        pauseAllVideos();
      }
      
      previousMaximizedOption = maximizedOption;
      
      // Calcular el desplazamiento horizontal basado en el ancho del contenedor
      const container = gridRef.parentElement;
      const cardWidth = container ? container.offsetWidth : window.innerWidth;
      const offset = currentIdx * cardWidth;
      
      console.log('[CreatePoll Slider] 📊 Aplicando transform:', {
        currentIdx,
        cardWidth,
        containerWidth: container?.offsetWidth,
        offset,
        transform: `translate3d(-${offset}px, 0, 0)`
      });
      
      console.log('[CreatePoll Slider] 🔍 gridRef:', {
        element: gridRef,
        classList: gridRef.className,
        width: gridRef.offsetWidth,
        childrenCount: gridRef.children.length,
        currentTransform: gridRef.style.transform
      });
      
      // Aplicar transform3d al contenedor
      gridRef.style.transform = `translate3d(-${offset}px, 0, 0)`;
      gridRef.style.transition = previousMaximizedOption ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none';
      
      console.log('[CreatePoll Slider] ✅ Transform aplicado:', gridRef.style.transform);
      console.log('[CreatePoll Slider] 📏 Grid width computado:', window.getComputedStyle(gridRef).width);
    } else {
      console.log('[CreatePoll Slider] ❌ currentIdx es -1, opción no encontrada');
    }
  } else if (!maximizedOption && typeof document !== 'undefined' && gridRef) {
    // RESETEAR el transform cuando se sale del modo maximizado
    console.log('[CreatePoll Slider] 🔄 Reseteando transform');
    gridRef.style.transform = '';
    gridRef.style.transition = '';
    
    // NO pausar videos al salir de maximizado - mantener reproducción
    console.log('[CreatePoll Slider] ✅ Segunda pausa de seguridad');
  }
});
```

### 2. Efecto de Guardado de URLs

```typescript
$effect(() => {
  if (isOpen && options.length > 0) {
    console.log('[URL Saver] 🔍 Guardando URLs de opciones...');
    
    for (const option of options) {
      // Primero verificar si ya hay un preview cacheado para esta opción
      const existingPreview = optionPreviews.get(option.id);
      
      if (existingPreview?.url && !optionUrls.has(option.id)) {
        // Prioridad 1: URL del preview ya cacheado
        optionUrls.set(option.id, existingPreview.url);
        console.log('[URL Saver] ✅ URL guardada desde preview cacheado:', option.id, '→', existingPreview.url);
      } else if (option.imageUrl && !optionUrls.has(option.id)) {
        // Prioridad 2: imageUrl de la opción
        optionUrls.set(option.id, option.imageUrl);
        console.log('[URL Saver] ✅ URL guardada desde imageUrl:', option.id, '→', option.imageUrl);
      } else if (option.label) {
        // Prioridad 3: URLs detectadas en el label
        const urls = extractUrls(option.label);
        if (urls.length > 0 && !optionUrls.has(option.id)) {
          optionUrls.set(option.id, urls[0]);
          console.log('[URL Saver] ✅ URL guardada desde label:', option.id, '→', urls[0]);
        }
      }
    }
    
    // Forzar actualización del Map
    optionUrls = optionUrls;
    
    console.log('[URL Saver] 📊 Total URLs guardadas:', optionUrls.size);
    console.log('[URL Saver] 🗺️ Contenido del Map:', Array.from(optionUrls.entries()));
  }
});
```

### 3. Efecto de Carga de Preview en Maximizado

```typescript
$effect(() => {
  if (maximizedOption) {
    console.log('[Preview Effect] 🔍 Opción maximizada:', maximizedOption);
    
    // 🆕 PRIMERO: Poblar el Map con URLs de TODAS las opciones si está vacío
    if (optionUrls.size === 0) {
      console.log('[Preview Effect] 🚨 Map vacío, poblando con todas las opciones...');
      for (const opt of options) {
        const preview = optionPreviews.get(opt.id);
        if (preview?.url) {
          optionUrls.set(opt.id, preview.url);
          console.log('[Preview Effect] ➕ Agregada URL al Map:', opt.id, '→', preview.url);
        } else if (opt.imageUrl) {
          optionUrls.set(opt.id, opt.imageUrl);
          console.log('[Preview Effect] ➕ Agregada imageUrl al Map:', opt.id, '→', opt.imageUrl);
        }
      }
      optionUrls = optionUrls;
      console.log('[Preview Effect] ✅ Map poblado con', optionUrls.size, 'URLs');
    }
    
    // Obtener URL del Map persistente
    const savedUrl = optionUrls.get(maximizedOption);
    console.log('[Preview Effect] 📦 URL guardada en Map:', savedUrl);
    
    const option = options.find(opt => opt.id === maximizedOption);
    if (option) {
      console.log('[Preview Effect] ✅ Opción encontrada:', { 
        id: option.id, 
        label: option.label, 
        imageUrl: option.imageUrl,
        savedUrl 
      });
      
      const hasPreview = optionPreviews.has(option.id);
      const isLoading = loadingPreviews.has(option.id);
      console.log('[Preview Effect] 📊 Estado:', { hasPreview, isLoading });
      
      // Si hay URL guardada, SIEMPRE cargar (aunque ya exista en cache)
      if (savedUrl && !isLoading) {
        console.log('[Preview Effect] 🚀 Cargando preview desde URL guardada:', savedUrl);
        detectAndLoadOptionPreview(option.id, savedUrl);
      } else if (!savedUrl) {
        console.log('[Preview Effect] ⚠️ No hay URL guardada para esta opción');
      } else {
        console.log('[Preview Effect] ⏭️ Skip - Está cargando');
      }
    } else {
      console.log('[Preview Effect] ❌ Opción NO encontrada');
    }
  }
});
```

---

## Funciones

### Funciones de Navegación

```typescript
function navigateToPreviousOption() {
  if (!maximizedOption) return;
  const currentIdx = options.findIndex(opt => opt.id === maximizedOption);
  if (currentIdx > 0) {
    maximizedOption = options[currentIdx - 1].id;
  }
}

function navigateToNextOption() {
  if (!maximizedOption) return;
  const currentIdx = options.findIndex(opt => opt.id === maximizedOption);
  if (currentIdx < options.length - 1) {
    maximizedOption = options[currentIdx + 1].id;
  }
}
```

### Funciones de Swipe/Drag

```typescript
function handleSwipeStart(e: TouchEvent | PointerEvent) {
  const target = e.target as HTMLElement;
  
  // NO capturar si el click es en el media-background o dentro de él
  if (target.closest('.option-media-background')) {
    console.log('[CreatePoll Swipe] ❌ Click en media-background, NO capturar');
    return;
  }
  
  const touch = 'touches' in e ? e.touches[0] : e;
  swipeStartX = touch.clientX;
  swipeStartY = touch.clientY;
  isSwiping = true;
  console.log('[CreatePoll Swipe] 👇 Swipe iniciado:', { x: swipeStartX, y: swipeStartY });
}

function handleSwipeMove(e: TouchEvent | PointerEvent) {
  if (!isSwiping) return;
  
  const touch = 'touches' in e ? e.touches[0] : e;
  swipeCurrentX = touch.clientX;
  
  const deltaX = Math.abs(swipeCurrentX - swipeStartX);
  const deltaY = Math.abs(touch.clientY - swipeStartY);
  
  if (deltaX > 10 && deltaX > deltaY) {
    e.preventDefault();
  }
}

function handleSwipeEnd(e: TouchEvent | PointerEvent) {
  if (!isSwiping) return;
  
  const touch = 'changedTouches' in e ? e.changedTouches[0] : e;
  const deltaX = touch.clientX - swipeStartX;
  const deltaY = Math.abs(touch.clientY - swipeStartY);
  
  if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > deltaY * 2) {
    if (deltaX < 0) {
      navigateToNextOption();
    } else {
      navigateToPreviousOption();
    }
  }
  
  isSwiping = false;
  swipeStartX = 0;
  swipeStartY = 0;
  swipeCurrentX = 0;
}

function handlePointerDown(e: PointerEvent) {
  if (maximizedOption) return;
  isDragging = true;
}

function handlePointerUp() {
  isDragging = false;
}
```

---

## HTML - Bloque de Navegación Maximizada

```svelte
<!-- Navegación para card maximizada (fuera de vote-cards-container) -->
{#if maximizedOption}
  <div class="maximized-navigation">
    <!-- Puntos de paginación -->
    <div class="maximized-dots">
      {#each options as opt, idx}
        <button
          type="button"
          class="dot {maximizedOption === opt.id ? 'active' : ''}"
          onclick={() => maximizedOption = opt.id}
          style="background: {maximizedOption === opt.id ? opt.color : 'rgba(255,255,255,0.5)'}"
          aria-label="Ir a opción {idx + 1}"
        ></button>
      {/each}
    </div>
    
    <!-- Flechas de navegación -->
    <button
      type="button"
      class="nav-arrow left"
      onclick={navigateToPreviousOption}
      disabled={options.findIndex(opt => opt.id === maximizedOption) === 0}
      aria-label="Opción anterior"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M15 18l-6-6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    
    <button
      type="button"
      class="nav-arrow right"
      onclick={navigateToNextOption}
      disabled={options.findIndex(opt => opt.id === maximizedOption) === options.length - 1}
      aria-label="Siguiente opción"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M9 18l6-6-6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
{/if}
```

---

## CSS - Estilos de Maximizado

```css
/* ============================================
   MODO MAXIMIZADO - SLIDER HORIZONTAL
   ============================================ */

/* Backdrop negro detrás del contenedor maximizado */
.vote-cards-container.maximized::before {
  content: '';
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 5;
  backdrop-filter: blur(4px);
}

/* Contenedor padre cuando hay cards maximizadas */
.vote-cards-container.maximized {
  position: fixed !important;
  inset: 0 !important;
  margin: auto !important;
  width: 100vw !important;
  max-width: 700px !important;
  height: 70vh !important;
  max-height: 900px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important;
  z-index: 10 !important;
}

/* Contenedor de cards maximizadas: slider horizontal */
.vote-cards-grid.has-maximized {
  /* Sobrescribir TODOS los estilos del grid base */
  display: flex !important;
  flex-direction: row !important;
  flex: none !important;
  width: calc(var(--items) * 100%) !important; /* 🔧 Ancho dinámico para N opciones */
  height: 100% !important;
  min-height: 70vh !important;
  max-height: 900px !important;
  gap: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
  grid-template-columns: none !important;
  grid-auto-flow: unset !important;
  grid-auto-columns: unset !important;
  /* transform3d se aplica dinámicamente desde JS */
  will-change: transform;
  align-items: center !important;
  position: relative !important;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* TODAS las cards dentro del grid maximizado necesitan estos estilos base */
.vote-cards-container.maximized .vote-cards-grid.has-maximized .vote-card,
.vote-cards-container.maximized .vote-cards-grid.has-maximized button.vote-card {
  flex: 0 0 100% !important;
  width: 100% !important;
  min-width: 100% !important;
  height: 100% !important;
  min-height: 70vh !important;
  max-height: 900px !important;
  display: flex !important;
  flex-direction: column !important;
  position: relative !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  overflow: hidden !important;
}

/* Forzar que TODAS las cards en maximizado muestren su contenido completo */
.vote-cards-container.maximized .vote-cards-grid.has-maximized .vote-card .question-title,
.vote-cards-container.maximized .vote-cards-grid.has-maximized .vote-card .card-header,
.vote-cards-container.maximized .vote-cards-grid.has-maximized .vote-card .card-content {
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
}

/* MAXIMIZADO: Habilitar interacción completa con videos */
.vote-cards-container.maximized .vote-cards-grid.has-maximized .vote-card.is-maximized .option-media-background {
  pointer-events: auto !important;
  z-index: 1 !important;
  position: relative !important;
}

.vote-cards-container.maximized .vote-cards-grid.has-maximized .vote-card.is-maximized .option-media-background :global(*) {
  pointer-events: auto !important;
  z-index: 1 !important;
}

/* Asegurar que iframes/videos sean clickeables */
.vote-cards-container.maximized .vote-cards-grid.has-maximized .vote-card.is-maximized .option-media-background :global(iframe),
.vote-cards-container.maximized .vote-cards-grid.has-maximized .vote-card.is-maximized .option-media-background :global(video) {
  pointer-events: auto !important;
  z-index: 2 !important;
  position: relative !important;
}

/* MAXIMIZADO: Cards NO maximizadas tienen preview pero sin interacción */
.vote-cards-container.maximized .vote-cards-grid.has-maximized .vote-card:not(.is-maximized) .option-media-background {
  pointer-events: none !important;
}

/* Navegación de modo maximizado */
.maximized-navigation {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 20px;
}

.maximized-dots {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 20px;
  backdrop-filter: blur(10px);
}

.maximized-dots .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0;
}

.maximized-dots .dot.active {
  width: 24px;
  border-radius: 4px;
}

.nav-arrow {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-arrow:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.8);
  transform: scale(1.1);
}

.nav-arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
```

---

## Notas Técnicas

### Problemas Encontrados

1. **Renderizado Condicional**: El `{#if}` no se ejecutaba para todas las opciones cuando se maximizaba
2. **Key Blocks**: Los `{#key}` blocks destruían el grid y perdían el `gridRef`
3. **Transform3D**: Se aplicaba correctamente pero el contenido no era visible por problemas de renderizado
4. **Timing**: El Map de URLs se poblaba después del render inicial
5. **CSS z-index**: Conflictos entre card-header, media-background y botones

### Soluciones Intentadas

- ✅ Dividir condición de renderizado en dos ramas (maximizado vs normal)
- ✅ Poblar Map de URLs al maximizar si está vacío
- ✅ Eliminar key blocks que destruían el grid
- ✅ Ajustar z-index y pointer-events para interacción
- ❌ No se logró solucionar el problema de renderizado completo

### Estado Final

El slider horizontal funciona técnicamente (transform3D se aplica correctamente) pero visualmente solo se renderiza la primera opción o las últimas 3 opciones que tienen URLs guardadas. Las primeras 4-5 opciones no se renderizan inicialmente.

---

**FIN DEL BACKUP**
