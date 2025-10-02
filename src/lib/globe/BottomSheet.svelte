<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  export let state: 'hidden' | 'peek' | 'collapsed' | 'expanded' = 'hidden';
  export let y = 0; // translateY px
  export let isTransitioning = false; // Si debe usar transición CSS
  export let selectedCountryName: string | null = null;
  export let selectedSubdivisionName: string | null = null;
  export let selectedCityName: string | null = null;
  export let countryChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let worldChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let cityChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let voteOptions: Array<{ key: string; label: string; color: string; votes: number }> = [];
  // Amigos que han votado por opción (opcional)
  export let friendsByOption: Record<string, Array<{ id: string; name: string; avatarUrl?: string }>> = {};
  // Visitas por opción (opcional)
  export let visitsByOption: Record<string, number> = {};
  // Creador de la publicación por opción (opcional)
  export let creatorsByOption: Record<string, { id: string; name: string; handle?: string; avatarUrl?: string; verified?: boolean }> = {};
  // Fecha de publicación por opción (opcional)
  export let publishedAtByOption: Record<string, string | Date> = {};

  // Handlers de acciones (opcionales)
  export let onSaveOption: (optionKey: string) => void = () => {};
  export let onShareOption: (optionKey: string) => void = () => {};
  export let onMoreOption: (optionKey: string) => void = () => {};
  export let onPointerDown: (e: PointerEvent | TouchEvent) => void = () => {};
  export let onScroll: (e: Event) => void = () => {};
  export const navigationManager: any = null; // Used by parent component
  export let onNavigateToView: (level: 'world' | 'country' | 'subdivision' | 'city') => void = () => {};
  export let onVote: (optionKey: string) => void = () => {};
  export let currentAltitude: number = 0; // Altitud actual del globo
  
  // Dropdown toggle function
  export let onToggleDropdown: () => void = () => {};
  
  // Search props
  export let showSearch: boolean = false;
  export let tagQuery: string = '';
  export let onToggleSearch: () => void = () => {};
  
  // Referencia al input de búsqueda
  let searchInput: HTMLInputElement;
  
  // Hacer scroll al final cuando se cierra la búsqueda
  $: if (!showSearch && navContainer) {
    setTimeout(() => {
      navContainer.scrollLeft = navContainer.scrollWidth;
    }, 50);
  }

  const dispatch = createEventDispatcher();
  
  // Estado de pantalla completa
  let fullscreenActive = false;
  
  onMount(() => {
    // Detectar cambios de pantalla completa
    const handleFullscreenChange = () => {
      fullscreenActive = !!document.fullscreenElement;
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  });
  
  function onCardKeydown(e: KeyboardEvent, optionKey: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleVote(optionKey);
    }
  }
  
  // Segments activos según el contexto mostrado en el header (ciudad > país > mundo)
  $: activeSegments = (
    (selectedCityName && cityChartSegments?.length ? cityChartSegments : null) ||
    (selectedCountryName && countryChartSegments?.length ? countryChartSegments : null) ||
    (worldChartSegments?.length ? worldChartSegments : [])
  );

  // Opciones derivadas de los segments para que coincidan 1:1 con el gráfico superior
  $: displayOptions = (activeSegments || []).map((s) => ({
    key: s.key,
    label: s.key,
    color: s.color,
    votes: s.pct // usamos el % como métrica para tamaño/orden
  }));

  // Determina el tamaño visual de cada tarjeta según su porcentaje de votos
  function sizeForOption(option: any, index: number) {
    const percentage = option.votes;
    
    // Treemap proporcional basado en porcentajes
    if (percentage >= 50) return 'large';     // 50%+ = 2x2 (muy grande)
    if (percentage >= 25) return 'medium';    // 25-49% = 2x1 (mediano alto)
    if (percentage >= 15) return 'small-wide'; // 15-24% = 1x2 (pequeño ancho)
    return 'small';                           // <15% = 1x1 (pequeño)
  }
  
  // Función para manejar el voto
  function handleVote(optionKey: string) {
    onVote(optionKey);
    dispatch('vote', { option: optionKey });
  }
  
  // Debug: log when world chart segments change
  $: if (worldChartSegments) {
    console.log('[BottomSheet] World chart segments:', worldChartSegments);
  }

  // Auto-scroll to active button when navigation changes
  let navContainer: HTMLElement;
  
  $: if (selectedCountryName || selectedSubdivisionName || selectedCityName) {
    // Wait for DOM update then scroll to active button
    setTimeout(() => {
      if (navContainer) {
        const activeButton = navContainer.querySelector('.nav-chip.active');
        if (activeButton) {
          activeButton.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest', 
            inline: 'center' 
          });
        }
      }
    }, 100);
  }
