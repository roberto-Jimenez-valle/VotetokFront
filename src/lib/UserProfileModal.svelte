<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { X, MapPin, Calendar, Check, UserPlus, UserMinus, Loader2, TrendingUp, BarChart } from 'lucide-svelte';
  import { createEventDispatcher, onMount } from 'svelte';
  import SinglePollSection from '$lib/globe/cards/sections/SinglePollSection.svelte';
  import { apiCall, apiDelete } from '$lib/api/client';
  import { currentUser } from '$lib/stores';
  import { markImageFailed, shouldRetryImage } from '$lib/stores/failed-images-store';
  
  const dispatch = createEventDispatcher();
  
  interface Props {
    isOpen?: boolean;
    userId?: number | null;
  }
  
  let { isOpen = $bindable(false), userId = $bindable(null) }: Props = $props();
  
  // Estados
  let loading = $state(false);
  let error = $state<string | null>(null);
  let userData = $state<any>(null);
  let userPolls = $state<any[]>([]);
  let userVotes = $state<any[]>([]);
  let isFollowing = $state(false);
  let followLoading = $state(false);
  let activeTab = $state<'polls' | 'votes'>('polls');
  
  // Sistema de paginación para encuestas
  let pollPages = $state<Record<string, number>>({});
  let activeAccordions = $state<Record<string, number>>({});
  let votesState = $state<Record<string, string>>({}); // Estado local de votos
  let touchStartX = 0;
  let touchStartY = 0;
  let isDragging = false;
  let currentDragPollId: string | null = null;
  let currentDragGrid: HTMLElement | null = null;
  
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
  
  function closeModal() {
    isOpen = false;
    // Resetear datos después de la animación
    setTimeout(() => {
      userData = null;
      userPolls = [];
      userVotes = [];
      activeTab = 'polls';
      error = null;
      userId = null;
    }, 300);
  }
  
  // Manejar botón atrás del navegador
  let historyPushed = false;
  
  $effect(() => {
    if (isOpen && !historyPushed) {
      history.pushState({ modal: 'profile' }, '');
      historyPushed = true;
    } else if (!isOpen) {
      historyPushed = false;
    }
  });
  
  onMount(() => {
    const handlePopState = () => {
      if (isOpen) {
        closeModal();
      }
    };
    
    const handleCloseModals = () => {
      if (isOpen) {
        closeModal();
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('closeModals', handleCloseModals);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('closeModals', handleCloseModals);
    };
  });
  
  // Cargar datos del usuario cuando se abre el modal o cambia el userId
  $effect(() => {
    if (isOpen && userId) {
      loadUserData();
    }
  });
  
  async function loadUserData() {
    loading = true;
    error = null;
    
    try {
      // Cargar perfil del usuario
      const profileRes = await apiCall(`/api/users/${userId}`);
      if (!profileRes.ok) {
        throw new Error('No se pudo cargar el perfil');
      }
      const profileData = await profileRes.json();
      userData = profileData.data;
      
      // Cargar encuestas del usuario
      const pollsRes = await apiCall(`/api/users/${userId}/polls?limit=10`);
      if (pollsRes.ok) {
        const pollsData = await pollsRes.json();
        userPolls = pollsData.data;
      }
      
      // Cargar votos del usuario
      const votesRes = await apiCall(`/api/users/${userId}/votes?limit=10`);
      if (votesRes.ok) {
        const votesData = await votesRes.json();
        const rawVotes = votesData.data || [];
        
        // Asegurar que cada voto tenga la estructura completa
        userVotes = rawVotes.map((vote: any) => ({
          ...vote,
          poll: {
            ...vote.poll,
            options: (vote.poll?.options || []).map((opt: any) => ({
              ...opt,
              votes: opt.votes || 0,
              key: opt.key || opt.optionKey,
              label: opt.label || opt.optionLabel
            })),
            stats: vote.poll?.stats || { totalVotes: 0, interactions: 0, comments: 0 }
          }
        }));
        
      } else {
        console.error('[UserProfileModal] Error al cargar votos:', votesRes.status);
        userVotes = [];
      }
      
      // TODO: Verificar si seguimos al usuario (cuando haya autenticación)
      isFollowing = false;
    } catch (err: any) {
      error = err.message || 'Error al cargar el perfil';
      console.error('[UserProfileModal] Error:', err);
    } finally {
      loading = false;
    }
  }
  
  async function toggleFollow() {
    if (!userId || followLoading) return;
    
    followLoading = true;
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const res = await apiCall(`/api/users/${userId}/follow`, { method });
      
      if (res.ok) {
        isFollowing = !isFollowing;
        // Actualizar contador de seguidores
        if (userData) {
          userData.stats.followersCount += isFollowing ? 1 : -1;
        }
      }
    } catch (err) {
      console.error('[UserProfileModal] Error al seguir/dejar de seguir:', err);
    } finally {
      followLoading = false;
    }
  }
  
  function handlePollClick(pollId: number) {
    dispatch('pollClick', { pollId });
  }
  
  function handleSetActive(e: CustomEvent) {
    const { pollId, index } = e.detail;
    activeAccordions = { ...activeAccordions, [pollId]: index };
  }
  
  function handlePageChange(e: CustomEvent) {
    const { pollId, page } = e.detail;
    pollPages = { ...pollPages, [pollId]: page };
  }
  
  // Manejar arrastre horizontal para cambiar entre opciones
  function handleDragStart(e: CustomEvent) {
    const { event, pollId } = e.detail;
    
    const target = event.target as HTMLElement;
    currentDragGrid = target.closest('.vote-cards-grid');
    if (!currentDragGrid) {
      console.log('[UserProfileModal] No se encontró vote-cards-grid');
      return;
    }
    
    const touch = 'touches' in event ? event.touches[0] : event;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    currentDragPollId = pollId.toString();
    isDragging = false;
    
    // Limpiar listeners previos
    document.removeEventListener('pointermove', handleCardDragMove as EventListener);
    document.removeEventListener('pointerup', handleCardDragEnd);
    document.removeEventListener('touchmove', handleCardDragMove as EventListener);
    document.removeEventListener('touchend', handleCardDragEnd);
    
    // Agregar listeners globales
    document.addEventListener('pointermove', handleCardDragMove as EventListener, { passive: true });
    document.addEventListener('pointerup', handleCardDragEnd);
    document.addEventListener('touchmove', handleCardDragMove as EventListener, { passive: true });
    document.addEventListener('touchend', handleCardDragEnd);
  }
  
  function handleCardDragMove(e: PointerEvent | TouchEvent) {
    if (!currentDragGrid || !currentDragPollId) return;
    
    const touch = 'touches' in e ? e.touches[0] : e;
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    // Detectar movimiento horizontal
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
      isDragging = true;
      
      let currentIndex = activeAccordions[currentDragPollId] ?? 0;
      const cards = currentDragGrid.querySelectorAll('.vote-card');
      const totalCards = cards.length;
      
      // Cambiar a siguiente/anterior opción
      if (deltaX < -50 && currentIndex < totalCards - 1) {
        // Swipe izquierda - siguiente opción
        activeAccordions = { ...activeAccordions, [currentDragPollId]: currentIndex + 1 };
        touchStartX = touch.clientX;
        console.log('[UserProfileModal] Cambiando a opción:', currentIndex + 1);
      } else if (deltaX < -50 && currentIndex === totalCards - 1) {
        // Última opción, cambiar de página
        const poll = [...userPolls, ...userVotes.map(v => v.poll)].find(p => p.id.toString() === currentDragPollId);
        if (poll) {
          const currentPage = pollPages[currentDragPollId] || 0;
          const totalPages = Math.ceil(poll.options.length / 4);
          if (currentPage < totalPages - 1) {
            pollPages = { ...pollPages, [currentDragPollId]: currentPage + 1 };
            activeAccordions = { ...activeAccordions, [currentDragPollId]: 0 };
            touchStartX = touch.clientX;
            console.log('[UserProfileModal] Cambiando a página:', currentPage + 1);
          }
        }
      } else if (deltaX > 50 && currentIndex > 0) {
        // Swipe derecha - opción anterior
        activeAccordions = { ...activeAccordions, [currentDragPollId]: currentIndex - 1 };
        touchStartX = touch.clientX;
        console.log('[UserProfileModal] Cambiando a opción:', currentIndex - 1);
      } else if (deltaX > 50 && currentIndex === 0) {
        // Primera opción, cambiar a página anterior
        const currentPage = pollPages[currentDragPollId] || 0;
        if (currentPage > 0) {
          pollPages = { ...pollPages, [currentDragPollId]: currentPage - 1 };
          activeAccordions = { ...activeAccordions, [currentDragPollId]: 3 };
          touchStartX = touch.clientX;
          console.log('[UserProfileModal] Cambiando a página:', currentPage - 1);
        }
      }
    }
  }
  
  function handleCardDragEnd() {
    isDragging = false;
    currentDragGrid = null;
    currentDragPollId = null;
    
    document.removeEventListener('pointermove', handleCardDragMove as EventListener);
    document.removeEventListener('pointerup', handleCardDragEnd);
    document.removeEventListener('touchmove', handleCardDragMove as EventListener);
    document.removeEventListener('touchend', handleCardDragEnd);
  }
  
  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long'
    });
  }
  
  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
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
    transition:fly={{ y: '100%', duration: 450, easing: cubicOut }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="user-profile-modal-title"
    ontouchstart={handleModalSwipeStart}
    ontouchmove={handleModalSwipeMove}
  >
    <!-- Header -->
    <div class="modal-header">
      <h2 id="user-profile-modal-title">Perfil</h2>
      <button onclick={closeModal} class="close-btn" aria-label="Cerrar">
        <X size={24} />
      </button>
    </div>

    <!-- Content -->
    <div class="modal-content" bind:this={scrollContainer}>
      {#if loading && !userData}
        <div class="loading-state">
          <Loader2 size={48} class="spinner" />
          <p>Cargando perfil...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p>{error}</p>
          <button class="retry-btn" onclick={loadUserData}>Reintentar</button>
        </div>
      {:else if userData}
        <!-- Perfil del usuario -->
        <div class="profile-header">
          <!-- Banner (opcional) -->
          <div class="profile-banner"></div>
          
          <!-- Avatar y botón de seguir -->
          <div class="profile-top">
            <div class="profile-avatar">
              <img 
                src={userData.avatarUrl && shouldRetryImage(userData.avatarUrl) ? userData.avatarUrl : `https://i.pravatar.cc/150?u=${userData.username}`} 
                alt={userData.displayName}
                onerror={(e: Event) => { if (e.target && userData.avatarUrl) { (e.target as HTMLImageElement).src = `https://i.pravatar.cc/150?u=${userData.username}`; markImageFailed(userData.avatarUrl); }}}
              />
              {#if userData.verified}
                <div class="verified-badge">
                  <Check size={14} />
                </div>
              {/if}
            </div>
            
            <button 
              class="follow-btn" 
              class:following={isFollowing}
              onclick={toggleFollow}
              disabled={followLoading}
            >
              {#if followLoading}
                <Loader2 size={18} class="spinner" />
              {:else if isFollowing}
                <UserMinus size={18} />
                <span>Siguiendo</span>
              {:else}
                <UserPlus size={18} />
                <span>Seguir</span>
              {/if}
            </button>
          </div>
          
          <!-- Información del usuario -->
          <div class="profile-info">
            <h3>{userData.displayName}</h3>
            <p class="username">@{userData.username}</p>
            
            {#if userData.bio}
              <p class="bio">{userData.bio}</p>
            {/if}
            
            <div class="profile-meta">
              {#if userData.countryIso3}
                <span class="meta-item">
                  <MapPin size={14} />
                  {userData.countryIso3}
                </span>
              {/if}
              <span class="meta-item">
                <Calendar size={14} />
                Se unió en {formatDate(userData.createdAt)}
              </span>
            </div>
          </div>
          
          <!-- Stats -->
          <div class="stats-row">
            <div class="stat-item">
              <span class="stat-value">{formatNumber(userData.stats.pollsCount)}</span>
              <span class="stat-label">Encuestas</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{formatNumber(userData.stats.votesCount)}</span>
              <span class="stat-label">Votos</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{formatNumber(userData.stats.followersCount)}</span>
              <span class="stat-label">Seguidores</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{formatNumber(userData.stats.followingCount)}</span>
              <span class="stat-label">Siguiendo</span>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs-container">
          <button 
            class="tab-btn" 
            class:active={activeTab === 'polls'}
            onclick={() => activeTab = 'polls'}
          >
            <BarChart size={18} />
            <span>Encuestas ({userPolls.length})</span>
          </button>
          <button 
            class="tab-btn" 
            class:active={activeTab === 'votes'}
            onclick={() => activeTab = 'votes'}
          >
            <TrendingUp size={18} />
            <span>Votaciones ({userVotes.length})</span>
          </button>
        </div>

        <!-- Contenido de tabs -->
        <div class="tab-content">
          {#if activeTab === 'polls'}
            <div class="polls-list">
              {#if userPolls.length === 0}
                <div class="empty-state">
                  <BarChart size={48} />
                  <p>Aún no ha publicado encuestas</p>
                </div>
              {:else}
                {#each userPolls as poll (poll.id)}
                    <SinglePollSection 
                      {poll}
                      state="expanded"
                      activeAccordionIndex={activeAccordions[poll.id] ?? 0}
                      currentPage={pollPages[poll.id] || 0}
                      userVotes={votesState}
                      multipleVotes={{}}
                      pollIndex={0}
                      pollTitleExpanded={{}}
                      pollTitleTruncated={{}}
                      pollTitleElements={{}}
                      voteEffectActive={false}
                      voteEffectPollId={null}
                      displayVotes={{}}
                      voteClickX={0}
                      voteClickY={0}
                      voteIconX={0}
                      voteIconY={0}
                      voteEffectColor="#10b981"
                      on:openPollById={(e) => {
                        handlePollClick(e.detail.pollId);
                        closeModal();
                      }}
                      on:dragStart={(e) => handleDragStart(e)}
                      on:setActive={(e) => handleSetActive(e)}
                      on:pageChange={handlePageChange}
                      on:optionClick={(e) => {
                        const { pollId, optionKey } = e.detail;
                        console.log('[UserProfileModal] Voto recibido:', e.detail);
                        // Actualizar estado local de votos
                        const pollIdStr = pollId.toString();
                        const currentVote = votesState[pollIdStr];
                        
                        if (currentVote === optionKey) {
                          // Desvoto - eliminar
                          delete votesState[pollIdStr];
                          votesState = { ...votesState };
                          console.log('[UserProfileModal] Voto eliminado');
                        } else {
                          // Nuevo voto
                          votesState = { ...votesState, [pollIdStr]: optionKey };
                          console.log('[UserProfileModal] Voto registrado:', optionKey);
                        }
                      }}
                      on:yesNoVote={(e) => {
                        const { pollId, optionKey, answer } = e.detail;
                        console.log('[UserProfileModal] Voto Sí/No recibido:', e.detail);
                        const pollIdStr = pollId.toString();
                        votesState = { ...votesState, [pollIdStr]: optionKey };
                      }}
                      on:clearVote={async (e) => {
                        const { pollId } = e.detail;
                        const pollIdStr = pollId.toString();
                        console.log('[UserProfileModal] clearVote recibido para:', pollIdStr);
                        
                        try {
                          const numericPollId = typeof pollId === 'string' ? parseInt(pollId) : pollId;
                          
                          // Usar apiDelete con autenticación
                          await apiDelete(`/api/polls/${numericPollId}/vote`);
                          
                          delete votesState[pollIdStr];
                          votesState = { ...votesState };
                          console.log('[UserProfileModal] ✅ Voto eliminado');
                        } catch (error) {
                          console.error('[UserProfileModal] Error al eliminar voto:', error);
                        }
                      }}  
                    />
                {/each}
              {/if}
            </div>
          {:else if activeTab === 'votes'}
            <div class="votes-list">
              {#if loading}
                <div class="loading-state">
                  <Loader2 size={48} class="spinner" />
                  <p>Cargando votaciones...</p>
                </div>
              {:else if userVotes.length === 0}
                <div class="empty-state">
                  <TrendingUp size={48} />
                  <p>Aún no ha votado en encuestas</p>
                </div>
              {:else}
                {#each userVotes as vote, voteIdx (vote.id)}
                  {#if vote.poll && vote.poll.options && vote.selectedOption}
                    {@const votedOptionIndex = vote.poll.options.findIndex((opt: any) => opt.key === vote.selectedOption.key)}
                    {@const votedPage = votedOptionIndex >= 0 ? Math.floor(votedOptionIndex / 4) : 0}
                    {@const votedIndexInPage = votedOptionIndex >= 0 ? votedOptionIndex % 4 : 0}
                      <SinglePollSection 
                        poll={vote.poll}
                        state="expanded"
                        activeAccordionIndex={activeAccordions[vote.poll.id] ?? votedIndexInPage}
                        currentPage={pollPages[vote.poll.id] ?? votedPage}
                        userVotes={votesState}
                        multipleVotes={{}}
                        pollIndex={0}
                        pollTitleExpanded={{}}
                        pollTitleTruncated={{}}
                        pollTitleElements={{}}
                        voteEffectActive={false}
                        voteEffectPollId={null}
                        displayVotes={{}}
                        voteClickX={0}
                        voteClickY={0}
                        voteIconX={0}
                        voteIconY={0}
                        voteEffectColor="#10b981"
                        on:openPollById={(e) => {
                          handlePollClick(e.detail.pollId);
                          closeModal();
                        }}
                        on:dragStart={(e) => handleDragStart(e)}
                        on:setActive={(e) => handleSetActive(e)}
                        on:pageChange={handlePageChange}
                        on:optionClick={(e) => {
                          const { pollId, optionKey } = e.detail;
                          const pollIdStr = pollId.toString();
                          const currentVote = votesState[pollIdStr];
                          if (currentVote === optionKey) {
                            delete votesState[pollIdStr];
                            votesState = { ...votesState };
                          } else {
                            votesState = { ...votesState, [pollIdStr]: optionKey };
                          }
                        }}
                        on:yesNoVote={(e) => {
                          const { pollId, optionKey, answer } = e.detail;
                          const pollIdStr = pollId.toString();
                          votesState = { ...votesState, [pollIdStr]: optionKey };
                        }}
                        on:clearVote={async (e) => {
                          const { pollId } = e.detail;
                          const pollIdStr = pollId.toString();
                          
                          try {
                            const numericPollId = typeof pollId === 'string' ? parseInt(pollId) : pollId;
                            
                            // Usar apiDelete con autenticación
                            await apiDelete(`/api/polls/${numericPollId}/vote`);
                            
                            delete votesState[pollIdStr];
                            votesState = { ...votesState };
                            console.log('[UserProfileModal] ✅ Voto eliminado');
                          } catch (error) {
                            console.error('[UserProfileModal] Error al eliminar voto:', error);
                          }
                        }}
                      />
                  {/if}
                {/each}
              {/if}
            </div>
          {/if}
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
    z-index: 1000000;
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
    z-index: 1000001;
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

  .modal-header h2 {
    font-size: 24px;
    font-weight: 700;
    color: white;
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
    padding: 0 20px 20px;
    touch-action: pan-y;
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

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: rgba(255, 255, 255, 0.7);
    text-align: center;
    gap: 16px;
  }

  :global(.spinner) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .retry-btn {
    padding: 10px 24px;
    background: rgba(59, 130, 246, 0.3);
    border: none;
    border-radius: 8px;
    color: #60a5fa;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .retry-btn:hover {
    background: rgba(59, 130, 246, 0.4);
  }

  /* Profile Header */
  .profile-header {
    position: relative;
  }

  .profile-banner {
    width: 100%;
    height: 120px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .profile-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 0 1.5rem;
    margin-top: -40px;
  }

  .profile-avatar {
    position: relative;
  }

  .profile-avatar img {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    object-fit: cover;
    border: 4px solid #181a20;
  }

  .verified-badge {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 28px;
    height: 28px;
    background: #3b82f6;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid #181a20;
  }

  .follow-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    background: rgba(59, 130, 246, 0.3);
    border: 2px solid #3b82f6;
    border-radius: 24px;
    color: #60a5fa;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 8px;
  }

  .follow-btn:hover {
    background: rgba(59, 130, 246, 0.4);
    transform: scale(1.05);
  }

  .follow-btn.following {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
    color: white;
  }

  .follow-btn.following:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    color: #ef4444;
  }

  .follow-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .profile-info {
    padding: 16px 1.5rem 0;
  }

  .profile-info h3 {
    font-size: 22px;
    font-weight: 700;
    color: white;
    margin: 0 0 4px 0;
  }

  .username {
    color: rgba(255, 255, 255, 0.6);
    font-size: 15px;
    margin: 0 0 12px 0;
  }

  .bio {
    color: rgba(255, 255, 255, 0.9);
    font-size: 15px;
    line-height: 1.5;
    margin: 12px 0;
  }

  .profile-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 12px;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
  }

  .stats-row {
    display: flex;
    gap: 20px;
    padding: 20px 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .stat-value {
    font-size: 18px;
    font-weight: 700;
    color: white;
  }

  .stat-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
  }

  /* Tabs */
  .tabs-container {
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.9);
  }

  .tab-btn.active {
    color: #60a5fa;
    border-bottom-color: #3b82f6;
  }

  /* Tab Content */
  .tab-content {
    padding: 0;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    margin: 0 20px;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
  }

  .empty-state p {
    margin-top: 16px;
    font-size: 16px;
  }

  /* Polls List - usar SinglePollSection */
  .polls-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  
  .polls-list :global(.vote-cards-grid) {
    touch-action: pan-x pan-y;
  }
  
  /* Asegurar que SinglePollSection ocupe todo el ancho como en rells */
  .polls-list :global(.poll-item),
  .votes-list :global(.poll-item) {
    width: 100%;
    max-width: none;
  }

  /* Votes List - usar SinglePollSection */
  .votes-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  
  .votes-list :global(.vote-cards-grid) {
    touch-action: pan-x pan-y;
  }
</style>
