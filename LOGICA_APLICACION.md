# Lógica de Aplicación - VoteTok (ACTUALIZADA)

## 🎯 Flujo Principal de la Aplicación

### 📌 CAMBIO IMPORTANTE EN LA UI

**Avatares del Header:**
- **NO cambian** cuando seleccionas una encuesta
- Siempre muestran:
  - Vista "Para Ti": Avatares de seguidores
  - Vista "Trending": Avatares de usuarios con encuestas más votadas
- Todos los datos vienen de BD

**Barra Horizontal (Gráfico de Opciones):**
- **Ubicación**: Justo encima del BottomSheet
- **Comportamiento**:
  - **Sin encuesta seleccionada**: Oculta o muestra resumen global
  - **Con encuesta seleccionada**: 
    - Muestra título de la encuesta arriba
    - Muestra barra horizontal con colores de opciones
    - **Click en la barra** → Se despliega hacia abajo mostrando todas las opciones (igual que en BottomSheet)

---

### 1. **CARGA INICIAL (Vista Global)**

#### Backend:
- API `/api/polls/trending-by-region?region=Global` devuelve encuestas trending de BD
- Cada encuesta tiene: `id`, `title`, `options[]` (con `color`, `optionLabel`, `voteCount`)

#### Frontend - BottomSheet:
1. `loadMainPoll()` carga encuestas trending de BD
2. Transforma cada encuesta a formato:
   ```js
   {
     key: poll.id,
     label: poll.title,
     color: poll.options[0].color, // Color de la primera opción
     votes: poll.trendingScore,
     pollData: poll // Datos completos
   }
   ```
3. Emite evento `openPollInGlobe` con `poll: null` y `options: encuestasTrending`

#### Frontend - GlobeGL:
1. Recibe evento en `handleOpenPollInGlobe`
2. Actualiza `colorMap` con colores de cada encuesta
3. Genera `answersData` simulados para cada país
4. Recalcula colores dominantes con `computeGlobeViewModel`
5. Llama `globe.refreshPolyColors()` para actualizar polígonos
6. Emite `polldata` con:
   ```js
   {
     title: "Trending Global",
     options: encuestasTrending.map(e => ({
       key: e.label,
       color: e.color,
       avatar: '/default-avatar.png'
     })),
     isWorldView: true
   }
   ```

#### Frontend - Header:
1. **NO recibe cambios de encuesta**
2. Siempre muestra avatares de usuarios trending (de BD)
3. Avatares con círculo de color según su encuesta más votada

#### Frontend - Barra de Opciones (Nueva):
1. **Ubicación**: Justo encima del BottomSheet
2. **Estado inicial**: Oculta (no hay encuesta seleccionada)
3. **Contenido**: Solo el título "Trending Global" o similar

#### Frontend - Trending (BottomSheet):
1. Muestra lista de encuestas trending
2. Cada item tiene avatar con borde del color de la encuesta

---

### 2. **CLICK EN ENCUESTA TRENDING**

#### Frontend - BottomSheet:
1. Usuario hace click en encuesta del trending
2. `openTrendingPoll(pollData)` se ejecuta
3. Transforma encuesta a formato Poll
4. Agrega a `additionalPolls`
5. Llama `openAdditionalPollInGlobe(transformedPoll)`
6. Emite evento `openPollInGlobe` con:
   ```js
   {
     poll: transformedPoll,
     options: poll.options // Opciones de ESA encuesta
   }
   ```

#### Frontend - GlobeGL:
1. Recibe evento en `handleOpenPollInGlobe`
2. Actualiza `colorMap` con colores de las OPCIONES de la encuesta
3. Genera `answersData` con las opciones de la encuesta
4. Recalcula colores dominantes
5. Llama `globe.refreshPolyColors()`
6. Emite `polldata` con:
   ```js
   {
     title: poll.title, // Título de la encuesta
     options: poll.options.map(opt => ({
       key: opt.label,
       color: opt.color,
       avatar: opt.avatarUrl || '/default-avatar.png'
     })),
     isWorldView: false
   }
   ```

#### Frontend - Header:
1. **NO cambia** - sigue mostrando avatares de usuarios trending
2. Los avatares permanecen igual

