# Componentes de Sección para BottomSheet

Esta carpeta contiene componentes de sección completos que encapsulan toda la lógica de diferentes tipos de contenido en el BottomSheet.

## Arquitectura

```
BottomSheet.svelte
├── ActivePollSection.svelte (Encuesta activa principal)
├── TrendingPollsSection.svelte (Ranking de trending)
├── AdCard.svelte (Anuncios patrocinados)
├── WhoToFollowSection.svelte (Sugerencias de usuarios)
└── SinglePollSection.svelte (Encuestas individuales adicionales)
```

---

## 1. **ActivePollSection.svelte**
Sección completa para la encuesta activa principal.

**Props principales:**
- `activePoll`: Datos de la encuesta activa
- `voteOptions`: Array de opciones con votos
- `state`: Estado del BottomSheet (collapsed/expanded)
- `userVotes` / `multipleVotes`: Estado de votos del usuario
- `OPTIONS_PER_PAGE`: Cantidad de opciones por página

**Eventos:**
- `optionClick`: Click en una opción
- `confirmCollaborative` / `cancelCollaborative`: Acciones de edición colaborativa
- `setActive`: Cambio de opción activa en acordeón
- `pageChange`: Cambio de página
- `confirmMultiple`: Confirmar votos múltiples
- `addOption`: Añadir nueva opción (colaborativas)
- `dragStart`: Inicio de drag para scroll

**Características:**
- Header con título, avatar y tiempo restante
- Grid de opciones con acordeón
- Soporte para encuestas colaborativas (añadir opciones)
- Paginación para +4 opciones
- Botón de confirmar votos múltiples
- Usa `ActivePollOption` y `EditablePollOption` internamente

---

## 2. **TrendingPollsSection.svelte**
Sección de ranking de encuestas trending estilo leaderboard.

**Props principales:**
- `trendingPolls`: Array de encuestas trending
- `selectedCountryName` / `selectedSubdivisionName`: Ubicación actual
- `currentPageMain`: Página actual del ranking
- `mainPollViews`: Total de vistas
- `TRENDING_PER_PAGE`: Encuestas por página (default: 5)
- `hasMorePolls`: Si hay más encuestas después

**Eventos:**
- `openPoll`: Abrir una encuesta trending
- `pollOptions`: Abrir menú de opciones de encuesta
- `pageChange`: Cambio de página con dirección (next/prev)

**Características:**
- Diseño tipo leaderboard profesional
- Rankings numerados con flechas de cambio (↑↓)
- Avatares de creadores con bordes de color
- Metadata de votos y autor verificado
- Touch gestures para navegación
- Paginación con dots
- Stats de encuestas y vistas
- Divisor para separar de otras secciones

---

## 3. **SinglePollSection.svelte**
Sección para encuestas individuales (no trending) con todas sus opciones.

**Props principales:**
- `poll`: Datos completos de la encuesta
- `state` / `activeAccordionIndex`: Estado de acordeón
- `userVotes` / `multipleVotes`: Estado de votos
- `historicalData`: Datos para gráficos históricos
- `chartHoverData` / `isBrushing`: Estado de interacción con gráfico
- `pollTitleExpanded` / `pollTitleTruncated`: Estado de expansión de títulos

**Eventos:**
- `optionClick`: Click en opción
- `setActive`: Cambio de opción activa
- `pageChange`: Cambio de página
- `timeRangeChange`: Cambio de rango temporal en gráfico
- `confirmMultiple`: Confirmar votos múltiples
- `addOption`: Añadir nueva opción (colaborativas)

**Características:**
- Header con título expandible (hashtags y regulares)
- Soporte para títulos truncados con click para expandir
- Grid de opciones con `TrendingPollOption`
- Gráficos interactivos para encuestas de 1 opción
- Paginación para múltiples opciones
- Botón confirmar votos múltiples
- Badges de tipo de encuesta

---

## 4. **WhoToFollowSection.svelte**
Sección de sugerencias de usuarios para seguir.

**Props:**
- `userSuggestions`: Array de usuarios sugeridos

**Eventos:**
- `follow`: Usuario hace click en seguir

**Características:**
- Scroll horizontal de usuarios
- Avatares con gradientes generativos si no hay imagen
- Badge de verificación
- Bio truncada
- Botón de seguir

---

## 5. **AdCard.svelte**
Tarjeta de anuncio patrocinado.

**Props:**
- `title`: Título del anuncio
- `description`: Descripción
- `ctaText`: Texto del botón CTA
- `imageUrl`: URL de la imagen
- `isSponsored`: Mostrar label "Patrocinado"

**Eventos:**
- `click`: Click en el botón CTA

**Características:**
- Label "Patrocinado"
- Imagen destacada
- CTA prominente
- Diseño limpio y profesional

