# Mejoras de Arrastre del BottomSheet

## Resumen
Se ha implementado un sistema de arrastre completo para el BottomSheet, similar a Google Maps, que permite arrastrar desde cualquier parte del componente.

## Cambios Implementados

### 1. **BottomSheet.svelte**
- ✅ Eventos de arrastre movidos del área específica al contenedor principal
- ✅ Todo el sheet es ahora arrastrable desde cualquier punto

### 2. **bottomSheet.ts**
#### Detección Inteligente de Elementos Interactivos
- ✅ Lista de selectores excluidos del arrastre:
  - Botones, enlaces, inputs, textareas, selects
  - Tarjetas de votación (`.vote-card`)
  - Botones de navegación (`.nav-chip`)
  - Elementos con roles ARIA interactivos

#### Manejo Inteligente del Scroll
- ✅ Permite arrastre desde `.sheet-content` cuando:
  - No tiene scroll
  - Está en el tope (scrollTop = 0)
  - Está en el fondo (scrollTop = scrollHeight)
- ✅ Previene arrastre cuando el usuario está haciendo scroll en el medio del contenido

#### Sistema de Fling Gestures (Deslizamiento Rápido)
- ✅ Tracking de velocidad en tiempo real (px/ms)
- ✅ Umbral de fling: 0.5 px/ms
- ✅ Comportamiento:
  - **Fling hacia arriba**: Expande al siguiente nivel
  - **Fling hacia abajo**: Colapsa al siguiente nivel
  - **Arrastre lento**: Usa umbrales de distancia tradicionales
  - **Movimiento pequeño**: Snap al ancla más cercana

#### Detección de Dirección de Gesto
- ✅ Tracking de posición X e Y desde el inicio
- ✅ Umbral de detección: 10px de movimiento
- ✅ Lógica de bloqueo de dirección:
  - Si `dy > dx`: Gesto **vertical** → Arrastre del BottomSheet
  - Si `dx > dy`: Gesto **horizontal** → Scroll horizontal nativo
- ✅ Prevención selectiva de eventos:
  - Solo previene `preventDefault()` en gestos verticales
  - Permite scroll horizontal sin interferencias
- ✅ Reset de estado al finalizar el gesto

### 3. **GlobeGL.css**
#### Estilos de Cursor
- ✅ `.bottom-sheet`: `cursor: grab` y `user-select: none`
- ✅ `.bottom-sheet:active`: `cursor: grabbing`
- ✅ Elementos interactivos: `cursor: pointer` y `user-select: auto`
- ✅ `.sheet-content`: `cursor: auto` y `user-select: text`

## Comportamiento Final

### ✅ Arrastre Global
- Puedes arrastrar desde cualquier parte del BottomSheet
- Fondos, espacios vacíos, headers, etc.

### ✅ Elementos Interactivos Protegidos
- Botones funcionan normalmente
- Tarjetas de voto son clickeables
- Navegación breadcrumb funciona
- Inputs y formularios no inician arrastre

### ✅ Scroll Inteligente
- El área de contenido permite scroll normal
- Arrastre solo se activa en los extremos del scroll vertical
- Previene conflictos entre scroll y arrastre

### ✅ Detección de Dirección de Gesto
- **Scroll horizontal** (tarjetas de votación): Funciona normalmente
- **Arrastre vertical** (BottomSheet): Se activa cuando el gesto es principalmente vertical
- **Umbral de detección**: 10px de movimiento
- **Lógica**: Si `dy > dx` → gesto vertical, si `dx > dy` → gesto horizontal
- **Prevención inteligente**: Solo previene eventos cuando es gesto vertical

### ✅ Gestos Naturales
- **Fling rápido**: Cambia de nivel inmediatamente
- **Arrastre lento**: Requiere distancia mínima
- **Movimiento pequeño**: Vuelve a la posición original
- **Transiciones suaves**: 220ms ease

## Testing

### Pruebas Manuales Recomendadas

1. **Arrastre desde diferentes áreas:**
   - [ ] Arrastrar desde el header con el gráfico
   - [ ] Arrastrar desde espacios vacíos entre elementos
   - [ ] Arrastrar desde el fondo del sheet