#### Frontend - Barra de Opciones:
1. **Se muestra** encima del BottomSheet
2. **Título**: Nombre de la encuesta seleccionada
3. **Barra horizontal**: Muestra colores de todas las opciones (proporcional a votos)
4. **Click en la barra**: Se despliega hacia abajo mostrando:
   - Todas las opciones con sus porcentajes
   - Igual que se ve en las cards del BottomSheet
   - Botón para cerrar/colapsar

---

### 3. **NAVEGACIÓN POR PAÍSES**

#### Frontend - GlobeGL:
1. Usuario hace click en un país (ej: España)
2. NavigationManager cambia a vista país
3. BottomSheet llama `loadMainPoll()` con `region=España`

#### Backend:
- API `/api/polls/trending-by-region?region=España` devuelve encuestas trending de España

#### Frontend - BottomSheet:
1. Carga encuestas trending del país seleccionado
2. Emite `openPollInGlobe` con las encuestas del país
3. Trending muestra encuestas de ese país

#### Frontend - GlobeGL:
1. Recibe evento con encuestas del país
2. Actualiza colores del globo con datos del país
3. Cada región del país se colorea según encuesta dominante

#### Frontend - Header:
1. **NO cambia** - sigue mostrando avatares trending GLOBALES
2. Los avatares son independientes del país seleccionado
3. Siempre muestran usuarios con más votos a nivel global

#### Frontend - Barra de Opciones:
1. Si hay encuesta seleccionada, la muestra
2. Si no, puede mostrar "Trending de España" o similar

---

### ⚠️ PROBLEMA ACTUAL A CORREGIR

**Comportamiento incorrecto:**
- ❌ Al seleccionar país, los avatares del header cambian
- ❌ Los avatares muestran opciones en lugar de usuarios

**Comportamiento correcto:**
- ✅ Al seleccionar país, solo cambia el trending del BottomSheet
- ✅ Los avatares del header NUNCA cambian
- ✅ Los avatares siempre muestran usuarios trending globales de BD
- ✅ El globo muestra colores según encuestas del país seleccionado

---

## 🔧 Problemas Actuales a Resolver

### ❌ Problema 1: Datos Hardcodeados
- **Actual**: Globo usa `/static/data/WORLD.json` con datos fake
- **Solución**: Eliminar carga de WORLD.json, usar solo datos de BD

### ❌ Problema 2: Inicialización
- **Actual**: Globo se inicializa con datos vacíos o hardcodeados
- **Solución**: Esperar a que `loadMainPoll()` termine antes de inicializar globo

### ❌ Problema 3: Colores no se actualizan
- **Actual**: `refreshPolyColors()` no se llama o no funciona
- **Solución**: Asegurar que se llama después de actualizar `colorMap` y `isoDominantKey`

---

## ✅ Implementación Requerida

### Paso 1: Eliminar datos hardcodeados
- [ ] No cargar `/static/data/WORLD.json`
- [ ] Inicializar `answersData` y `colorMap` vacíos
- [ ] Esperar evento `openPollInGlobe` para poblar datos

### Paso 2: Sincronizar carga inicial
- [ ] `loadMainPoll()` debe ejecutarse en `onMount` de BottomSheet
- [ ] Debe emitir `openPollInGlobe` cuando termine
- [ ] GlobeGL debe esperar este evento para mostrar colores

### Paso 3: Actualización de colores
- [ ] `handleOpenPollInGlobe` debe actualizar todos los datos
- [ ] Debe llamar `refreshPolyColors()` con timeout
- [ ] Debe emitir `polldata` para actualizar header

### Paso 4: Header dinámico
- [ ] Vista global: "Trending Global" + encuestas como opciones
- [ ] Vista encuesta: Título de encuesta + opciones reales
- [ ] Avatares con borde del color correspondiente

---

## 📊 Estructura de Datos

### Encuesta Trending (de BD):
```typescript
{
  id: number,
  title: string,
  options: [
    {
      optionKey: string,
      optionLabel: string,
      color: string,
      voteCount: number,
      avatarUrl?: string
    }
  ],
  trendingScore: number,
  user: {
    displayName: string,
    avatarUrl: string
  }
}
```

### Formato para Globo (voteOptions):
```typescript
{
  key: string, // poll.id o option.key
  label: string, // poll.title o option.label
  color: string, // poll.options[0].color o option.color
  votes: number,
  pollData?: any // Datos completos de la encuesta
}
```

