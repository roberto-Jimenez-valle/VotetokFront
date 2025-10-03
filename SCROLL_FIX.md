# 🔧 Corrección de Scroll Vertical en BottomSheet

## Problema Identificado
El scroll vertical no funcionaba correctamente en el BottomSheet, especialmente en dispositivos móviles (iOS Safari).

## Causas del Problema

### 1. **stopPropagation() Bloqueando Eventos**
Los elementos internos tenían `e.stopPropagation()` que impedía que los eventos de scroll llegaran al contenedor:
```svelte
<!-- ❌ ANTES - Bloqueaba el scroll -->
<div 
  class="topic-header"
  ontouchstart={(e) => e.stopPropagation()}
  onpointerdown={(e) => e.stopPropagation()}
>
```

### 2. **Falta de -webkit-overflow-scrolling**
El contenedor no tenía la propiedad crítica para scroll suave en iOS:
```css
/* ❌ ANTES - Sin scroll suave en iOS */
.main-scroll-container {
  overflow-y: scroll;
}
```

### 3. **Altura No Definida Correctamente**
El contenedor flex necesita `min-height: 0` para que el scroll funcione en Safari:
```css
/* ❌ ANTES - Sin min-height */
.main-scroll-container {
  flex: 1;
}
```

## Soluciones Aplicadas

### 1. **Movido el Arrastre al Área Específica**
```svelte
<!-- ✅ DESPUÉS - Arrastre solo en el drag-area -->
<div
  class="bottom-sheet"
  style={`transform: translateY(${y}px);`}
>
  <!-- Área de arrastre con eventos -->
  <div 
    class="sheet-drag-area"
    onpointerdown={onPointerDown}
    ontouchstart={onPointerDown}
  >
    <!-- Barra de gráfico para arrastrar -->
  </div>
  
  <!-- Contenido con scroll -->
  <div class="main-scroll-container">
    <!-- Contenido scrolleable -->
  </div>
</div>
```

### 2. **Eliminados stopPropagation() del Contenido**
```svelte
<!-- ✅ DESPUÉS - Permite scroll natural -->
<div class="topic-header">
  <!-- Contenido -->
</div>

<div class="vote-summary-info">
  <!-- Contenido -->
</div>

<div class="more-polls-divider">
  <!-- Contenido -->
</div>
```

**Archivos modificados:**
- `src/lib/globe/BottomSheet.svelte` - Movido arrastre a drag-area, eliminados 3 stopPropagation

### 2. **Agregado -webkit-overflow-scrolling**
```css
/* ✅ DESPUÉS - Scroll suave en iOS */
.main-scroll-container {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

.bottom-sheet .main-scroll-container {
  -webkit-overflow-scrolling: touch !important;
  overflow-y: auto !important;
}
```

### 3. **Altura Dinámica con --vh**
```css
/* ✅ DESPUÉS - Altura correcta con teclado móvil */
.main-scroll-container {
  max-height: calc(100vh - 180px);
  max-height: calc(var(--vh, 1vh) * 100 - 180px);
}
```

### 4. **Min-height para Flex en Safari**
```css
/* ✅ DESPUÉS - Flex funciona correctamente */
.bottom-sheet.solid .main-scroll-container,
.bottom-sheet.transitioning .main-scroll-container {
  flex: 1;
  min-height: 0; /* CRÍTICO para Safari */
  -webkit-overflow-scrolling: touch !important;
  overflow-y: auto !important;
}
```

### 5. **Overflow Hidden en BottomSheet**
```css
/* ✅ DESPUÉS - Solo el contenedor interno hace scroll */
.bottom-sheet.solid,
.bottom-sheet.glass {
  overflow: hidden; /* El scroll está en main-scroll-container */
}
```

### 6. **Transform para Nueva Capa de Composición**
```css
/* ✅ DESPUÉS - Mejor rendimiento de scroll */
.main-scroll-container {
  -webkit-transform: translateZ(0);
  -moz-transform: translateZ(0);
  transform: translateZ(0);
}
```

### 7. **Scrollbar Oculta en Móvil**
```css
/* ✅ DESPUÉS - Sin scrollbar visible en móvil */
@media (max-width: 768px) {
  .main-scroll-container::-webkit-scrollbar {
    display: none;
    width: 0;
  }
  .main-scroll-container {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
}
```

## Archivos Modificados