</script>

<div
  class="bottom-sheet {state === 'expanded' ? 'solid' : 'glass'} {state === 'peek' ? 'peek-state' : ''} {isTransitioning ? 'transitioning' : ''}"
  role="dialog"
  aria-modal="true"
  aria-hidden={state === 'hidden'}
  style={`transform: translateY(${y}px);`}
  onpointerdown={onPointerDown}
  ontouchstart={onPointerDown}
>
  <!-- Indicadores flotantes - visibles excepto cuando está expandido -->
  {#if state !== 'expanded'}
  <div class="floating-indicators">
    <!-- Indicador de altitud -->
    <div class="altitude-indicator-floating">
      <div class="scale-bar">
        <div class="altitude-value">
          {(() => {
            const meters = Math.round(currentAltitude * 675000);
            if (meters < 1000) {
              return `${meters} m`;
            } else {
              const km = meters / 1000;
              if (km < 10) {
                return `${km.toFixed(1)} km`;
              } else {
                return `${Math.round(km)} km`;
              }
            }
          })()}
        </div>
      </div>
    </div>

    <!-- Botón de pantalla completa - cambia icono según estado -->
    <button 
      class="fullscreen-btn-floating" 
      onclick={() => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }}
      title={fullscreenActive ? "Salir de pantalla completa" : "Pantalla completa"}
      aria-label={fullscreenActive ? "Salir de pantalla completa" : "Activar pantalla completa"}
    >
      {#if fullscreenActive}
        <!-- Icono de minimizar/salir de fullscreen -->
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
        </svg>
      {:else}
        <!-- Icono de expandir a fullscreen -->
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
      {/if}
    </button>
  </div>
  {/if}

  <!-- Header simplificado con indicador visual de arrastre -->
  <div class="sheet-drag-area">
    {#if selectedCityName && cityChartSegments.length}
      <div class="drag-chart" role="img" aria-label={`Distribución en ${selectedCityName}`}>
        {#each cityChartSegments as seg}
          <div
            class="drag-seg"
            style={`width:${seg.pct}%; background:${seg.color}`}
            title={`${seg.key}: ${seg.pct.toFixed(1)}%`}
          ></div>
        {/each}
      </div>
    {:else if selectedCountryName && countryChartSegments.length}
      <div class="drag-chart" role="img" aria-label={`Distribución en ${selectedCountryName}`}>
        {#each countryChartSegments as seg}
          <div
            class="drag-seg"
            style={`width:${seg.pct}%; background:${seg.color}`}
            title={`${seg.key}: ${seg.pct.toFixed(1)}%`}
          ></div>
        {/each}
      </div>
    {:else if worldChartSegments.length}
      <div class="drag-chart" role="img" aria-label="Distribución global">
        {#each worldChartSegments as seg}
          <div
            class="drag-seg"
            style={`width:${seg.pct}%; background:${seg.color}`}
            title={`${seg.key}: ${seg.pct.toFixed(1)}%`}
          ></div>
        {/each}
      </div>
    {:else}
      <!-- Fallback: grabber tradicional si no hay datos -->
      <div class="sheet-grabber"></div>
    {/if}
  </div>
  
  <!-- Navegación minimalista -->
  <div class="nav-minimal" bind:this={navContainer}>
    {#if !selectedCountryName}
      <!-- Global is last active - show dropdown -->
      <button
        class="nav-chip active dropdown-trigger"
        onclick={onToggleDropdown}
      >
        Global
        <span style="margin-left: 4px;">▼</span>
      </button>
    {:else}
      <!-- Global is not last - no dropdown -->
      <button
        class="nav-chip"
        onclick={() => onNavigateToView('world')}
      >
        Global
      </button>
    {/if}
    
    {#if selectedCountryName}
      <div class="nav-divider">/</div>
      
      {#if !selectedSubdivisionName}
        <!-- Country is last active - show dropdown -->
        <button
          class="nav-chip active dropdown-trigger"
          onclick={onToggleDropdown}
        >
          {selectedCountryName}
          <span style="margin-left: 4px;">▼</span>
        </button>
      {:else}
        <!-- Country is not last - no dropdown -->
        <button
          class="nav-chip"
          onclick={() => onNavigateToView('country')}
        >
          {selectedCountryName}
        </button>
      {/if}
    {/if}
    
    {#if selectedSubdivisionName}
      <div class="nav-divider">/</div>
      
      {#if !selectedCityName}
        <!-- Subdivision is last active - show dropdown -->
        <button
          class="nav-chip active dropdown-trigger"
          onclick={onToggleDropdown}
        >
          {selectedSubdivisionName}
          <span style="margin-left: 4px;">▼</span>
        </button>
      {:else}
        <!-- Subdivision is not last - no dropdown -->
        <button
          class="nav-chip"
          onclick={() => onNavigateToView('subdivision')}
        >
          {selectedSubdivisionName}
        </button>
      {/if}
    {/if}
    
    {#if selectedCityName}
      <div class="nav-divider">/</div>
      <!-- City is last active - show dropdown -->
      <button
        class="nav-chip active dropdown-trigger"
        onclick={onToggleDropdown}
      >
        {selectedCityName}
        <span style="margin-left: 4px;">▼</span>
      </button>
    {/if}
    
    <!-- Search button at the end (only when search is closed) -->
    {#if !showSearch}
      <button
        class="nav-search-btn"
        onclick={onToggleSearch}
        aria-label="Buscar"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </button>
    {/if}
    
    <!-- Search input overlay (appears above navigation) -->
    {#if showSearch}
      <div class="nav-search-overlay">
        <svg class="nav-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="search"
          class="nav-search-input-full"
          placeholder="Buscar hashtag/categoría..."
          bind:value={tagQuery}
          bind:this={searchInput}
          onclick={(e) => e.stopPropagation()}
          autofocus
        />
        {#if tagQuery}
          <button
            class="nav-search-clear-btn"
            onclick={(e) => {
              e.preventDefault();
              tagQuery = '';
              searchInput?.focus();
            }}
            aria-label="Limpiar texto"
          >
            Limpiar
          </button>
        {/if}
        <button
          class="nav-search-close-btn"
          onclick={onToggleSearch}
          aria-label="Cerrar búsqueda"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    {/if}
  </div>
  
  <!-- Opciones de votación como mosaico horizontal estilo Google Maps -->
  {#if displayOptions.length > 0}
    <div class="vote-cards-section">
      <!-- Título del tema arriba de las tarjetas -->
      <div class="topic-header">
        {#if Math.random() > 0.7}
          <!-- Encuesta específica -->
          <h3>¿Cuál debería ser la prioridad del gobierno para 2024?</h3>
          <span class="topic-type">Encuesta • {selectedCountryName || 'Global'}</span>
        {:else if Math.random() > 0.5}
          <!-- Hashtag trending -->
          <h3 data-type="hashtag">#CambioClimático2024</h3>
          <span class="topic-type">Hashtag trending • {selectedSubdivisionName || selectedCountryName || 'Global'}</span>
        {:else if selectedCountryName && selectedSubdivisionName}
          <!-- Trending regional -->
          <h3>Trending en {selectedSubdivisionName}</h3>
          <span class="topic-type">Encuestas más votadas • {selectedCountryName}</span>
        {:else if selectedCountryName}
          <!-- Trending nacional -->
          <h3>Trending en {selectedCountryName}</h3>
          <span class="topic-type">Encuestas más votadas • Nacional</span>
        {:else}
          <!-- Trending global -->
          <h3>Trending Global</h3>
          <span class="topic-type">Encuestas más votadas • Mundial</span>
        {/if}
      </div>
      
      <div class="vote-cards-grid {displayOptions?.length === 2 ? 'compact-two' : ''} {displayOptions?.length === 1 ? 'compact-one' : ''} {displayOptions?.length >= 5 ? 'dense' : ''}">
        {#each displayOptions.sort((a, b) => b.votes - a.votes) as option, index}
          <div class="vote-card {sizeForOption(option, index)}" style="background-color: {option.color};" onclick={() => handleVote(option.key)}>
            <!-- Header con avatar y título -->
            <div class="card-header">
              <h2 class="question-title">{option.label}</h2>
              <img class="creator-avatar" src={`https://i.pravatar.cc/40?u=${encodeURIComponent(creatorsByOption?.[option.key]?.name || option.key)}`} alt="Avatar" loading="lazy" />
            </div>

            <!-- Contenido principal -->
            <div class="card-content">
              <div class="percentage-display">
                <span class="percentage-large">{Math.round(option.votes)}</span>
              </div>
              
              <!-- Avatares de amigos posicionados absolutamente -->
              {#if friendsByOption?.[option.key]?.length || true}
                <div class="friend-avatars-absolute">
                  {#each (friendsByOption?.[option.key] || [
                    { id: '1', name: 'Ana García', avatarUrl: `https://i.pravatar.cc/40?u=ana` },
                    { id: '2', name: 'Carlos López', avatarUrl: `https://i.pravatar.cc/40?u=carlos` },
                    { id: '3', name: 'María Silva', avatarUrl: `https://i.pravatar.cc/40?u=maria` }
                  ]).slice(0, 3) as friend, i}
                    <img 
                      class="friend-avatar-floating" 
                      src={friend.avatarUrl || `https://i.pravatar.cc/40?u=${encodeURIComponent(friend.name || friend.id)}`} 
                      alt={friend.name}
                      title={friend.name}
                      loading="lazy"
                      style="z-index: {10 - i};"
                    />
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      
      <!-- Información total debajo de las tarjetas -->
      <div class="vote-summary-info">
        <div class="vote-stats">
          <span class="total-votes">{displayOptions.reduce((sum, opt) => sum + Math.floor(opt.votes * 10), 0)} votos totales • {displayOptions.length} opciones</span>
          <div class="visits-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>{Math.floor(Math.random() * 2000) + 1000} visitas</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
  
  {#if voteOptions.length === 0 || state !== 'expanded'}
    <div class="sheet-content" onscroll={onScroll}>
      {#if state === 'expanded'}
        <!-- Contenido de feed podría ir aquí como slot en el futuro -->
      {:else if selectedCityName}
        <div style="opacity:.75; font-size:13px; text-align: center; padding: 20px;">
          Datos de {selectedCityName} - Usa las barras de votación arriba
        </div>
      {:else if selectedCountryName}
        <div style="opacity:.75; font-size:13px; text-align: center; padding: 20px;">
          Datos de {selectedCountryName} - Usa las barras de votación arriba
        </div>
      {:else}
        <div style="opacity:.75; font-size:13px; text-align: center; padding: 20px;">
          Vista global - Usa las barras de votación arriba o explora haciendo clic en los países
        </div>
      {/if}
    </div>
  {/if}
</div>
