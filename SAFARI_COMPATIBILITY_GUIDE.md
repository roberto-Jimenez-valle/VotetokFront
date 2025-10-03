# Guía de Compatibilidad Safari y Cross-Browser

## ✅ Correcciones Aplicadas

### Archivos Modificados
1. **`src/lib/GlobeGL.css`** - 100+ correcciones de compatibilidad
2. **`src/lib/globe/BottomSheet.svelte`** - Eliminación de `touch-action` inline
3. **`src/app.html`** - Optimizaciones móviles completas (viewport, --vh, safe areas)

## 📱 Optimizaciones Móviles Adicionales

### Viewport y Altura Dinámica
- ✅ `viewport-fit=cover` para iPhone con notch
- ✅ Variable CSS `--vh` para fix de teclado móvil
- ✅ Script que actualiza altura en resize/orientationchange

### Safe Areas
- ✅ `env(safe-area-inset-*)` en elementos fijos
- ✅ Padding dinámico para notch/home bar

### Inputs Optimizados
- ✅ `font-size: 16px` mínimo (evita zoom en iOS)
- ✅ `-webkit-appearance: none` (quita estilos nativos)

### Performance GPU
- ✅ `translateZ(0)` en animaciones
- ✅ `backface-visibility: hidden`
- ✅ Solo `transform` y `opacity` en animaciones

Ver **`MOBILE_OPTIMIZATIONS.md`** para detalles completos.

## 🔧 Cambios Principales

### 1. Prefijos de Navegador (Vendor Prefixes)
Todas las propiedades CSS modernas ahora incluyen prefijos para máxima compatibilidad:

```css
/* Transform */
-webkit-transform: translateY(0);
-moz-transform: translateY(0);
-ms-transform: translateY(0);
transform: translateY(0);

/* Transition */
-webkit-transition: all 0.2s ease;
-moz-transition: all 0.2s ease;
transition: all 0.2s ease;

/* Backdrop-filter (CRÍTICO para Safari) */
-webkit-backdrop-filter: blur(10px);
backdrop-filter: blur(10px);

/* User-select */
-webkit-user-select: none;
-moz-user-select: none;
-ms-user-select: none;
user-select: none;
```

### 2. Propiedades Modernas Reemplazadas

#### `inset` → `top/left/right/bottom`
```css
/* ❌ NO COMPATIBLE */
.element { inset: 0; }

/* ✅ COMPATIBLE */
.element {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
```

#### `dvh` → `vh`
```css
/* ❌ NO COMPATIBLE */
min-height: 100dvh;

/* ✅ COMPATIBLE */
min-height: 100vh;
```

#### `:has()` → Clases JavaScript
```css
/* ❌ SOPORTE LIMITADO */
.parent:has(.child) { }

/* ✅ COMPATIBLE */
.parent.has-child { }
```

### 3. Propiedades Eliminadas

Las siguientes propiedades se eliminaron por incompatibilidad o problemas de rendimiento:

- ❌ `touch-action` - Soporte inconsistente en Safari
- ❌ `will-change` - Puede causar problemas de rendimiento
- ❌ `isolation: isolate` - No esencial
- ❌ `contain: layout` - No compatible con Safari antiguo
- ❌ `overflow-anchor` - No necesario

### 4. Backgrounds Más Sólidos

Para asegurar legibilidad sin depender de `backdrop-filter`:

```css
/* ANTES */
background: rgba(0, 0, 0, 0.55);

/* DESPUÉS */
background: rgba(0, 0, 0, 0.85);
-webkit-backdrop-filter: blur(10px);
backdrop-filter: blur(10px);
```

### 5. Fallbacks para `env()`

```css
/* Con fallback para navegadores sin soporte */
padding-bottom: 60px;
padding-bottom: calc(60px + env(safe-area-inset-bottom));
```

## 🎯 Elementos Críticos Corregidos

### Canvas WebGL
```css
.globe-wrap canvas {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  display: block !important;
  -webkit-transform: translateZ(0);
  -moz-transform: translateZ(0);
  -ms-transform: translateZ(0);
  transform: translateZ(0);
  -webkit-backface-visibility: hidden;
  -moz-backface-visibility: hidden;
  backface-visibility: hidden;
}
```

### Bottom Sheet
```css
.bottom-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  -webkit-transform: translateY(100vh);
  -moz-transform: translateY(100vh);
  -ms-transform: translateY(100vh);
  transform: translateY(100vh);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  /* touch-action eliminado */
}
```

### Botones Flotantes
```css
.fullscreen-btn-floating,
.locate-btn-floating,
.settings-btn-floating {
  background: rgba(0, 0, 0, 0.85); /* Más opaco */
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  -webkit-transition: all 0.3s ease;
  -moz-transition: all 0.3s ease;
  transition: all 0.3s ease;
}
```

