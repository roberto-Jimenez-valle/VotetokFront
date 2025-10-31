# 🔍 PROMPT COMPLETO PARA AUDITORÍA Y REFACTORIZACIÓN DE VOTETOK

## 📋 CONTEXTO DE LA APLICACIÓN

**VouTop** es una aplicación web de votaciones geográficas en tiempo real con visualización 3D de un globo terráqueo interactivo. Los usuarios pueden:
- Crear y votar encuestas geolocalizadas
- Navegar por el globo 3D (mundo → país → subdivisión)
- Ver resultados en tiempo real con visualizaciones de datos
- Sistema de notificaciones, búsqueda y perfiles de usuario
- Modo claro/oscuro con 60 paletas de colores
- Sistema de seguimiento entre usuarios

## 🎯 OBJETIVO DE LA AUDITORÍA

Necesito que realices una **auditoría técnica completa** de toda la aplicación y me proporciones:

1. **Análisis exhaustivo** de la arquitectura actual
2. **Identificación de problemas críticos** (bugs, memory leaks, anti-patterns)
3. **Recomendaciones de refactorización** con prioridades
4. **Optimizaciones de rendimiento** específicas
5. **Mejoras en la estructura de componentes**
6. **Implementación de las mejoras** más críticas
7. **Informe final detallado** con antes/después

---

## 📂 ESTRUCTURA DEL PROYECTO

```
VoteTokFront/
├── src/
│   ├── lib/
│   │   ├── GlobeGL.svelte              # Componente principal del globo (4000+ líneas) ⚠️
│   │   ├── header.svelte               # Header con navegación y modals (3000+ líneas) ⚠️
│   │   ├── CreatePollModal.svelte      # Modal de creación de encuestas
│   │   ├── NotificationsModal.svelte   # Sistema de notificaciones
│   │   ├── SearchModal.svelte          # Búsqueda de usuarios/encuestas
│   │   ├── UserProfileModal.svelte     # Perfiles de usuario
│   │   ├── SettingsModal.svelte        # Configuración
│   │   ├── components/
│   │   │   └── UnifiedThemeToggle.svelte  # Sistema de temas
│   │   └── globe/
│   │       ├── GlobeCanvas.svelte      # Canvas WebGL del globo
│   │       ├── NavigationManager.ts    # Gestión de navegación geográfica
│   │       └── cards/
│   │           └── sections/
│   │               └── SinglePollSection.svelte  # Tarjeta de encuesta individual
│   ├── routes/
│   │   ├── +page.svelte                # Página principal
│   │   └── api/                        # Endpoints API
│   │       ├── polls/
│   │       ├── users/
│   │       ├── geocode/
│   │       └── notifications/
│   ├── app.html                        # HTML base con script inline de temas
│   └── app.css                         # Estilos globales
├── static/
│   └── geojson/                        # Archivos TopoJSON de países
└── package.json
```

---

## 🚨 PROBLEMAS CONOCIDOS Y ÁREAS CRÍTICAS

### 1. **Componentes Monolíticos**
- **GlobeGL.svelte**: ~4000 líneas, mezcla lógica de:
  - Renderizado del globo 3D
  - Gestión de estado de encuestas
  - Sistema de navegación geográfica
  - History API
  - Geocoding
  - Manejo de eventos
  - Animaciones
  - Sistema LOD (Level of Detail)
  
- **header.svelte**: ~3000 líneas, contiene:
  - Navegación principal
  - Modal fullscreen de encuestas tipo Instagram Stories
  - Sistema de drag/swipe
  - Gestión de avatares
  - Integración con múltiples modals

### 2. **Gestión de Estado**
- **Sin store centralizado**: Estado distribuido en múltiples componentes
- **Props drilling**: Datos pasados a través de múltiples niveles
- **Duplicación de estado**: Mismos datos en diferentes componentes
- **Sincronización manual**: Eventos personalizados para comunicación

### 3. **Rendimiento**
- **Re-renderizados innecesarios**: Falta de memoización
- **Listeners globales**: Muchos event listeners en document
- **Carga de datos**: Sin lazy loading ni virtualización
- **Animaciones**: Posibles memory leaks en transiciones
- **WebGL**: Actualización constante del globo

### 4. **TypeScript**
- **Tipado débil**: Muchos `any` y tipos implícitos
- **Falta de interfaces**: Estructuras de datos sin definir
- **Type assertions**: Uso excesivo de `as`

