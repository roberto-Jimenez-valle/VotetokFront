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
VouTopFront/
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

### K. BASE DE DATOS POSTGRESQL (ANÁLISIS EXHAUSTIVO)

#### K.1 Esquema y Diseño

1. **Auditar estructura de tablas**
   - Revisar normalización (¿está correctamente normalizada?)
   - Identificar redundancia de datos
   - Verificar integridad referencial (foreign keys)
   - Revisar tipos de datos apropiados
   - Identificar campos que deberían ser NOT NULL
   - Revisar constraints y validaciones a nivel de BD

2. **Analizar relaciones**
   - Verificar foreign keys y sus acciones (CASCADE, SET NULL, etc.)
   - Identificar relaciones faltantes
   - Revisar cardinalidad (1:1, 1:N, N:M)
   - Proponer mejoras en el modelo relacional

3. **Revisar nomenclatura**
   - Consistencia en nombres de tablas
   - Consistencia en nombres de columnas
   - Convenciones de naming (snake_case, camelCase)
   - Claridad y descriptividad

#### K.2 Índices y Performance

1. **Auditar índices existentes**
   - Identificar tablas sin índices apropiados
   - Detectar índices no utilizados (dead indexes)
   - Revisar índices duplicados o redundantes
   - Verificar índices en foreign keys
   - Analizar índices compuestos vs simples

2. **Proponer nuevos índices**
   - Índices para queries frecuentes
   - Índices parciales para casos específicos
   - Índices GiST/GIN para búsquedas full-text
   - Índices para ordenamiento (ORDER BY)
   - Índices para joins frecuentes

3. **Analizar uso de índices**
   - Revisar EXPLAIN ANALYZE de queries críticas
   - Identificar sequential scans que deberían usar índices
   - Optimizar índices según patrones de uso real

#### K.3 Queries y Optimización

1. **Auditar queries existentes**
   - Identificar N+1 queries
   - Detectar queries lentas (>100ms)
   - Revisar uso de SELECT *
   - Identificar queries sin WHERE apropiado
   - Detectar queries con múltiples JOINs complejos

2. **Optimizar queries críticas**
   - Usar EXPLAIN ANALYZE para identificar cuellos de botella
   - Proponer reescritura de queries ineficientes
   - Implementar CTEs (Common Table Expressions) donde sea apropiado
   - Optimizar subconsultas
   - Reducir número de roundtrips a la BD

3. **Implementar caching de queries**
   - Identificar queries que se repiten frecuentemente
   - Proponer estrategias de caching (Redis, en memoria)
   - Implementar materialized views para agregaciones costosas
   - Cache de conteos y estadísticas

#### K.4 Datos y Volumen

1. **Analizar volumen de datos**
   - Tamaño actual de cada tabla
   - Proyección de crecimiento
   - Identificar tablas que crecerán rápidamente
   - Proponer estrategias de particionamiento si es necesario

2. **Optimizar almacenamiento**
   - Identificar columnas con datos redundantes
   - Proponer normalización adicional si es necesario
   - Revisar uso de JSON/JSONB (¿es apropiado?)
   - Optimizar tipos de datos (INT vs BIGINT, VARCHAR vs TEXT)

3. **Gestión de datos históricos**
   - Proponer archivado de datos antiguos
   - Estrategias de soft delete vs hard delete
   - Implementar particionamiento por fecha si es necesario

#### K.5 Seguridad y Permisos

1. **Auditar seguridad**
   - Revisar permisos de usuarios de BD
   - Verificar uso de prepared statements (prevención de SQL injection)
   - Revisar exposición de datos sensibles
   - Validar encriptación de datos sensibles

2. **Proponer mejoras de seguridad**
   - Row-level security si es apropiado
   - Auditoría de cambios críticos
   - Backups y estrategias de recuperación

#### K.6 Migraciones y Versionado

1. **Revisar sistema de migraciones**
   - ¿Hay sistema de migraciones implementado?
   - ¿Las migraciones son reversibles?
   - ¿Hay documentación de cambios de esquema?

2. **Proponer mejoras**
   - Implementar migraciones automáticas si no existen
   - Versionado de esquema
   - Estrategias de rollback

#### K.7 Monitoreo y Métricas

1. **Implementar monitoreo**
   - Queries lentas (slow query log)
   - Uso de conexiones
   - Tamaño de tablas e índices
   - Cache hit ratio
   - Locks y deadlocks

