# Sistema de Selección de Polígono Centrado

## Resumen
Sistema implementado que detecta automáticamente el polígono más cercano al centro de la pantalla al arrastrar el globo y permite navegar hacia él al hacer click en cualquier parte de la pantalla (no directamente en el polígono).

## Niveles Activos
El sistema funciona **solo en niveles 2, 3 y 4**:
- **Nivel 2 (country)**: Detecta subdivisiones (estados/comunidades)
- **Nivel 3 (subdivision)**: Detecta sub-subdivisiones (provincias/departamentos)
- **Nivel 4**: Nivel ciudad/detalle máximo

En el **nivel 1 (world)** el sistema está **desactivado**.

## Componentes Modificados

### 1. GlobeCanvas.svelte
**Función agregada: `getCenterPolygon()`**
- Usa raycasting de THREE.js para detectar el polígono en el centro de la pantalla
- Apunta al centro (coordenadas normalizadas 0, 0)
- Retorna el feature completo con todas sus propiedades
- Manejo de errores robusto

**Prop agregada:**
- `centerPolygonId`: ID del polígono centrado para resaltado visual

**Actualización en `refreshPolyStrokes()`:**
- Resalta polígonos centrados con borde verde brillante (`#00ff00`)
- Prioridades: Ciudad seleccionada > Polígono centrado > Normal

### 2. GlobeGL.svelte

#### Estado Agregado
```typescript
let centerPolygon: any | null = null;           // Polígono actualmente centrado
let centerPolygonId: string | null = null;       // ID del polígono centrado
let isCenterPolygonActive: boolean = false;      // Sistema activo/inactivo
```

#### Lógica en `controlsChange`
Durante el arrastre del globo:
1. Verifica si está en niveles 2 o 3
2. Detecta polígono centrado usando `globe.getCenterPolygon()`
3. Extrae ID según el nivel:
   - Nivel 2: `ID_1` (ej: "ESP.1")
   - Nivel 3: `ID_2` o `_cityId` (ej: "ESP.1.8")
4. Verifica que el polígono tenga datos en `answersData`
5. Solo actualiza si cambió el polígono (evita renders innecesarios)
6. Refresca strokes para mostrar highlight verde

#### Lógica en `globeClick`
Al hacer click en espacio vacío (no en polígono):
1. Verifica si hay polígono centrado activo
2. Crea evento sintético con el polígono centrado
3. Reutiliza lógica existente de `polygonClick`:
   - **Nivel 2**: Navega a subdivisión (nivel 3)
   - **Nivel 3**: Navega a nivel 4 (ciudad/detalle)
4. Limpia estado del polígono centrado
5. Ejecuta navegación con zoom adaptativo

## Indicador Visual

### Elementos del Indicador
1. **Crosshair (mira telescópica)**
   - Círculo animado con pulso
   - Líneas horizontales y verticales
   - Color verde brillante (`#00ff00`)
   - Sombra con efecto glow

2. **Etiqueta con nombre del polígono**
   - Fondo negro semi-transparente
   - Texto verde con efecto glow
   - Borde verde
   - Truncado con ellipsis si es muy largo

3. **Hint "Toca para navegar"**
   - Animación de fade in/out
   - Texto blanco semi-transparente
   - Indica que puede hacer click

### Estilos CSS
- Posicionado en el centro exacto de la pantalla
- Z-index 9999 (sobre todo excepto modales)
- Pointer-events: none (no interfiere con clicks)
- Animaciones suaves con keyframes
- Transición fade de 200ms al aparecer/desaparecer

## Flujo de Usuario

### Arrastrar el Globo
1. Usuario arrastra/mueve el globo (niveles 2 o 3)
2. Sistema detecta automáticamente el polígono central cada frame
3. Borde verde aparece en el polígono centrado
4. Indicador visual aparece en el centro con el nombre

### Click para Navegar
1. Usuario hace click en cualquier parte (no en polígono)
2. Sistema navega automáticamente al polígono centrado
3. Zoom adaptativo según tamaño del polígono
4. Bottom sheet muestra datos de la nueva región
5. Indicador desaparece durante la navegación

## Optimizaciones

### Detección Throttled
- `controlsChange` ya tiene throttle de 16ms (60fps)
- Solo actualiza si cambió el polígono (compara IDs)
- Limpia estado al salir de niveles 2-3

### Validación de Datos
- Solo activa polígonos que tienen datos en `answersData`
- Evita resaltar polígonos sin información
- Previene navegación a regiones vacías

### Manejo de Memoria
- Limpia referencias al cambiar de polígono
- Desactiva sistema completamente en nivel 1
- No mantiene referencias innecesarias

## Casos de Uso

### Exploración Rápida
Usuario puede explorar rápidamente diferentes regiones solo arrastrando el globo y haciendo click, sin necesidad de apuntar con precisión.

### Móvil/Touch
Especialmente útil en dispositivos móviles donde es difícil hacer click preciso en polígonos pequeños.

### Navegación Fluida
Combina arrastre + click para navegación más natural e intuitiva.

## Configuración Visual

### Colores
- **Verde brillante**: `#00ff00` (polígono centrado)
- **Blanco**: `#ffffff` (ciudad seleccionada, nivel 4)
- **Gris oscuro**: `rgba(5,5,5,0.5)` (polígonos normales)

### Animaciones
- **Pulse**: 2s ease-in-out infinite (círculo del crosshair)
- **FadeInOut**: 2s ease-in-out infinite (hint)
- **Fade**: 200ms (aparición/desaparición del indicador)

## Testing

### Probar en Consola
```javascript
// Verificar detección
globe.getCenterPolygon()

// Ver estado actual
console.log({
  centerPolygonId,
  isCenterPolygonActive,
  centerPolygon
})
```

### Casos a Probar
1. Arrastrar en nivel 2 (países → subdivisiones)
2. Arrastrar en nivel 3 (subdivisiones → nivel 4)
3. Click en espacio vacío con polígono centrado
4. Cambiar entre polígonos con y sin datos
5. Zoom in/out y verificar que sigue funcionando
6. Volver al nivel 1 y verificar que se desactiva

## Notas Técnicas

### Raycasting
- Usa THREE.Raycaster de globe.gl
- Coordenadas normalizadas: (0, 0) = centro exacto
- Intersección recursiva con todos los hijos de la escena
- Verifica propiedad `__data` en objetos intersectados

### IDs por Nivel
- **Nivel 2**: `ID_1` (formato: "ESP.1", "USA.4")
- **Nivel 3**: `ID_2` (formato: "ESP.1.8", "USA.4.2")
- **Nivel 4**: `_cityId` o `ID_2` (ciudades específicas)

### Sincronización con GlobeCanvas
- `centerPolygonId` se pasa como prop reactiva
- GlobeCanvas actualiza strokes automáticamente
- Sin necesidad de refresh manual adicional