### 5. **Accesibilidad**
- **Navegación por teclado**: Limitada en modals
- **ARIA labels**: Faltan en muchos elementos interactivos
- **Focus management**: No se gestiona correctamente
- **Screen readers**: Poca compatibilidad

### 6. **Código Duplicado**
- **Lógica de drag/swipe**: Repetida en varios componentes
- **Formateo de datos**: Funciones similares en múltiples lugares
- **Llamadas API**: Sin abstracción centralizada
- **Validaciones**: Duplicadas en frontend y backend

---

## 🔍 ANÁLISIS REQUERIDO

### A. ARQUITECTURA Y ESTRUCTURA

1. **Evalúa la estructura de carpetas**
   - ¿Es escalable?
   - ¿Sigue convenciones de SvelteKit?
   - ¿Hay mejor organización posible?

2. **Analiza la separación de responsabilidades**
   - ¿Los componentes tienen una única responsabilidad?
   - ¿La lógica de negocio está separada de la presentación?
   - ¿Hay acoplamiento excesivo?

3. **Revisa los patrones de diseño**
   - ¿Se usan patrones apropiados?
   - ¿Hay anti-patterns?
   - ¿Qué patrones deberían implementarse?

### B. COMPONENTES

1. **GlobeGL.svelte (CRÍTICO)**
   - Identificar todas las responsabilidades
   - Proponer división en componentes más pequeños
   - Extraer lógica a stores/servicios
   - Optimizar re-renderizados
   - Mejorar gestión de memoria

2. **header.svelte (CRÍTICO)**
   - Separar modals en componentes independientes
   - Extraer lógica de drag/swipe
   - Simplificar estructura
   - Mejorar performance

3. **Otros componentes**
   - Revisar cada modal
   - Identificar código duplicado
   - Proponer componentes reutilizables

### C. GESTIÓN DE ESTADO

1. **Analizar flujo de datos actual**
   - ¿Cómo fluyen los datos entre componentes?
   - ¿Hay problemas de sincronización?
   - ¿Qué datos son globales vs locales?

2. **Proponer arquitectura de estado**
   - ¿Usar Svelte stores?
   - ¿Implementar Context API?
   - ¿Necesitamos un store manager más robusto?

3. **Optimizar reactividad**
   - Identificar reactividad innecesaria
   - Proponer uso de `$derived` y `$effect`
   - Mejorar performance de actualizaciones

### D. RENDIMIENTO (ANÁLISIS EXHAUSTIVO)

#### D.1 JavaScript Performance

1. **Analizar bundle size y tree-shaking**
   - Identificar dependencias pesadas y no utilizadas
   - Proponer code splitting por rutas
   - Optimizar imports (named vs default)
   - Analizar chunks generados por Vite
   - Identificar código muerto (dead code)
   - Revisar uso de dynamic imports

2. **Optimizar ejecución de JavaScript**
   - Identificar funciones costosas (profiling)
   - Detectar loops ineficientes
   - Optimizar operaciones de arrays (map/filter/reduce)
   - Revisar uso de recursión vs iteración
   - Identificar cálculos repetitivos que deberían cachearse
   - Analizar uso de closures y memory leaks potenciales
   - Revisar event handlers y debouncing/throttling

3. **Optimizar renderizado y reactividad**
   - Identificar re-renderizados innecesarios
   - Implementar lazy loading de componentes
   - Virtualización de listas largas (encuestas, notificaciones)
   - Memoización de cálculos costosos con `$derived`
   - Optimizar uso de `$effect` vs `$effect.pre`
   - Revisar dependencias reactivas innecesarias
   - Implementar shouldComponentUpdate equivalente

4. **WebGL y animaciones**
   - Revisar uso de requestAnimationFrame
   - Optimizar actualizaciones del globo 3D
   - Prevenir memory leaks en Three.js
   - Mejorar transiciones y reducir jank
   - Analizar uso de GPU vs CPU
   - Optimizar geometrías y texturas
   - Implementar LOD (Level of Detail) más eficiente

5. **Event listeners y memory management**
   - Auditar todos los event listeners globales
   - Verificar cleanup en onDestroy
   - Detectar memory leaks con Chrome DevTools
   - Optimizar uso de addEventListener vs on:event
   - Revisar uso de passive listeners
   - Implementar event delegation donde sea apropiado