### Formato para Header (polldata):
```typescript
{
  title: string,
  options: [
    {
      key: string,
      color: string,
      avatar: string
    }
  ],
  isWorldView: boolean
}
```

---

## 🔄 Flujo de Eventos

```
1. App carga
   ↓
2. BottomSheet.onMount() → loadMainPoll()
   ↓
3. API devuelve encuestas trending
   ↓
4. BottomSheet transforma y emite openPollInGlobe
   ↓
5. GlobeGL.handleOpenPollInGlobe actualiza datos
   ↓
6. GlobeGL.refreshPolyColors() actualiza colores
   ↓
7. GlobeGL emite polldata
   ↓
8. Header se actualiza con título y avatares
   ↓
9. Usuario ve: "Trending Global" + colores correctos
```

---

## 🎨 Colores

### Vista Global (Trending):
- Cada país se colorea según la encuesta trending dominante
- Color = `poll.options[0].color` de la encuesta más votada en ese país

### Vista Encuesta:
- Cada país se colorea según la opción dominante de ESA encuesta
- Color = `option.color` de la opción más votada en ese país

---

## 🚀 Plan de Implementación

### Fase 1: Arreglar Header (Avatares) ✅ COMPLETADA
- [x] Eliminar evento `polldata` que actualiza header
- [x] Header carga usuarios trending de BD una sola vez
- [x] API: `/api/polls/trending-by-region?region=Global` para obtener usuarios
- [x] Avatares con círculo de color de su encuesta principal
- [x] Header simplificado: solo logo + avatares
- [x] Eliminado código de títulos y opciones de encuestas

### Fase 2: Crear Barra de Opciones ✅ COMPLETADA
- [x] Nuevo componente `PollOptionsBar.svelte`
- [x] Ubicación: Entre Header y BottomSheet (top: 80px)
- [x] Recibe datos de encuesta seleccionada via props
- [x] Muestra título + barra horizontal de colores proporcionales
- [x] Click → Despliega opciones completas con avatares y porcentajes
- [x] Animaciones suaves de entrada/salida

### Fase 3: Actualizar Flujo de Eventos ✅ COMPLETADA
- [x] GlobeGL NO emite `polldata` al header
- [x] GlobeGL emite `pollselected` cuando se abre encuesta
- [x] BottomSheet emite `openPollInGlobe` cuando se abre encuesta
- [x] +page.svelte maneja `pollselected` y actualiza `selectedPoll`
- [x] Header permanece independiente
- [x] PollOptionsBar recibe `selectedPoll` y se muestra/oculta automáticamente

### Fase 4: Verificar Datos de BD
- [ ] Confirmar que NO se usa WORLD.json
- [ ] Confirmar que colores vienen de BD
- [ ] Confirmar que trending viene de BD
- [ ] Confirmar que usuarios vienen de BD

### Fase 5: Testing
- [ ] Cargar app → Ver avatares trending globales
- [ ] Click en encuesta → Ver barra de opciones
- [ ] Click en país → Ver trending del país + avatares NO cambian
- [ ] Click en encuesta del país → Ver barra de opciones

---

## 📝 Checklist de Verificación

**Header:**
- [ ] Muestra avatares de usuarios (no opciones)
- [ ] Avatares vienen de BD
- [ ] NO cambian al seleccionar encuesta
- [ ] NO cambian al seleccionar país
- [ ] Círculo de color según encuesta del usuario

**Barra de Opciones:**
- [ ] Oculta cuando no hay encuesta seleccionada
- [ ] Muestra título de encuesta cuando se selecciona
- [ ] Barra horizontal con colores proporcionales
- [ ] Click despliega opciones completas
- [ ] Datos vienen de la encuesta seleccionada

**Globo:**
- [ ] Colores vienen de BD (no WORLD.json)
- [ ] Vista global: colores de encuestas trending globales
- [ ] Vista país: colores de encuestas trending del país
- [ ] Vista encuesta: colores de opciones de la encuesta

**Trending:**
- [ ] Vista global: encuestas trending globales
- [ ] Vista país: encuestas trending del país
- [ ] Avatares con borde de color de la encuesta
- [ ] Datos vienen de BD
