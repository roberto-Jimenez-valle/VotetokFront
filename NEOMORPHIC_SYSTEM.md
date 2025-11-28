# Sistema de Estilos Neomórficos Adaptativos

Sistema completo de estilos neomórficos (Soft Chisel) que se adapta automáticamente al tema (claro/oscuro) y a la paleta de colores seleccionada.

## Características

- ✅ **Adaptación automática al tema**: Los estilos cambian suavemente entre modo claro y oscuro
- ✅ **Sincronización con paletas**: El hue de los colores se actualiza según la paleta seleccionada
- ✅ **Sombras suaves**: Eliminadas las líneas duras con blur en sombras internas y externas
- ✅ **Estados interactivos**: Hover, active y disabled con transiciones suaves
- ✅ **Múltiples variantes**: Botones regulares, circulares, pill, paneles e inputs

## Variables CSS

### Variables Base (app.css)

```css
:root {
  --neo-hue: 220; /* Actualizado dinámicamente por UnifiedThemeToggle */
  
  /* Modo Claro */
  --neo-bg: hsl(var(--neo-hue), 25%, 90%);
  --neo-text: hsl(var(--neo-hue), 40%, 40%);
  --neo-text-light: hsl(var(--neo-hue), 20%, 60%);
  --neo-shadow-dark: hsla(var(--neo-hue), 20%, 70%, 0.5);
  --neo-shadow-light: #ffffff;
  --neo-bevel-highlight: rgba(255, 255, 255, 0.6);
  --neo-border: hsla(var(--neo-hue), 100%, 100%, 0.2);
}

.dark {
  /* Modo Oscuro */
  --neo-bg: hsl(var(--neo-hue), 20%, 18%);
  --neo-text: hsl(var(--neo-hue), 10%, 85%);
  --neo-text-light: hsl(var(--neo-hue), 10%, 55%);
  --neo-shadow-dark: hsla(var(--neo-hue), 30%, 10%, 0.6);
  --neo-shadow-light: hsla(var(--neo-hue), 15%, 25%, 0.5);
  --neo-bevel-highlight: hsla(var(--neo-hue), 10%, 80%, 0.1);
  --neo-border: hsla(var(--neo-hue), 10%, 50%, 0.05);
}
```

## Clases Disponibles

### 1. Botón Regular (`.neo-btn`)
```html
<button class="neo-btn h-10 px-6 rounded-xl">
  Botón Estándar
</button>
```

### 2. Botón Circular (`.neo-btn-circle`)
```html
<button class="neo-btn-circle w-14 h-14 flex items-center justify-center">
  <MapPin size={24} />
</button>
```

### 3. Botón Pill (`.neo-btn-pill`)
```html
<button class="neo-btn-pill h-12 px-8 flex items-center gap-3">
  <span>Global</span>
  <ChevronDown size={20} />
</button>
```

### 4. Panel (`.neo-panel`)
```html
<div class="neo-panel p-6 space-y-4">
  <!-- Contenido del panel -->
</div>
```

### 5. Input (`.neo-input`)
```html
<input 
  type="text" 
  placeholder="Escribe algo..."
  class="neo-input w-full px-4 py-2"
/>
```

## Estados de Botones

### Hover
```css
.neo-btn:hover {
  box-shadow: 
    10px 10px 20px var(--neo-shadow-dark),
    -10px -10px 20px var(--neo-shadow-light),
    inset 1px 1px 4px var(--neo-bevel-highlight);
  transform: translateY(-1px);
}
```

### Active (Presionado)
```css
.neo-btn:active {
  box-shadow: 
    inset 3px 3px 6px var(--neo-shadow-dark),
    inset -3px -3px 6px var(--neo-shadow-light);
  transform: scale(0.98);
}
```

### Disabled
```css
.neo-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}
```

## Integración con Sistema de Temas

### UnifiedThemeToggle.svelte

La función `updateNeoHue()` extrae el hue del color de la paleta seleccionada:

```typescript
function updateNeoHue(color: string) {
  // Extraer hue de color hex
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === r) {
      hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      hue = ((b - r) / delta + 2) / 6;
    } else {
      hue = ((r - g) / delta + 4) / 6;
    }
  }

  const hueValue = Math.round(hue * 360);
  document.documentElement.style.setProperty('--neo-hue', hueValue.toString());
}
```

### Llamadas Automáticas

La función se llama en:

1. **onMount()**: Al cargar tema guardado o tema inicial
2. **cyclePalette()**: Al cambiar de paleta con click
3. **selectPalette()**: Al seleccionar paleta del picker
4. **handleDragEnd()**: Al cambiar entre modo claro/oscuro con drag

## Ejemplo de Uso Completo