6. **Carga de datos y APIs**
   - Implementar caching inteligente (memoria + localStorage)
   - Optimizar llamadas API (batching, deduplicación)
   - Prefetching estratégico de datos
   - Implementar stale-while-revalidate
   - Optimizar manejo de errores y retries
   - Reducir payload de respuestas API
   - Implementar paginación eficiente

#### D.2 CSS Performance

1. **Analizar CSS crítico y no utilizado**
   - Identificar CSS no utilizado (PurgeCSS/UnCSS)
   - Extraer CSS crítico para above-the-fold
   - Optimizar selectores complejos
   - Reducir especificidad innecesaria
   - Eliminar !important excesivos
   - Consolidar reglas duplicadas

2. **Optimizar renders y repaints**
   - Identificar propiedades que causan reflow
   - Usar transform/opacity para animaciones
   - Evitar layout thrashing
   - Optimizar uso de position: fixed/absolute
   - Revisar uso de will-change
   - Implementar contain para aislamiento

3. **Optimizar animaciones CSS**
   - Usar CSS animations vs JavaScript
   - Implementar GPU acceleration apropiadamente
   - Reducir complejidad de transiciones
   - Optimizar keyframes
   - Revisar duración y timing functions
   - Evitar animaciones en propiedades costosas

4. **Estructura y organización CSS**
   - Revisar metodología (BEM, SMACSS, etc.)
   - Identificar código duplicado
   - Proponer variables CSS vs valores hardcoded
   - Optimizar media queries
   - Revisar uso de CSS Grid vs Flexbox
   - Consolidar estilos globales vs scoped

5. **CSS moderno y compatibilidad**
   - Usar características modernas (container queries, :has, etc.)
   - Implementar fallbacks apropiados
   - Optimizar uso de custom properties
   - Revisar soporte de navegadores
   - Implementar progressive enhancement

#### D.3 Assets y Recursos

1. **Optimización de imágenes**
   - Auditar tamaños de imágenes
   - Implementar formatos modernos (WebP, AVIF)
   - Lazy loading de imágenes
   - Responsive images con srcset
   - Optimizar avatares y thumbnails
   - Implementar placeholders (blur-up, LQIP)

2. **Optimización de fuentes**
   - Auditar fuentes cargadas
   - Implementar font-display: swap
   - Subset de fuentes (solo caracteres necesarios)
   - Preload de fuentes críticas
   - Usar variable fonts si es apropiado

3. **Archivos estáticos**
   - Optimizar archivos TopoJSON
   - Implementar compresión (gzip/brotli)
   - Revisar tamaño de archivos GeoJSON
   - Lazy loading de datos geográficos
   - Implementar CDN para assets estáticos

#### D.4 Métricas Core Web Vitals

1. **LCP (Largest Contentful Paint)**
   - Identificar elemento LCP
   - Optimizar carga del elemento crítico
   - Reducir tiempo de respuesta del servidor
   - Eliminar recursos que bloquean el render

2. **FID/INP (First Input Delay / Interaction to Next Paint)**
   - Identificar tareas largas (>50ms)
   - Optimizar event handlers
   - Implementar code splitting
   - Reducir JavaScript en main thread

3. **CLS (Cumulative Layout Shift)**
   - Identificar elementos que causan shifts
   - Reservar espacio para contenido dinámico
   - Optimizar carga de fuentes
   - Fijar dimensiones de imágenes/videos

4. **TTFB (Time to First Byte)**
   - Optimizar respuesta del servidor
   - Implementar caching de servidor
   - Revisar queries de base de datos
   - Optimizar SSR si aplica

#### D.5 Network y Carga

1. **Optimización de requests**
   - Reducir número de requests HTTP
   - Implementar HTTP/2 push si es apropiado
   - Optimizar orden de carga de recursos
   - Implementar resource hints (preconnect, prefetch, preload)

2. **Caching strategies**
   - Implementar Service Worker
   - Configurar cache headers apropiados
   - Implementar offline-first approach
   - Optimizar estrategias de invalidación

3. **Bundle optimization**
   - Analizar con Rollup Visualizer
   - Implementar dynamic imports
   - Optimizar vendor chunks
   - Reducir tamaño de polyfills

#### D.6 Runtime Performance

1. **Profiling y monitoring**
   - Usar Chrome DevTools Performance tab
   - Identificar bottlenecks con Lighthouse
   - Implementar Real User Monitoring (RUM)
   - Analizar con WebPageTest

2. **Memory profiling**
   - Detectar memory leaks
   - Optimizar uso de memoria
   - Revisar garbage collection
   - Analizar heap snapshots

