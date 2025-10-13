# Ejemplo de Integración de Componentes de Sección

## Estructura actual creada:

### 📁 src/lib/globe/cards/
- **ActivePollOption.svelte** - Opción individual de encuesta activa
- **TrendingPollOption.svelte** - Opción de trending con gráficos
- **EditablePollOption.svelte** - Opción editable (colaborativa)

### 📁 src/lib/globe/cards/sections/
- **ActivePollSection.svelte** - Sección completa encuesta activa
- **TrendingPollsSection.svelte** - Sección completa trending ranking  
- **SinglePollSection.svelte** - Sección encuesta individual
- **WhoToFollowSection.svelte** - Sección "A quién seguir"
- **AdCard.svelte** - Tarjeta de anuncio

---

## Cómo se integraría en BottomSheet.svelte:

### ANTES (~3000 líneas):
```svelte
<div class="main-scroll-container">
  <!-- 300+ líneas de código inline para encuesta activa -->
  {#if activePoll}
    <div class="vote-cards-section">
      <div class="topic-header">...</div>
      <div class="vote-cards-container">
        {#each options as option}
          <!-- 100+ líneas por opción -->
        {/each}
      </div>
      <!-- paginación, botones, etc -->
    </div>
  {/if}
  
  <!-- 500+ líneas de código inline para trending -->
  {#if trendingPolls.length > 0}
    <div class="vote-cards-section">
      <!-- Trending ranking completo -->
    </div>
  {/if}
  
  <!-- 200+ líneas por cada encuesta adicional -->
  {#each additionalPolls as poll}
    <div class="poll-item">
      <!-- Header, opciones, gráficos, etc -->
    </div>
  {/each}
</div>
```

### DESPUÉS (~500 líneas):
```svelte
<div class="main-scroll-container">
  <!-- Encuesta activa (1 línea!) -->
  {#if activePoll && activePoll.id && voteOptions.length > 0}
    <ActivePollSection
      {activePoll}
      {voteOptions}
      {state}
      {activeAccordionMainIndex}
      {currentPageMain}
      {transitionDirectionMain}
      {userVotes}
      {multipleVotes}
      {OPTIONS_PER_PAGE}
      on:optionClick={(e) => {
        const { event, optionKey, pollId } = e.detail;
        voteClickX = event.clientX;
        voteClickY = event.clientY;
        if (activePoll.type === 'multiple') {
          handleMultipleVote(optionKey, pollId);
        } else {
          handleVote(optionKey);
        }
      }}
      on:setActive={(e) => activeAccordionMainIndex = e.detail.index}
      on:pageChange={(e) => currentPageMain = e.detail.page}
      on:confirmMultiple={(e) => confirmMultipleVotes(e.detail.pollId)}
      on:confirmCollaborative={(e) => confirmCollaborativeOption(e.detail.pollId)}
      on:cancelCollaborative={(e) => cancelCollaborativeOption(e.detail.pollId)}
      on:addOption={(e) => addNewCollaborativeOption(e.detail.pollId)}
      on:dragStart={(e) => handleDragStart(e.detail.event)}
    />
    
    <!-- Divisor si hay más contenido -->
    {#if trendingPolls.length > 0}
      <div class="more-polls-divider">
        <div class="divider-line"></div>
        <span class="divider-text">Trending en {selectedSubdivisionName || selectedCountryName || 'Global'}</span>
        <div class="divider-line"></div>
      </div>
    {/if}
  {/if}
  
  <!-- Trending (1 línea!) -->
  {#if trendingPolls.length > 0}
    <TrendingPollsSection
      {trendingPolls}
      {selectedCountryName}
      {selectedSubdivisionName}
      {currentPageMain}
      {trendingTransitionDirection}
      {mainPollViews}
      showActivePoll={!!(activePoll && activePoll.id)}
      {TRENDING_PER_PAGE}
      hasMorePolls={additionalPolls.length > 0}
      on:openPoll={(e) => openTrendingPoll(e.detail.poll)}
      on:pollOptions={(e) => openPollOptionsModal(e.detail.poll)}
      on:pageChange={(e) => {
        currentPageMain = e.detail.page;
        trendingTransitionDirection = e.detail.direction;
      }}
    />
  {/if}
  
  <!-- Encuestas adicionales con inserts de contenido -->
  {#each filteredAdditionalPolls as poll, pollIndex (poll.id)}
    <!-- Anuncio cada 3 encuestas -->
    {#if pollIndex === 2}
      <AdCard
        on:click={() => console.log('Ad clicked')}
      />
    {/if}
    
    <!-- A quién seguir después de la 5ta encuesta -->
    {#if pollIndex === 5 && userSuggestions.length > 0}
      <WhoToFollowSection
        {userSuggestions}
        on:follow={(e) => console.log('Follow', e.detail.user)}
      />
    {/if}
    
    <!-- Encuesta individual (1 línea!) -->
    <SinglePollSection
      {poll}
      {state}
      activeAccordionIndex={activeAccordionByPoll[poll.id]}
      currentPage={currentPageByPoll[poll.id] || 0}
      {userVotes}
      {multipleVotes}
      {historicalData}
      {isBrushing}
      {chartHoverData}
      {chartBrushCurrent}
      {selectedTimeRange}
      {timeRanges}
      {OPTIONS_PER_PAGE}
      {pollTitleExpanded}
      {pollTitleTruncated}
      {pollTitleElements}
      on:optionClick={(e) => {
        const { event, optionKey, pollId } = e.detail;
        voteClickX = event.clientX;
        voteClickY = event.clientY;
        if (poll.type === 'multiple') {
          handleMultipleVote(optionKey, pollId);
        } else {
          handleVote(optionKey, pollId);
        }
      }}
      on:setActive={(e) => activeAccordionByPoll[e.detail.pollId] = e.detail.index}
      on:pageChange={(e) => currentPageByPoll[e.detail.pollId] = e.detail.page}
      on:timeRangeChange={(e) => selectedTimeRange = e.detail.rangeId}
      on:confirmMultiple={(e) => confirmMultipleVotes(e.detail.pollId)}
      on:addOption={(e) => addNewCollaborativeOption(e.detail.pollId)}
    />
  {/each}
</div>
```

