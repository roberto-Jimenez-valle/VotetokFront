<script lang="ts">
  import { ChevronDown, MoreVertical } from 'lucide-svelte';
  import MediaEmbed from './MediaEmbed.svelte';
  import { fade, fly } from 'svelte/transition';

  interface PollOption {
    id: string;
    label: string;
    color: string;
    imageUrl?: string;
    pct?: number; // Porcentaje real de la encuesta
    votes?: number; // Votos reales
    voted?: boolean; // Si el usuario votó por esta opción
  }

  interface PollCreator {
    username: string;
    avatar?: string;
  }

  interface PollStats {
    totalVotes: number;
    totalViews: number;
  }

  interface VotedOption {
    label: string;
    color: string;
  }

  interface Friend {
    id: string;
    name: string;
    username?: string;
    avatarUrl?: string | null;
    verified?: boolean;
  }

  interface Props {
    options: PollOption[];
    activeOptionId: string;
    pollTitle: string;
    pollType?: 'simple' | 'multiple' | 'collaborative'; // Tipo de encuesta
    pollRegion?: string; // Región de la encuesta
    pollCreatedAt?: string | Date; // Fecha de creación
    creator?: PollCreator;
    stats?: PollStats;
    readOnly?: boolean; // Modo solo lectura
    showAllOptions?: boolean; // Mostrar todas las opciones en vertical con scroll
    hasVoted?: boolean; // Si el usuario ha votado
    votedOption?: VotedOption; // Opción votada por el usuario
    friendsByOption?: Record<string, Friend[]>; // Amigos que votaron por opción
    onClose: () => void;
    onOptionChange: (optionId: string) => void;
    onSwipeVertical?: (direction: 'up' | 'down') => void; // Swipe vertical para cambiar encuesta
    onVote?: (optionId: string) => void; // Votar con doble click
    onClearVote?: () => void; // Limpiar voto
    onTitleChange?: (title: string) => void;
    onLabelChange?: (optionId: string, label: string) => void;
    onOpenColorPicker?: (optionId: string) => void;
    onOpenInGlobe?: () => void;
    onShare?: () => void;
    onBookmark?: () => void;
    onRepost?: () => void;
    onAddOption?: () => void; // Añadir opción colaborativa
  }

  let { 
    options, 
    activeOptionId = $bindable(), 
    pollTitle,
    pollType = 'simple',
    pollRegion = 'General',
    pollCreatedAt,
    creator,
    stats,
    readOnly = false,
    showAllOptions = false,
    hasVoted = false,
    votedOption,
    friendsByOption = {},
    onClose,
    onOptionChange,
    onSwipeVertical = () => {},
    onVote = () => {},
    onClearVote = () => {},
    onTitleChange = () => {},
    onLabelChange = () => {},
    onOpenColorPicker = () => {},
    onOpenInGlobe = () => {},
    onShare = () => {},
    onBookmark = () => {},
    onRepost = () => {},
    onAddOption = () => {}
  }: Props = $props();

  const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e5e7eb"/%3E%3Cpath d="M20 20a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0 2c-5.33 0-16 2.67-16 8v4h32v-4c0-5.33-10.67-8-16-8z" fill="%239ca3af"/%3E%3C/svg%3E';

  // Opción activa derivada (readonly, calculada reactivamente)
  let activeOption = $derived(options.find(opt => opt.id === activeOptionId));
  let activeIndex = $derived(options.findIndex(opt => opt.id === activeOptionId));
  // Usar porcentaje real si existe, sino calcular
  let percentage = $derived(activeOption?.pct !== undefined ? Math.round(activeOption.pct) : Math.round(100 / options.length));

  // Estado del modal de opciones
  let showOptionsModal = $state(false);
  let modalDragStartY = $state(0);
  let modalDragCurrentY = $state(0);
  let isModalDragging = $state(false);

  // Estado del modal de votantes
  let showVotersModal = $state(false);
  let selectedOptionForVoters = $state<string | null>(null);

  // Animaciones de voto
  let showVoteConfirmation = $state(false);
  let showVoteRemoval = $state(false);
  let voteConfirmationColor = $state('#10b981');
  let voteRemovalColor = $state('#ef4444');
  let voteConfirmationTimeout: any = null;
  let voteRemovalTimeout: any = null;

  function getRelativeTime(minutes: number): string {
    if (minutes < 1) return 'ahora';
    if (minutes < 60) return `${Math.floor(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}sem`;
    const months = Math.floor(days / 30);
    return `${months}mes`;
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  // Handlers para drag del modal
  function handleModalDragStart(e: TouchEvent | PointerEvent) {
    e.stopPropagation(); // Evitar que afecte al modal principal
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    modalDragStartY = clientY;
    modalDragCurrentY = 0;
    isModalDragging = true;
  }

  function handleModalDragMove(e: TouchEvent | PointerEvent) {
    if (!isModalDragging) return;
    
    e.stopPropagation(); // Evitar que afecte al modal principal
    e.preventDefault(); // Evitar scroll del body
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - modalDragStartY;
    
    // Solo permitir drag hacia abajo
    if (deltaY > 0) {
      modalDragCurrentY = deltaY;
    }
  }

  function handleModalDragEnd() {
    if (!isModalDragging) return;
    
    // Si se arrastró más de 100px hacia abajo, cerrar el modal
    if (modalDragCurrentY > 100) {
      showOptionsModal = false;
    }
    
    // Reset
    isModalDragging = false;
    modalDragCurrentY = 0;
    modalDragStartY = 0;
  }

  // Abrir modal de votantes
  function openVotersModal(optionKey: string) {
    selectedOptionForVoters = optionKey;
    showVotersModal = true;
  }

  // Cerrar modal de votantes
  function closeVotersModal() {
    showVotersModal = false;
    selectedOptionForVoters = null;
  }

  // Debug logs
  $effect(() => {
    console.log('[PollMaximizedView] Renderizando:', {
      totalOptions: options.length,
      activeOptionId,
      activeIndex,
      activeOption: activeOption ? {
        id: activeOption.id,
        label: activeOption.label,
        hasImageUrl: !!activeOption.imageUrl,
        imageUrl: activeOption.imageUrl
      } : null,
      percentage,
      showAllOptions
    });
  });

  // No inicializar automáticamente ninguna opción como activa
  // Se activará solo cuando el usuario haga scroll

  // Estado local SOLO para swipe visual
  let touchStartX = $state(0);
  let touchStartY = $state(0);
  let isDragging = $state(false);
  
  // Estado para scroll de opciones (modo showAllOptions)
  let optionsScrollContainer: HTMLElement | null = null;
  let scrollStartY = $state(0);
  let isAtBottom = $state(false);
  let isAtTop = $state(false);
  let activeScrollOptionId = $state<string | null>(null); // Opción visible en el scroll
  
  // Estado para doble click/tap (solo para modo single-option)
  let lastTapTime = 0;
  let tapTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Transiciones dinámicas
  let transitionX = $state(0);
  let transitionY = $state(0);
  let showVoteBorder = $state(true); // Controla visibilidad del borde de voto
  
  // Variables derivadas para entrada (inversas a las de salida)
  let inTransitionX = $derived(-transitionX);
  let inTransitionY = $derived(-transitionY);

  // Navegación simple con transiciones
  function goToPrevious() {
    if (activeIndex > 0) {
      onOptionChange(options[activeIndex - 1].id);
    }
  }

  function goToNext() {
    if (activeIndex < options.length - 1) {
      onOptionChange(options[activeIndex + 1].id);
    }
  }

  function goToOption(optionId: string) {
    onOptionChange(optionId);
  }

  // Detectar si el scroll está al final o al principio
  function checkScrollPosition() {
    if (!optionsScrollContainer) return;
    
    const { scrollTop, scrollHeight, clientHeight } = optionsScrollContainer;
    isAtBottom = scrollTop + clientHeight >= scrollHeight - 5; // 5px de tolerancia
    isAtTop = scrollTop <= 5;
    
    // Detectar qué opción está más visible (más cerca del centro)
    if (showAllOptions) {
      const containerRect = optionsScrollContainer.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;
      
      const optionCards = optionsScrollContainer.querySelectorAll('.option-card-vertical');
      let closestOption: Element | null = null;
      let minDistance = Infinity;
      
      optionCards.forEach((card) => {
        const cardRect = card.getBoundingClientRect();
        const cardCenterY = cardRect.top + cardRect.height / 2;
        const distance = Math.abs(cardCenterY - centerY);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestOption = card;
        }
      });
      
      if (closestOption) {
        const optionId = (closestOption as HTMLElement).getAttribute('data-option-id');
        if (optionId && optionId !== activeScrollOptionId) {
          activeScrollOptionId = optionId;
        }
      }
    }
    
    console.log('[PollMaximizedView] Scroll position:', {
      scrollTop,
      scrollHeight,
      clientHeight,
      isAtBottom,
      isAtTop,
      activeScrollOptionId
    });
  }
  
  // Swipe handlers con doble tap
  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    scrollStartY = e.touches[0].clientY;
    isDragging = true;
    
    // Actualizar posición de scroll
    if (showAllOptions) {
      checkScrollPosition();
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (!isDragging) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Si es un tap (sin movimiento significativo)
    if (moveDistance < 10) {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTime;
      
      if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
        // Doble tap detectado - votar
        if (activeOption && readOnly) {
          console.log('[PollMaximizedView] 🗳️ Doble tap - Votando:', activeOption.id);
          
          // Determinar si es un voto o eliminación
          const isUnvoting = activeOption.voted;
          
          if (isUnvoting) {
            voteRemovalColor = activeOption.color;
            showVoteRemoval = true;
            if (voteRemovalTimeout) clearTimeout(voteRemovalTimeout);
            voteRemovalTimeout = setTimeout(() => {
              showVoteRemoval = false;
            }, 800);
          } else {
            voteConfirmationColor = activeOption.color;
            showVoteConfirmation = true;
            if (voteConfirmationTimeout) clearTimeout(voteConfirmationTimeout);
            voteConfirmationTimeout = setTimeout(() => {
              showVoteConfirmation = false;
            }, 800);
          }
          
          onVote(activeOption.id);
        }
        lastTapTime = 0; // Reset
      } else {
        // Primer tap
        lastTapTime = now;
      }
    } else {
      // Es un swipe
      // Determinar dirección predominante
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Swipe horizontal (cambiar opción) - threshold de 50px
        if (Math.abs(deltaX) > 50) {
          showVoteBorder = false;
          setTimeout(() => {
            if (deltaX < 0) {
              // Swipe a la izquierda → siguiente (sale hacia izquierda)
              transitionX = 300;
              transitionY = 0;
              goToNext();
              setTimeout(() => showVoteBorder = true, 500); // 250ms out + 250ms in
            } else {
              // Swipe a la derecha → anterior (sale hacia derecha)
              transitionX = -300;
              transitionY = 0;
              goToPrevious();
              setTimeout(() => showVoteBorder = true, 500); // 250ms out + 250ms in
            }
          }, 50);
        }
      } else {
        // Swipe vertical (cambiar encuesta) - threshold de 80px
        if (Math.abs(deltaY) > 80) {
          // Si estamos en modo showAllOptions, solo cambiar si estamos en los bordes
          if (showAllOptions) {
            if (deltaY < 0 && isAtBottom) {
              // Swipe hacia arriba Y estamos al final → siguiente encuesta
              console.log('[PollMaximizedView] 📱 Cambio a siguiente (al final del scroll)');
              showVoteBorder = false;
              setTimeout(() => {
                transitionX = 0;
                transitionY = 300;
                onSwipeVertical('down');
                setTimeout(() => showVoteBorder = true, 500); // 250ms out + 250ms in
              }, 50);
            } else if (deltaY > 0 && isAtTop) {
              // Swipe hacia abajo Y estamos al inicio → encuesta anterior
              console.log('[PollMaximizedView] 📱 Cambio a anterior (al inicio del scroll)');
              showVoteBorder = false;
              setTimeout(() => {
                transitionX = 0;
                transitionY = -300;
                onSwipeVertical('up');
                setTimeout(() => showVoteBorder = true, 500); // 250ms out + 250ms in
              }, 50);
            }
            // Si no estamos en los bordes, el scroll normal funciona
          } else {
            // Modo normal (una opción a la vez)
            showVoteBorder = false;
            setTimeout(() => {
              transitionX = 0;
              if (deltaY < 0) {
                // Swipe hacia arriba → siguiente encuesta (sale hacia arriba)
                transitionY = 300;
                onSwipeVertical('down');
              } else {
                // Swipe hacia abajo → encuesta anterior (sale hacia abajo)
                transitionY = -300;
                onSwipeVertical('up');
              }
              setTimeout(() => showVoteBorder = true, 500); // 250ms out + 250ms in
            }, 50);
          }
        }
      }
    }
    
    isDragging = false;
  }

  // Keyboard navigation
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Escape') {
      e.preventDefault();
      if (e.key === 'ArrowLeft') goToPrevious();
      else if (e.key === 'ArrowRight') goToNext();
      else onClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Backdrop y contenedor principal -->
