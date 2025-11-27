<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { X, Search, TrendingUp, Clock, User } from 'lucide-svelte';
  import { createEventDispatcher, onMount } from 'svelte';
  import { apiCall } from '$lib/api/client';
  import { formatNumber } from '$lib/utils/pollHelpers';
  import { currentUser } from '$lib/stores';
  import AuthModal from '$lib/AuthModal.svelte';
  import UserProfileModal from '$lib/UserProfileModal.svelte';
  
  const dispatch = createEventDispatcher();
  
  interface Props {
    isOpen?: boolean;
  }
  
  let { isOpen = $bindable(false) }: Props = $props();
  let showAuthModal = $state(false);
  
  // Derived authentication state
  const isAuthenticated = $derived(!!$currentUser);
  
  // Estado para modal de perfil
  let isProfileModalOpen = $state(false);
  let selectedProfileUserId = $state<number | null>(null);
  
  // Swipe handlers para cerrar modal - SOLO si scroll está en top
  let modalTouchStartY = 0;
  let scrollContainer: HTMLElement | null = $state(null);
  
  function handleModalSwipeStart(e: TouchEvent) {
    modalTouchStartY = e.touches[0].clientY;
  }
  
  function handleModalSwipeMove(e: TouchEvent) {
    // Solo cerrar si el scroll está en la parte superior
    if (!scrollContainer || scrollContainer.scrollTop > 0) return;
    
    const deltaY = e.touches[0].clientY - modalTouchStartY;
    if (deltaY > 100) {
      closeModal();
    }
  }
  
  let searchQuery = $state('');
  let searchFilter = $state<'all' | 'polls' | 'users'>('all');
  let pollsSubfilter = $state<'trending' | 'recent'>('trending');
  let usersSubfilter = $state<'all' | 'trending' | 'followers' | 'following'>('trending');
  let isLoading = $state(false);
  let searchResults = $state<{
    polls: any[];
    users: any[];
  }>({ polls: [], users: [] });
  let trendingPolls = $state<any[]>([]);
  let debounceTimer: NodeJS.Timeout;
  
  // Búsquedas recientes desde localStorage
  let recentSearches = $state<Array<{ text: string; type: string; icon: any }>>([]);
  
  // Sistema de caché para búsquedas (3 minutos TTL)
  const searchCache: Map<string, { data: any; timestamp: number }> = new Map();
  const SEARCH_CACHE_TTL = 3 * 60 * 1000; // 3 minutos
  
  // AbortController para cancelar búsquedas anteriores
  let searchAbortController: AbortController | null = null;
  
  // Removido sistema de auto-ocultación que causaba parpadeo
  
  // Cargar búsquedas recientes del localStorage
  function loadRecentSearches() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('voutop-recent-searches');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          recentSearches = parsed.map((item: any) => ({
            ...item,
            icon: item.type === 'polls' ? TrendingUp : User
          }));
        } catch (e) {
          console.error('Error parsing recent searches:', e);
        }
      }
    }
  }
  
  // Guardar búsqueda reciente
  function saveRecentSearch(text: string, type: string) {
    if (typeof window !== 'undefined') {
      const newSearch = { text, type };
      const filtered = recentSearches.filter(s => s.text !== text);
      const updated = [newSearch, ...filtered].slice(0, 5); // Máximo 5
      localStorage.setItem('voutop-recent-searches', JSON.stringify(updated));
      loadRecentSearches();
    }
  }
  
  // Cargar tendencias
  async function loadTrending() {
    try {
      const response = await apiCall('/api/search/trending?limit=15');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          trendingPolls = data.data;
        }
      }
    } catch (error) {
      console.error('[SearchModal] Error loading trending:', error);
    }
  }
  
  // Buscar con debounce
  async function performSearch() {
    // Cancelar búsqueda anterior si existe
    if (searchAbortController) {
      searchAbortController.abort();
    }
    
    // Crear nuevo AbortController para esta búsqueda
    searchAbortController = new AbortController();
    const currentController = searchAbortController;
    
    isLoading = true;
    
    try {
      const query = searchQuery.trim() || '';
      
      // Construir parámetros de búsqueda
      let searchParams = `q=${encodeURIComponent(query)}&filter=${searchFilter}&limit=20`;
      
      // Agregar subfiltros según el filtro principal
      if (searchFilter === 'polls') {
        searchParams += `&sort=${pollsSubfilter}`; // recent o trending
      } else if (searchFilter === 'users') {
        searchParams += `&userType=${usersSubfilter}`; // all o followers
      }
      
      // Verificar caché primero
      const cacheKey = searchParams;
      const cachedResult = searchCache.get(cacheKey);
      const now = Date.now();
      
      if (cachedResult && (now - cachedResult.timestamp) < SEARCH_CACHE_TTL) {
        console.log('[SearchModal] ♻️ Usando resultados cacheados');
        searchResults = cachedResult.data;
        isLoading = false;
        return;
      }
      
      const response = await apiCall(`/api/search?${searchParams}`, {
        signal: currentController.signal
      });
      
      // Verificar si la búsqueda fue cancelada
      if (currentController.signal.aborted) {
        console.log('[SearchModal] ⚠️ Búsqueda cancelada');
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          searchResults = data.data;
          
          // Guardar en caché
          searchCache.set(cacheKey, { data: data.data, timestamp: now });
          
          // Guardar búsqueda solo si hay query
          if (searchQuery.trim()) {
            saveRecentSearch(searchQuery.trim(), searchFilter);
          }
        }
      }
    } catch (error: any) {
      // Ignorar errores de abort
      if (error?.name !== 'AbortError') {
        console.error('[SearchModal] Error searching:', error);
      }
    } finally {
      isLoading = false;
    }
  }
  
  // Debounce para búsqueda
  function handleSearchInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performSearch();
    }, 200); // Reducido de 300ms a 200ms para búsquedas más rápidas
  }
  
  // Effect para cargar datos cuando se abre la modal
  $effect(() => {
    if (isOpen) {
      // Resetear subfiltros inválidos si no está autenticado
      if (!isAuthenticated && (usersSubfilter === 'followers' || usersSubfilter === 'following')) {
        usersSubfilter = 'all';
      }
      
      loadRecentSearches();
      loadTrending();
      // Cargar contenido inicial basado en el filtro
      performSearch();
    }
  });
  
  // Variable para detectar cambios de filtro (no reactiva)
  let previousFilter: string | null = null;
  
  // Effect para buscar cuando cambia el filtro o la query
  $effect(() => {
    if (isOpen) {
      const filterChanged = previousFilter !== null && searchFilter !== previousFilter;
      previousFilter = searchFilter;
      
      // Track dependencies
      searchFilter;
      searchQuery;
      
      // Si cambió el filtro, buscar inmediatamente sin debounce
      if (filterChanged) {
        performSearch();
      } 
      // Si solo cambió la query (escribiendo), usar debounce
      else if (searchQuery.trim()) {
        handleSearchInput();
      } 
      // Sin query, buscar inmediatamente
      else {
        performSearch();
      }
    }
  });
  
  // Effect para buscar cuando cambian los subfiltros (excepto encuestas que filtra en frontend)
  $effect(() => {
    if (isOpen) {
      // Track dependencies de subfiltros
      usersSubfilter;
      
      // Buscar cuando cambian usuarios
      if (searchFilter === 'users') {
        performSearch();
      }
    }
  });
  
  // Filtrar encuestas en frontend según subfiltro
  const filteredPolls = $derived((() => {
    if (searchFilter !== 'polls' && searchFilter !== 'all') {
      return [];
    }
    
    if (pollsSubfilter === 'trending') {
      // Solo encuestas con muchos votos (más de 10 votos)
      return searchResults.polls.filter(poll => poll.votesCount > 10);
    } else {
      // recent - encuestas recientes (últimas 7 días)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return searchResults.polls.filter(poll => {
        const pollDate = new Date(poll.createdAt);
        return pollDate > sevenDaysAgo;
      });
    }
  })());
  
  function clearSearch() {
    searchQuery = '';
    // Recargar contenido sin query para el filtro actual
    performSearch();
  }
  
  function selectRecentSearch(search: string) {
    searchQuery = search;
    performSearch();
  }
  
  function selectTrendingPoll(poll: any) {
    // Formatear opciones correctamente antes de enviar
    const formattedOptions = poll.options?.map((opt: any, idx: number) => ({
      key: opt.optionKey || opt.key || opt.id?.toString() || `opt-${idx}`,
      label: opt.optionLabel || opt.label || opt.optionText || `Opción ${idx + 1}`,
      color: opt.color || ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#f4a261', '#e76f51'][idx % 6],
      votes: opt.votes || opt._count?.votes || 0
    })) || [];
    
    // Disparar evento para abrir en el globo
    dispatch('openPollInGlobe', { poll, options: formattedOptions });
    closeModal();
  }
  
  function selectSearchResult(type: 'poll' | 'user' | 'place', item: any) {
    if (type === 'poll') {
      // Formatear opciones correctamente antes de enviar
      const formattedOptions = item.options?.map((opt: any, idx: number) => ({
        key: opt.optionKey || opt.key || opt.id?.toString() || `opt-${idx}`,
        label: opt.optionLabel || opt.label || opt.optionText || `Opción ${idx + 1}`,
        color: opt.color || ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#f4a261', '#e76f51'][idx % 6],
        votes: opt.votes || opt._count?.votes || 0
      })) || [];
      
      // Disparar evento para abrir encuesta en el globo
      dispatch('openPollInGlobe', { poll: item, options: formattedOptions });
      closeModal();
    } else if (type === 'user') {
      // Abrir perfil del usuario
      selectedProfileUserId = item.id;
      isProfileModalOpen = true;
      // Cerrar el modal de búsqueda cuando se abre el perfil
      isOpen = false;
    } else {
      // Para lugares, disparar evento genérico
      dispatch('select', { type, item });
    }
  }
  
  function handlePollClickFromProfile(event: CustomEvent) {
    const { pollId } = event.detail;
    // Cerrar modal de perfil y abrir encuesta en el globo
    isProfileModalOpen = false;
    // Aquí podrías disparar evento para abrir la encuesta
    dispatch('openPollById', { pollId });
  }
  
  async function handleFollowToggle(user: any) {
    // Verificar si está autenticado usando el store
    if (!$currentUser) {
      showAuthModal = true;
      return;
    }
    
    try {
      if (user.isFollowing) {
        // Dejar de seguir
        const response = await apiCall(`/api/users/${user.id}/follow`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // Actualizar estado local
          user.isFollowing = false;
          user.followersCount = Math.max(0, user.followersCount - 1);
          searchResults.users = [...searchResults.users];
        }
      } else {
        // Seguir
        const response = await apiCall(`/api/users/${user.id}/follow`, {
          method: 'POST'
        });
        
        if (response.ok) {
          // Actualizar estado local
          user.isFollowing = true;
          user.followersCount += 1;
          searchResults.users = [...searchResults.users];
        }
      }
    } catch (error) {
      console.error('[SearchModal] Error toggling follow:', error);
    }
  }
  
  function closeModal() {
    isOpen = false;
    searchQuery = '';
    searchResults = { polls: [], users: [] };
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
    bind:this={scrollContainer}
    transition:fly={{ y: '100%', duration: 300 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="search-modal-title"
    ontouchstart={handleModalSwipeStart}
    ontouchmove={handleModalSwipeMove}
  >
    <!-- Header con barra de búsqueda -->
    <div class="modal-header">
      <div class="search-header-container">
        <span class="search-icon-header">
          <Search size={20} />
        </span>
        <input
          type="text"
          bind:value={searchQuery}
          oninput={handleSearchInput}
          placeholder="Buscar"
          class="search-input-header"
        />
        {#if searchQuery}
          <button onclick={clearSearch} class="clear-btn-header" aria-label="Limpiar">
            Limpiar
          </button>
        {/if}
      </div>
      <button onclick={closeModal} class="close-btn" aria-label="Cerrar">
        <X size={20} />
      </button>
    </div>

    <!-- Filtros sticky -->
    <div class="filter-tabs-container">
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
      </div>

      <!-- Subfiltros dinámicos -->
      {#if searchFilter === 'polls'}
        <div class="subfilter-tabs">
          <button
            class="subfilter-tab"
            class:active={pollsSubfilter === 'trending'}
            onclick={() => pollsSubfilter = 'trending'}
          >
            Tendencias
          </button>
          <button
            class="subfilter-tab"
            class:active={pollsSubfilter === 'recent'}
            onclick={() => pollsSubfilter = 'recent'}
          >
            Recientes
          </button>
        </div>
      {:else if searchFilter === 'users'}
        <div class="subfilter-tabs">
          <button
            class="subfilter-tab"
            class:active={usersSubfilter === 'all'}
            onclick={() => usersSubfilter = 'all'}
          >
            Todos
          </button>
          <button
            class="subfilter-tab"
            class:active={usersSubfilter === 'trending'}
            onclick={() => usersSubfilter = 'trending'}
          >
            Tendencias
          </button>
          {#if isAuthenticated}
            <button
              class="subfilter-tab"
              class:active={usersSubfilter === 'followers'}
              onclick={() => usersSubfilter = 'followers'}
            >
              Seguidores
            </button>
            <button
              class="subfilter-tab"
              class:active={usersSubfilter === 'following'}
              onclick={() => usersSubfilter = 'following'}
            >
              Seguidos
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Content scrollable -->
    <div class="modal-content">
      <!-- Loading indicator -->
      {#if isLoading}
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Buscando...</p>
        </div>
      {/if}

      <!-- Resultados de búsqueda -->
      {#if !isLoading && (filteredPolls.length > 0 || searchResults.users.length > 0)}
        <!-- Resultados: Encuestas -->
        {#if (searchFilter === 'polls' || (searchFilter === 'all' && searchQuery)) && filteredPolls.length > 0}
          <div class="section">
            <h3 class="section-title">
              <TrendingUp size={18} />
              {#if searchQuery}
                Encuestas ({filteredPolls.length})
              {:else if pollsSubfilter === 'trending'}
                Tendencias ({filteredPolls.length})
              {:else}
                Recientes ({filteredPolls.length})
              {/if}
            </h3>
            {#if pollsSubfilter === 'trending'}
              <!-- Estilo trending con ranking -->
              <div class="trending-list">
                {#each filteredPolls as poll, i}
                  <button
                    class="trending-item"
                    onclick={() => selectSearchResult('poll', poll)}
                  >
                    <div class="trending-rank">#{i + 1}</div>
                    <div class="trending-content">
                      <div class="trending-text">{poll.title}</div>
                      <div class="trending-votes">{formatNumber(poll.votesCount)} votos</div>
                    </div>
                  </button>
                {/each}
              </div>
            {:else}
              <!-- Estilo normal de resultados -->
              <div class="results-list">
                {#each filteredPolls as poll}
                  <button
                    class="result-item poll-item"
                    onclick={() => selectSearchResult('poll', poll)}
                  >
                    <div class="result-content">
                      <div class="result-title">{poll.title}</div>
                      {#if poll.description}
                        <div class="result-description">{poll.description}</div>
                      {/if}
                      <div class="result-meta">
                        <span class="meta-item">{formatNumber(poll.votesCount)} votos</span>
                        {#if poll.category}
                          <span class="meta-divider">•</span>
                          <span class="meta-item">{poll.category}</span>
                        {/if}
                      </div>
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Tendencias (en "Todo" van primero) -->
        {#if !searchQuery && !isLoading && trendingPolls.length > 0 && searchFilter === 'all'}
          <div class="section">
            <h3 class="section-title">
              <TrendingUp size={18} />
              Tendencias
            </h3>
            <div class="trending-list">
              {#each trendingPolls as poll, i}
                <button
                  class="trending-item"
                  onclick={() => selectTrendingPoll(poll)}
                >
                  <div class="trending-rank">#{i + 1}</div>
                  <div class="trending-content">
                    <div class="trending-text">{poll.title}</div>
                    <div class="trending-votes">{formatNumber(poll.recentVotesCount || poll.votesCount)} votos</div>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Resultados: Usuarios -->
        {#if (searchFilter === 'users' || (searchFilter === 'all' && usersSubfilter === 'trending')) && searchResults.users.length > 0}
          <div class="section">
            <h3 class="section-title">
              <User size={18} />
              {#if searchQuery}
                Usuarios ({searchResults.users.length})
              {:else if usersSubfilter === 'trending'}
                Usuarios en tendencia ({searchResults.users.length})
              {:else if usersSubfilter === 'followers'}
                Seguidores ({searchResults.users.length})
              {:else if usersSubfilter === 'following'}
                Seguidos ({searchResults.users.length})
              {:else}
                Todos los usuarios ({searchResults.users.length})
              {/if}
            </h3>
            <div class="results-list">
              {#each searchResults.users as user}
                <div class="result-item user-item-container">
                  <button
                    class="user-info"
                    onclick={() => selectSearchResult('user', user)}
                  >
                    <img 
                      src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=random`} 
                      alt={user.displayName}
                      class="user-avatar"
                    />
                    <div class="result-content">
                      <div class="user-name">
                        {user.displayName}
                        {#if user.verified}
                          <span class="verified-badge">✓</span>
                        {/if}
                      </div>
                      <div class="user-username">@{user.username}</div>
                      {#if user.bio}
                        <div class="result-description">{user.bio}</div>
                      {/if}
                      <div class="result-meta">
                        <span class="meta-item">{user.pollsCount} encuestas</span>
                        <span class="meta-divider">•</span>
                        <span class="meta-item">{user.followersCount} seguidores</span>
                      </div>
                    </div>
                  </button>
                  <button
                    class="follow-btn"
                    class:following={user.isFollowing}
                    onclick={(e) => {
                      e.stopPropagation();
                      handleFollowToggle(user);
                    }}
                  >
                    {user.isFollowing ? 'Siguiendo' : 'Seguir'}
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

      {/if}

      <!-- Sin resultados -->
      {#if !isLoading && filteredPolls.length === 0 && searchResults.users.length === 0}
        <div class="no-results">
          <Search size={48} />
          {#if searchQuery}
            <p>No se encontraron resultados para "{searchQuery}"</p>
          {:else if searchFilter === 'polls'}
            <p>No hay encuestas disponibles</p>
          {:else if searchFilter === 'users'}
            <p>No hay usuarios disponibles</p>
          {:else}
            <p>No hay contenido disponible</p>
          {/if}
        </div>
      {/if}

      <!-- Búsquedas recientes -->
      {#if !isLoading && recentSearches.length > 0 && filteredPolls.length === 0 && searchResults.users.length === 0}
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
                {#if search.type === 'polls'}
                  <TrendingUp size={18} />
                {:else}
                  <User size={18} />
                {/if}
                <span>{search.text}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Modal de autenticación -->
<AuthModal bind:isOpen={showAuthModal} />

<!-- Modal de perfil de usuario -->
<UserProfileModal 
  bind:isOpen={isProfileModalOpen} 
  bind:userId={selectedProfileUserId}
  on:pollClick={handlePollClickFromProfile}
/>

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
    gap: 0;
    padding: 1rem 1.5rem 1rem 0;
    padding-top: calc(1rem + env(safe-area-inset-top));
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
    position: sticky;
    top: 0;
    background: #181a20;
    z-index: 11;
  }

  .search-header-container {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    margin-right: 12px;
    margin-left: 1.5rem;
  }

  .search-icon-header {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgb(255, 255, 255) !important;
    pointer-events: none;
    z-index: 3;
  }

  .search-input-header {
    flex: 1;
    border: none;
    background: rgba(0, 0, 0, 1);
    color: #ffffff;
    font-size: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    outline: none;
    width: 100%;
    padding: 10px 80px 10px 44px;
    border-radius: 20px;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
  }

  .search-input-header:focus {
    outline: none;
  }

  .search-input-header::placeholder {
    color: rgb(255, 255, 255);
  }

  .search-input-header::-webkit-search-cancel-button {
    display: none;
    -webkit-appearance: none;
  }

  .search-input-header::-webkit-search-decoration {
    display: none;
    -webkit-appearance: none;
  }

  .clear-btn-header {
    position: absolute;
    right: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    border: none;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .clear-btn-header:hover {
    background: rgba(255, 255, 255, 0.25);
    color: rgba(255, 255, 255, 1);
  }

  .close-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
    margin-right: 0.5rem;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    color: rgba(255, 255, 255, 1);
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    padding-bottom: calc(5rem + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 1rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .modal-content::-webkit-scrollbar {
    width: 4px;
  }

  .modal-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .modal-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  /* Contenedor de filtros sticky */
  .filter-tabs-container {
    position: sticky;
    top: 85px;
    background: #181a20;
    padding: 12px 1.5rem 16px;
    z-index: 10;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .filter-tabs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
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
    flex-shrink: 0;
    height: fit-content;
  }

  .filter-tab:hover {
    background: rgba(255, 255, 255, 0.12);
    color: white;
  }

  .filter-tab.active {
    background: rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }

  /* Subfiltros */
  .subfilter-tabs {
    display: flex;
    gap: 6px;
    margin-top: 12px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .subfilter-tabs::-webkit-scrollbar {
    display: none;
  }

  .subfilter-tab {
    padding: 6px 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .subfilter-tab:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .subfilter-tab.active {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border-color: rgba(59, 130, 246, 0.4);
  }

  .section {
    margin-bottom: 32px;
    scroll-margin-top: 140px;
  }
  
  .section:first-of-type {
    padding-top: 8px;
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

  /* Loading */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Results */
  .results-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .result-item {
    display: flex;
    align-items: flex-start;
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

  .result-item:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(4px);
  }

  .result-content {
    flex: 1;
    min-width: 0;
  }

  .result-title {
    color: white;
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 4px;
    word-wrap: break-word;
  }

  .result-description {
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    margin-bottom: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .result-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .meta-item {
    display: inline;
  }

  .meta-divider {
    opacity: 0.5;
  }

  /* User specific */
  .user-item-container {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    margin-bottom: 8px;
    transition: all 0.2s;
  }

  .user-item-container:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .user-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    background: none;
    border: none;
    color: white;
    text-align: left;
    padding: 0;
    cursor: pointer;
  }

  .follow-btn {
    padding: 8px 20px;
    background: rgba(59, 130, 246, 0.8);
    color: white;
    border: none;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .follow-btn:hover {
    background: rgba(59, 130, 246, 1);
    transform: scale(1.05);
  }

  .follow-btn.following {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }

  .follow-btn.following:hover {
    background: rgba(239, 68, 68, 0.8);
    color: white;
  }

  .user-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .user-name {
    display: flex;
    align-items: center;
    gap: 6px;
    color: white;
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 2px;
  }

  .user-username {
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    margin-bottom: 4px;
  }

  .verified-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #3b82f6;
    color: white;
    font-size: 10px;
    font-weight: bold;
  }

  /* No results */
  .no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
  }

  .no-results p {
    font-size: 15px;
  }

</style>