---

## Beneficios de esta arquitectura:

### 1. **Reducción masiva de código**
- **Antes**: ~3000 líneas en BottomSheet.svelte
- **Después**: ~500 líneas en BottomSheet.svelte
- **Ahorro**: **83% menos código** en el archivo principal

### 2. **Separación perfecta de responsabilidades**
```
BottomSheet.svelte (Orquestador)
├── Maneja estado global
├── Coordina eventos
└── Composición de secciones

ActivePollSection (Sección especializada)
├── Lógica de encuesta activa
├── Paginación interna
└── Manejo de votos múltiples/colaborativos

TrendingPollsSection (Sección especializada)
├── Ranking y leaderboard
├── Touch gestures
└── Navegación de páginas

SinglePollSection (Sección especializada)
├── Encuestas individuales
├── Gráficos interactivos
└── Expansión de títulos
```

### 3. **Mantenibilidad extrema**
- Bug en trending? → Solo editas `TrendingPollsSection.svelte`
- Nueva feature en activa? → Solo editas `ActivePollSection.svelte`
- Cambio de diseño? → Un solo archivo por sección

### 4. **Testabilidad individual**
Cada sección se puede testear independientemente:
```javascript
// test/ActivePollSection.test.ts
test('should handle multiple votes', () => {
  const { component } = render(ActivePollSection, { props });
  // Test aislado de esta sección
});
```

### 5. **Reutilización en otros contextos**
```svelte
<!-- Página de perfil -->
<ActivePollSection {poll} />

<!-- Modal de encuesta -->
<SinglePollSection {poll} />

<!-- Sidebar de trending -->
<TrendingPollsSection polls={top10} />
```

---

## Comparación de complejidad:

### Modificar el header de una encuesta:

**ANTES:**
1. Buscar en ~3000 líneas de BottomSheet.svelte
2. Encontrar la sección correcta
3. Editar cuidadosamente sin romper nada
4. Probar todo el BottomSheet

**DESPUÉS:**
1. Abrir `ActivePollSection.svelte` o `SinglePollSection.svelte`
2. Ver solo ~300 líneas relevantes
3. Editar el header
4. Probar solo esa sección

---

## Siguiente paso:

¿Quieres que integre estos componentes en BottomSheet.svelte ahora, reemplazando todo el código inline?

**Cambios a realizar:**
1. ✅ Imports ya agregados
2. ⏳ Reemplazar sección de encuesta activa (líneas 2495-2764) → `<ActivePollSection />`
3. ⏳ Reemplazar sección de trending (líneas 2767-2996) → `<TrendingPollsSection />`
4. ⏳ Reemplazar cada poll adicional (líneas 3006+) → `<SinglePollSection />` con inserts de `<AdCard />` y `<WhoToFollowSection />`
5. ⏳ Verificar que todos los eventos estén conectados
6. ⏳ Limpiar código antiguo no utilizado

**Resultado final:**
- BottomSheet.svelte: De ~4800 líneas → ~1500 líneas
- Código 100% modular y mantenible
- Misma funcionalidad, mejor arquitectura
