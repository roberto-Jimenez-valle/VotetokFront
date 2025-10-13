<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e5e7eb"/%3E%3Cpath d="M20 20a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0 2c-5.33 0-16 2.67-16 8v4h32v-4c0-5.33-10.67-8-16-8z" fill="%239ca3af"/%3E%3C/svg%3E';
  
  const OPTIONS_PER_PAGE = 4;
  
  // Props
  export let poll: any;
  export let state: string = 'collapsed';
  export let activeAccordionIndex: number | null = null;
  export let currentPage: number = 0;
  export let userVotes: Record<string, string> = {};
  export let multipleVotes: Record<string, string[]> = {};
  export let pollIndex: number = 0;
  
  // Title expansion state
  export let pollTitleExpanded: Record<string, boolean> = {};
  export let pollTitleTruncated: Record<string, boolean> = {};
  export let pollTitleElements: Record<string, HTMLElement> = {};
  
  let pollGridRef: HTMLElement;
  
  // Helper functions
  function normalizeTo100(values: number[]): number[] {
    const total = values.reduce((sum, v) => sum + v, 0);
    if (total === 0) return values.map(() => 0);
    return values.map(v => (v / total) * 100);
  }
  
  function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  }
  
  function getRelativeTime(minutesAgo: number): string {
    if (minutesAgo < 60) return `${minutesAgo}min`;
    if (minutesAgo < 1440) return `${Math.floor(minutesAgo / 60)}h`;
    if (minutesAgo < 43200) return `${Math.floor(minutesAgo / 1440)}d`;
    return `${Math.floor(minutesAgo / 525600)}a`;
  }
  
  function fontSizeForPct(pct: number): number {
    const clamped = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    const bucket = Math.max(1, Math.ceil(clamped / 10));
    const size = bucket * 10;
    return Math.max(20, Math.min(70, size));
  }
  
  function getNormalizedOptions(poll: any) {
    const opts = poll.options || [];
    const values = opts.map((o: any) => Number(o.votes) || 0);
    const norm = normalizeTo100(values);
    return opts.map((o: any, i: number) => ({ ...o, pct: norm[i] }));
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
  
  function checkTruncation(element: HTMLElement | undefined): boolean {
    if (!element) return false;
    return element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
  }
  
  // Reactive data
  $: sortedPollOptions = getNormalizedOptions(poll).sort((a: any, b: any) => b.pct - a.pct);
  $: shouldPaginate = sortedPollOptions.length > OPTIONS_PER_PAGE;
  $: paginatedPoll = shouldPaginate 
    ? getPaginatedOptions(sortedPollOptions, currentPage)
    : { items: sortedPollOptions, totalPages: 1, hasNext: false, hasPrev: false };
  $: isSingleOptionPoll = sortedPollOptions.length === 1;
  $: isExpired = poll.closedAt ? isPollExpired(poll.closedAt) : false;
  
  // Event handlers
  function handleSetActive(index: number) {
    dispatch('setActive', { pollId: poll.id, index });
  }
  
  function handlePageChange(pageIndex: number) {
    dispatch('pageChange', { pollId: poll.id, page: pageIndex });
  }
  
  function handleConfirmMultiple() {
    dispatch('confirmMultiple', { pollId: poll.id });
  }
  
  function handleAddOption() {
    dispatch('addOption', { pollId: poll.id });
  }
  
  function handleOpenInGlobe() {
    dispatch('openInGlobe', { poll });
  }
  
  function handleDragStart(e: PointerEvent | TouchEvent) {
    dispatch('dragStart', { event: e, pollId: poll.id });
  }
</script>

<div class="poll-item">
  <!-- Header de la encuesta -->
  <div class="poll-header">
    <div class="header-with-avatar">
      <div class="header-content">
        {#if poll.type === 'hashtag'}
          <div class="poll-question-wrapper">
            <div class="poll-question-row">
              <h3 
                class="poll-question" 
                class:expanded={pollTitleExpanded[poll.id]}
                class:truncated={pollTitleTruncated[poll.id] && !pollTitleExpanded[poll.id]}
                data-type="hashtag"
                bind:this={pollTitleElements[poll.id]}
                onmouseenter={() => {
                  if (!pollTitleExpanded[poll.id] && pollTitleElements[poll.id]) {
                    pollTitleTruncated[poll.id] = checkTruncation(pollTitleElements[poll.id]);
                  }
                }}
                onclick={() => {
                  if (pollTitleTruncated[poll.id] || pollTitleExpanded[poll.id]) {
                    pollTitleExpanded[poll.id] = !pollTitleExpanded[poll.id];
                    if (pollTitleExpanded[poll.id]) pollTitleTruncated[poll.id] = false;
                  }
                }}
                onkeydown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && (pollTitleTruncated[poll.id] || pollTitleExpanded[poll.id])) {
                    e.preventDefault();
                    pollTitleExpanded[poll.id] = !pollTitleExpanded[poll.id];
                    if (pollTitleExpanded[poll.id]) pollTitleTruncated[poll.id] = false;
                  }
                }}
                role={pollTitleTruncated[poll.id] || pollTitleExpanded[poll.id] ? 'button' : undefined}
              >
                #{poll.question}
                {#if pollTitleExpanded[poll.id]}
                  <span class="collapse-indicator-poll"> [−]</span>
                {/if}
              </h3>
              {#if poll.closedAt}
                {@const timeColor = getTimeRemainingColor(poll.closedAt)}
                {@const timeText = getTimeRemaining(poll.closedAt)}
                <div class="time-remaining-badge {timeColor} {isExpired ? 'expired' : ''}">
                  {#if isExpired}
                    🔒 Cerrada
                  {:else}
                    ⏰ {timeText}
                  {/if}
                </div>
              {/if}
            </div>
            <div class="poll-meta">
              <span class="topic-type">Hashtag # • {poll.region || 'General'}</span>
              {#if poll.createdAt}
                <span class="topic-time">• {getRelativeTime(Math.floor((Date.now() - new Date(poll.createdAt).getTime()) / 60000))}</span>
              {/if}
            </div>
          </div>
        {:else}
          <div class="poll-question-wrapper">
            <div class="poll-question-row">
              <h3 
                class="poll-question" 
                class:expanded={pollTitleExpanded[poll.id]}
                class:truncated={pollTitleTruncated[poll.id] && !pollTitleExpanded[poll.id]}
                bind:this={pollTitleElements[poll.id]}
                onmouseenter={() => {
                  if (!pollTitleExpanded[poll.id] && pollTitleElements[poll.id]) {
                    pollTitleTruncated[poll.id] = checkTruncation(pollTitleElements[poll.id]);
                  }
                }}
                onclick={() => {
                  if (pollTitleTruncated[poll.id] || pollTitleExpanded[poll.id]) {
                    pollTitleExpanded[poll.id] = !pollTitleExpanded[poll.id];
                    if (pollTitleExpanded[poll.id]) pollTitleTruncated[poll.id] = false;
                  }
                }}
                onkeydown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && (pollTitleTruncated[poll.id] || pollTitleExpanded[poll.id])) {
                    e.preventDefault();
                    pollTitleExpanded[poll.id] = !pollTitleExpanded[poll.id];
                    if (pollTitleExpanded[poll.id]) pollTitleTruncated[poll.id] = false;
                  }
                }}
                role={pollTitleTruncated[poll.id] || pollTitleExpanded[poll.id] ? 'button' : undefined}
              >
                {poll.question || poll.title}
                {#if pollTitleExpanded[poll.id]}
                  <span class="collapse-indicator-poll"> [−]</span>
                {/if}
              </h3>
              {#if poll.closedAt}
                {@const timeColor = getTimeRemainingColor(poll.closedAt)}
                {@const timeText = getTimeRemaining(poll.closedAt)}
                <div class="time-remaining-badge {timeColor} {isExpired ? 'expired' : ''}">
                  {#if isExpired}
                    🔒 Cerrada
                  {:else}
                    ⏰ {timeText}
                  {/if}
                </div>
              {/if}
            </div>
            <div class="poll-meta">
              <span class="topic-type">
                {#if poll.type === 'multiple'}
                  Encuesta ☑️
                {:else if poll.type === 'collaborative'}
                  Encuesta 👥
                {:else}
                  Encuesta ⭕
                {/if}
                • {poll.region || 'General'}
              </span>
              {#if poll.createdAt}
                <span class="topic-time">• {getRelativeTime(Math.floor((Date.now() - new Date(poll.createdAt).getTime()) / 60000))}</span>
              {/if}
            </div>
          </div>
        {/if}
      </div>
      {#if poll.user?.avatarUrl}
        <div class="header-avatar header-avatar-real">
          <img src={poll.user.avatarUrl} alt={poll.user.displayName || 'Avatar'} loading="lazy" />
        </div>
      {:else}
        <div class="header-avatar header-avatar-real">
          <img src={DEFAULT_AVATAR} alt="Avatar" loading="lazy" />
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Grid de opciones -->
  <div class="vote-cards-container">
    <div 
      class="vote-cards-grid accordion fullwidth {activeAccordionIndex != null ? 'open' : ''} {isSingleOptionPoll ? 'compact-one' : ''}"
      style="--items: {paginatedPoll.items.length}"
      role="group"
      aria-label="Opciones de {poll.question || poll.title}"
      bind:this={pollGridRef}
      onpointerdown={handleDragStart}
      ontouchstart={handleDragStart}
    >
      {#each paginatedPoll.items as option, index (option.key)}
        {@const isPollVoted = poll.type === 'multiple'
          ? multipleVotes[poll.id]?.includes(option.key)
          : userVotes[poll.id] === option.key}
        
        <button 
          class="vote-card {activeAccordionIndex === index ? 'is-active' : ''} {(state !== 'expanded' || activeAccordionIndex !== index) ? 'collapsed' : ''}" 
          style="--card-color: {option.color}; --fill-pct: {Math.max(0, Math.min(100, option.pct))}%; --fill-pct-val: {Math.max(0, Math.min(100, option.pct))}; --flex: {Math.max(0.5, option.pct / 10)};" 
          onclick={() => {
            if (isSingleOptionPoll) { return; }
            if (activeAccordionIndex !== index) { handleSetActive(index); return; }
            dispatch('optionClick', { event: event, optionKey: option.key, pollId: poll.id });
          }}
          onfocus={() => !isSingleOptionPoll ? handleSetActive(index) : null}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (activeAccordionIndex !== index) { handleSetActive(index); return; }
              dispatch('optionClick', { event: e, optionKey: option.key, pollId: poll.id });
            }
          }}
          type="button"
        >
          <!-- Header con avatar y título -->
          {#if !isSingleOptionPoll}
          <div class="card-header">
            <h2 class="question-title">{option.label}</h2>
            <img class="creator-avatar" src={option.avatarUrl || DEFAULT_AVATAR} alt={option.label} loading="lazy" />
          </div>
          {/if}

          <!-- Contenido principal -->
          <div class="card-content" class:card-content-full={isSingleOptionPoll}>
            <!-- Porcentaje tradicional para múltiples opciones -->
            <div class="percentage-display">
              <span
                class="percentage-large"
                style="font-size: {(activeAccordionIndex === index && state === 'expanded'
                  ? fontSizeForPct(option.pct)
                  : Math.min(fontSizeForPct(option.pct), 21))}px"
              >
                {Math.round(option.pct)}
              </span>
            </div>
            
            <!-- Avatares de amigos posicionados absolutamente (solo si hay amigos que votaron) -->
            {#if poll.friendsByOption?.[option.key] && poll.friendsByOption[option.key].length > 0}
              <div class="friend-avatars-absolute">
                {#each poll.friendsByOption[option.key].slice(0, 3) as friend, i}
                  <img 
                    class="friend-avatar-floating" 
                    src={friend.avatarUrl || DEFAULT_AVATAR}
                    alt={friend.name}
                    loading="lazy"
                    style="z-index: {10 - i};"
                  />
                {/each}
              </div>
            {/if}
          </div>
        </button>
      {/each}
    </div>
    
    <!-- Botón añadir opción (colaborativas) -->
    {#if poll.type === 'collaborative' && poll.options.length < 10}
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
  
  <!-- Información de la encuesta (estadísticas y acciones) -->
  <div class="vote-summary-info">
    <div class="vote-stats">
      <div class="stat-badge">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="20" x2="12" y2="10"></line>
          <line x1="18" y1="20" x2="18" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="16"></line>
        </svg>
        <span>{formatNumber(poll.options.length)}</span>
      </div>
      <div class="stat-badge">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 11l3 3L22 4"></path>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
        <span>{formatNumber(poll.totalVotes)}</span>
      </div>
      <div class="stat-badge">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span>{formatNumber(poll.totalViews || 0)}</span>
      </div>
    </div>
    <div class="vote-actions">
      <button class="action-badge" type="button" title="Guardar">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        <span>{formatNumber(0)}</span>
      </button>
      <button class="action-badge" type="button" title="Republicar">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M17 1l4 4-4 4"/>
          <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
          <path d="M7 23l-4-4 4-4"/>
          <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
        </svg>
        <span>{formatNumber(0)}</span>
      </button>
      <button class="action-badge action-share" type="button" title="Compartir">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        <span>{formatNumber(0)}</span>
      </button>
      <button 
        class="action-badge action-globe" 
        type="button" 
        title="Ver en el globo"
        aria-label="Ver en el globo"
        onclick={handleOpenInGlobe}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </button>
    </div>
  </div>
  
  <!-- Paginación -->
  {#if shouldPaginate}
    <div class="pagination-dots">
      {#each Array(paginatedPoll.totalPages) as _, pageIndex}
        <button 
          class="pagination-dot {pageIndex === currentPage ? 'active' : ''}"
          onclick={() => handlePageChange(pageIndex)}
          type="button"
          aria-label="Página {pageIndex + 1}"
        ></button>
      {/each}
    </div>
  {/if}
  
  <!-- Botón confirmar votos múltiples -->
  {#if poll.type === 'multiple'}
    {@const selectedCount = multipleVotes[poll.id]?.length || 0}
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