3. **JavaScript execution**
   - Identificar long tasks
   - Optimizar parsing y compilation
   - Reducir tiempo de ejecución de scripts
   - Implementar code splitting agresivo

### E. TYPESCRIPT Y TIPOS

1. **Auditar tipado actual**
   - Identificar todos los `any`
   - Crear interfaces faltantes
   - Mejorar type safety

2. **Crear sistema de tipos robusto**
   - Definir tipos para API responses
   - Tipos para eventos personalizados
   - Tipos para props de componentes
   - Tipos para stores

### F. ACCESIBILIDAD (A11Y)

1. **Auditar accesibilidad**
   - Navegación por teclado
   - ARIA labels y roles
   - Focus management
   - Contraste de colores
   - Screen reader support

2. **Implementar mejoras**
   - Añadir keyboard shortcuts
   - Mejorar focus traps en modals
   - Añadir skip links
   - Mejorar semántica HTML

### G. CÓDIGO Y CALIDAD

1. **Identificar code smells**
   - Funciones muy largas
   - Complejidad ciclomática alta
   - Código duplicado
   - Magic numbers
   - Comentarios obsoletos

2. **Proponer refactorizaciones**
   - Extraer funciones auxiliares
   - Crear utilities/helpers
   - Simplificar lógica compleja
   - Mejorar nombres de variables

### H. TESTING

1. **Evaluar testabilidad**
   - ¿El código es testeable?
   - ¿Qué dificulta el testing?
   - ¿Qué componentes necesitan tests?

2. **Proponer estrategia de testing**
   - Unit tests prioritarios
   - Integration tests necesarios
   - E2E tests críticos

### I. SEGURIDAD

1. **Revisar vulnerabilidades**
   - XSS
   - CSRF
   - Validación de inputs
   - Sanitización de datos
   - Manejo de tokens

2. **Proponer mejoras de seguridad**

### J. APIS Y BACKEND

1. **Revisar endpoints**
   - Estructura de respuestas
   - Manejo de errores
   - Validaciones
   - Performance

2. **Optimizar comunicación**
   - Reducir llamadas redundantes
   - Implementar caching
   - Mejorar error handling

---

## 🎯 TAREAS ESPECÍFICAS

### FASE 1: ANÁLISIS (NO MODIFICAR CÓDIGO AÚN)

1. **Lee TODOS los archivos principales**:
   - `src/lib/GlobeGL.svelte`
   - `src/lib/header.svelte`
   - `src/lib/CreatePollModal.svelte`
   - `src/lib/NotificationsModal.svelte`
   - `src/lib/SearchModal.svelte`
   - `src/lib/UserProfileModal.svelte`
   - `src/lib/globe/GlobeCanvas.svelte`
   - `src/lib/globe/cards/sections/SinglePollSection.svelte`
   - `src/routes/+page.svelte`

2. **Genera un mapa mental** de:
   - Dependencias entre componentes
   - Flujo de datos
   - Event chains
   - Lifecycle hooks
   - Stores y estado global

3. **Identifica y prioriza problemas**:
   - 🔴 CRÍTICO: Afecta funcionalidad o rendimiento severamente
   - 🟡 IMPORTANTE: Mejora significativa pero no bloquea
   - 🟢 NICE-TO-HAVE: Mejoras menores

### FASE 2: PROPUESTA DE REFACTORIZACIÓN

1. **Crea un plan de refactorización** con:
   - Lista priorizada de cambios
   - Estimación de impacto
   - Riesgos de cada cambio
   - Orden de implementación

2. **Diseña nueva arquitectura** (si necesario):
   - Estructura de carpetas propuesta
   - Nuevos componentes a crear
   - Stores/servicios necesarios
   - Utilities/helpers a extraer

3. **Propón mejoras específicas** para:
   - Cada componente grande
   - Sistema de estado
   - Performance crítica
   - Accesibilidad

### FASE 3: IMPLEMENTACIÓN

1. **Implementa cambios CRÍTICOS** (🔴):
   - Divide GlobeGL.svelte en componentes más pequeños
   - Refactoriza header.svelte
   - Crea sistema de stores si necesario
   - Optimiza rendimiento crítico
   - Corrige bugs graves

2. **Implementa cambios IMPORTANTES** (🟡):
   - Mejora tipado TypeScript
   - Extrae código duplicado
   - Optimiza carga de datos
   - Mejora accesibilidad