### Tarjetas de Votación
```css
.vote-card {
  -webkit-transition: all 0.3s ease;
  -moz-transition: all 0.3s ease;
  transition: all 0.3s ease;
}

.vote-card:hover {
  -webkit-transform: translateY(-2px);
  -moz-transform: translateY(-2px);
  -ms-transform: translateY(-2px);
  transform: translateY(-2px);
}
```

## 🧪 Testing Checklist

### Safari iOS (iPhone/iPad)
- [ ] Canvas WebGL se muestra correctamente
- [ ] BottomSheet se arrastra suavemente
- [ ] Botones flotantes son clickeables
- [ ] Backdrop-filter funciona o fondo es legible
- [ ] Animaciones son suaves (60fps)
- [ ] Scroll vertical funciona en el contenedor
- [ ] Scroll horizontal funciona en las tarjetas
- [ ] Navegación breadcrumb funciona
- [ ] Búsqueda funciona correctamente

### Safari macOS
- [ ] Canvas WebGL se muestra correctamente
- [ ] Todas las animaciones son suaves
- [ ] Hover states funcionan correctamente
- [ ] Backdrop-filter se ve bien
- [ ] No hay elementos cortados o mal posicionados

### Chrome/Edge
- [ ] No hay regresiones
- [ ] Todas las funcionalidades siguen funcionando
- [ ] Rendimiento no se ha degradado

### Firefox
- [ ] Prefijos `-moz-` funcionan correctamente
- [ ] Animaciones son suaves
- [ ] No hay problemas de layout

## 🚨 Problemas Conocidos de Safari

### 1. Backdrop-filter
Safari requiere `-webkit-backdrop-filter` obligatoriamente. Si no funciona:
- Aumentar opacidad del background a >= 0.85
- Usar color sólido como fallback

### 2. Transform en Elementos Fijos
Safari puede tener problemas con `transform` en elementos `position: fixed`:
- Usar `translateZ(0)` para forzar aceleración GPU
- Agregar `-webkit-backface-visibility: hidden`

### 3. Scroll en Contenedores Anidados
Safari puede tener problemas con scroll en contenedores anidados:
- Eliminar `touch-action` y dejar que el navegador lo maneje
- Usar `-webkit-overflow-scrolling: touch` para scroll suave

### 4. Flexbox y Grid
Safari puede interpretar flexbox/grid diferente:
- Usar `flex-shrink: 0` explícitamente cuando sea necesario
- Evitar `gap` en flexbox antiguo, usar margin en su lugar

## 📝 Recomendaciones Adicionales

### Para Desarrollo Futuro

1. **Siempre usar prefijos** para propiedades CSS modernas
2. **Evitar propiedades experimentales** sin fallbacks
3. **Probar en Safari primero** antes de otros navegadores
4. **Usar backgrounds opacos** cuando sea posible
5. **Evitar `touch-action`** - dejar que el navegador lo maneje
6. **No usar `:has()`** sin polyfill o alternativa JS
7. **Preferir `vh` sobre `dvh`** por compatibilidad
8. **Usar `top/left/right/bottom`** en lugar de `inset`

### Herramientas de Testing

1. **BrowserStack** - Para testing en Safari real
2. **Safari Technology Preview** - Para testing de características nuevas
3. **Can I Use** - Para verificar compatibilidad de propiedades CSS
4. **Autoprefixer** - Para agregar prefijos automáticamente (considerar)

### Autoprefixer Config (Opcional)

Si quieres automatizar los prefijos en el futuro:

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    autoprefixer: {
      browsers: [
        'last 2 versions',
        'Safari >= 12',
        'iOS >= 12'
      ]
    }
  }
}
```

## 🎨 Estilos Simplificados

Los estilos ahora son más simples y directos:
- Menos propiedades experimentales
- Más compatibilidad cross-browser
- Backgrounds más opacos para mejor legibilidad
- Menos dependencia de características modernas

## ✨ Resultado Final

El código ahora debería funcionar correctamente en:
- ✅ Safari 12+ (iOS y macOS)
- ✅ Chrome 80+
- ✅ Edge 80+
- ✅ Firefox 75+
- ✅ Opera 67+

## 🔍 Si Aún Hay Problemas

1. **Verificar la consola del navegador** para errores JavaScript
2. **Comprobar que WebGL está habilitado** en Safari
3. **Verificar permisos de ubicación** si la función de localización no funciona
4. **Limpiar caché del navegador** y recargar
5. **Verificar que no hay extensiones** bloqueando funcionalidad
6. **Probar en modo incógnito** para descartar problemas de caché

## 📞 Soporte

Si encuentras problemas específicos de Safari:
1. Documenta el problema con screenshots
2. Indica la versión de Safari (Ajustes > Safari > Acerca de)
3. Indica el dispositivo (iPhone, iPad, Mac)
4. Describe los pasos para reproducir el problema