2. **Métricas a incluir en el informe**
   - Queries más lentas (top 10)
   - Tablas más grandes
   - Índices más usados/no usados
   - Conexiones activas promedio
   - Tiempo de respuesta promedio por endpoint

#### K.8 Casos Específicos de VouTop

1. **Tabla de encuestas (polls)**
   - Índices en user_id, created_at, status
   - Optimizar queries de trending polls
   - Particionamiento por fecha si hay muchas encuestas

2. **Tabla de votos (votes)**
   - Índices compuestos en (poll_id, user_id)
   - Índices en subdivision_id para agregaciones geográficas
   - Considerar particionamiento por fecha
   - Optimizar conteos de votos (materialized views?)

3. **Tabla de subdivisiones (subdivisions)**
   - Índices en level, parent_id, country_iso
   - Índices GiST para búsquedas geográficas si hay lat/lon
   - Optimizar queries jerárquicas (país → subdivisión)

4. **Tabla de usuarios (users)**
   - Índices en username, email
   - Índices en created_at para usuarios recientes
   - Optimizar queries de followers/following

5. **Tabla de notificaciones (notifications)**
   - Índices en (user_id, read, created_at)
   - Considerar archivado de notificaciones antiguas
   - Optimizar queries de notificaciones no leídas

6. **Agregaciones geográficas**
   - Optimizar queries que agrupan por país/subdivisión
   - Considerar materialized views para resultados por región
   - Índices apropiados para JOINs con datos geográficos

---

## 🎯 TAREAS ESPECÍFICAS

### FASE 1: ANÁLISIS (NO MODIFICAR CÓDIGO AÚN)

1. **Lee TODOS los archivos principales**:
   
   **Frontend:**
   - `src/lib/GlobeGL.svelte`
   - `src/lib/header.svelte`
   - `src/lib/CreatePollModal.svelte`
   - `src/lib/NotificationsModal.svelte`
   - `src/lib/SearchModal.svelte`
   - `src/lib/UserProfileModal.svelte`
   - `src/lib/globe/GlobeCanvas.svelte`
   - `src/lib/globe/cards/sections/SinglePollSection.svelte`
   - `src/routes/+page.svelte`
   
   **Backend y Base de Datos:**
   - Todos los archivos en `src/routes/api/` (endpoints)
   - Archivos de configuración de base de datos
   - Esquema de base de datos (si existe archivo de schema)
   - Archivos de migraciones (si existen)
   - `src/lib/server/` (si existe lógica de servidor)

2. **Analiza la base de datos PostgreSQL**:
   - Conecta a la BD y ejecuta queries de análisis:
     ```sql
     -- Listar todas las tablas y sus tamaños
     SELECT schemaname, tablename, 
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
     FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
     ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
     
     -- Listar índices y su uso
     SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
     FROM pg_stat_user_indexes
     ORDER BY idx_scan ASC;
     
     -- Queries lentas (si está habilitado pg_stat_statements)
     SELECT query, calls, total_time, mean_time
     FROM pg_stat_statements
     ORDER BY mean_time DESC LIMIT 10;
     ```
   - Documenta el esquema actual (tablas, columnas, tipos, relaciones)
   - Identifica índices existentes
   - Analiza queries en los endpoints API

3. **Genera un mapa mental** de:
   - Dependencias entre componentes
   - Flujo de datos (frontend → API → BD)
   - Event chains
   - Lifecycle hooks
   - Stores y estado global
   - Estructura de tablas y relaciones de BD
   - Flujo de queries más frecuentes

4. **Identifica y prioriza problemas**:
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
   - Performance crítica (JS, CSS, assets)
   - Accesibilidad

4. **Análisis de rendimiento detallado**:
   - Ejecutar Lighthouse y documentar scores actuales
   - Identificar bottlenecks de JavaScript con Performance tab
   - Analizar CSS no utilizado con Coverage tab
   - Medir bundle size y proponer optimizaciones
   - Identificar memory leaks con Memory profiler
   - Analizar Core Web Vitals y proponer mejoras específicas

### FASE 3: IMPLEMENTACIÓN

1. **Implementa cambios CRÍTICOS** (🔴):
   
   **Frontend:**
   - Divide GlobeGL.svelte en componentes más pequeños
   - Refactoriza header.svelte
   - Crea sistema de stores si necesario
   - Optimiza rendimiento crítico (JS, CSS)
   - Corrige bugs graves
   
   **Base de Datos:**
   - Agrega índices faltantes críticos
   - Optimiza queries más lentas (>500ms)
   - Corrige problemas de N+1 queries
   - Implementa caching para queries frecuentes
   - Corrige problemas de integridad referencial