```svelte
<script lang="ts">
  import { MapPin, Search, Scan, ChevronDown } from 'lucide-svelte';
</script>

<!-- Grupo de botones neomórficos -->
<div class="flex items-center gap-6 p-8">
  <!-- Botón dropdown -->
  <button class="neo-btn-pill h-14 px-10 flex items-center gap-4">
    <span class="text-lg">Global</span>
    <ChevronDown size={24} style="opacity: 0.6" />
  </button>
  
  <!-- Botones de acción -->
  <div class="flex gap-4">
    <button class="neo-btn-circle w-16 h-16 flex items-center justify-center">
      <MapPin size={28} strokeWidth={2.5} />
    </button>
    
    <button class="neo-btn-circle w-16 h-16 flex items-center justify-center">
      <Scan size={28} strokeWidth={2.5} />
    </button>
    
    <button class="neo-btn-circle w-16 h-16 flex items-center justify-center">
      <Search size={28} strokeWidth={2.5} />
    </button>
  </div>
</div>

<!-- Panel con input -->
<div class="neo-panel p-6 max-w-md">
  <h3 class="text-lg font-bold mb-4" style="color: var(--neo-text)">
    Formulario Neomórfico
  </h3>
  
  <input 
    type="text"
    placeholder="Buscar..."
    class="neo-input w-full px-4 py-3 mb-4"
  />
  
  <button class="neo-btn w-full h-12 rounded-xl">
    Enviar
  </button>
</div>
```

## Implementación en Header

Los estilos neomórficos están aplicados en los botones del header:

**Botón "Global" y navegación** (`.neo-btn-pill`):
- Botón pill con texto "Global"
- Botones de país, subdivisión y ciudad
- Dropdown indicator (▼)

**Botones de iconos circulares** (`.neo-btn-circle`):
- Botón de ubicación (📍)
- Botón de pantalla completa (⛶)
- Botón de búsqueda (🔍)

## Ventajas del Sistema

1. **Consistencia Visual**: Todos los elementos mantienen el mismo estilo
2. **Adaptabilidad**: Se ajusta automáticamente a cualquier tema o paleta
3. **Suavidad**: Bordes difuminados y sombras con blur eliminan rigidez
4. **Accesibilidad**: Estados claros para hover, active y disabled
5. **Performance**: Usa CSS variables para cambios instantáneos sin re-render
6. **Mantenibilidad**: Un solo punto de definición para todos los estilos

## Paletas de Color Soportadas

El sistema funciona con las **60 paletas** (30 oscuras + 30 claras) definidas en `UnifiedThemeToggle.svelte`:

- Grises/Negros
- Púrpuras/Violetas
- Azules
- Cianes/Turquesas
- Verdes
- Amarillos/Dorados
- Naranjas
- Rosas/Rojos

Cada cambio de paleta actualiza automáticamente el hue de los estilos neomórficos.

## Archivos Modificados

1. **src/app.css**
   - Variables CSS neomórficas (`:root` y `.dark`)
   - Clases `.neo-btn`, `.neo-btn-circle`, `.neo-btn-pill`
   - Clases `.neo-panel` y `.neo-input`
   - Estados hover/active/disabled

2. **src/lib/components/UnifiedThemeToggle.svelte**
   - Función `updateNeoHue()` para extraer hue de paletas
   - Llamadas en cyclePalette, selectPalette y onMount
   - Actualización automática de `--neo-hue` en cada cambio

3. **src/lib/header.svelte**
   - Aplicación de `.neo-btn-pill` a botones de navegación
   - Aplicación de `.neo-btn-circle` a botones de iconos
   - Simplificación de estilos `.nav-chip` y `.nav-icon-btn`

## Testing

Para probar los estilos neomórficos:

1. **Visualizar botones**: 
   - Abre http://localhost:5173
   - Observa el header superior con botones "Global", ubicación, pantalla completa y búsqueda

2. **Cambio de tema**: 
   - Arrastra el toggle día/noche → Los botones adaptan colores automáticamente
   - Modo claro: tonos claros con sombras suaves
   - Modo oscuro: tonos oscuros con sombras profundas

3. **Cambio de paleta**: 
   - Click en toggle de paleta → El hue de los botones se actualiza
   - Prueba con diferentes colores (azul, verde, púrpura, etc.)

4. **Estados interactivos**:
   - **Hover**: Botones se elevan ligeramente con sombras más marcadas
   - **Active**: Efecto "hundido" al presionar
   - **Focus**: Sin outline visible, estilo limpio

5. **Navegación**:
   - Navega a un país → Aparecen más botones pill
   - Todos mantienen el estilo neomórfico consistente

## Próximos Pasos (Opcional)

- [ ] Agregar variantes de tamaño (sm, md, lg, xl)
- [ ] Crear botones con iconos a la izquierda/derecha
- [ ] Agregar loading state con spinner
- [ ] Crear toggle switches neomórficos
- [ ] Implementar checkbox y radio buttons
- [ ] Agregar cards neomórficas
- [ ] Crear sistema de tooltips
