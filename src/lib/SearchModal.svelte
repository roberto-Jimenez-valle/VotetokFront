<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { X, Search, TrendingUp, Clock, MapPin } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  interface Props {
    isOpen?: boolean;
  }
  
  let { isOpen = $bindable(false) }: Props = $props();
  
  // Swipe handlers para cerrar modal (como type-options-sheet)
  let modalTouchStartY = 0;
  
  function handleModalSwipeStart(e: TouchEvent) {
    modalTouchStartY = e.touches[0].clientY;
  }
  
  function handleModalSwipeMove(e: TouchEvent) {
    const deltaY = e.touches[0].clientY - modalTouchStartY;
    if (deltaY > 100) {
      closeModal();
    }
  }
  
  let searchQuery = $state('');
  let searchFilter = $state<'all' | 'polls' | 'users' | 'places'>('all');
  
  // Mock data para búsquedas recientes
  const recentSearches = [
    { text: 'Elecciones 2024', type: 'polls', icon: TrendingUp },
    { text: 'Madrid', type: 'places', icon: MapPin },
    { text: 'Tecnología', type: 'polls', icon: TrendingUp },
  ];
  
  // Mock data para tendencias (más items para forzar scroll)
  const trendingTopics = [
    { text: '¿Mejor película del año?', votes: 15420 },
    { text: 'Cambio climático', votes: 12350 },
    { text: 'Inteligencia Artificial', votes: 10890 },
    { text: 'Deportes 2024', votes: 8760 },
    { text: 'Política internacional', votes: 7500 },
    { text: 'Economía global', votes: 6800 },
    { text: 'Tecnología 5G', votes: 6200 },
    { text: 'Salud y bienestar', votes: 5900 },
    { text: 'Educación digital', votes: 5400 },
    { text: 'Entretenimiento', votes: 5100 },
    { text: 'Redes sociales', votes: 4800 },
    { text: 'Gaming y eSports', votes: 4500 },
    { text: 'Música actual', votes: 4200 },
    { text: 'Series de TV', votes: 3900 },
  ];
  
  function handleSearch() {
    if (searchQuery.trim()) {
      dispatch('search', { query: searchQuery, filter: searchFilter });
      // Aquí iría la lógica de búsqueda real
      console.log('Buscando:', searchQuery, 'Filtro:', searchFilter);
    }
  }
  
  function clearSearch() {
    searchQuery = '';
  }
  
  function selectRecentSearch(search: string) {
    searchQuery = search;
    handleSearch();
  }
  
  function closeModal() {
    isOpen = false;
  }
</script>

{#if isOpen}
  <!-- Overlay -->
  <div
    class="modal-overlay"
    transition:fade={{ duration: 200 }}
    onclick={closeModal}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Escape' && closeModal()}
  ></div>

  <!-- Modal -->
  <div
    class="modal-container"
    transition:fly={{ y: '100%', duration: 300 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="search-modal-title"
    ontouchstart={handleModalSwipeStart}
    ontouchmove={handleModalSwipeMove}
  >
    <!-- Header -->
    <div class="modal-header">
      <div class="modal-header-content">
        <Search size={24} />
        <h2 id="search-modal-title">Buscar</h2>
      </div>
      <button onclick={closeModal} class="close-btn" aria-label="Cerrar">
        <X size={24} />
      </button>
    </div>

    <!-- Content -->
    <div class="modal-content">
      <!-- Barra de búsqueda -->
      <div class="search-input-container">
        <Search size={20} class="search-icon" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Buscar encuestas, usuarios o lugares..."
          class="search-input"
          onkeydown={(e) => e.key === 'Enter' && handleSearch()}
          autofocus
        />
        {#if searchQuery}
          <button onclick={clearSearch} class="clear-btn" aria-label="Limpiar">
            <X size={18} />
          </button>
        {/if}
      </div>

      <!-- Filtros -->
      <div class="filter-tabs">
        <button
          class="filter-tab"
          class:active={searchFilter === 'all'}
          onclick={() => searchFilter = 'all'}
        >
          Todo
        </button>
        <button
          class="filter-tab"
          class:active={searchFilter === 'polls'}
          onclick={() => searchFilter = 'polls'}
        >
          Encuestas
        </button>
        <button
          class="filter-tab"
          class:active={searchFilter === 'users'}
          onclick={() => searchFilter = 'users'}
        >
          Usuarios
        </button>
        <button
          class="filter-tab"
          class:active={searchFilter === 'places'}
          onclick={() => searchFilter = 'places'}
        >
          Lugares
        </button>
      </div>

      <!-- Búsquedas recientes -->
      {#if !searchQuery && recentSearches.length > 0}
        <div class="section">
          <h3 class="section-title">
            <Clock size={18} />
            Búsquedas recientes
          </h3>
          <div class="recent-list">
            {#each recentSearches as search}
              <button
                class="recent-item"
                onclick={() => selectRecentSearch(search.text)}
              >
                <svelte:component this={search.icon} size={18} />
                <span>{search.text}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Tendencias -->
      {#if !searchQuery}
        <div class="section">
          <h3 class="section-title">
            <TrendingUp size={18} />
            Tendencias
          </h3>
          <div class="trending-list">
            {#each trendingTopics as topic, i}
              <button
                class="trending-item"
                onclick={() => selectRecentSearch(topic.text)}
              >
                <div class="trending-rank">#{i + 1}</div>
                <div class="trending-content">
                  <div class="trending-text">{topic.text}</div>
                  <div class="trending-votes">{topic.votes.toLocaleString()} votos</div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 30000;
    backdrop-filter: blur(8px);
  }
  
  @media (min-width: 768px) {
    .modal-overlay {
      right: auto;
      width: 700px;
    }
  }

  .modal-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #181a20;
    z-index: 30001;
    display: flex;
    flex-direction: column;
  }

  @media (min-width: 768px) {
    .modal-container {
      left: 0;
      right: auto;
      width: 100%;
      max-width: 700px;
      border-radius: 0 1.25rem 0 0;
      box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.4);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    padding-top: calc(1rem + env(safe-area-inset-top));
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
    position: sticky;
    top: 0;
    background: #181a20;
    z-index: 10;
  }

  .modal-header-content {
    display: flex;
    align-items: center;
    gap: 12px;
    color: white;
  }

  .modal-header-content h2 {
    font-size: 24px;
    font-weight: 700;
    margin: 0;
  }

  .close-btn {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    padding-bottom: calc(5rem + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .search-input-container {
    position: relative;
    margin-bottom: 20px;
  }

  .search-input {
    width: 100%;
    padding: 14px 48px 14px 48px;
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    color: white;
    font-size: 16px;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: rgba(59, 130, 246, 0.5);
    background: rgba(255, 255, 255, 0.12);
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  .search-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(255, 255, 255, 0.5);
    pointer-events: none;
  }

  .clear-btn {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 8px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .clear-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .filter-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .filter-tabs::-webkit-scrollbar {
    display: none;
  }

  .filter-tab {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .filter-tab:hover {
    background: rgba(255, 255, 255, 0.12);
    color: white;
  }

  .filter-tab.active {
    background: rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }

  .section {
    margin-bottom: 32px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }

  .recent-list, .trending-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .recent-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 12px;
    color: white;
    font-size: 15px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .recent-item:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(4px);
  }

  .trending-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .trending-item:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(4px);
  }

  .trending-rank {
    font-size: 20px;
    font-weight: 700;
    color: rgba(59, 130, 246, 0.8);
    min-width: 40px;
  }

  .trending-content {
    flex: 1;
  }

  .trending-text {
    color: white;
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .trending-votes {
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
  }

</style>
