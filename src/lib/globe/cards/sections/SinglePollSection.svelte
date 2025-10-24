<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { currentUser } from '$lib/stores';
  import UserProfileModal from '$lib/UserProfileModal.svelte';
  
  const dispatch = createEventDispatcher();
  const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e5e7eb"/%3E%3Cpath d="M20 20a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0 2c-5.33 0-16 2.67-16 8v4h32v-4c0-5.33-10.67-8-16-8z" fill="%239ca3af"/%3E%3C/svg%3E';
  
  // Estado para modal de perfil
  let isProfileModalOpen: boolean = false;
  let selectedProfileUserId: number | null = null;
  let showDoubleClickTooltip: boolean = false;
  let showVoteConfirmation: boolean = false;
  let showVoteRemoval: boolean = false;
  let voteConfirmationColor: string = '#10b981';
  let voteRemovalColor: string = '#ef4444';
  let tooltipTimeout: any = null;
  let clickTimeout: any = null;
  let voteConfirmationTimeout: any = null;
  let voteRemovalTimeout: any = null;
  let clickCount = 0;
  let pendingOptionKey: string | null = null;
  let touchStartPosition: { x: number, y: number } | null = null;
  const DOUBLE_CLICK_DELAY = 500; // ms
  const TOUCH_MOVE_THRESHOLD = 10; // px
  
  // Long press tooltip
  let showLongPressTooltip: boolean = false;
  let longPressTooltipText: string = '';
  let longPressTimer: any = null;
  let longPressActivated: boolean = false; // Flag para evitar interferencia con doble click
  const LONG_PRESS_DELAY = 500; // ms
  
  // Title tooltip (para títulos truncados)
  let showTitleTooltip: boolean = false;
  let titleTooltipText: string = '';
  
  const OPTIONS_PER_PAGE = 4;
  
  // Props
  export let poll: any;
  export let state: string = 'collapsed';
  export let activeAccordionIndex: number | null = null;
  export let currentPage: number = 0;
  export let userVotes: Record<string, string> = {};
  export let multipleVotes: Record<string, string[]> = {};
  export const pollIndex: number = 0;
  
  // Dirección de paginación
  let paginationDirection: 'forward' | 'backward' = 'forward';
  let lastPage: number = currentPage;
  
  // Detectar cambio de página y actualizar dirección ANTES del render
  $: if (currentPage !== lastPage) {
    paginationDirection = currentPage > lastPage ? 'forward' : 'backward';
    console.log('[Pagination] Dirección:', paginationDirection, 'cambio:', lastPage, '→', currentPage);
    lastPage = currentPage;
  }
  
  // Title expansion state
  export let pollTitleExpanded: Record<string, boolean> = {};
  export let pollTitleTruncated: Record<string, boolean> = {};
  export let pollTitleElements: Record<string, HTMLElement> = {};
  
  // Vote effect state (passed from parent)
  export let voteEffectActive: boolean = false;
  export let voteEffectPollId: string | null = null;
  export let displayVotes: Record<string, string> = {};
  export let voteClickX: number = 0;
  export let voteClickY: number = 0;
  export let voteIconX: number = 0;
  export let voteIconY: number = 0;
  export let voteEffectColor: string = '#10b981';
  
  let pollGridRef: HTMLElement;
  let voteIconElement: HTMLElement | null = null;
  
  // Trackear el texto de las opciones en edición para reactividad
  let editingOptionLabels: Record<string, string> = {};
  
  // Helper functions
  function normalizeTo100(values: number[]): number[] {
    const total = values.reduce((sum, v) => sum + v, 0);
    if (total === 0) return values.map(() => 0);
    return values.map(v => (v / total) * 100);
  }
  
  function formatNumber(num: number | undefined | null): string {
    if (num === undefined || num === null || isNaN(num)) return '0';
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
    
    // Escala gradual más suave
    // 0-20%: 20-25px
    // 21-40%: 26-35px
    // 41-60%: 36-42px
    // 61-80%: 43-47px
    // 81-100%: 48-50px
    const size = 20 + (clamped * 0.3);  // De 20px a 50px de forma lineal
    
    return Math.max(20, Math.min(50, Math.round(size)));
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
  // NUNCA reordenar opciones para evitar confusión al usuario
  // Las opciones mantienen su orden original siempre
  $: sortedPollOptions = getNormalizedOptions(poll);
  $: shouldPaginate = sortedPollOptions.length > OPTIONS_PER_PAGE;
  $: paginatedPoll = shouldPaginate 
    ? getPaginatedOptions(sortedPollOptions, currentPage)
    : { items: sortedPollOptions, totalPages: 1, hasNext: false, hasPrev: false };
  $: isSingleOptionPoll = sortedPollOptions.length === 1;
  $: isExpired = poll.closedAt ? isPollExpired(poll.closedAt) : false;
  $: pollVotedOption = displayVotes[poll.id] || userVotes[poll.id];
  $: votedOptionData = pollVotedOption ? poll.options.find((o: any) => o.key === pollVotedOption) : null;
  
  // Event handlers
  function handleSetActive(index: number) {
    dispatch('setActive', { pollId: poll.id, index });
  }
  
  // Long press handlers
  function startLongPress(optionText: string, event: MouseEvent | TouchEvent) {
    // Cancelar cualquier long press anterior
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
    
    longPressActivated = false; // Resetear flag al inicio
    
    longPressTimer = setTimeout(() => {
      showLongPressTooltip = true;
      longPressTooltipText = optionText;
      longPressActivated = true; // Marcar que se activó el long press
      
      // Cancelar cualquier lógica de doble click en progreso
      if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
      }
      clickCount = 0;
      pendingOptionKey = null;
      showDoubleClickTooltip = false;
      
      console.log('[LongPress] Mostrando tooltip:', optionText);
    }, LONG_PRESS_DELAY);
  }
  
  function cancelLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    showLongPressTooltip = false;
    longPressTooltipText = '';
    
    // Resetear flag después de un pequeño delay para evitar clicks inmediatos
    setTimeout(() => {
      longPressActivated = false;
    }, 100);
  }
  
  function handlePageChange(pageIndex: number) {
    dispatch('pageChange', { pollId: poll.id, page: pageIndex });
    // Abrir automáticamente la primera opción de la nueva página
    setTimeout(() => {
      dispatch('setActive', { pollId: poll.id, index: 0 });
      console.log('[SinglePoll] Abriendo primera opción de página:', pageIndex);
    }, 50);
  }
  
  function handleConfirmMultiple() {
    dispatch('confirmMultiple', { pollId: poll.id });
  }
  
  // Title tooltip handlers
  function showTitleTooltipHandler(text: string, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    console.log('[TitleTooltip] Intentando mostrar:', text);
    console.log('[TitleTooltip] showTitleTooltip antes:', showTitleTooltip);
    
    showTitleTooltip = true;
    titleTooltipText = text;
    
    console.log('[TitleTooltip] showTitleTooltip después:', showTitleTooltip);
    console.log('[TitleTooltip] titleTooltipText:', titleTooltipText);
    
    // Agregar listener global con delay para evitar que cierre inmediatamente
    setTimeout(() => {
      if (showTitleTooltip && typeof document !== 'undefined') {
        document.addEventListener('click', handleClickOutside, { once: false });
        console.log('[TitleTooltip] Listener global agregado');
      }
    }, 100);
  }
  
  function hideTitleTooltip() {
    console.log('[TitleTooltip] Ocultando tooltip');
    showTitleTooltip = false;
    titleTooltipText = '';
    
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', handleClickOutside);
    }
  }
  
  // Listener global para cerrar tooltip al hacer click fuera
  function handleClickOutside(event: MouseEvent) {
    console.log('[TitleTooltip] Click fuera detectado');
    if (showTitleTooltip) {
      hideTitleTooltip();
    }
  }
  
  function handleAddOption() {
    console.log('[SinglePollSection] handleAddOption called:', { pollId: poll.id, previewColor });
    dispatch('addOption', { pollId: poll.id, previewColor });
  }
  
  function handleOpenInGlobe() {
    dispatch('openInGlobe', { poll });
  }
  
  function handleDragStart(e: PointerEvent | TouchEvent) {
    dispatch('dragStart', { event: e, pollId: poll.id });
  }
  
  // Generar color aleatorio para preview del botón
  const previewColors = [
    '#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
    '#dc2626', '#ea580c', '#d97706', '#059669', '#2563eb', '#7c3aed', '#db2777', '#0d9488'
  ];
  const previewColor = previewColors[Math.floor(Math.random() * previewColors.length)];