<div 
  class="maximized-container"
  role="dialog"
  aria-modal="true"
  aria-label="Vista maximizada de encuesta"
  transition:fade={{ duration: 200 }}
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
>
  <!-- Título de la encuesta con avatar -->
  {#key pollTitle}
    <div 
      class="poll-title-section"
      class:voted={activeOption?.voted && showVoteBorder}
      style={activeOption?.voted && showVoteBorder ? `--vote-color: ${activeOption.color}` : ''}
      in:fly|local={{ y: transitionY, duration: 250, delay: 250 }}
      out:fly|local={{ y: inTransitionY, duration: 250, delay: 0 }}
    >
      <div class="poll-header">
        {#if creator}
          <img 
            src={creator.avatar || DEFAULT_AVATAR} 
            alt={creator.username}
            class="creator-avatar"
          />
        {/if}
        {#if readOnly}
          <h2 class="poll-title-readonly">{pollTitle}</h2>
        {:else}
          <textarea
            class="poll-title-input"
            placeholder="¿Cuál es tu pregunta?"
            value={pollTitle}
            oninput={(e) => onTitleChange((e.target as HTMLTextAreaElement).value)}
            rows="2"
            maxlength="280"
          ></textarea>
        {/if}
      </div>
      
      <!-- Meta información de la encuesta -->
      <div class="poll-meta">
        <span class="poll-type">
          {#if pollType === 'multiple'}
            Encuesta ☑️
          {:else if pollType === 'collaborative'}
            Encuesta 👥
          {:else}
            Encuesta ⭕
          {/if}
          • {pollRegion}
        </span>
        {#if pollCreatedAt}
          <span class="poll-time">• {getRelativeTime(Math.floor((Date.now() - new Date(pollCreatedAt).getTime()) / 60000))}</span>
        {/if}
      </div>
    </div>
  {/key}

  <!-- Mostrar todas las opciones en scroll vertical O una opción activa -->
  {#if showAllOptions}
    <!-- Modo: Todas las opciones en scroll vertical -->
    {#key pollTitle}
      <div 
        class="all-options-container"
        bind:this={optionsScrollContainer}
        onscroll={checkScrollPosition}
        in:fly={{ y: transitionY, duration: 250, delay: 250 }}
        out:fly={{ y: inTransitionY, duration: 250, delay: 0 }}
      >
      {#each options as option, idx}
        <button
          type="button"
          class="option-card-vertical"
          class:voted={option.voted}
          class:active={activeScrollOptionId === option.id}
          style="border-color: {option.color}; --option-color: {option.color};"
          data-option-id={option.id}
          onclick={() => {
            if (readOnly) {
              console.log('[PollMaximizedView] 🗳️ Click - Votando:', option.id, option.label);
              
              // Determinar si es un voto o eliminación
              const isUnvoting = option.voted;
              
              if (isUnvoting) {
                voteRemovalColor = option.color;
                showVoteRemoval = true;
                if (voteRemovalTimeout) clearTimeout(voteRemovalTimeout);
                voteRemovalTimeout = setTimeout(() => {
                  showVoteRemoval = false;
                }, 800);
              } else {
                voteConfirmationColor = option.color;
                showVoteConfirmation = true;
                if (voteConfirmationTimeout) clearTimeout(voteConfirmationTimeout);
                voteConfirmationTimeout = setTimeout(() => {
                  showVoteConfirmation = false;
                }, 800);
              }
              
              onVote(option.id);
            }
          }}
        >
          <div class="option-number" style="background: {option.color};">{idx + 1}</div>
          <div class="option-content-vertical">
            <div class="option-label-vertical">{option.label}</div>
            <div class="option-stats">
              <span class="option-pct" style="color: {option.color};">{Math.round(option.pct || 0)}%</span>
              <span class="option-votes">{option.votes || 0} votos</span>
            </div>
            
            <!-- Avatares de amigos que votaron -->
            {#if friendsByOption[option.id] && friendsByOption[option.id].length > 0}
              <div class="friend-avatars-container" onclick={(e) => { e.stopPropagation(); openVotersModal(option.id); }}>
                {#each friendsByOption[option.id].slice(0, 3) as friend, i}
                  <img 
                    class="friend-avatar" 
                    src={friend.avatarUrl || DEFAULT_AVATAR}
                    alt={friend.name}
                    loading="lazy"
                    style="z-index: {10 - i};"
                  />
                {/each}
                {#if friendsByOption[option.id].length > 3}
                  <div class="more-avatars">+{friendsByOption[option.id].length - 3}</div>
                {/if}
              </div>
            {/if}
          </div>
          {#if option.voted}
            <div class="voted-checkmark" style="color: {option.color};">✓</div>
          {/if}
        </button>
      {/each}
      
      <!-- Botón añadir opción (colaborativas) -->
      {#if pollType === 'collaborative' && options.length < 10}
        <button
          type="button"
          class="add-option-button"
          onclick={onAddOption}
          title="Añadir nueva opción"
          aria-label="Añadir nueva opción"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Añadir opción</span>
        </button>
      {/if}
      </div>
    {/key}
  {:else if activeOption}
    <!-- Modo: Una opción a la vez (comportamiento actual) -->
    {#key `${pollTitle}-${activeOptionId}`}
      <!-- Borde de voto que cubre toda la pantalla -->
      {#if activeOption.voted && showVoteBorder}
        <div class="vote-border-overlay" style="--vote-color: {activeOption.color}"></div>
      {/if}
      
      <div 
        class="option-content-container"
        class:voted={activeOption.voted}
        style={activeOption.voted ? `--vote-color: ${activeOption.color}` : ''}
        in:fly={{ x: transitionX, y: transitionY, duration: 250, delay: 250 }}
        out:fly={{ x: inTransitionX, y: inTransitionY, duration: 250, delay: 0 }}
      >
        {#if activeOption.imageUrl}
          <!-- Media Preview con texto dentro -->
          <div class="media-preview">
            <MediaEmbed 
              url={activeOption.imageUrl}
              mode="full"
              width="100%"
              height="auto"
              autoplay={true}
            />
            
            <!-- Texto con flechas superpuesto sobre el preview -->
            <div class="text-with-arrows">
              <!-- Label de opción -->
              {#if readOnly}
                <div class="option-label-readonly">{activeOption.label}</div>
              {:else}
                <textarea
                  class="option-label-input"
                  placeholder="Opción {activeIndex + 1}"
                  value={activeOption.label}
                  oninput={(e) => onLabelChange(activeOption.id, (e.target as HTMLTextAreaElement).value)}
                  rows="2"
                  maxlength="150"
                ></textarea>
              {/if}

              <!-- Flechas debajo a los lados -->
              <div class="arrows-below">
                <button
                  type="button"
                  class="nav-arrow-side left"
                  onclick={goToPrevious}
                  aria-label="Opción anterior"
                  style="visibility: {activeIndex > 0 ? 'visible' : 'hidden'};"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>

                <button
                  type="button"
                  class="nav-arrow-side right"
                  onclick={goToNext}
                  aria-label="Siguiente opción"
                  style="visibility: {activeIndex < options.length - 1 ? 'visible' : 'hidden'};"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        {:else}
          <!-- Sin media: texto centrado en toda la pantalla -->
          <div class="text-only-container">
            <div class="text-with-arrows-centered">
              <!-- Label de opción centrado -->
              {#if readOnly}
                <div class="option-label-readonly-centered">{activeOption.label}</div>
              {:else}
                <textarea
                  class="option-label-input-centered"
                  placeholder="Opción {activeIndex + 1}"
                  value={activeOption.label}
                  oninput={(e) => onLabelChange(activeOption.id, (e.target as HTMLTextAreaElement).value)}
                  rows="3"
                  maxlength="150"
                ></textarea>
              {/if}

              <!-- Flechas debajo a los lados -->
              <div class="arrows-below">
                <button
                  type="button"
                  class="nav-arrow-side left"
                  onclick={goToPrevious}
                  aria-label="Opción anterior"
                  style="visibility: {activeIndex > 0 ? 'visible' : 'hidden'};"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>

                <button
                  type="button"
                  class="nav-arrow-side right"
                  onclick={goToNext}
                  aria-label="Siguiente opción"
                  style="visibility: {activeIndex < options.length - 1 ? 'visible' : 'hidden'};"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/key}
  {/if}

  <!-- Porcentaje abajo a la izquierda (solo en modo single-option) -->
  {#if activeOption && !showAllOptions}
    <div class="percentage-bottom-left">
      <div class="percentage-text">{percentage}%</div>
    </div>
  {/if}

  <!-- Avatares de amigos encima de la barra de progreso -->
  {#if activeOption && !showAllOptions && friendsByOption[activeOption.id] && friendsByOption[activeOption.id].length > 0}
    <div class="friend-avatars-above-progress" onclick={() => openVotersModal(activeOption.id)}>
      {#each friendsByOption[activeOption.id].slice(0, 3) as friend, i}
        <img 
          class="friend-avatar" 
          src={friend.avatarUrl || DEFAULT_AVATAR}
          alt={friend.name}
          loading="lazy"
          style="z-index: {10 - i};"
        />
      {/each}
      {#if friendsByOption[activeOption.id].length > 3}
        <div class="more-avatars">+{friendsByOption[activeOption.id].length - 3}</div>
      {/if}
    </div>
  {/if}

  <!-- Botones de acción abajo a la derecha (solo en modo readonly) -->
  {#if activeOption && readOnly}
    <div class="bottom-right-buttons">
      <!-- Botón de opciones (3 puntos) -->
      <button
        type="button"
        class="options-button"
        onclick={() => showOptionsModal = true}
        aria-label="Opciones"
      >
        <MoreVertical size={28} />
      </button>
      
      <!-- Botón de minimizar -->
      <button
        type="button"
        class="minimize-button-bottom"
        onclick={onClose}
        aria-label="Minimizar"
      >
        <ChevronDown size={24} />
      </button>
    </div>
  {/if}

  <!-- Modal de opciones (bottom sheet) -->
  {#if showOptionsModal}
    <div 
      class="options-modal-overlay" 
      role="button"
      tabindex="0"
      onclick={(e) => { e.stopPropagation(); showOptionsModal = false; }}
      onkeydown={(e) => e.key === 'Enter' && (showOptionsModal = false)}
      ontouchstart={(e) => e.stopPropagation()}
      ontouchmove={(e) => e.stopPropagation()}
      ontouchend={(e) => e.stopPropagation()}
      transition:fade={{ duration: 200 }}
    >
      <div 
        class="options-modal-content"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        style={isModalDragging ? `transform: translateY(${modalDragCurrentY}px); transition: none;` : ''}
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        ontouchstart={handleModalDragStart}
        ontouchmove={handleModalDragMove}
        ontouchend={handleModalDragEnd}
        onpointerdown={handleModalDragStart}
        onpointermove={handleModalDragMove}
        onpointerup={handleModalDragEnd}
        in:fly={{ y: 300, duration: 250 }}
        out:fly|global={{ y: 300, duration: 250 }}
      >
        <div class="options-modal-header" style="cursor: grab; user-select: none;">
          <div class="modal-handle"></div>
        </div>
        
        <div class="options-modal-actions">
          <!-- Info: Votos y Vistas -->
          {#if stats}
            <div class="stats-row">
              <div class="stat-item">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 11l3 3L22 4"></path>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                <span class="stat-label">Votos</span>
                <span class="stat-value">{formatNumber(stats.totalVotes)}</span>
              </div>
              <div class="stat-item">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span class="stat-label">Vistas</span>
                <span class="stat-value">{formatNumber(stats.totalViews)}</span>
              </div>
            </div>
          {/if}

          <!-- Acciones -->
          <button class="action-item" onclick={() => { onOpenInGlobe(); showOptionsModal = false; }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span>Ver en el mapa</span>
          </button>

          <button class="action-item" onclick={() => { onBookmark(); showOptionsModal = false; }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Guardar</span>
          </button>

          <button class="action-item" onclick={() => { onRepost(); showOptionsModal = false; }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M17 1l4 4-4 4"/>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <path d="M7 23l-4-4 4-4"/>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
            <span>Republicar</span>
          </button>

          <button class="action-item" onclick={() => { onShare(); showOptionsModal = false; }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span>Compartir</span>
          </button>
        </div>

        <button class="cancel-button" onclick={() => showOptionsModal = false}>
          Cancelar
        </button>
      </div>
    </div>
  {/if}

  <!-- Botones de acción en el bottom derecho (solo en modo edición) -->
  {#if activeOption && !readOnly}
    <div class="action-buttons-bottom">
      <!-- Botón de cambiar color (izquierda) -->
      <button
        type="button"
        class="color-button"
        style="background: {activeOption.color};"
        onclick={() => onOpenColorPicker(activeOption.id)}
        aria-label="Cambiar color"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      </button>

      <!-- Botón de minimizar (derecha) -->
      <button
        type="button"
        class="minimize-button"
        onclick={onClose}
        aria-label="Minimizar"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
        </svg>
      </button>
    </div>
  {/if}

  <!-- Botones de acción (solo en modo readOnly) -->
  {#if readOnly && (activeOption || showAllOptions)}
    <div class="vote-actions">
      <!-- Lado izquierdo: Votos, Vistas y Globo -->
      <div class="action-group-left">
        <button 
          class="action-badge action-vote {hasVoted ? 'has-voted' : 'no-vote'}" 
          type="button" 
          title={hasVoted ? `Tu voto: ${votedOption?.label || ''} (Click para quitar)` : activeOption ? `Votar: ${activeOption.label}` : "Selecciona una opción"}
          style="{hasVoted && votedOption ? `--vote-color: ${votedOption.color};` : ''}"
          onclick={(e) => {
            e.stopPropagation();
            if (hasVoted) {
              // Quitar voto
              voteRemovalColor = votedOption?.color || '#ef4444';
              showVoteRemoval = true;
              if (voteRemovalTimeout) clearTimeout(voteRemovalTimeout);
              voteRemovalTimeout = setTimeout(() => {
                showVoteRemoval = false;
              }, 800);
              onClearVote();
            } else if (activeOption) {
              // Votar opción activa
              voteConfirmationColor = activeOption.color;
              showVoteConfirmation = true;
              if (voteConfirmationTimeout) clearTimeout(voteConfirmationTimeout);
              voteConfirmationTimeout = setTimeout(() => {
                showVoteConfirmation = false;
              }, 800);
              onVote(activeOption.id);
            }
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill={hasVoted ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          <span>{formatNumber(stats?.totalVotes || 0)}</span>
        </button>
        <button class="action-badge" type="button" title="Vistas">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>{formatNumber(stats?.totalViews || 0)}</span>
        </button>
        <button 
          class="action-badge action-globe" 
          type="button" 
          title="Ver en el globo"
          aria-label="Ver en el globo"
          onclick={onOpenInGlobe}
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
        <button class="action-badge" type="button" title="Guardar" onclick={onBookmark}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          <span>{formatNumber(0)}</span>
        </button>
        <button class="action-badge" type="button" title="Republicar" onclick={onRepost}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M17 1l4 4-4 4"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <path d="M7 23l-4-4 4-4"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
          <span>{formatNumber(0)}</span>
        </button>
        <button class="action-badge action-share" type="button" title="Compartir" onclick={onShare}>
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
  {/if}

  <!-- Barra inferior con color y dots (solo en modo single-option) -->
  {#if !showAllOptions}
    <div class="bottom-bar">
      <!-- Dots de navegación - todos opacos -->
      <div class="navigation-dots">
        {#each options as option, idx}
          <button
            type="button"
            class="dot"
            class:active={option.id === activeOptionId}
            style="background: {option.color};"
            onclick={() => goToOption(option.id)}
            aria-label="Ir a opción {idx + 1}"
          ></button>
        {/each}
      </div>
      
      <!-- Franja de color que sube según porcentaje -->
      {#if activeOption}
        <div class="color-stripe" style="background: {activeOption.color}; height: {Math.max(50, Math.min(150, 50 + percentage))}px;"></div>
      {/if}
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

</div>

<!-- Modal de votantes -->
{#if showVotersModal && selectedOptionForVoters}
  <!-- Backdrop -->
  <div
    class="voters-modal-backdrop"
    onclick={closeVotersModal}
    transition:fade={{ duration: 200 }}
  ></div>

  <!-- Bottom Sheet -->
  <div
    class="voters-modal-sheet"
    transition:fly={{ y: 400, duration: 300 }}
  >
    <!-- Handle bar -->
    <div class="voters-handle-bar"></div>

    <!-- Header -->
    <div class="voters-modal-header">
      <h3>Quién votó por esta opción</h3>
      <button
        class="voters-close-btn"
        onclick={closeVotersModal}
        aria-label="Cerrar"
      >
        ✕
      </button>
    </div>

    <!-- Lista de votantes agrupada por opción -->
    <div class="voters-modal-content">
      {#each options as option}
        {@const voters = friendsByOption[option.id]}
        {#if voters && voters.length > 0}
          <div class="voters-option-group">
            <div class="voters-option-header" style="border-left-color: {option.color};">
              <div class="voters-option-label">{option.label}</div>
              <div class="voters-option-count">{voters.length} {voters.length === 1 ? 'voto' : 'votos'}</div>
            </div>
            
            <div class="voters-list">
              {#each voters as friend}
                <div class="voter-item">
                  <img 
                    src={friend.avatarUrl || DEFAULT_AVATAR}
                    alt={friend.name}
                    class="voter-avatar"
                  />
                  <div class="voter-info">
                    <div class="voter-name">
                      {friend.name}
                      {#if friend.verified}
                        <svg class="verified-icon" width="16" height="16" viewBox="0 0 24 24" fill="#3b82f6">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      {/if}
                    </div>
                    {#if friend.username}
                      <div class="voter-username">@{friend.username}</div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .maximized-container {
    position: fixed;
    inset: 0;
    background: #000;
    z-index: 99999 !important;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    touch-action: pan-y;
  }

  /* Contenedor de todas las opciones en scroll vertical */
  .all-options-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20px;
    padding-bottom: 20px; /* Sin barra inferior, menos padding */
    display: flex;
    flex-direction: column;
    gap: 12px;
    -webkit-overflow-scrolling: touch;
  }

  /* Tarjeta de opción en modo vertical */
  .option-card-vertical {
    position: relative;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    min-height: 80px;
    width: 100%;
  }

  .option-card-vertical:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--option-color);
    transform: translateX(4px);
  }

  .option-card-vertical.voted {
    border-color: var(--option-color);
    background: color-mix(in srgb, var(--option-color) 15%, transparent);
  }

  .option-card-vertical.active {
    border-color: var(--option-color);
    background: color-mix(in srgb, var(--option-color) 20%, transparent);
    border-width: 3px;
    transform: scale(1.02);
    box-shadow: 0 8px 24px color-mix(in srgb, var(--option-color) 40%, transparent);
  }

  .option-number {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 18px;
  }

  .option-content-vertical {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-label-vertical {
    color: white;
    font-size: 18px;
    font-weight: 500;
    line-height: 1.4;
    text-align: left;
  }

  .option-stats {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
  }

  .option-pct {
    font-weight: 700;
    font-size: 24px;
  }

  .option-votes {
    color: rgba(255, 255, 255, 0.6);
  }

  .voted-checkmark {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
  }

  .close-button {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 10000;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    pointer-events: auto;
  }

  .close-button:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: scale(1.1);
  }

  /* Título editable de la encuesta */
  .poll-title-section {
    padding: 20px;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    border-bottom: 4px solid transparent;
    min-height: 80px;
    max-height: 120px;
    display: flex;
    align-items: center;
    overflow-y: hidden;
    transition: border-color 0.2s ease;
  }

  .poll-title-section.voted {
    border-bottom-color: var(--vote-color);
  }

  /* Meta información de la encuesta */
  .poll-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
  }

  .poll-type {
    color: rgba(255, 255, 255, 0.7);
  }

  .poll-time {
    color: rgba(255, 255, 255, 0.5);
  }

  /* Botón añadir opción en showAllOptions */
  .add-option-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    margin: 12px 0;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 2px dashed rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .add-option-button:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.8);
    transform: scale(1.02);
  }

  .add-option-button svg {
    opacity: 0.6;
  }

  /* Botones de acción - posicionados encima de la barra de color */
  .vote-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 20px;
    margin: 0;
    gap: 8px;
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 2;
    padding-bottom: 12px;
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
  
  /* Botón de votos con estados */
  .action-vote.has-voted {
    color: var(--vote-color, #10b981);
  }
  
  .action-vote.has-voted svg {
    opacity: 1;
  }
  
  .action-vote.no-vote {
    color: rgba(255, 255, 255, 0.7);
  }
  
  .action-vote.no-vote span {
    color: rgba(255, 255, 255, 0.9);
  }
  
  .action-vote:hover {
    color: rgba(16, 185, 129, 0.9);
  }

  .poll-title-input {
    width: 100%;
    background: transparent;
    border: none;
    color: white;
    font-size: 20px;
    font-weight: 600;
    padding: 16px 20px;
    resize: none;
    outline: none;
    font-family: inherit;
    line-height: 1.4;
    transition: all 0.2s;
  }

  .poll-title-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  /* Contenedor principal de la opción */
  .option-content-container {
    flex: 1; /* Ocupa el espacio disponible */
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0;
    gap: 0;
    position: relative;
    box-sizing: border-box;
    will-change: transform, opacity;
    width: 100%;
    max-height: 55%; /* Permite que funcione el overflow */
  }

  /* Capa de borde de voto que cubre toda la pantalla (sin incluir título) */
  .vote-border-overlay {
    position: fixed;
    top: 120px;
    left: 0;
    right: 0;
    bottom: 0;
    border: 4px solid var(--vote-color);
    border-top: none;
    border-radius: 0;
    pointer-events: none;
    z-index: 5;
    transition: border-color 0.2s ease;
  }

  /* Media preview - centrado vertical, todo el ancho */
  .media-preview {
    width: 100%;
    flex: 1; /* Ocupa el espacio disponible */
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #000;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center; /* Centrado vertical */
    position: relative;
    min-height: 0; /* Permite que funcione el overflow */
  }

  .media-preview :global(.media-embed) {
    width: 100% !important;
    flex: 1;
    max-height: 100%;
    position: relative;
    border-radius: 0 !important;
    background: transparent !important;
    display: flex;
    align-items: flex-start;
    overflow: hidden !important;
    justify-content: center;
  }

  .media-preview :global(.media-embed.full-mode) {
    width: 100% !important;
    height: 100% !important;
    border-radius: 0 !important;
    background: transparent !important;
  }

  .media-preview :global(.media-embed iframe) {
    width: 100% !important;
    min-width: 100% !important;
    height: 100% !important;
    min-height: 100% !important;
    border-radius: 0 !important;
    opacity: 0;
    animation: showMedia 0s linear 0.39s forwards;
  }

  .media-preview :global(.media-embed video),
  .media-preview :global(.media-embed img) {
    width: 100% !important;
    height: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
    min-height: 100% !important;
    max-height: 100% !important;
    object-fit: contain !important;
    object-position: center !important;
    border-radius: 0 !important;
    opacity: 0;
    animation: showMedia 0s linear 0.39s forwards;
  }

  @keyframes showMedia {
    to {
      opacity: 1;
    }
  }

  /* Contenedor para opciones sin media - texto centrado */
  .text-only-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    min-height: 75vh;
  }

  .text-with-arrows-centered {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    max-width: 600px;
    min-height: 180px;
  }

  .option-label-input-centered {
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 20px;
    color: white;
    font-size: 32px;
    font-weight: 500;
    resize: none;
    outline: none;
    font-family: inherit;
    line-height: 1.5;
    text-align: center;
    transition: all 0.2s;
    min-height: 96px;
  }

  .option-label-input-centered:focus {
    background: transparent;
  }

  .option-label-input-centered::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  /* Contenedor principal de texto y botones - horizontal */
  .option-text-container {
    display: flex;
    flex-direction: row;
    gap: 12px;
    align-items: flex-end;
  }

  /* Texto con flechas arriba - vertical, por encima del preview */
  .text-with-arrows {
    bottom: 0;
    margin:4px;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    z-index: 10;
    opacity: 0;
    animation: showMedia 0s linear 0.39s forwards;
  }

  /* Flechas debajo a los lados */
  .arrows-below {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 32px;
  }

  /* Porcentaje abajo a la izquierda, por encima de dots */
  .percentage-bottom-left {
    position: absolute;
    bottom: 145px;
    left: 20px;
    z-index: 10;
    pointer-events: none;
  }

  .percentage-text {
    font-size: 64px;
    font-weight: 700;
    color: white;
    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.8);
  }

  /* Avatares de amigos encima de la barra de progreso */
  .friend-avatars-above-progress {
    position: absolute;
    bottom: 90px;
    left: 20px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    transition: transform 0.2s ease;
  }

  .friend-avatars-above-progress:hover {
    transform: scale(1.05);
  }

  /* Botones de acción casi en el bottom derecho - horizontal */
  .action-buttons-bottom {
    position: absolute;
    bottom: 50px;
    right: 20px;
    display: flex;
    flex-direction: row;
    gap: 12px;
    z-index: 1000;
  }

  .option-label-input {
    flex: 1;
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 0;
    color: white;
    font-size: 16px;
    font-weight: 500;
    resize: none;
    outline: none;
    font-family: inherit;
    line-height: 1.5;
    transition: all 0.2s;
  }

  .option-label-input:focus {
    background: transparent;
  }

  .option-label-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  /* Flechas laterales discretas - solo en desktop */
  .nav-arrow-side {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.5);
    display: none;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  /* Mostrar flechas solo en desktop (>768px) */
  @media (min-width: 768px) {
    .nav-arrow-side {
      display: flex;
    }
  }

  .nav-arrow-side:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .nav-arrow-side:active {
    transform: scale(0.95);
  }

  /* Botón de cambiar color */
  .color-button {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    color: white;
    pointer-events: auto;
  }

  .color-button:hover {
    transform: scale(1.1);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .color-button:active {
    transform: scale(0.95);
  }

  /* Botón de minimizar */
  .minimize-button {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    color: white;
    pointer-events: auto;
  }

  .minimize-button:hover {
    transform: scale(1.1);
    background: rgba(0, 0, 0, 0.7);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .minimize-button:active {
    transform: scale(0.95);
  }

  .percentage-display {
    display: flex;
    justify-content: center;
  }

  .percentage-text {
    font-size: 48px;
    font-weight: 700;
    color: white;
    text-shadow: 0 4px 16px rgba(0, 0, 0, 0.8);
    letter-spacing: -0.02em;
  }

  /* Barra inferior */
  .bottom-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 50px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    z-index: 1;
    pointer-events: none;
  }

  .bottom-bar .color-stripe {
    z-index: 1;
  }

  .navigation-dots {
    position: absolute;
    bottom: 145px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    padding: 8px 20px;
    justify-content: center;
    background: transparent;
    z-index: 10;
    pointer-events: auto;
  }

  .color-stripe {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    border-radius: 0;
    transition: height 0.3s ease;
    opacity: 0.8;
    z-index: 3;
    min-height: 50px;
    max-height: 150px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 0;
    pointer-events: auto;
  }

  .dot.active {
    width: 24px;
    border-radius: 4px;
  }

  .option-counter {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    font-size: 14px;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(10px);
    padding: 8px 16px;
    border-radius: 12px;
    z-index: 999;
    pointer-events: none;
  }

  /* Flechas de navegación */
  .nav-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 1001;
    pointer-events: auto;
  }

  .nav-arrow.left {
    left: 20px;
  }

  .nav-arrow.right {
    right: 20px;
  }

  .nav-arrow:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: translateY(-50%) scale(1.1);
  }

  .nav-arrow:active {
    transform: translateY(-50%) scale(0.95);
  }

  /* Responsive */
  @media (max-width: 640px) {
    .poll-title h2 {
      font-size: 14px;
    }

    .option-label {
      font-size: 18px;
    }

    .percentage-text {
      font-size: 20px;
    }
  }

  /* Botón de minimizar abajo a la derecha (modo readonly) */
  .minimize-button-bottom {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    border: 2px solid rgba(255, 255, 255, 0.2);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .minimize-button-bottom:hover {
    background: rgba(0, 0, 0, 0.85);
    transform: scale(1.1);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .minimize-button-bottom:active {
    transform: scale(0.95);
  }

  /* Estilos para modo readonly */
  .poll-title-readonly {
    color: white;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.4;
    margin: 0;
    padding: 0;
    text-align: left;
    flex: 1;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .option-label-readonly {
    color: white;
    font-size: 20px;
    font-weight: 600;
    line-height: 1.4;
    text-align: center;
    padding: 0;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  }

  .option-label-readonly-centered {
    color: white;
    font-size: 28px;
    font-weight: 700;
    line-height: 1.3;
    text-align: center;
    padding: 20px;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
    min-height: 96px;
  }

  /* Header con avatar */
  .poll-header {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .creator-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    object-fit: cover;
    flex-shrink: 0;
  }

  /* Contenedor de botones abajo a la derecha */
  .bottom-right-buttons {
    position: fixed;
    bottom: 80px;
    right: 20px;
    z-index: 1000;
    display: flex;
    flex-direction: column-reverse;
    gap: 12px;
    pointer-events: auto;
  }

  /* Botón de opciones (3 puntos) */
  .options-button {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    border: 2px solid rgba(255, 255, 255, 0.2);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .options-button:hover {
    background: rgba(0, 0, 0, 0.85);
    transform: scale(1.1);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .options-button:active {
    transform: scale(0.95);
  }

  /* Modal de opciones (bottom sheet) */
  .options-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 99999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .options-modal-content {
    width: 100%;
    max-width: 500px;
    background: #1a1a1a;
    border-radius: 24px 24px 0 0;
    padding: 0 0 20px 0;
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
    transition: transform 0.2s ease-out;
    touch-action: pan-y;
  }

  .options-modal-header {
    padding: 12px 0;
    display: flex;
    justify-content: center;
  }

  .modal-handle {
    width: 40px;
    height: 5px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
  }

  .options-modal-actions {
    padding: 0 20px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* Fila de estadísticas */
  .stats-row {
    display: flex;
    gap: 12px;
    padding: 16px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 8px;
  }

  .stat-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
  }

  .stat-item svg {
    color: rgba(255, 255, 255, 0.7);
  }

  .stat-label {
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    color: white;
    font-size: 20px;
    font-weight: 700;
  }

  /* Botón de acción del modal */
  .action-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 16px;
    background: transparent;
    border: none;
    color: white;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border-radius: 12px;
  }

  .action-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .action-item:active {
    background: rgba(255, 255, 255, 0.1);
    transform: scale(0.98);
  }

  .action-item svg {
    color: rgba(255, 255, 255, 0.8);
    flex-shrink: 0;
  }

  .action-item span {
    flex: 1;
    text-align: left;
  }

  /* Botón de cancelar */
  .cancel-button {
    width: calc(100% - 40px);
    margin: 16px 20px 0 20px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 12px;
    color: white;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-button:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .cancel-button:active {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(0.98);
  }

  /* Responsive para modal */
  @media (max-width: 640px) {
    .stat-item {
      padding: 8px;
    }

    .stat-value {
      font-size: 16px;
    }

    .action-item {
      padding: 14px 12px;
      font-size: 15px;
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

  /* Avatares de amigos */
  .friend-avatars-container {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    cursor: pointer;
    transition: transform 0.2s ease;
  }

  .friend-avatars-container:hover {
    transform: scale(1.05);
  }

  .friend-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #000;
    object-fit: cover;
    margin-left: -8px;
  }

  .friend-avatar:first-child {
    margin-left: 0;
  }

  .more-avatars {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 10px;
    font-weight: 600;
    border: 2px solid #000;
    margin-left: -8px;
  }

  /* Modal de votantes */
  .voters-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 100000;
    backdrop-filter: blur(4px);
  }

  .voters-modal-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 24px 24px 0 0;
    padding: 0 0 20px 0;
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
    max-height: 80vh;
    overflow-y: auto;
    z-index: 100001;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
  }

  .voters-handle-bar {
    width: 40px;
    height: 5px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    margin: 12px auto;
  }

  .voters-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .voters-modal-header h3 {
    color: white;
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }

  .voters-close-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: white;
    font-size: 20px;
    transition: all 0.2s ease;
  }

  .voters-close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }

  .voters-modal-content {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .voters-option-group {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    overflow: hidden;
  }

  .voters-option-header {
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    border-left: 4px solid;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .voters-option-label {
    color: white;
    font-size: 16px;
    font-weight: 600;
  }

  .voters-option-count {
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-weight: 500;
  }

  .voters-list {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .voter-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    transition: background 0.2s ease;
  }

  .voter-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .voter-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .voter-info {
    flex: 1;
    min-width: 0;
  }

  .voter-name {
    color: white;
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .verified-icon {
    flex-shrink: 0;
  }

  .voter-username {
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    margin-top: 2px;
  }

  @media (max-width: 640px) {
    .voters-modal-header h3 {
      font-size: 16px;
    }

    .voter-avatar {
      width: 36px;
      height: 36px;
    }

    .voter-name {
      font-size: 14px;
    }

    .voter-username {
      font-size: 13px;
    }
  }
</style>