2. **Implementa cambios IMPORTANTES** (🟡):
   
   **Frontend:**
   - Mejora tipado TypeScript
   - Extrae código duplicado
   - Optimiza carga de datos
   - Mejora accesibilidad
   - Reduce bundle size
   
   **Base de Datos:**
   - Agrega índices para optimización
   - Implementa materialized views si es apropiado
   - Optimiza queries moderadamente lentas (100-500ms)
   - Mejora estructura de tablas si es necesario
   - Implementa archivado de datos históricos

3. **Implementa NICE-TO-HAVE** (🟢) si hay tiempo:
   - Mejoras menores de UX
   - Optimizaciones adicionales
   - Documentación
   - Índices parciales para casos específicos
   - Particionamiento de tablas grandes

### FASE 4: VALIDACIÓN

1. **Verifica que todo funciona**:
   - No hay errores de TypeScript
   - La app compila correctamente
   - Funcionalidad principal intacta
   - No hay regresiones
   - Queries de BD funcionan correctamente
   - No hay errores en endpoints API

2. **Mide mejoras**:
   
   **Frontend:**
   - Bundle size antes/después
   - Lighthouse scores antes/después
   - Complejidad de componentes antes/después
   - Core Web Vitals antes/después
   - Memory usage antes/después
   
   **Base de Datos:**
   - Tiempo de queries antes/después (ejecutar EXPLAIN ANALYZE)
   - Número de índices antes/después
   - Tamaño de BD antes/después
   - Cache hit ratio antes/después
   - Tiempo de respuesta de endpoints API antes/después
   
3. **Genera reportes de performance**:
   - Ejecutar Lighthouse y guardar resultados
   - Ejecutar queries de análisis de BD y documentar
   - Tomar screenshots de Performance tab
   - Documentar mejoras con gráficos si es posible

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

#### 2.6 Base de Datos PostgreSQL
- Análisis del esquema actual
- Problemas de normalización/diseño
- Índices faltantes o redundantes
- Queries lentas identificadas
- Optimizaciones implementadas
- Propuestas de mejora adicionales

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

#### 4.9 Base de Datos PostgreSQL

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Queries lentas (>100ms) | X | Y | -Z |
| Tiempo promedio de query | X ms | Y ms | -Z% |
| Índices no utilizados | X | Y | -Z |
| Índices faltantes agregados | 0 | Y | +Y |
| Tamaño total de BD | X MB | Y MB | -Z% |
| N+1 queries detectadas | X | Y | -Z |
| Sequential scans innecesarios | X | Y | -Z |
| Cache hit ratio | X% | Y% | +Z% |

#### 4.10 API Performance

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Tiempo respuesta promedio | X ms | Y ms | -Z% |
| Endpoints lentos (>500ms) | X | Y | -Z |
| Llamadas API redundantes | X | Y | -Z |
| Payload promedio | X KB | Y KB | -Z% |

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

---

## ⚡ ÉNFASIS ESPECIAL EN RENDIMIENTO COMPLETO

**ES CRÍTICO** que dediques especial atención al análisis exhaustivo de rendimiento en frontend Y backend:

### 🔍 JavaScript Performance
- **Profiling detallado**: Usa Chrome DevTools Performance para identificar funciones lentas, long tasks, y bottlenecks
- **Bundle analysis**: Analiza el tamaño del bundle, identifica dependencias pesadas, propón code splitting
- **Memory leaks**: Detecta memory leaks en event listeners, closures, y animaciones
- **Event handlers**: Revisa todos los event listeners globales, implementa debouncing/throttling donde sea necesario
- **Reactividad**: Optimiza el uso de runes de Svelte 5 ($state, $derived, $effect)
- **WebGL**: Optimiza el rendimiento del globo 3D (Three.js), reduce re-renderizados innecesarios

### 🎨 CSS Performance
- **CSS no utilizado**: Identifica y elimina CSS que no se usa (usa Coverage tab)
- **Selectores**: Optimiza selectores complejos que causan reflows
- **Animaciones**: Asegura que las animaciones usen transform/opacity para GPU acceleration
- **Layout thrashing**: Detecta y elimina operaciones que causan reflows múltiples
- **Critical CSS**: Identifica CSS crítico para above-the-fold
- **Organización**: Propón mejor estructura y eliminación de duplicados

