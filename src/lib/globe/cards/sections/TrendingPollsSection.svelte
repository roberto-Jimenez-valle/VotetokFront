<script lang="ts">
  /**
   * Sección completa de Trending Polls con ranking tipo leaderboard
   */
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Props
  export let trendingPolls: any[] = [];
  export let selectedCountryName: string | null = null;
  export let selectedSubdivisionName: string | null = null;
  export let currentPageMain: number = 0;
  export let trendingTransitionDirection: 'next' | 'prev' | null = null;
  export let mainPollViews: number = 0;
  export let showActivePoll: boolean = false;
  export let TRENDING_PER_PAGE: number = 5;
  export let hasMorePolls: boolean = false;
  
  // Refs
  let trendingGridRef: HTMLElement;
  let touchStartX = 0;
  let touchStartY = 0;
  
  // Helper functions
  function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  }
  
  function getPaginatedOptions(options: any[], page: number, perPage: number = TRENDING_PER_PAGE) {
    const start = page * perPage;
    const end = start + perPage;
    const items = options.slice(start, end);
    return {
      items,
      totalPages: Math.ceil(options.length / perPage),
      hasNext: end < options.length,
      hasPrev: page > 0
    };
  }
  
  function normalizeTo100(values: number[]): number[] {
    const total = values.reduce((sum, v) => sum + v, 0);
    if (total === 0) return values.map(() => 0);
    return values.map(v => (v / total) * 100);
  }
  
  // Reactive data
  // Los datos ya vienen transformados desde BottomSheet con { key, label, color, votes, pollData }
  $: displayOptions = trendingPolls;
  
  $: sortedDisplayOptions = displayOptions.sort((a, b) => (b.votes || 0) - (a.votes || 0));
  $: shouldPaginateMain = sortedDisplayOptions.length > TRENDING_PER_PAGE;
  $: paginatedMainOptions = shouldPaginateMain
    ? getPaginatedOptions(sortedDisplayOptions, currentPageMain, TRENDING_PER_PAGE)
    : { items: sortedDisplayOptions, totalPages: 1, hasNext: false, hasPrev: false };
  
  // Event handlers
  function handleOpenPoll(pollData: any) {
    dispatch('openPoll', { poll: pollData });
  }
  
  function handlePollOptions(pollData: any) {
    dispatch('pollOptions', { poll: pollData });
  }
  
  async function handlePageChange(pageIndex: number) {
    const oldPage = currentPageMain;
    dispatch('pageChange', { 
      page: pageIndex, 
      direction: pageIndex < oldPage ? 'prev' : 'next' 
    });
  }
  
  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }
  
  async function handleTouchMove(e: TouchEvent) {
    if (touchStartX === 0) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      e.preventDefault();
      
      if (deltaX > 0 && currentPageMain > 0) {
        dispatch('pageChange', { page: currentPageMain - 1, direction: 'prev' });
      } else if (deltaX < 0 && shouldPaginateMain && currentPageMain < paginatedMainOptions.totalPages - 1) {
        dispatch('pageChange', { page: currentPageMain + 1, direction: 'next' });
      }
      
      touchStartX = 0;
      touchStartY = 0;
    }
  }
  
  function handleTouchEnd() {
    touchStartX = 0;
    touchStartY = 0;
  }
</script>