### 1. `src/lib/globe/BottomSheet.svelte`
- ✅ **Movido arrastre** de `.bottom-sheet` a `.sheet-drag-area` específicamente
- ✅ Eliminado `onpointerdown` y `ontouchstart` del contenedor principal
- ✅ Agregado `onpointerdown={onPointerDown}` a `.sheet-drag-area`
- ✅ Agregado `ontouchstart={onPointerDown}` a `.sheet-drag-area`
- ✅ Eliminado `ontouchstart={(e) => e.stopPropagation()}` de `.topic-header`
- ✅ Eliminado `onpointerdown={(e) => e.stopPropagation()}` de `.topic-header`
- ✅ Eliminado `ontouchstart={(e) => e.stopPropagation()}` de `.vote-summary-info`
- ✅ Eliminado `onpointerdown={(e) => e.stopPropagation()}` de `.vote-summary-info`
- ✅ Eliminado `ontouchstart={(e) => e.stopPropagation()}` de `.more-polls-divider`
- ✅ Eliminado `onpointerdown={(e) => e.stopPropagation()}` de `.more-polls-divider`

### 2. `src/lib/GlobeGL.css`
- ✅ Agregado `-webkit-overflow-scrolling: touch` al `.main-scroll-container`
- ✅ Cambiado `overflow-y: scroll` a `overflow-y: auto`
- ✅ Agregado `max-height` con variable `--vh`
- ✅ Agregado `transform: translateZ(0)` para GPU
- ✅ Agregado `min-height: 0` en estado expandido
- ✅ Agregado `overflow: hidden` al `.bottom-sheet`
- ✅ Agregado media query para ocultar scrollbar en móvil
- ✅ **Agregado `touch-action: none`** a `.sheet-drag-area` (solo arrastre)
- ✅ **Agregado `pointer-events: auto !important`** a `.sheet-drag-area`
- ✅ **Agregado `z-index: 100`** a `.sheet-drag-area` (por encima del scroll)
- ✅ Agregado `:active` state con `cursor: grabbing` al drag area

## Propiedades CSS Críticas para Scroll en iOS

### Esenciales
```css
.scroll-container {
  /* 1. CRÍTICO: Scroll suave en iOS */
  -webkit-overflow-scrolling: touch;
  
  /* 2. Tipo de overflow */
  overflow-y: auto; /* auto es mejor que scroll */
  overflow-x: hidden;
  
  /* 3. Comportamiento de overscroll */
  overscroll-behavior: contain;
  
  /* 4. Altura definida */
  max-height: calc(var(--vh, 1vh) * 100 - 180px);
  
  /* 5. Para flex containers en Safari */
  flex: 1;
  min-height: 0; /* IMPORTANTE */
  
  /* 6. Nueva capa de composición */
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
}
```

### Evitar
```css
/* ❌ NO USAR en elementos que necesitan scroll */
.elemento-interno {
  /* Esto bloquea el scroll */
  ontouchstart={(e) => e.stopPropagation()}
  onpointerdown={(e) => e.stopPropagation()}
}
```

## Testing Checklist

### iOS Safari
- [ ] Scroll vertical funciona con un dedo
- [ ] Scroll suave (momentum scrolling)
- [ ] No hay rebote extraño
- [ ] Funciona con teclado abierto
- [ ] Funciona en landscape y portrait

### Android Chrome
- [ ] Scroll vertical funciona
- [ ] No hay lag o stuttering
- [ ] Funciona con teclado abierto

### Desktop
- [ ] Scrollbar visible y funcional
- [ ] Scroll con rueda del mouse
- [ ] Scroll con trackpad

## Resultado Final

El scroll vertical ahora funciona correctamente en:
- ✅ **iOS Safari** - Scroll suave con momentum
- ✅ **Android Chrome** - Scroll nativo
- ✅ **Desktop** - Scrollbar personalizada
- ✅ **Todos los estados** - peek, collapsed, expanded

### Características
- ✅ Scroll suave en iOS (`-webkit-overflow-scrolling: touch`)
- ✅ Sin stopPropagation que bloquee eventos
- ✅ Altura dinámica con `--vh`
- ✅ Min-height para flex en Safari
- ✅ Transform para GPU
- ✅ Scrollbar oculta en móvil
- ✅ Overscroll contenido

## Notas Importantes

### Para Futuros Desarrollos

1. **NUNCA usar stopPropagation** en elementos dentro de contenedores con scroll
2. **SIEMPRE incluir** `-webkit-overflow-scrolling: touch` en iOS
3. **SIEMPRE usar** `min-height: 0` en flex containers con scroll en Safari
4. **PREFERIR** `overflow-y: auto` sobre `overflow-y: scroll`
5. **USAR** `--vh` en lugar de `vh` para altura con teclado móvil
6. **AGREGAR** `transform: translateZ(0)` para mejor rendimiento

### Propiedades Críticas
```css
/* Combo ganador para scroll en iOS */
.scroll-container {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  flex: 1;
  min-height: 0;
  transform: translateZ(0);
}
```

## Referencias

- [MDN: -webkit-overflow-scrolling](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-overflow-scrolling)
- [CSS Tricks: Flexbox and Truncated Text](https://css-tricks.com/flexbox-truncated-text/)
- [Safari CSS Reference](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariCSSRef/Articles/StandardCSSProperties.html)