2. **Elementos interactivos:**
   - [ ] Click en tarjetas de votación
   - [ ] Click en botones de navegación (Global, País, etc.)
   - [ ] Verificar que no inician arrastre

3. **Área de scroll:**
   - [ ] Scroll normal en `.sheet-content`
   - [ ] Arrastre desde el tope del contenido
   - [ ] Arrastre desde el fondo del contenido
   - [ ] **Scroll horizontal en tarjetas de votación** (`.vote-cards-grid`)
   - [ ] **Arrastre vertical desde área de tarjetas** (gesto vertical)

4. **Gestos de fling:**
   - [ ] Deslizar rápido hacia arriba (debe expandir)
   - [ ] Deslizar rápido hacia abajo (debe colapsar)
   - [ ] Comparar con arrastre lento

5. **Estados del sheet:**
   - [ ] Peek → Collapsed (fling up)
   - [ ] Collapsed → Expanded (fling up)
   - [ ] Expanded → Collapsed (fling down)
   - [ ] Collapsed → Peek (fling down)
   - [ ] Peek → Hidden (fling down)

### Debugging
- Los logs en consola muestran cuando se ignora el arrastre
- Formato: `[BottomSheet] Drag ignored - interactive element: [selector]`

## Notas Técnicas

### Cálculo de Velocidad
```typescript
velocityY = (currentY - lastY) / (currentTime - lastTime) // px/ms
```

### Detección de Dirección de Gesto
```typescript
// En los primeros movimientos (umbral: 10px)
const dx = Math.abs(x - dragStartX);
const dy = Math.abs(y - dragStartY);

if (dx > 10 || dy > 10) {
  gestureDirectionLocked = true;
  isVerticalGesture = dy > dx; // Vertical si dy > dx
}

// Si es horizontal, permitir scroll horizontal nativo
if (!isVerticalGesture) {
  return; // No procesar arrastre vertical
}
```

### Umbrales
- **FLING_THRESHOLD**: 0.5 px/ms
- **GESTURE_DETECTION_THRESHOLD**: 3px (optimizado para móvil)
- **GESTURE_DIRECTION_RATIO**: 1.2 (dy debe ser 1.2x mayor que dx para ser vertical)
- **expandSnapPx**: Configurado en GlobeGL.svelte (default: 80px)

### Optimizaciones Específicas para Móvil

**Propiedades CSS `touch-action`:**
- `.bottom-sheet`: `touch-action: none` → JS maneja todos los gestos
- `.vote-cards-grid`: `touch-action: pan-x` → Solo scroll horizontal nativo
- `.vote-cards-section`: `touch-action: pan-x` → Solo scroll horizontal nativo
- `.vote-card`: `touch-action: manipulation` → Permite taps
- Botones/links: `touch-action: manipulation` → Permite clicks

**Detección de Dirección Optimizada:**
- Umbral reducido a **3px** (más sensible en móvil)
- Ratio de dirección: **1.2x** (dy > dx * 1.2 para ser vertical)
- `preventDefault()` + `stopPropagation()` en gestos verticales

**Prevención de Conflictos:**
- Scroll horizontal del navegador: Permitido en `.vote-cards-grid`
- Gestos verticales: Capturados por el JS del BottomSheet
- Bounce/rubber-band: Desactivado con `touch-action: none`

### Compatibilidad
- ✅ Touch events (móvil) - **Optimizado**
- ✅ Pointer events (desktop)
- ✅ Prevención de scroll durante arrastre vertical
- ✅ Scroll horizontal nativo en tarjetas
- ✅ Passive event listeners donde es apropiado

## Experiencia Similar a Google Maps

El sistema implementado replica el comportamiento de Google Maps:
1. ✅ Arrastre desde cualquier parte
2. ✅ Elementos interactivos funcionan normalmente
3. ✅ Fling gestures para cambios rápidos
4. ✅ Snap a posiciones definidas
5. ✅ Transiciones suaves
6. ✅ Indicadores visuales de cursor apropiados
7. ✅ **Detección de dirección de gesto** (vertical vs horizontal)
8. ✅ **Scroll horizontal en tarjetas** funciona sin conflictos
9. ✅ **Arrastre vertical desde área de tarjetas** cuando el gesto es vertical