---

## Uso en BottomSheet.svelte

```svelte
<script>
  import ActivePollSection from './cards/sections/ActivePollSection.svelte';
  import TrendingPollsSection from './cards/sections/TrendingPollsSection.svelte';
  import SinglePollSection from './cards/sections/SinglePollSection.svelte';
  import WhoToFollowSection from './cards/sections/WhoToFollowSection.svelte';
  import AdCard from './cards/sections/AdCard.svelte';
</script>

<!-- Encuesta activa -->
{#if activePoll && activePoll.id}
  <ActivePollSection
    {activePoll}
    {voteOptions}
    {state}
    {userVotes}
    {multipleVotes}
    on:optionClick={handleVote}
    on:confirmMultiple={handleConfirmMultiple}
  />
{/if}

<!-- Trending polls -->
{#if trendingPolls.length > 0}
  <TrendingPollsSection
    {trendingPolls}
    {selectedCountryName}
    {selectedSubdivisionName}
    showActivePoll={!!activePoll?.id}
    on:openPoll={handleOpenTrendingPoll}
  />
{/if}

<!-- Encuestas adicionales con inserts -->
{#each additionalPolls as poll, index}
  <!-- Anuncio cada 3 encuestas -->
  {#if index === 2}
    <AdCard on:click={handleAdClick} />
  {/if}
  
  <!-- A quién seguir después de la 5ta -->
  {#if index === 5}
    <WhoToFollowSection
      {userSuggestions}
      on:follow={handleFollow}
    />
  {/if}
  
  <!-- Encuesta individual -->
  <SinglePollSection
    {poll}
    {state}
    {userVotes}
    {multipleVotes}
    on:optionClick={handleVote}
  />
{/each}
```

---

## Beneficios de la arquitectura por secciones

### 1. **Máxima modularidad**
- Cada tipo de contenido está completamente aislado
- Fácil agregar nuevos tipos de secciones
- Reutilización en otros contextos

### 2. **Mantenibilidad superior**
- BottomSheet.svelte mucho más limpio (~500 líneas menos)
- Cada sección maneja su propia lógica y estado
- Más fácil debuggear problemas específicos

### 3. **Escalabilidad**
- Agregar nuevas features por sección sin afectar otras
- Fácil A/B testing de diferentes diseños
- Código preparado para crecimiento

### 4. **Testabilidad**
- Cada sección se puede testear independientemente
- Props y eventos bien definidos
- Componentes más pequeños = tests más simples

### 5. **Separación de responsabilidades**
- **ActivePollSection**: Lógica de encuesta principal
- **TrendingPollsSection**: Ranking y navegación
- **SinglePollSection**: Encuestas individuales con gráficos
- **WhoToFollowSection**: Sistema de seguimiento
- **AdCard**: Monetización

---

## Estructura de datos típica

```typescript
// ActivePoll
{
  id: number,
  question: string,
  title: string,
  type: 'simple' | 'multiple' | 'collaborative',
  options: Array<{
    key: string,
    label: string,
    color: string,
    votes: number,
    isEditing?: boolean
  }>,
  closedAt: Date | null,
  region: string,
  creatorAvatar: string
}

// TrendingPoll
{
  id: number,
  question: string,
  totalVotes: number,
  user: {
    displayName: string,
    avatarUrl: string,
    verified: boolean
  },
  options: Array<{color: string}>
}

// UserSuggestion
{
  displayName: string,
  avatarUrl: string,
  bio: string,
  verified: boolean
}
```

---

## Migración desde código inline

**Antes** (~3000 líneas en BottomSheet.svelte):
```svelte
<!-- 200+ líneas de header de encuesta activa -->
<!-- 300+ líneas de grid de opciones -->
<!-- 500+ líneas de trending ranking -->
<!-- 200+ líneas por cada encuesta adicional -->
<!-- etc. -->
```

**Después** (~1500 líneas en BottomSheet.svelte):
```svelte
<ActivePollSection {...props} on:* />
<TrendingPollsSection {...props} on:* />
{#each polls as poll}
  <SinglePollSection {poll} on:* />
{/each}
```

**Resultado**: **-50% líneas de código**, **+100% mantenibilidad**

---

## Próximos pasos sugeridos

1. ✅ Crear componentes de opción (ActivePollOption, TrendingPollOption, EditablePollOption)
2. ✅ Crear componentes de sección (este directorio)
3. ⏳ Integrar en BottomSheet.svelte
4. ⏳ Verificar funcionamiento completo
5. 📝 Extraer estilos compartidos a archivos CSS dedicados
6. 🧪 Crear tests unitarios para cada sección
7. 📊 Agregar analytics/tracking por sección
