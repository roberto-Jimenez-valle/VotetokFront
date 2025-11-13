# Integración del Buscador de GIFs de Giphy

## 📌 Resumen

Añadido un buscador completo de GIFs de Giphy tipo WhatsApp en el modal de creación de encuestas, además del botón automático existente que obtiene el primer resultado.

## 🎯 Funcionalidades

### 1. **Botón Automático (Existente - Sparkles ✨)**
- Busca automáticamente GIFs para todas las opciones que tienen texto pero no imagen
- Usa `giphyGifUrl()` para obtener el primer resultado
- Se muestra solo cuando hay opciones sin imagen

### 2. **Buscador Manual (Nuevo - Search 🔍)**
- Abre un modal completo con búsqueda de GIFs tipo WhatsApp
- Permite buscar y seleccionar GIFs manualmente
- Grid de GIFs con preview
- GIFs trending por defecto
- Localización automática según el país del usuario

## 🏗️ Arquitectura

### Componentes

**`GiphyPicker.svelte`**
- Componente reutilizable para buscar GIFs
- Props:
  - `onSelect(gifUrl: string)`: Callback cuando se selecciona un GIF
  - `onClose()`: Callback para cerrar el picker

**`CreatePollModal.svelte`**
- Integra el `GiphyPicker`
- Controla el estado del modal y el target de asignación

### Estados Reactivos

```typescript
let showGiphyPicker = $state(false);  // Control del modal
let giphyTarget = $state<'main' | string | null>(null);  // Target: 'main' o optionId
```

### Funciones Clave

**`openGiphyPicker(target: 'main' | string)`**
- Abre el buscador de GIFs
- `target = 'main'`: Asignar a imagen principal de la encuesta
- `target = optionId`: Asignar a una opción específica

**`handleGifSelect(gifUrl: string)`**
- Procesa la selección del GIF
- Asigna la URL al target correspondiente
- Cierra el modal automáticamente

## 🎨 UI/UX

### Botón de Búsqueda Individual
- **Ubicación**: En cada opción, al lado derecho del badge de color en la parte inferior
- **Icono**: Sparkles ✨ (mismo que el botón de animar cards)
- **Estilo**: Botón circular azul (32px)
- **Comportamiento**: 
  - Solo visible cuando la opción está desplegada (no en modo collapsed)
  - Siempre visible independiente de si tiene preview o no
  - Click abre el modal del GiphyPicker para esa opción específica
  - Efecto hover con scale 1.15 y shadow azul
  - En modo activo: posición ajustada (right: 60px)

### Modal del Picker
- **Z-index**: 35000 (por encima del CreatePollModal que tiene 30000)
- **Overlay**: Fondo negro semi-transparente con blur
- **Container**: 
  - Max-width: 700px
  - Max-height: 80vh
  - Border-radius: 16px
  - Shadow elegante

### Filtros de Contenido
- **Botones**: GIFs | Stickers
- **Cambio dinámico**: Al cambiar el filtro, recarga automáticamente los resultados
- **API soportada**: 
  - `searchGiphy(query, { type: 'gifs' | 'stickers' })`
  - `getTrendingGifs(limit, rating, type)`

### Personalización por Color de Opción
- **Color dinámico**: El picker se personaliza con el color de la opción que estás editando
- **Elementos tematizados**:
  - Borde del input al hacer focus
  - Spinner de carga
  - Sombra de hover en GIFs
  - Scrollbar del grid
  - Botón "Ver Trending"
  - Logo "Powered by GIPHY"
  - Filtro activo (GIF/Sticker)
- **CSS Variables**: Usa `v-bind(optionColor)` y `color-mix()` para generar variantes

## 🔄 Flujo de Uso

1. **Usuario crea una encuesta con opciones**
2. **Opción A: Automático**
   - Click en botón Sparkles ✨
   - El sistema busca GIFs automáticamente para todas las opciones
   - Usa el texto de cada opción como query

3. **Opción B: Manual**
   - Selecciona una opción específica
   - Click en botón Search 🔍
   - Se abre el buscador completo de Giphy
   - Busca manualmente el GIF deseado
   - Click en el GIF → se asigna a la opción
   - Modal se cierra automáticamente

## 🌍 Localización

El `GiphyPicker` detecta automáticamente el país del usuario mediante:
1. API de `ipapi.co`
2. Fallback a configuración del navegador
3. Fallback a "es" (español)

Los resultados de búsqueda están localizados según el idioma detectado.

## 📁 Archivos Modificados

```
src/lib/CreatePollModal.svelte
├── Imports: +GiphyPicker, +Search icon
├── Estados: +showGiphyPicker, +giphyTarget
├── Funciones: +openGiphyPicker(), +handleGifSelect()
├── UI: +Botón de búsqueda, +Modal del picker
└── CSS: +Estilos para botón y overlay
```

## 🎨 Estilos CSS

### Botón de Búsqueda
```css
.giphy-search-button {
  width: 48px;
  height: 48px;
  border: 2px solid rgba(147, 197, 253, 0.3);
  background: rgba(30, 30, 35, 0.95);
  /* Hover: elevación + glow azul */
}
```

### Overlay del Picker
```css
.giphy-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 35000;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
}

.giphy-picker-container {
  max-width: 700px;
  max-height: 80vh;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
```

## 🚀 Ventajas

✅ **Dos modos de uso**: Automático para rapidez, manual para precisión
✅ **UX tipo WhatsApp**: Familiar y fácil de usar
✅ **Localización automática**: Resultados relevantes por país
✅ **Preview visual**: Grid con imágenes de GIFs
✅ **Trending GIFs**: Muestra GIFs populares por defecto
✅ **Búsqueda en tiempo real**: Con debounce de 500ms
✅ **Asignación flexible**: Puede asignar a imagen principal o a opciones específicas

## 🔮 Mejoras Futuras

- [ ] Permitir asignar GIF a la imagen principal de la encuesta desde el botón principal
- [ ] Añadir categorías de GIFs (reacciones, emociones, celebraciones, etc.)
- [ ] Guardar GIFs recientes del usuario
- [ ] Favoritos de GIFs
- [ ] Integración con otros servicios (Tenor, etc.)

## 📝 Notas

- El botón automático (Sparkles) usa `giphyGifUrl()` que retorna el primer resultado
- El buscador manual usa `searchGiphy()` que retorna un array de GIFs con metadata completa
- Ambos usan la misma localización automática
- El z-index del picker (35000) está por encima del CreatePollModal (30000) pero por debajo de AuthModal si existiera