3. **Implementa NICE-TO-HAVE** (🟢) si hay tiempo:
   - Mejoras menores de UX
   - Optimizaciones adicionales
   - Documentación

### FASE 4: VALIDACIÓN

1. **Verifica que todo funciona**:
   - No hay errores de TypeScript
   - La app compila correctamente
   - Funcionalidad principal intacta
   - No hay regresiones

2. **Mide mejoras**:
   - Bundle size antes/después
   - Lighthouse scores antes/después
   - Complejidad de componentes antes/después

---

## 📊 FORMATO DEL INFORME FINAL

Al finalizar, genera un informe completo en formato Markdown con:

### 1. RESUMEN EJECUTIVO
- Estado general de la aplicación (1-10)
- Problemas críticos encontrados
- Mejoras implementadas
- Impacto estimado

### 2. ANÁLISIS DETALLADO

#### 2.1 Arquitectura
- ✅ Puntos fuertes
- ❌ Problemas encontrados
- 💡 Recomendaciones

#### 2.2 Componentes
Para cada componente principal:
- Análisis de responsabilidades
- Problemas identificados
- Refactorización realizada
- Código antes/después (snippets clave)

#### 2.3 Rendimiento
- Métricas antes/después
- Optimizaciones aplicadas
- Recomendaciones adicionales

#### 2.4 Calidad de Código
- Code smells eliminados
- Mejoras de tipado
- Reducción de complejidad

#### 2.5 Accesibilidad
- Problemas encontrados
- Mejoras implementadas
- Checklist de A11Y

### 3. CAMBIOS IMPLEMENTADOS

Lista detallada de todos los cambios con:
- Archivo modificado
- Tipo de cambio (refactor/fix/feat/perf)
- Descripción
- Impacto

### 4. MÉTRICAS

#### 4.1 Métricas de Código

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Componentes > 500 líneas | X | Y | -Z |
| Funciones > 50 líneas | X | Y | -Z |
| TypeScript errors | X | Y | -Z |
| Duplicación de código | X% | Y% | -Z% |
| Complejidad ciclomática promedio | X | Y | -Z% |
| Líneas de código totales | X | Y | -Z% |

#### 4.2 Métricas de Bundle

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Bundle size total | X KB | Y KB | -Z% |
| Main chunk size | X KB | Y KB | -Z% |
| Vendor chunk size | X KB | Y KB | -Z% |
| CSS size | X KB | Y KB | -Z% |
| Número de chunks | X | Y | -Z |
| Gzip size | X KB | Y KB | -Z% |

#### 4.3 Core Web Vitals

| Métrica | Antes | Después | Mejora | Target |
|---------|-------|---------|--------|--------|
| LCP (Largest Contentful Paint) | X ms | Y ms | -Z% | < 2.5s |
| FID/INP (First Input Delay) | X ms | Y ms | -Z% | < 100ms |
| CLS (Cumulative Layout Shift) | X | Y | -Z% | < 0.1 |
| TTFB (Time to First Byte) | X ms | Y ms | -Z% | < 600ms |

#### 4.4 Lighthouse Scores

| Categoría | Antes | Después | Mejora |
|-----------|-------|---------|--------|
| Performance | X | Y | +Z |
| Accessibility | X | Y | +Z |
| Best Practices | X | Y | +Z |
| SEO | X | Y | +Z |

#### 4.5 Runtime Performance

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Time to Interactive (TTI) | X ms | Y ms | -Z% |
| Total Blocking Time (TBT) | X ms | Y ms | -Z% |
| Speed Index | X | Y | -Z% |
| First Contentful Paint (FCP) | X ms | Y ms | -Z% |

#### 4.6 JavaScript Performance

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Main thread work | X ms | Y ms | -Z% |
| JavaScript execution time | X ms | Y ms | -Z% |
| Número de event listeners | X | Y | -Z |
| Memory usage (heap size) | X MB | Y MB | -Z% |
| Long tasks (>50ms) | X | Y | -Z |

#### 4.7 CSS Performance

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| CSS no utilizado | X KB | Y KB | -Z% |
| Número de selectores | X | Y | -Z |
| Tiempo de recalculate style | X ms | Y ms | -Z% |
| Layout shifts | X | Y | -Z |

#### 4.8 Network Performance

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Número de requests | X | Y | -Z |
| Total transfer size | X KB | Y KB | -Z% |
| Requests bloqueantes | X | Y | -Z |
| Cache hit rate | X% | Y% | +Z% |

