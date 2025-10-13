<script lang="ts">
  /**
   * Sección completa para mostrar la encuesta activa
   * Incluye header, opciones, paginación y botones de acción
   */
  import { createEventDispatcher } from 'svelte';
  // import ActivePollOption from '../ActivePollOption.svelte'; // Component doesn't exist
  // import EditablePollOption from '../EditablePollOption.svelte'; // Component doesn't exist
  
  const dispatch = createEventDispatcher();
  const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e5e7eb"/%3E%3Cpath d="M20 20a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0 2c-5.33 0-16 2.67-16 8v4h32v-4c0-5.33-10.67-8-16-8z" fill="%239ca3af"/%3E%3C/svg%3E';
  
  // Props
  export let activePoll: any;
  export let voteOptions: any[];
  export let state: string = 'collapsed';
  export let activeAccordionMainIndex: number | null = null;
  export let currentPageMain: number = 0;
  export let transitionDirectionMain: 'next' | 'prev' | null = null;
  export let userVotes: Record<string, string> = {};
  export let multipleVotes: Record<string, string[]> = {};
  export let OPTIONS_PER_PAGE: number = 4;
  
  // Refs
  let mainGridRef: HTMLElement;
  
  // Helper functions
  function normalizeTo100(values: number[]): number[] {
    const total = values.reduce((sum, v) => sum + v, 0);
    if (total === 0) return values.map(() => 0);
    return values.map(v => (v / total) * 100);
  }
  
  function getPaginatedOptions(options: any[], page: number, perPage: number = OPTIONS_PER_PAGE) {
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
  
  function isPollExpired(closedAt: Date | string | null | undefined): boolean {
    if (!closedAt) return false;
    return new Date(closedAt).getTime() < Date.now();
  }
  
  function getTimeRemaining(closedAt: Date | string | null | undefined): string {
    if (!closedAt) return '';
    const now = Date.now();
    const end = new Date(closedAt).getTime();
    const diff = end - now;
    if (diff <= 0) return 'Cerrada';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
  
  function getTimeRemainingColor(closedAt: Date | string | null | undefined): string {
    if (!closedAt) return 'normal';
    const now = Date.now();
    const end = new Date(closedAt).getTime();
    const diff = end - now;
    const hours = diff / (1000 * 60 * 60);
    if (hours <= 1) return 'critical';
    if (hours <= 6) return 'warning';
    return 'normal';
  }
  
  // Reactive data
  $: normalizedVoteOptions = (() => {
    const opts = voteOptions || [];
    const values = opts.map(o => Number(o.votes) || 0);
    const norm = normalizeTo100(values);
    return opts.map((o, i) => ({ ...o, pct: norm[i] }));
  })();
  
  $: sortedActiveOptions = normalizedVoteOptions.sort((a, b) => b.pct - a.pct);
  $: shouldPaginateActive = sortedActiveOptions.length > OPTIONS_PER_PAGE;
  $: paginatedActiveOptions = shouldPaginateActive 
    ? getPaginatedOptions(sortedActiveOptions, currentPageMain, OPTIONS_PER_PAGE)
    : { items: sortedActiveOptions, totalPages: 1, hasNext: false, hasPrev: false };
  
  $: mainPollId = activePoll?.id ? activePoll.id.toString() : 'main';
  $: selectedCount = multipleVotes[mainPollId]?.length || 0;
  $: isExpired = activePoll.closedAt ? isPollExpired(activePoll.closedAt) : false;
  
  // Event handlers
  function handleOptionClick(e: CustomEvent) {
    dispatch('optionClick', e.detail);
  }
  
  function handleConfirmCollaborative() {
    dispatch('confirmCollaborative', { pollId: mainPollId });
  }
  
  function handleCancelCollaborative() {
    dispatch('cancelCollaborative', { pollId: mainPollId });
  }
  
  function handleAddOption() {
    dispatch('addOption', { pollId: mainPollId });
  }
  
  function handleSetActive(index: number) {
    dispatch('setActive', { index });
  }
  
  function handlePageChange(page: number) {
    dispatch('pageChange', { page });
  }
  
  function handleConfirmMultiple() {
    dispatch('confirmMultiple', { pollId: mainPollId });
  }
  
  function handleDragStart(e: PointerEvent | TouchEvent) {
    dispatch('dragStart', { event: e });
  }
</script>

<div class="vote-cards-section active-poll-section">
  <!-- Título de la encuesta activa -->
  <div class="topic-header">
    <div class="header-with-avatar">
      <div class="header-content">
        <div class="header-title-row">
          <h3>{activePoll.question || activePoll.title || 'Encuesta'}</h3>
          {#if activePoll.closedAt}
            {@const timeColor = getTimeRemainingColor(activePoll.closedAt)}
            {@const timeText = getTimeRemaining(activePoll.closedAt)}
            <div class="time-remaining-badge {timeColor} {isExpired ? 'expired' : ''}">
              {#if isExpired}
                🔒 Cerrada
              {:else}
                ⏰ {timeText}
              {/if}
            </div>
          {/if}
        </div>
        <div class="topic-meta">
          <span class="topic-type">
            {#if activePoll.type === 'multiple'}
              ☑️ Votación múltiple • 
            {:else if activePoll.type === 'collaborative'}
              👥 Colaborativa • 
            {/if}
            {activePoll.region || 'General'}
          </span>
        </div>
      </div>
      <img class="creator-avatar" src={activePoll.creatorAvatar || DEFAULT_AVATAR} alt="Avatar" loading="lazy" />
    </div>
  </div>
  
  <!-- Grid de opciones -->
  <div class="vote-cards-container">
    <div 
      class="vote-cards-grid accordion fullwidth {activeAccordionMainIndex != null ? 'open' : ''}"
      style="--items: {paginatedActiveOptions.items.length}"
      role="group" 
      aria-label="Opciones de encuesta activa"
      bind:this={mainGridRef}
      onpointerdown={handleDragStart}
      ontouchstart={handleDragStart}
    >
      {#each paginatedActiveOptions.items as option, index (option.key)}
        {@const isVoted = activePoll.type === 'multiple' 
          ? multipleVotes[mainPollId]?.includes(option.key) 
          : userVotes[mainPollId] === option.key}
        {@const isPending = option.isEditing === true}
        
        <!-- Inline poll option rendering (ActivePollOption/EditablePollOption components don't exist) -->
        {#if isPending}
          <!-- Editable option for collaborative polls -->
          <div class="editable-poll-option">
            <input type="text" value={option.label} placeholder="Nueva opción..." />
            <button onclick={() => handleConfirmCollaborative()}>Confirmar</button>
            <button onclick={() => handleCancelCollaborative()}>Cancelar</button>
          </div>
        {:else}
          <!-- Regular poll option -->
          <button
            class="vote-card {isVoted ? 'voted' : ''}"
            style="--card-color: {option.color}; background: linear-gradient(135deg, {option.color}20, {option.color}10);"
            type="button"
            disabled={isExpired}
            aria-label="{option.label}: {(option.pct || 0).toFixed(1)}%"
            onclick={(e) => {
              if (activeAccordionMainIndex !== index) { 
                handleSetActive(index);
                return; 
              }
              dispatch('optionClick', { event: e, optionKey: option.key, pollId: mainPollId });
            }}
          >
            <!-- Header with title and vote count -->
            <div class="card-header-full">
              <h2 class="option-title">{option.label}</h2>
              <span class="vote-count-badge">{(option.votes || 0)}/{activePoll.totalVotes || 0}</span>
            </div>

            <!-- Large percentage display -->
            <div class="percentage-display">
              <span class="percentage-large" style="color: {option.color};">{(option.pct || 0).toFixed(0)}%</span>
            </div>

            <!-- Bottom bar with color -->
            <div class="option-bar-wrapper">
              <div class="option-bar" style="width: {option.pct || 0}%; background: {option.color};"></div>
            </div>

            <!-- Vote indicator -->
            {#if isVoted}
              <div class="vote-check-icon" style="background: {option.color};">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
            {/if}
          </button>
        {/if}
      {/each}
    </div>
    
    <!-- Botón añadir opción (encuestas colaborativas) -->
    {#if activePoll.type === 'collaborative' && activePoll.options.length < 10}
      <button
        type="button"
        class="add-option-button-inline"
        onclick={handleAddOption}
        title="Añadir nueva opción"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    {/if}
  </div>
  
  <!-- Paginación -->
  {#if shouldPaginateActive}
    <div class="pagination-dots">
      {#each Array(paginatedActiveOptions.totalPages) as _, pageIndex}
        <button 
          class="pagination-dot {pageIndex === currentPageMain ? 'active' : ''}"
          onclick={() => handlePageChange(pageIndex)}
          type="button"
          aria-label="Página {pageIndex + 1}"
        ></button>
      {/each}
    </div>
  {/if}
  
  <!-- Botón confirmar votos múltiples -->
  {#if activePoll.type === 'multiple'}
    <button
      class="confirm-multiple-votes-btn {selectedCount > 0 ? 'has-selection' : ''} {isExpired ? 'disabled' : ''}"
      onclick={handleConfirmMultiple}
      disabled={selectedCount === 0 || isExpired}
      type="button"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
      <span>
        {#if selectedCount === 0}
          Selecciona opciones
        {:else}
          Confirmar {selectedCount} {selectedCount === 1 ? 'voto' : 'votos'}
        {/if}
      </span>
    </button>
  {/if}
</div>

<style>
  /* Estilos para opciones de encuesta inline */
  .vote-card {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 16px;
    min-height: 180px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: left;
    width: 100%;
    overflow: hidden;
  }

  .vote-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--card-color);
    opacity: 0.15;
    transition: opacity 0.3s ease;
    z-index: 0;
  }

  .vote-card:hover:not(:disabled)::before {
    opacity: 0.25;
  }

  .vote-card:hover:not(:disabled) {
    border-color: var(--card-color);
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--card-color);
  }

  .vote-card.voted {
    border-color: var(--card-color);
    box-shadow: 0 0 0 2px var(--card-color);
  }

  .vote-card:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .card-header-full {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  .option-title {
    font-size: 14px;
    font-weight: 600;
    color: white;
    margin: 0;
    flex: 1;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .vote-count-badge {
    position: relative;
    z-index: 1;
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    background: rgba(0, 0, 0, 0.2);
    padding: 4px 8px;
    border-radius: 8px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .percentage-display {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 16px 0;
  }

  .percentage-large {
    font-size: 56px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -2px;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .option-bar-wrapper {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 8px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    overflow: hidden;
  }

  .option-bar {
    height: 100%;
    border-radius: 4px;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 12px currentColor;
  }

  .vote-check-icon {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    animation: checkPop 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }

  @keyframes checkPop {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Estilos para opción editable (encuestas colaborativas) */
  .editable-poll-option {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 12px;
  }

  .editable-poll-option input {
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 14px;
  }

  .editable-poll-option input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .editable-poll-option button {
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
  }

  .editable-poll-option button:hover {
    background: linear-gradient(135deg, #059669, #047857);
    transform: translateY(-1px);
  }
</style>