<div class="vote-cards-section">
  <!-- Título de trending (solo si no hay encuesta activa) -->
  {#if !showActivePoll}
    <div class="topic-header">
      {#if selectedCountryName && selectedSubdivisionName}
        <div class="header-content">
          <h3>Trending en {selectedSubdivisionName}</h3>
          <div class="topic-meta">
            <span class="topic-type">{displayOptions.length} {displayOptions.length === 1 ? 'encuesta' : 'encuestas'} más votadas • Regional</span>
          </div>
        </div>
      {:else if selectedCountryName}
        <div class="header-content">
          <h3>Trending en {selectedCountryName}</h3>
          <div class="topic-meta">
            <span class="topic-type">{displayOptions.length} {displayOptions.length === 1 ? 'encuesta' : 'encuestas'} más votadas • Nacional</span>
          </div>
        </div>
      {:else}
        <div class="header-content">
          <h3>Trending Global</h3>
          <div class="topic-meta">
            <span class="topic-type">{displayOptions.length} {displayOptions.length === 1 ? 'encuesta' : 'encuestas'} más votadas • Mundial</span>
          </div>
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- TRENDING RANKING: Diseño profesional tipo leaderboard -->
  <div 
    class="trending-ranking-container {trendingTransitionDirection ? 'trending-transition trending-transition-' + trendingTransitionDirection : ''}"
    bind:this={trendingGridRef}
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
    ontouchcancel={handleTouchEnd}
  >
    {#each paginatedMainOptions.items as option, index (option.key)}
      {@const pollData = option.pollData}
      {@const rankNumber = (currentPageMain * TRENDING_PER_PAGE) + index + 1}
      {@const rankChange = index === 0 ? 2 : index === 1 ? -1 : index === 2 ? 0 : 1}
      <div 
        class="trending-rank-item rank-{rankNumber}"
        style="--rank-color: {option.color};"
        onclick={() => handleOpenPoll(pollData)}
        onkeydown={(e) => { 
          if (e.key === 'Enter' || e.key === ' ') { 
            e.preventDefault(); 
            handleOpenPoll(pollData);
          }
        }}
        role="button"
        tabindex="0"
      >
        <!-- Avatar del creador con borde de color -->
        <div class="rank-avatar" style="--poll-color: {option.color}">
          {#if pollData?.user?.avatarUrl}
            <img src={pollData.user.avatarUrl} alt={pollData.user.displayName} style="border: 3px solid {option.color};" />
          {:else}
            <div class="rank-avatar-placeholder" style="background: {option.color}; border: 3px solid {option.color};">
              {rankNumber}
            </div>
          {/if}
        </div>
        
        <!-- Posición del ranking con flecha de cambio -->
        <div class="rank-position">
          <span class="rank-number">{rankNumber}</span>
          {#if rankChange > 0}
            <svg class="rank-change rank-up" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14l5-5 5 5z"/>
            </svg>
          {:else if rankChange < 0}
            <svg class="rank-change rank-down" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          {:else}
            <span class="rank-change rank-same">—</span>
          {/if}
        </div>
        
        <!-- Contenido: Título de la encuesta -->
        <div class="rank-content">
          <h3 class="rank-title">{option.label}</h3>
          <div class="rank-meta">
            {#if pollData?.user?.displayName}
              <span class="rank-author">
                {pollData.user.displayName}
                {#if pollData.user.verified}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="color: #3b82f6; margin-left: 2px;">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                {/if}
              </span>
              <span class="rank-separator">•</span>
            {/if}
            <span class="rank-votes">
              {formatNumber(option.votes || pollData?.totalVotes || 0)} votos
            </span>
          </div>
        </div>
        
        <!-- Menú de 3 puntos -->
        <button 
          class="rank-menu-btn"
          onclick={(e) => {
            e.stopPropagation();
            handlePollOptions(pollData);
          }}
          type="button"
          aria-label="Más opciones"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="19" r="2"/>
          </svg>
        </button>
      </div>
    {/each}
  </div>
  
  <!-- Indicadores de paginación -->
  {#if shouldPaginateMain}
    <div class="pagination-dots {paginatedMainOptions.totalPages > 25 ? 'many-pages' : ''}">
      {#each Array(paginatedMainOptions.totalPages) as _, pageIndex}
        <button 
          class="pagination-dot {pageIndex === currentPageMain ? 'active' : ''}"
          onclick={() => handlePageChange(pageIndex)}
          type="button"
          aria-label="Página {pageIndex + 1}"
        ></button>
      {/each}
    </div>
  {/if}
  
  <!-- Información total debajo de trending -->
  <div class="vote-summary-info">
    <div class="vote-stats">
      <div class="stat-badge">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
        </svg>
        <span>{formatNumber(trendingPolls.length)}</span>
      </div>
      <div class="stat-badge">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span>{formatNumber(mainPollViews)}</span>
      </div>
    </div>
  </div>
  
  <!-- Separador después de trending -->
  {#if hasMorePolls}
    <div class="more-polls-divider">
      <div class="divider-line"></div>
      <span class="divider-text">Ver otras encuestas de {selectedSubdivisionName || selectedCountryName || 'Global'}</span>
      <div class="divider-line"></div>
    </div>
  {/if}
</div>