### 5. ROADMAP FUTURO

Cambios NO implementados pero recomendados:
- Prioridad ALTA
- Prioridad MEDIA
- Prioridad BAJA

### 6. CONCLUSIONES

- Resumen de mejoras
- Estado final de la aplicación
- Próximos pasos recomendados

---

## 🛠️ HERRAMIENTAS Y CONSIDERACIONES

### Tecnologías Usadas
- **Framework**: SvelteKit 2.0 (Svelte 5 con runes)
- **Lenguaje**: TypeScript
- **3D**: globe.gl (Three.js)
- **Estilos**: CSS vanilla (sin Tailwind)
- **Geolocalización**: TopoJSON, Turf.js
- **API**: SvelteKit endpoints

### Restricciones
- ✅ Mantener funcionalidad existente
- ✅ No cambiar stack tecnológico principal
- ✅ Mantener compatibilidad con datos existentes
- ✅ No romper APIs públicas
- ⚠️ Puedes cambiar estructura interna libremente
- ⚠️ Puedes añadir dependencias si mejoran significativamente

### Prioridades
1. **Funcionalidad**: No romper nada que funcione
2. **Rendimiento**: Mejorar experiencia de usuario
3. **Mantenibilidad**: Código más limpio y organizado
4. **Escalabilidad**: Preparar para crecimiento futuro

---

## 📝 NOTAS ADICIONALES

### Características Clave a Preservar
- Sistema de navegación geográfica (mundo → país → subdivisión)
- Visualización 3D del globo interactivo
- Sistema LOD (Level of Detail) para etiquetas
- History API para navegación SPA
- Sistema de temas con 60 paletas
- Geocoding con point-in-polygon
- Modal fullscreen tipo Instagram Stories
- Sistema de drag/swipe en encuestas
- Notificaciones en tiempo real
- Perfiles de usuario con tabs

### Áreas de Especial Atención
1. **Memory leaks** en listeners globales y animaciones
2. **Performance** del globo 3D con muchos polígonos
3. **Bundle size** y code splitting
4. **TypeScript** strict mode compliance
5. **Accesibilidad** en modals y navegación

### Herramientas de Análisis de Rendimiento

**Debes usar estas herramientas para el análisis:**

1. **Chrome DevTools**
   - Performance tab: Grabar sesión de uso típico (navegación, votación, cambio de país)
   - Memory tab: Heap snapshots antes/después de acciones
   - Coverage tab: Identificar CSS/JS no utilizado
   - Lighthouse: Auditoría completa (Performance, A11Y, Best Practices, SEO)
   - Network tab: Analizar waterfall, tamaños, tiempos

2. **Vite Build Analysis**
   - Ejecutar `npm run build` y analizar output
   - Usar `rollup-plugin-visualizer` para ver composición del bundle
   - Revisar chunks generados y sus tamaños

3. **Bundle Analyzers**
   - Analizar dependencias con `npm ls`
   - Identificar duplicados con `npm dedupe`
   - Revisar package.json para dependencias innecesarias

4. **Performance Profiling**
   - Usar React DevTools Profiler (si aplica)
   - Identificar componentes que re-renderizan frecuentemente
   - Medir tiempo de renderizado de componentes grandes

5. **CSS Analysis**
   - Usar PurgeCSS o similar para identificar CSS no usado
   - Analizar especificidad con herramientas como CSS Stats
   - Revisar performance de selectores complejos

6. **Métricas Reales**
   - Lighthouse CI para métricas consistentes
   - WebPageTest para análisis detallado
   - Chrome User Experience Report para datos reales

**Comandos útiles a ejecutar:**
```bash
# Build y análisis
npm run build
npm run preview

# Análisis de bundle
npx vite-bundle-visualizer

# Análisis de dependencias
npm ls --depth=0
npm outdated

# TypeScript check
npx tsc --noEmit

# Lighthouse desde CLI
npx lighthouse http://localhost:4173 --view
```

---

## 🚀 COMENZAR

1. **Primero**: Lee este prompt completo
2. **Segundo**: Explora la estructura del proyecto
3. **Tercero**: Lee los componentes principales
4. **Cuarto**: Genera el análisis inicial
5. **Quinto**: Propón plan de refactorización
6. **Sexto**: Implementa cambios críticos
7. **Séptimo**: Genera informe final

**¡Adelante! Necesito que seas exhaustivo, crítico y propositivo. No tengas miedo de proponer cambios grandes si son necesarios.**