### 📦 Assets y Recursos
- **Imágenes**: Optimiza tamaños, propón formatos modernos (WebP, AVIF)
- **Fuentes**: Optimiza carga de fuentes, implementa font-display: swap
- **TopoJSON**: Revisa tamaño de archivos geográficos, propón lazy loading
- **Compresión**: Asegura que todos los assets estén comprimidos (gzip/brotli)

### 📊 Core Web Vitals
Debes medir y optimizar específicamente:
- **LCP (Largest Contentful Paint)**: Target < 2.5s
- **FID/INP (First Input Delay)**: Target < 100ms
- **CLS (Cumulative Layout Shift)**: Target < 0.1
- **TTFB (Time to First Byte)**: Target < 600ms

### 🗄️ Base de Datos PostgreSQL Performance
- **Índices**: Analiza índices existentes, identifica faltantes, elimina redundantes
- **Queries lentas**: Usa EXPLAIN ANALYZE para identificar queries >100ms
- **N+1 queries**: Detecta y corrige problemas de N+1 en endpoints
- **Caching**: Implementa caching para queries frecuentes
- **Esquema**: Revisa normalización y estructura de tablas
- **Volumen**: Analiza tamaño de tablas y propón particionamiento si es necesario
- **Monitoreo**: Documenta queries más lentas y propón optimizaciones

### 🔬 Herramientas Obligatorias

**Frontend:**
1. **Lighthouse**: Ejecuta auditoría completa y documenta scores
2. **Performance tab**: Graba sesión de uso típico y analiza
3. **Memory tab**: Toma heap snapshots y detecta leaks
4. **Coverage tab**: Identifica código no utilizado
5. **Network tab**: Analiza waterfall y optimiza carga

**Base de Datos:**
1. **EXPLAIN ANALYZE**: Para todas las queries críticas
2. **pg_stat_statements**: Analiza queries más frecuentes y lentas
3. **pg_stat_user_indexes**: Revisa uso de índices
4. **pg_stat_user_tables**: Analiza tamaño y acceso a tablas
5. **Herramientas de monitoreo**: pgAdmin, DataGrip, o similar

### 📈 Métricas Esperadas en el Informe
El informe final DEBE incluir tablas comparativas con:

**Frontend:**
- Bundle size antes/después (total, chunks, gzip)
- Lighthouse scores antes/después (Performance, A11Y, Best Practices, SEO)
- Core Web Vitals antes/después (LCP, FID, CLS, TTFB)
- JavaScript metrics (execution time, long tasks, memory usage)
- CSS metrics (unused CSS, selector count, recalculate style time)
- Network metrics (requests count, transfer size, cache hit rate)

**Base de Datos:**
- Queries lentas antes/después (número y tiempo promedio)
- Índices antes/después (total, no usados, agregados)
- Tiempo de respuesta de endpoints API antes/después
- N+1 queries detectadas y corregidas
- Cache hit ratio antes/después
- Tamaño de BD antes/después

---

## 🎯 OBJETIVO FINAL

**¡Adelante! Necesito que seas exhaustivo, crítico y propositivo. No tengas miedo de proponer cambios grandes si son necesarios.**

**RECUERDA**: El rendimiento completo (frontend Y backend) es TAN IMPORTANTE como la arquitectura y la calidad del código. Dedica tiempo significativo a:

**Frontend:**
1. Medir el rendimiento actual con herramientas reales (Lighthouse, Performance tab)
2. Identificar bottlenecks de JavaScript y CSS con datos concretos
3. Implementar optimizaciones medibles (bundle size, Core Web Vitals)
4. Documentar mejoras con métricas antes/después

**Base de Datos:**
1. Analizar el esquema actual y queries existentes
2. Identificar queries lentas con EXPLAIN ANALYZE
3. Detectar N+1 queries y problemas de índices
4. Implementar optimizaciones (índices, caching, reescritura de queries)
5. Documentar mejoras con métricas antes/después

El informe final debe demostrar mejoras tangibles en:
- ✅ **Rendimiento frontend** (bundle, Lighthouse, Core Web Vitals)
- ✅ **Rendimiento de base de datos** (queries, índices, tiempo de respuesta)
- ✅ **Arquitectura y código** (componentes, tipado, organización)
- ✅ **Accesibilidad** (A11Y scores, navegación por teclado)

**NO es suficiente solo refactorizar código. Debes MEDIR y OPTIMIZAR el rendimiento real de la aplicación completa.**