</script>

<div class="poll-item">
  <!-- Header de la encuesta -->
  <div class="poll-header">
    <div class="header-with-avatar">
      <div class="header-content">
        {#if poll.type === 'hashtag'}
          <div class="poll-question-wrapper">
            <div class="poll-question-row" style="position: relative;">
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
              
              <!-- Botón de tooltip para título truncado -->
              {#if pollTitleTruncated[poll.id] || poll.question.length > 50}
                <button 
                  class="title-tooltip-btn"
                  onclick={(e) => showTitleTooltipHandler(`#${poll.question}`, e)}
                  title="Ver título completo"
                >
                  ⋯
                </button>
              {/if}
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
            <div class="poll-question-row" style="position: relative;">
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
              
              <!-- Botón de tooltip para título truncado -->
              {#if pollTitleTruncated[poll.id] || (poll.question || poll.title || '').length > 50}
                <button 
                  class="title-tooltip-btn"
                  onclick={(e) => showTitleTooltipHandler(poll.question || poll.title, e)}
                  title="Ver título completo"
                >
                  ⋯
                </button>
              {/if}
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
        <button 
          class="header-avatar header-avatar-real" 
          onclick={(e) => {
            e.stopPropagation();
            if (poll.user?.id) {
              selectedProfileUserId = poll.user.id;
              isProfileModalOpen = true;
            }
          }}
          aria-label="Ver perfil de {poll.user.displayName || 'usuario'}"
        >
          <img src={poll.user.avatarUrl} alt={poll.user.displayName || 'Avatar'} loading="lazy" />
        </button>
      {:else}
        <div class="header-avatar header-avatar-real">
          <img src={DEFAULT_AVATAR} alt="Avatar" loading="lazy" />
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Grid de opciones -->
  <div class="vote-cards-container" style="position: relative;">
    <!-- Tooltip de long press con texto completo -->
    {#if showLongPressTooltip}
      <div class="long-press-tooltip">
        {longPressTooltipText}
      </div>
    {/if}
    
    <div 
      class="vote-cards-grid accordion fullwidth {activeAccordionIndex != null ? 'open' : ''} {isSingleOptionPoll ? 'compact-one' : ''} pagination-{paginationDirection}"
      style="--items: {paginatedPoll.items.length}"
      role="group"
      aria-label="Opciones de {poll.question || poll.title}"
      bind:this={pollGridRef}
      onpointerdown={handleDragStart}
      ontouchstart={(e) => {
        const touch = e.touches[0];
        touchStartPosition = { x: touch.clientX, y: touch.clientY };
        handleDragStart(e);
      }}
    >
      {#each paginatedPoll.items as option, index (`${currentPage}-${option.key || option.id || index}`)}
        {@const isPollVoted = poll.type === 'multiple'
          ? (multipleVotes[poll.id]?.includes(option.key) || 
             (displayVotes[poll.id] || userVotes[poll.id])?.split(',').includes(option.key))
          : (displayVotes[poll.id] || userVotes[poll.id]) === option.key}
        {@const isNewOption = poll.type === 'collaborative' && option.isEditing === true}
        {@const displayPct = isNewOption ? 25 : option.pct}
        
        <svelte:element
          this={isNewOption ? 'div' : 'button'}
          role={isNewOption ? 'region' : undefined}
          class="vote-card {activeAccordionIndex === index ? 'is-active' : ''} {(state !== 'expanded' || activeAccordionIndex !== index) ? 'collapsed' : ''} {isPollVoted ? 'voted' : ''}" 
          style="--card-color: {option.color}; --fill-pct: {Math.max(0, Math.min(100, displayPct))}%; --fill-pct-val: {Math.max(0, Math.min(100, displayPct))}; --fill-window: 120px; --flex: {Math.max(0.5, displayPct / 10)};"
          in:fly={{ x: paginationDirection === 'forward' ? 300 : -300, duration: 400, easing: cubicOut }}
          out:fly={{ x: paginationDirection === 'forward' ? -300 : 300, duration: 300, easing: cubicOut }} 
          ontouchstart={(e: TouchEvent) => {
            if (isNewOption || isSingleOptionPoll) return;
            touchStartPosition = { 
              x: e.touches[0].clientX, 
              y: e.touches[0].clientY 
            };
            startLongPress(option.label, e);
          }}
          onmousedown={(e: MouseEvent) => {
            if (isNewOption || isSingleOptionPoll) return;
            startLongPress(option.label, e);
          }}
          onmouseup={() => cancelLongPress()}
          onmouseleave={() => cancelLongPress()}
          ontouchend={(e: TouchEvent) => {
            // Cancelar long press al soltar
            cancelLongPress();
            // Manejar touch para móvil (igual que onclick)
            if (isNewOption || isSingleOptionPoll) { return; }
            
            // Verificar si hubo movimiento (drag) vs tap estático
            if (touchStartPosition && e.changedTouches[0]) {
              const touch = e.changedTouches[0];
              const deltaX = Math.abs(touch.clientX - touchStartPosition.x);
              const deltaY = Math.abs(touch.clientY - touchStartPosition.y);
              
              // Si hubo movimiento significativo, es un drag, no un tap
              if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD) {
                console.log('[SinglePoll] Movimiento detectado, ignorando tap:', { deltaX, deltaY });
                return;
              }
            }
            
            // Si el long press acaba de activarse, ignorar este touch
            if (longPressActivated) {
              console.log('[SinglePoll] Touch ignorado - long press activo');
              return;
            }
            
            const editingOption = poll.options.find((opt: any) => opt.isEditing);
            if (editingOption) {
              dispatch('cancelEditing', { pollId: poll.id, optionKey: editingOption.key });
              return;
            }
            
            // Para polls múltiples o colaborativas: voto con un touch
            if (poll.type === 'multiple' || poll.type === 'collaborative') {
              if (state !== 'expanded' || activeAccordionIndex !== index) {
                e.preventDefault();
                e.stopPropagation();
                handleSetActive(index);
                return;
              }
              dispatch('optionClick', { event: e, optionKey: option.key, pollId: poll.id, optionColor: option.color });
              return;
            }
            
            // Para polls normales: sistema de doble touch (funciona tanto colapsada como expandida)
            e.preventDefault();
            e.stopPropagation();
            
            const wasCollapsed = state !== 'expanded' || activeAccordionIndex !== index;
            
            // Si está colapsada, abrirla
            if (wasCollapsed) {
              handleSetActive(index);
            }
            
            // Incrementar contador y procesar doble touch
            clickCount++;
            pendingOptionKey = option.key;
            
            console.log('[SinglePoll] Touch #' + clickCount, option.key);
            
            if (clickTimeout) clearTimeout(clickTimeout);
            
            clickTimeout = setTimeout(() => {
              console.log('[SinglePoll] ⏰ Touch timeout ejecutado! clickCount:', clickCount);
              if (clickCount === 1) {
                // Touch simple - Mostrar tooltip (solo si ya estaba expandida)
                if (!wasCollapsed) {
                  console.log('[SinglePoll] Touch simple - Mostrando tooltip');
                  showDoubleClickTooltip = true;
                  if (tooltipTimeout) clearTimeout(tooltipTimeout);
                  tooltipTimeout = setTimeout(() => {
                    showDoubleClickTooltip = false;
                  }, 2000);
                } else {
                  console.log('[SinglePoll] Touch simple en colapsada - Solo abierta');
                }
              } else if (clickCount >= 2) {
                // Doble touch - VOTAR o DESVOTAR (y abrir si estaba colapsada)
                console.log('[SinglePoll] ✅ DOBLE TOUCH confirmado - Votando:', pendingOptionKey);
                showDoubleClickTooltip = false;
                if (tooltipTimeout) clearTimeout(tooltipTimeout);
                
                // Verificar si ya votó esta opción (desvoto)
                const isUnvoting = isPollVoted;
                
                if (isUnvoting) {
                  // Mostrar X de eliminación
                  voteRemovalColor = option.color;
                  showVoteRemoval = true;
                  if (voteRemovalTimeout) clearTimeout(voteRemovalTimeout);
                  voteRemovalTimeout = setTimeout(() => {
                    showVoteRemoval = false;
                  }, 800);
                } else {
                  // Mostrar check de confirmación
                  voteConfirmationColor = option.color;
                  showVoteConfirmation = true;
                  if (voteConfirmationTimeout) clearTimeout(voteConfirmationTimeout);
                  voteConfirmationTimeout = setTimeout(() => {
                    showVoteConfirmation = false;
                  }, 800);
                }
                
                dispatch('optionClick', { 
                  event: e, 
                  optionKey: pendingOptionKey, 
                  pollId: poll.id, 
                  optionColor: option.color 
                });
                console.log('[SinglePoll] Evento optionClick despachado desde touch');
              }
              
              clickCount = 0;
              pendingOptionKey = null;
            }, DOUBLE_CLICK_DELAY);
          }}
          onclick={(e: MouseEvent) => {
            if (isNewOption || isSingleOptionPoll) { return; }
            
            // Ignorar clicks en el botón de tooltip
            const target = e.target as HTMLElement;
            if (target.closest('.option-tooltip-btn')) {
              console.log('[SinglePoll] Click en botón tooltip - ignorando');
              return;
            }
            
            // Si el long press acaba de activarse, ignorar este click
            if (longPressActivated) {
              console.log('[SinglePoll] Click ignorado - long press activo');
              return;
            }
            
            // Cancelar cualquier opción en edición antes de proceder
            const editingOption = poll.options.find((opt: any) => opt.isEditing);
            if (editingOption) {
              dispatch('cancelEditing', { pollId: poll.id, optionKey: editingOption.key });
              return;
            }
            
            // Para polls múltiples o colaborativas: voto con un click
            if (poll.type === 'multiple' || poll.type === 'collaborative') {
              if (state !== 'expanded' || activeAccordionIndex !== index) {
                e.preventDefault();
                e.stopPropagation();
                handleSetActive(index); 
                return; 
              }
              dispatch('optionClick', { event: e, optionKey: option.key, pollId: poll.id, optionColor: option.color });
              return;
            }
            
            // Para polls normales: sistema de doble click (funciona tanto colapsada como expandida)
            e.preventDefault();
            e.stopPropagation();
            
            const wasCollapsed = state !== 'expanded' || activeAccordionIndex !== index;
            
            // Si está colapsada, abrirla
            if (wasCollapsed) {
              handleSetActive(index);
            }
            
            // Incrementar contador y procesar doble click
            clickCount++;
            pendingOptionKey = option.key;
            
            console.log('[SinglePoll] Click #' + clickCount, option.key);
            console.log('[SinglePoll] clickCount actual:', clickCount, 'pendingOptionKey:', option.key);
            
            // Cancelar timeout anterior
            if (clickTimeout) {
              console.log('[SinglePoll] Cancelando timeout anterior');
              clearTimeout(clickTimeout);
            }
            
            // Esperar medio segundo para ver si es doble click
            console.log('[SinglePoll] Programando timeout de 500ms...');
            clickTimeout = setTimeout(() => {
              console.log('[SinglePoll] ⏰ Timeout ejecutado! clickCount:', clickCount);
              if (clickCount === 1) {
                // Es click simple - Mostrar tooltip (solo si ya estaba expandida)
                if (!wasCollapsed) {
                  console.log('[SinglePoll] Click simple confirmado - Mostrando tooltip');
                  showDoubleClickTooltip = true;
                  if (tooltipTimeout) clearTimeout(tooltipTimeout);
                  tooltipTimeout = setTimeout(() => {
                    showDoubleClickTooltip = false;
                  }, 2000);
                } else {
                  console.log('[SinglePoll] Click simple en colapsada - Solo abierta');
                }
              } else if (clickCount >= 2) {
                // Es doble click - VOTAR o DESVOTAR (y abrir si estaba colapsada)
                console.log('[SinglePoll] ✅ DOBLE CLICK confirmado - Votando:', pendingOptionKey);
                console.log('[SinglePoll] Despachando evento optionClick:', {
                  optionKey: pendingOptionKey,
                  pollId: poll.id,
                  pollType: poll.type,
                  color: option.color
                });
                showDoubleClickTooltip = false;
                if (tooltipTimeout) clearTimeout(tooltipTimeout);
                
                // Verificar si ya votó esta opción (desvoto)
                const isUnvoting = isPollVoted;
                
                if (isUnvoting) {
                  // Mostrar X de eliminación
                  voteRemovalColor = option.color;
                  showVoteRemoval = true;
                  if (voteRemovalTimeout) clearTimeout(voteRemovalTimeout);
                  voteRemovalTimeout = setTimeout(() => {
                    showVoteRemoval = false;
                  }, 800);
                } else {
                  // Mostrar check de confirmación
                  voteConfirmationColor = option.color;
                  showVoteConfirmation = true;
                  if (voteConfirmationTimeout) clearTimeout(voteConfirmationTimeout);
                  voteConfirmationTimeout = setTimeout(() => {
                    showVoteConfirmation = false;
                  }, 800);
                }
                
                // Despachar el evento
                dispatch('optionClick', { 
                  event: e, 
                  optionKey: pendingOptionKey, 
                  pollId: poll.id, 
                  optionColor: option.color 
                });
                
                console.log('[SinglePoll] Evento optionClick despachado');
              }
              
              // Reset
              clickCount = 0;
              pendingOptionKey = null;
            }, DOUBLE_CLICK_DELAY);
          }}
          onfocus={() => !isSingleOptionPoll && !isNewOption ? handleSetActive(index) : null}
          onkeydown={(e: KeyboardEvent) => {
            if (isNewOption) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              
              // Cancelar cualquier opción en edición antes de proceder
              const editingOption = poll.options.find((opt: any) => opt.isEditing);
              if (editingOption) {
                dispatch('cancelEditing', { pollId: poll.id, optionKey: editingOption.key });
                return;
              }
              
              // Primer toque: abrir la card si está colapsada
              if (state !== 'expanded' || activeAccordionIndex !== index) {
                e.stopPropagation();
                handleSetActive(index); 
                return; 
              }
              
              // Segundo toque: votar SOLO si está completamente desplegada
              if (state === 'expanded' && activeAccordionIndex === index) {
                dispatch('optionClick', { event: e, optionKey: option.key, pollId: poll.id, optionColor: option.color });
              } else {
                e.stopPropagation();
              }
            }
          }}
          type={isNewOption ? undefined : 'button'}
        >
          {#if isNewOption}
            <!-- Layout para opciones nuevas: Avatar + Botón X arriba, textarea medio, porcentaje abajo -->
            <!-- Avatar del usuario logueado arriba a la izquierda -->
            <img 
              class="creator-avatar-editing" 
              src={$currentUser?.avatarUrl || DEFAULT_AVATAR} 
              alt={$currentUser?.displayName || 'Usuario'} 
              loading="lazy" 
            />
            
            <!-- Botón X para cerrar/eliminar arriba -->
            <button
              class="remove-option-badge-top"
              onclick={(e) => {
                e.stopPropagation();
                // Emitir evento para que el padre elimine la opción
                dispatch('cancelEditing', { pollId: poll.id, optionKey: option.key });
              }}
              title="Cerrar"
              type="button"
              aria-label="Cerrar opción"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            
            <!-- Textarea en el centro -->
            <div class="new-option-content">
              <textarea
                class="question-title editable new-option"
                placeholder="Escribe tu opción..."
                value={editingOptionLabels[option.key] || option.label || ''}
                oninput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  option.label = target.value;
                  editingOptionLabels = { ...editingOptionLabels, [option.key]: target.value };
                }}
                onclick={(e) => e.stopPropagation()}
                maxlength="200"
              ></textarea>
            </div>
            
            <!-- Contenedor con gradiente de color -->
            <div class="card-content">
              <div class="percentage-display">
                <span class="percentage-large" style="font-size: {fontSizeForPct(displayPct)}px;">
                  {Math.round(displayPct)}
                </span>
              </div>
            </div>
            
            <!-- Botones posicionados absolutamente -->
            <!-- Botón selector de color -->
            <button
              class="color-picker-badge-absolute"
              style="background-color: {option.color}"
              onclick={(e) => {
                e.stopPropagation();
                dispatch('openColorPicker', { pollId: poll.id, optionKey: option.key });
              }}
              title="Cambiar color"
              type="button"
              aria-label="Cambiar color"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </button>
            
            <!-- Botón publicar -->
            <button
              class="publish-option-btn-absolute"
              onclick={(e) => {
                e.stopPropagation();
                const currentLabel = editingOptionLabels[option.key] || option.label || '';
                if (currentLabel && currentLabel.trim()) {
                  const pollIdStr = poll.id.toString();
                  console.log('[SinglePollSection] Dispatching publishOption:', { 
                    pollId: pollIdStr, 
                    optionKey: option.key, 
                    label: currentLabel.trim(), 
                    color: option.color 
                  });
                  dispatch('publishOption', { pollId: pollIdStr, optionKey: option.key, label: currentLabel.trim(), color: option.color });
                }
              }}
              title="Publicar opción"
              type="button"
              disabled={!editingOptionLabels[option.key] || !editingOptionLabels[option.key].trim()}
              aria-label="Publicar opción"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </button>
          {:else}
            <!-- Layout normal para opciones existentes -->
            <!-- Header con avatar y título -->
            {#if !isSingleOptionPoll}
            <div class="card-header" style="position: relative;">
              <h2 class="question-title">{option.label}</h2>
              
              <!-- Botón de tooltip para texto largo (solo cuando está desplegada/activa) -->
              {#if activeAccordionIndex === index && option.label && option.label.length > 50}
                <button 
                  class="option-tooltip-btn"
                  onpointerdown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onmousedown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  ontouchstart={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onclick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('[OptionTooltip] Botón clickeado!');
                    showTitleTooltipHandler(option.label, e);
                  }}
                  title="Ver texto completo"
                  type="button"
                >
                  ⋯
                </button>
              {/if}
              
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
                    ? fontSizeForPct(displayPct)
                    : Math.min(fontSizeForPct(displayPct), 21))}px"
                >
                  {Math.round(displayPct)}
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
          {/if}
        </svelte:element>
      {/each}
    </div>
  </div>
  
  <!-- Tooltip de doble click -->
  {#if showDoubleClickTooltip && poll.type !== 'multiple' && poll.type !== 'collaborative'}
    <div class="double-click-tooltip">
      Doble click para votar
    </div>
  {/if}
  
  <!-- Tooltip de confirmación de voto -->
  {#if showVoteConfirmation}
    <div class="vote-confirmation-tooltip" style="--vote-color: {voteConfirmationColor}">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
  {/if}
  
  <!-- Tooltip de eliminación de voto -->
  {#if showVoteRemoval}
    <div class="vote-removal-tooltip" style="--vote-color: {voteRemovalColor}">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </div>
  {/if}
  
  <!-- Controles inferiores: izquierda (estadísticas), centro (paginación), derecha (acciones) -->
  <div class="bottom-controls-container">
    <!-- Lado izquierdo: Icono de estadísticas -->
    <div class="bottom-controls-left">
      <button
        class="stats-icon-btn"
        type="button"
        title="Ver estadísticas"
        aria-label="Ver estadísticas"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="20" x2="12" y2="10"></line>
          <line x1="18" y1="20" x2="18" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="16"></line>
        </svg>
      </button>
    </div>
    
    <!-- Centro: Paginación -->
    <div class="bottom-controls-center">
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
    </div>
    
    <!-- Lado derecho: Botones de acción -->
    <div class="bottom-controls-right">
      <!-- Botón confirmar votos múltiples -->
      {#if poll.type === 'multiple'}
        {@const selectedCount = multipleVotes[poll.id]?.length || 0}
        {@const hasVoted = !!userVotes[poll.id]}
        {@const hasNewSelections = selectedCount > 0}
        {@const shouldActivate = hasNewSelections && (!hasVoted || selectedCount > 0)}
        <button
          class="confirm-multiple-btn-compact {shouldActivate ? 'has-selection' : ''} {hasVoted && !hasNewSelections ? 'voted-state' : ''} {isExpired ? 'disabled' : ''}"
          onclick={handleConfirmMultiple}
          disabled={selectedCount === 0 || isExpired}
          type="button"
          title="{selectedCount === 0 ? 'Selecciona opciones' : `Confirmar ${selectedCount} ${selectedCount === 1 ? 'voto' : 'votos'}`}"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          {#if selectedCount > 0}
            <span class="count-badge">{selectedCount}</span>
          {/if}
        </button>
      {/if}
      
      <!-- Botón añadir opción (colaborativas) -->
      {#if poll.type === 'collaborative' && poll.options.length < 10 && !poll.options.some((opt: any) => opt.isEditing)}
        <button
          type="button"
          class="add-option-button-bottom"
          style="--preview-color: {previewColor}"
          onclick={handleAddOption}
          title="Añadir nueva opción"
          aria-label="Añadir nueva opción"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>
  
  <!-- Botones de acción -->
  <div class="vote-summary-info">
    <div class="vote-actions">
      <!-- Lado izquierdo: Votos, Vistas y Globo -->
      <div class="action-group-left">
        <button 
          bind:this={voteIconElement}
          class="action-badge action-vote {pollVotedOption ? 'has-voted' : 'no-vote'}" 
          type="button" 
          title={pollVotedOption ? `Tu voto: ${votedOptionData?.label || pollVotedOption} (Click para quitar)` : "Aún no has votado"}
          style="{pollVotedOption && votedOptionData ? `--vote-color: ${votedOptionData.color};` : ''}"
          ontouchend={(e) => {
            e.stopPropagation();
            console.log('[SinglePoll] 🗑️ Touch en botón de voto');
            console.log('[SinglePoll] pollVotedOption:', pollVotedOption);
            if (pollVotedOption) {
              console.log('[SinglePoll] Despachando clearVote para:', poll.id);
              voteRemovalColor = votedOptionData?.color || '#ef4444';
              showVoteRemoval = true;
              if (voteRemovalTimeout) clearTimeout(voteRemovalTimeout);
              voteRemovalTimeout = setTimeout(() => {
                showVoteRemoval = false;
              }, 800);
              
              dispatch('clearVote', { pollId: poll.id });
            }
          }}
          onclick={(e) => {
            e.stopPropagation();
            console.log('[SinglePoll] 👁️ Click en botón de voto');
            console.log('[SinglePoll] pollVotedOption:', pollVotedOption);
            if (pollVotedOption) {
              console.log('[SinglePoll] Despachando clearVote para:', poll.id);
              voteRemovalColor = votedOptionData?.color || '#ef4444';
              showVoteRemoval = true;
              if (voteRemovalTimeout) clearTimeout(voteRemovalTimeout);
              voteRemovalTimeout = setTimeout(() => {
                showVoteRemoval = false;
              }, 800);
              
              dispatch('clearVote', { pollId: poll.id });
            }
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill={pollVotedOption ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          {#if pollVotedOption}
            <span>{formatNumber(poll.stats?.totalVotes || poll.totalVotes || 0)}</span>
          {:else}
            <span style="opacity: 0;">-</span>
          {/if}
        </button>
        <button class="action-badge" type="button" title="Vistas">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>{formatNumber(poll.stats?.totalViews || poll.totalViews || 0)}</span>
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
      
      <!-- Lado derecho: Guardar, Republicar, Compartir -->
      <div class="action-group-right">
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
      </div>
    </div>
  </div>
</div>

<!-- Tooltip del título truncado (fuera de todo para máxima visibilidad) -->
{#if showTitleTooltip}
  <div class="title-tooltip-overlay" onclick={hideTitleTooltip}>
    <div class="title-tooltip-content" onclick={(e) => e.stopPropagation()}>
      {titleTooltipText}
    </div>
  </div>
{/if}

<style>
  /* Botón confirmar votos múltiples - Versión compacta */
  .confirm-multiple-btn-compact {
    width: 36px;
    height: 36px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: visible;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .confirm-multiple-btn-compact.has-selection {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border-color: rgba(255, 255, 255, 0.3);
    color: white;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4), 
                0 2px 8px rgba(16, 185, 129, 0.3);
  }

  .confirm-multiple-btn-compact.has-selection:hover {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.5);
  }

  .confirm-multiple-btn-compact.has-selection:active {
    transform: scale(0.92);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  }

  .confirm-multiple-btn-compact.disabled,
  .confirm-multiple-btn-compact:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .confirm-multiple-btn-compact svg {
    flex-shrink: 0;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  }
  
  .count-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #ef4444;
    color: white;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: 10px;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
  
  /* Badge apagado cuando ya has votado */
  .count-badge-voted {
    position: absolute;
    top: -4px;
    right: -4px;
    background: rgba(107, 114, 128, 0.4);
    color: rgba(255, 255, 255, 0.5);
    font-size: 10px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: 10px;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  
  /* Estado apagado cuando ya has votado */
  .confirm-multiple-btn-compact.voted-state {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.4);
    cursor: default;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .confirm-multiple-btn-compact.voted-state:hover {
    background: rgba(255, 255, 255, 0.03);
    transform: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  /* Paginación - Exacto como CreatePollModal */
  .pagination-dots {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 2px 0 0px;
    margin: 0;
  }
  
  .pagination-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 0;
  }
  
  .pagination-dot:hover {
    background: rgba(255, 255, 255, 0.5);
    transform: scale(1.2);
  }
  
  .pagination-dot.active {
    background: #3b82f6;
    width: 24px;
    border-radius: 4px;
  }

  /* Contenedor de controles inferiores */
  .bottom-controls-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0;
    margin: 0 16px;
    gap: 8px;
  }
  
  .bottom-controls-left,
  .bottom-controls-right {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 36px;
  }
  
  /* Botón de estadísticas */
  .stats-icon-btn {
    width: 36px;
    height: 36px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .stats-icon-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
    transform: scale(1.05);
  }
  
  .stats-icon-btn:active {
    transform: scale(0.95);
  }
  
  .stats-icon-btn svg {
    flex-shrink: 0;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  }
  
  .bottom-controls-center {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Botón añadir opción pequeño debajo - estilo card con borde color */
  .add-option-button-bottom {
    width: 30px;
    height: 30px;
    border-radius: 6px;
    background: #2a2c31;
    border: none;
    border-bottom: 2.5px solid var(--preview-color, #8b5cf6);
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  /* Vote cards con background sólido */
  :global(.vote-card) {
    background: #2a2c31 !important;
  }

  :global(.vote-card.collapsed) {
    background: #2a2c31 !important;
  }

  /* Contenedor de tarjetas con botón añadir */
  .vote-cards-container {
    display: flex;
    align-items: stretch;
    gap: 0;
    margin: 0 -1rem;
    padding: 0 1rem;
  }

  /* Botón añadir opción inline a la derecha - Efecto Glass */
  .add-option-button-inline {
    
    
    flex-shrink:0;
    min-width: 60px;
    width: 50px;
    height: 224px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: none;
    border-left: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0 16px 16px 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 1.25rem;
    font-weight: 300;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex
;
    align-items: center;
    padding-right: 7px;
    justify-content: right;
    margin-left: -43px;
    margin-right: 16px;
    z-index: 0;
  }

  .add-option-button-inline:hover {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-left-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.95);
   
    transform: translateX(2px);
  }

  /* Layout para opciones nuevas colaborativas */
  .remove-option-badge-top {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 8px;
    background: #000000;
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .remove-option-badge-top:hover {
    background: #1a1a1a;
    transform: scale(1.1);
  }

  .card-header {
    background: transparent;
    position: relative;
    z-index: 0;
    pointer-events: none;
  }

  .question-title {
    background: transparent;
    position: relative;
    z-index: 0;
    pointer-events: none;
  }

  .percentage-large {
    background: transparent;
    pointer-events: none;
  }

  .creator-avatar-editing {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    z-index: 3;
  }

  .new-option-content {
    padding: 48px 16px 16px 16px;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    pointer-events: none;
    position: relative;
    z-index: 1;
  }

  .question-title.editable.new-option {
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    width: 100%;
    resize: none;
    overflow: hidden;
    vertical-align: top;
    word-wrap: break-word;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    text-align: center;
    font-size: 16px;
    font-weight: 600;
    min-height: 60px;
    max-height: 120px;
    pointer-events: auto;
    position: relative;
    z-index: 2;
  }

  .question-title.editable.new-option::placeholder {
    color: rgba(255, 255, 255, 0.45);
    font-weight: 500;
  }

  .card-content {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: transparent;
    z-index: 0;
  }

  .card-content::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc(var(--fill-window, 120px) * (var(--fill-pct-val, 0) / 100));
    max-height: var(--fill-window, 120px);
    background: var(--card-color, rgba(0, 0, 0, 0.4));
    pointer-events: none;
    z-index: 0;
    opacity: 0.8;
    transition: height 0.3s ease, opacity 0.2s ease;
  }

  .card-content-bottom {
    padding: 0 16px 16px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    z-index: 1;
  }

  .bottom-buttons {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-left: auto;
  }
  
  .percentage-display {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    position: relative;
    z-index: 0;
    pointer-events: none;
  }
  
  /* Cuando está desplegada, mover a la izquierda */
  .vote-card.is-active .percentage-display {
    justify-content: flex-start;
    padding-left: 20px;
  }
  
  /* Tooltip de doble click */
  .double-click-tooltip {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    pointer-events: none;
    z-index: 1000;
    animation: tooltipFadeIn 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  @keyframes tooltipFadeIn {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.9);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
  
  /* Tooltip de confirmación de voto */
  .vote-confirmation-tooltip {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--vote-color, #10b981);
    color: white;
    padding: 12px;
    border-radius: 50%;
    pointer-events: none;
    z-index: 1000;
    animation: voteConfirmFlyUp 0.8s ease-out forwards;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
  }
  
  .vote-confirmation-tooltip svg {
    flex-shrink: 0;
  }
  
  @keyframes voteConfirmFlyUp {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.8);
    }
    20% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -150%) scale(0.8);
    }
  }
  
  /* Tooltip de eliminación de voto */
  .vote-removal-tooltip {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--vote-color, #ef4444);
    color: white;
    padding: 12px;
    border-radius: 50%;
    pointer-events: none;
    z-index: 1000;
    animation: voteRemovalFlyUp 0.8s ease-out forwards;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
  }
  
  .vote-removal-tooltip svg {
    flex-shrink: 0;
  }
  
  @keyframes voteRemovalFlyUp {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.8) rotate(0deg);
    }
    20% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.1) rotate(90deg);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -150%) scale(0.8) rotate(180deg);
    }
  }
  
  /* Tooltip de long press con texto completo */
  .long-press-tooltip {
    position: absolute;
    bottom: calc(100% + 12px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.92);
    color: white;
    padding: 12px 20px;
    border-radius: 12px;
    pointer-events: none;
    z-index: 10000;
    max-width: min(400px, 90vw);
    font-size: 14px;
    line-height: 1.4;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    animation: fadeInUp 0.2s ease-out;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    word-wrap: break-word;
    white-space: normal;
  }
  
  /* Flecha del tooltip apuntando hacia abajo */
  .long-press-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 8px solid transparent;
    border-top-color: rgba(0, 0, 0, 0.92);
  }
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
  
  @media (max-width: 768px) {
    .long-press-tooltip {
      padding: 10px 16px;
      font-size: 13px;
      max-width: 85vw;
      bottom: calc(100% + 8px);
    }
  }
  
  /* Botón de tres puntos para tooltip del título */
  .title-tooltip-btn {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 18px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 10;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
  }
  
  .title-tooltip-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.95);
    transform: translateY(-50%) scale(1.1);
  }
  
  /* Botón de tres puntos para opciones */
  .option-tooltip-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
    margin-left: 4px;
    background: rgba(255, 255, 255, 0.15);
    border: none;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 16px;
    line-height: 1;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 1000;
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    position: absolute;
    bottom: 4px;
    right: 8px;
    pointer-events: auto;
  }
  
  .option-tooltip-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    color: white;
    transform: scale(1.15);
  }
  
  /* Overlay del tooltip del título */
  .title-tooltip-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease-out;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }
  
  .title-tooltip-content {
    background: rgba(20, 20, 20, 0.95);
    color: white;
    padding: 24px 32px;
    border-radius: 16px;
    max-width: min(600px, 90vw);
    max-height: 70vh;
    overflow-y: auto;
    font-size: 16px;
    line-height: 1.6;
    text-align: center;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.8);
    animation: scaleIn 0.3s ease-out;
    word-wrap: break-word;
    white-space: pre-wrap;
  }
  
  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  @media (max-width: 768px) {
    .title-tooltip-btn {
      padding: 3px 8px;
      font-size: 16px;
    }
    
    .title-tooltip-content {
      padding: 20px 24px;
      font-size: 15px;
      max-width: 92vw;
    }
  }

  .color-picker-badge-bottom {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 2px solid rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0;
    position: relative;
    overflow: visible;
  }

  .color-picker-badge-bottom:hover {
    border-color: rgba(255, 255, 255, 0.8);
    transform: scale(1.1);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
  }

  /* Note: .publish-option-btn is unused - component uses .publish-option-btn-absolute instead */
  .publish-option-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0;
    color: white;
  }

  .publish-option-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #059669, #047857);
    transform: scale(1.1);
    box-shadow: 0 3px 10px rgba(16, 185, 129, 0.5);
  }

  .publish-option-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .publish-option-btn:disabled {
    background: rgba(107, 114, 128, 0.3);
    cursor: not-allowed;
    opacity: 0.5;
    box-shadow: none;
  }

  /* Botones posicionados absolutamente para opciones en edición */
  .color-picker-badge-absolute {
    position: absolute;
    bottom: 16px;
    right: 60px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 2px solid rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3;
    padding: 0;
  }

  .color-picker-badge-absolute:hover {
    border-color: rgba(255, 255, 255, 0.8);
    transform: scale(1.1);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
  }

  .color-picker-badge-absolute svg {
    width: 1rem;
    height: 1rem;
    color: rgba(255, 255, 255, 0.9);
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  }

  .publish-option-btn-absolute {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #10b981, #059669);
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    color: white;
    z-index: 3;
    padding: 0;
  }

  .publish-option-btn-absolute:hover:not(:disabled) {
    background: linear-gradient(135deg, #059669, #047857);
    transform: scale(1.1);
    box-shadow: 0 3px 10px rgba(16, 185, 129, 0.5);
  }

  .publish-option-btn-absolute:disabled {
    background: rgba(107, 114, 128, 0.3);
    cursor: not-allowed;
    opacity: 0.5;
    box-shadow: none;
  }

  .publish-option-btn-absolute svg {
    width: 1.125rem;
    height: 1.125rem;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }
  
  /* Contenedor de información de votos */
  .vote-summary-info {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
  
  /* Grupos de acciones */
  .vote-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0;
    margin: 0 16px 0;
    gap: 8px;
    width: calc(100% - 32px);
  }
  
  .action-group-left,
  .action-group-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  /* Botones de acción - estilo sutil sin bordes */
  .action-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .action-badge:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.8);
    transform: translateY(-1px);
  }
  
  .action-badge:active {
    transform: translateY(0);
  }
  
  .action-badge svg {
    flex-shrink: 0;
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }
  
  .action-badge:hover svg {
    opacity: 1;
  }
  
  .action-badge span {
    font-weight: 500;
    font-size: 12px;
  }
  
  .action-globe {
    color: rgba(59, 130, 246, 0.8);
  }
  
  .action-globe:hover {
    color: rgb(59, 130, 246);
  }
  
  .action-share:hover {
    color: rgba(16, 185, 129, 0.9);
  }
  
  /* Reducir espaciado del header y meta */
  .poll-header {
    margin-bottom: 0;
    padding-bottom: 4px;
  }
  
  .poll-meta {
    margin-top: 4px;
    margin-bottom: 0;
  }
  
  .header-with-avatar {
    margin-bottom: 0;
  }
  
  .poll-item {
    margin-bottom: 0;
    padding-bottom: 0;
  }
  
  /* Reducir padding de botones individuales */
  .action-badge {
    padding: 2px 4px !important;
  }
  
  /* Estilo para avatar clickeable */
  .header-avatar-real {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .header-avatar-real:hover {
    transform: scale(1.1);
  }
  
  /* Botón de votos con estados */
  .action-vote.has-voted {
    color: var(--vote-color, #10b981);
  }
  
  .action-vote.has-voted svg {
    opacity: 1;
  }
  
  .action-vote:hover {
    color: rgba(16, 185, 129, 0.9);
  }
  
</style>

<!-- Modal de perfil de usuario -->
<UserProfileModal 
  bind:isOpen={isProfileModalOpen} 
  bind:userId={selectedProfileUserId}
  on:pollClick={(e) => dispatch('openPollById', e.detail)}
/>