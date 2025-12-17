<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import GlobeGL from '$lib/GlobeGL.svelte';
  
  export let data: PageData;
  
  const { poll, theme, palette, baseUrl, isClosed } = data;
  
  let isReady = false;
  let selectedOption: string | null = null;
  let hasVoted = false;
  let cardsContainer: HTMLElement;
  let expandedCard = false;
  
  // Toggle expansión de card activa
  function toggleCardExpand() {
    expandedCard = !expandedCard;
  }
  
  // Cerrar card expandida al hacer click fuera
  function handleBackgroundClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    // Si está expandida y el click no fue en una card activa, cerrar
    if (expandedCard && !target.closest('.stack-card.active')) {
      expandedCard = false;
    }
  }
  
  // ===== THUMBNAILS PARA URLS DE PLATAFORMAS =====
  let thumbnails: Record<string, string> = {};
  
  // Detectar si es una URL de plataforma que necesita thumbnail
  function needsThumbnail(url: string): boolean {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    // Plataformas que necesitan thumbnail
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return true;
    if (lowerUrl.includes('spotify.com')) return true;
    if (lowerUrl.includes('vimeo.com')) return true;
    if (lowerUrl.includes('tiktok.com')) return true;
    if (lowerUrl.includes('soundcloud.com')) return true;
    if (lowerUrl.includes('twitch.tv')) return true;
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return true;
    if (lowerUrl.includes('dailymotion.com')) return true;
    // Si es imagen directa, no necesita thumbnail
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url)) return false;
    return false;
  }
  
  // Verificar si es imagen directa
  function isDirectImage(url: string): boolean {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url);
  }
  
  // Limpiar URLs del texto para mostrar solo el contenido descriptivo
  function cleanTextFromUrls(text: string): string {
    if (!text) return '';
    // Remover URLs completas (http://, https://, www.)
    return text.replace(/https?:\/\/[^\s]+/gi, '').replace(/www\.[^\s]+/gi, '').trim();
  }
  
  // Obtener thumbnail desde la API
  async function fetchThumbnail(url: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result;
        return data.imageProxied || data.image || data.thumbnailUrl || null;
      }
    } catch (err) {
      console.warn('[Embed] Error fetching thumbnail:', err);
    }
    return null;
  }
  
  // Cargar todos los thumbnails al montar
  onMount(async () => {
    for (const option of poll.options) {
      if (option.imageUrl && needsThumbnail(option.imageUrl)) {
        const thumb = await fetchThumbnail(option.imageUrl);
        if (thumb) {
          thumbnails[option.key] = thumb;
          thumbnails = thumbnails; // Trigger reactivity
        }
      }
    }
  });
  
  // ===== CARD STACK FLIP EFFECT (CIRCULAR) =====
  let activeIndex = 0;
  let isAnimating = false;
  const totalCards = poll.options.length;
  
  // Array reactivo con posiciones de cada card
  $: cardPositions = poll.options.map((_, i) => {
    let diff = i - activeIndex;
    if (diff > totalCards / 2) diff -= totalCards;
    if (diff < -totalCards / 2) diff += totalCards;
    return diff;
  });
  
  function nextCard() {
    if (isAnimating) return;
    console.log('[Cards] Next card', activeIndex, '->', (activeIndex + 1) % totalCards);
    isAnimating = true;
    expandedCard = false; // Cerrar expansión al cambiar
    activeIndex = (activeIndex + 1) % totalCards;
    setTimeout(() => isAnimating = false, 400);
  }
  
  function prevCard() {
    if (isAnimating) return;
    console.log('[Cards] Prev card', activeIndex, '->', (activeIndex - 1 + totalCards) % totalCards);
    isAnimating = true;
    expandedCard = false; // Cerrar expansión al cambiar
    activeIndex = (activeIndex - 1 + totalCards) % totalCards;
    setTimeout(() => isAnimating = false, 400);
  }
  
  // Calcular offset para centrar el punto activo
  function getDotOffset(active: number, total: number): number {
    if (total <= 5) return 0; // No scroll si hay pocos puntos
    const dotSize = 22; // 12px dot + 10px gap
    const center = active * dotSize;
    return -center;
  }
  
  // Handlers para el card-stack (no globales)
  let startX = 0, startY = 0;
  
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.deltaY > 20) {
      nextCard();
    } else if (e.deltaY < -20) {
      prevCard();
    }
  }
  
  function handleTouchStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }
  
  function handleTouchEnd(e: TouchEvent) {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    
    // Swipe horizontal más sensible (20px)
    if (Math.abs(deltaX) > 20 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        nextCard();
      } else {
        prevCard();
      }
    }
  }
  
  onMount(() => {
    console.log('[Cards] Componente montado');
  });
  
  // Calcular total de votos
  $: totalVotes = poll.options.reduce((sum: number, opt: any) => sum + (opt.votes || 0), 0);
  
  // Calcular tiempo relativo
  function getTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }
  
  $: timeAgo = getTimeAgo(poll.createdAt);
  
  onMount(() => {
    // Aplicar tema
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
    
    // Marcar como listo después de un breve delay
    setTimeout(() => {
      isReady = true;
    }, 1000);
    
    // Click fuera de las cards deselecciona
    function handleClickOutside(e: MouseEvent) {
      if (cardsContainer && !cardsContainer.contains(e.target as Node)) {
        selectedOption = null;
      }
    }
    
    // Pequeño delay para evitar que el click inicial deseleccione
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
    
    return () => document.removeEventListener('click', handleClickOutside);
  });
  
  function selectOption(optionKey: string) {
    if (hasVoted) return;
    // Toggle: si ya está seleccionada, deseleccionar
    if (selectedOption === optionKey) {
      selectedOption = null;
    } else {
      selectedOption = optionKey;
    }
  }
  
  function handleCardClick(optionKey: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    selectOption(optionKey);
  }
  
  async function submitVote() {
    if (!selectedOption || isClosed || hasVoted) return;
    
    try {
      const response = await fetch(`${baseUrl}/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionKey: selectedOption })
      });
      
      if (response.ok) {
        hasVoted = true;
      }
    } catch (error) {
      console.error('Error al votar:', error);
    }
  }
</script>

<svelte:head>
  <title>{poll.title} - VouTop</title>
  <meta name="robots" content="noindex" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
</svelte:head>

<!-- Globo en su propio contenedor -->
<div class="globe-container" style="background-color: {palette.bg}">
  <GlobeGL 
    embedMode={true}
    initialPoll={poll}
    embedPalette={palette}
  />
</div>

<!-- UI flotante FUERA del contenedor del globo -->
<div class="embed-ui" style="--embed-bg: {palette.bg}" on:click={handleBackgroundClick}>
  <!-- Header minimalista -->
  <div class="header-top" class:visible={isReady}>
    <!-- Barra superior: logo + abrir -->
    <div class="top-bar">
      <a href="{baseUrl}" target="_blank" rel="noopener noreferrer" class="logo-link">
        <img src="{baseUrl}/logo.png" alt="VouTop" class="logo-img" />
      </a>
      <a href="{baseUrl}/poll/{poll.id}" target="_blank" rel="noopener noreferrer" class="open-btn">
        Abrir ↗
      </a>
    </div>
    
    <!-- Pregunta -->
    <h1 class="question">{poll.title}</h1>
    
    <!-- Info usuario -->
    <div class="user-row">
      {#if poll.user?.avatarUrl}
        <img src={poll.user.avatarUrl} alt="" class="user-avatar" />
      {:else}
        <div class="user-avatar-fallback">{poll.user?.displayName?.[0] || '?'}</div>
      {/if}
      <span class="username">@{poll.user?.username || 'anónimo'}</span>
    </div>
    
    <!-- Meta: tiempo + tipo voto + votos -->
    <div class="poll-meta">
      <span class="time-ago">{timeAgo}</span>
      <span class="meta-dot">·</span>
      {#if poll.allowMultiple}
        <svg class="type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="2" stroke-width="2"/>
        </svg>
        <span class="type-label">Múltiple</span>
      {:else}
        <svg class="type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" stroke-width="2"/>
        </svg>
        <span class="type-label">Único</span>
      {/if}
      <span class="meta-dot">·</span>
      <span class="votes-count">{totalVotes.toLocaleString()} votos</span>
    </div>
  </div>
  
  <!-- Card Stack Flip Effect (Circular) -->
  <div 
    class="card-stack" 
    bind:this={cardsContainer}
    role="listbox"
    tabindex="0"
    on:wheel|preventDefault|stopPropagation={handleWheel}
    on:touchstart={handleTouchStart}
    on:touchend={handleTouchEnd}
  >
    {#each poll.options as option, i (option.key)}
      {@const thumbnailUrl = thumbnails[option.key] || (option.imageUrl && isDirectImage(option.imageUrl) ? option.imageUrl : null)}
      {@const hasImage = !!thumbnailUrl}
      {@const pos = cardPositions[i]}
      <div 
        class="stack-card"
        class:active={pos === 0}
        class:past={pos < 0}
        class:future={pos > 0}
        class:has-image={hasImage}
        class:expanded={pos === 0 && expandedCard}
        style="--stack-pos: {pos}; --abs-pos: {Math.abs(pos)}; --card-color: {option.color};"
        role="option"
        tabindex={pos === 0 ? 0 : -1}
        aria-selected={pos === 0}
        on:click={() => { if (pos === 0) toggleCardExpand(); }}
        on:keydown={(e) => { if (pos === 0 && (e.key === 'Enter' || e.key === ' ')) toggleCardExpand(); }}
      >
        <div class="card-inner">
          <!-- Fondo: imagen/thumbnail o color sólido -->
          {#if hasImage}
            <img src={thumbnailUrl} alt="" class="card-bg-image" />
            <div class="card-gradient-overlay"></div>
          {:else}
            <div class="card-color-bg" style="background: {option.color};"></div>
            <!-- Comillas decorativas en esquinas -->
            <span class="quote-mark quote-open">"</span>
            <span class="quote-mark quote-close">"</span>
          {/if}
          
          <!-- Contenido superpuesto -->
          <div class="card-content">
            <span class="option-text">{cleanTextFromUrls(option.label || option.text)}</span>
          </div>
          
          <!-- Borde con color -->
          <div class="card-border" style="border-color: {option.color};"></div>
        </div>
      </div>
    {/each}
    
    <!-- Botones de navegación -->
    <button class="nav-btn nav-prev" on:click={prevCard} aria-label="Anterior">
      ‹
    </button>
    <button class="nav-btn nav-next" on:click={nextCard} aria-label="Siguiente">
      ›
    </button>
    
  </div>
  
  <!-- Barras de progreso FIJAS en bottom -->
  <div class="progress-bars-fixed">
    {#each poll.options as option, i}
      <button 
        class="progress-bar" 
        class:active={i === activeIndex}
        class:past={i < activeIndex}
        style="--bar-color: {option.color};"
        on:click={() => { activeIndex = i; }}
        aria-label="Ir a opción {i + 1}"
      ></button>
    {/each}
  </div>
  
  <!-- Botón votar flotante -->
  {#if !hasVoted && !isClosed && selectedOption}
    <button class="vote-floating" on:click={submitVote}>
      Votar
    </button>
  {/if}
  
  <!-- Loading -->
  {#if !isReady}
    <div class="loading-overlay">
      <div class="spinner"></div>
    </div>
  {/if}
</div>

<style>
  /* Contenedor del globo - capa inferior */
  .globe-container {
    position: fixed;
    inset: 0;
    z-index: 1;
  }
  
  /* UI flotante - capa superior, NO bloquea el globo */
  .embed-ui {
    position: fixed;
    inset: 0;
    font-family: system-ui, -apple-system, sans-serif;
    color: white;
    overflow: hidden;
    z-index: 10;
    pointer-events: none; /* No bloquear clicks al globo */
    user-select: none;
    -webkit-user-select: none;
  }
  
  /* Elementos interactivos dentro de embed-ui */
  .header-top,
  .cards-deck,
  .vote-area,
  .card-stack {
    pointer-events: auto;
  }
  
  /* Ocultar elementos UI del GlobeGL en modo embed */
  :global(.dynamic-background),
  :global(.globe-top-fade),
  :global(.tabs-float),
  :global(.legend-panel),
  :global(.settings-btn),
  :global(.locate-btn),
  :global(.tagbar),
  :global(.navigation-breadcrumb),
  :global(.altitude-indicator),
  :global(header),
  :global(.bottom-sheet),
  :global(.settings-overlay),
  :global(.global-dropdown-overlay),
  :global(.data-loading-overlay),
  :global(.scroll-to-top-btn),
  :global(.nav-dropdown) {
    display: none !important;
  }
  
  /* ===== HEADER MINIMALISTA ===== */
  .header-top {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: 12px 16px;
    background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%);
    z-index: 600;
    opacity: 0;
    transition: opacity 0.5s;
  }
  
  .header-top.visible {
    opacity: 1;
  }
  
  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .logo-link {
    text-decoration: none;
  }
  
  .logo-img {
    height: 28px;
    width: auto;
  }
  
  .open-btn {
    font-size: 11px;
    font-weight: 500;
    color: rgba(255,255,255,0.7);
    text-decoration: none;
    padding: 6px 12px;
    background: rgba(255,255,255,0.1);
    border-radius: 16px;
    transition: all 0.2s;
  }
  
  .open-btn:hover {
    background: rgba(255,255,255,0.2);
    color: #fff;
  }
  
  .question {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 10px 0;
    line-height: 1.35;
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
    text-shadow: 
      0 2px 4px rgba(0,0,0,0.5),
      0 4px 12px rgba(0,0,0,0.3);
    letter-spacing: -0.3px;
  }
  
  .meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  
  .author {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  /* User row */
  .user-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  
  .user-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .user-avatar-fallback {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
  }
  
  .username {
    font-size: 13px;
    font-weight: 500;
    color: #fff;
  }
  
  .follow-btn {
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    text-decoration: none;
    padding: 4px 12px;
    background: rgba(255,255,255,0.15);
    border-radius: 14px;
    transition: background 0.2s;
  }
  
  .follow-btn:hover {
    background: rgba(255,255,255,0.25);
  }
  
  /* Poll meta: tiempo + tipo */
  .poll-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: rgba(255,255,255,0.5);
  }
  
  .time-ago {
    color: rgba(255,255,255,0.5);
  }
  
  .meta-dot {
    color: rgba(255,255,255,0.3);
  }
  
  .type-icon {
    width: 14px;
    height: 14px;
    color: rgba(255,255,255,0.5);
  }
  
  .type-label {
    color: rgba(255,255,255,0.5);
  }
  
  .votes-count {
    color: rgba(255,255,255,0.5);
  }
  
  /* Botón votar flotante */
  .vote-floating {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 32px;
    background: #fff;
    border: none;
    border-radius: 24px;
    color: #1a1a1a;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    z-index: 500;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    transition: transform 0.2s;
  }
  
  .vote-floating:hover {
    transform: translateX(-50%) scale(1.05);
  }
  
  /* ===== CARD STACK FLIP EFFECT ===== */
  .card-stack {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 600px;
    height: 280px;
    transform-style: preserve-3d;
    perspective: 1000px;
    perspective-origin: center center;
    cursor: grab;
    outline: none;
    pointer-events: auto;
    z-index: 100;
  }
  
  .card-stack:active {
    cursor: grabbing;
  }
  
  /* Botones de navegación */
  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
    font-size: 28px;
    font-weight: 300;
    cursor: pointer;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    padding: 0;
    padding-bottom: 3px;
  }
  
  .nav-btn:hover {
    background: rgba(255,255,255,0.35);
    transform: translateY(-50%) scale(1.1);
  }
  
  .nav-prev {
    left: -60px;
  }
  
  .nav-next {
    right: -60px;
  }
  
  .stack-card {
    position: absolute;
    width: 110px;
    height: 150px;
    left: 50%;
    top: 50%;
    margin-left: -55px;
    margin-top: -75px;
    transform-style: preserve-3d;
    transform-origin: center center;
    transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                filter 0.3s ease-out,
                opacity 0.3s ease-out;
    cursor: pointer;
    will-change: transform;
    backface-visibility: hidden;
  }
  
  /* Cards futuras (a la derecha) */
  .stack-card.future {
    transform: 
      translateX(calc(var(--stack-pos) * 120px))
      translateZ(calc(var(--abs-pos) * -80px))
      rotateY(-55deg);
    filter: brightness(calc(1 - var(--abs-pos) * 0.15));
    opacity: calc(1 - var(--abs-pos) * 0.2);
  }
  
  /* Card activa (al frente, centrada) */
  .stack-card.active {
    transform: 
      translateX(0)
      translateZ(100px)
      rotateY(0deg)
      scale(1.1);
    filter: brightness(1);
    z-index: 100;
  }
  
  /* Card expandida al hacer click (solo con click, sin hover) */
  .stack-card.expanded {
    transform: 
      translateX(0)
      translateY(-60px)
      translateZ(200px)
      rotateY(0deg)
      scale(1.8);
    z-index: 200;
  }
  
  /* Texto más pequeño en cards normales */
  .option-text {
    font-size: 11px;
    -webkit-line-clamp: 4;
    line-clamp: 4;
  }
  
  /* En móvil aún más pequeño */
  @media (max-width: 600px) {
    .option-text {
      font-size: 9px;
      -webkit-line-clamp: 4;
      line-clamp: 4;
    }
    
    /* Más texto visible cuando está expandida */
    .stack-card.expanded .option-text {
      font-size: 7px;
      -webkit-line-clamp: 8;
      line-clamp: 8;
    }
  }
  
  /* Cards pasadas (a la izquierda) */
  .stack-card.past {
    transform: 
      translateX(calc(var(--stack-pos) * 120px))
      translateZ(calc(var(--abs-pos) * -80px))
      rotateY(55deg);
    filter: brightness(calc(1 - var(--abs-pos) * 0.15));
    opacity: calc(1 - var(--abs-pos) * 0.2);
    pointer-events: none;
  }
  
  /* Desktop: Cards más grandes */
  @media (min-width: 768px) {
    .card-stack {
      max-width: 900px;
      height: 320px;
      bottom: 30px;
      perspective: 1200px;
    }
    
    .stack-card {
      width: 200px;
      height: 280px;
      margin-left: -100px;
      margin-top: -140px;
    }
    
    .stack-card.future {
      transform: 
        translateX(calc(var(--stack-pos) * 150px))
        translateZ(calc(var(--abs-pos) * -100px))
        rotateY(-55deg);
    }
    
    .stack-card.active {
      transform: 
        translateX(0)
        translateZ(120px)
        rotateY(0deg);
    }
    
    .stack-card.past {
      transform: 
        translateX(calc(var(--stack-pos) * 150px))
        translateZ(calc(var(--abs-pos) * -100px))
        rotateY(55deg);
    }
  }
  
  .card-inner {
    width: 100%;
    height: 100%;
    border-radius: 16px;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    transform-style: preserve-3d;
    box-shadow: 
      0 20px 40px -10px rgba(0,0,0,0.5),
      0 10px 20px -5px rgba(0,0,0,0.3);
  }
  
  .card-color-bg {
    position: absolute;
    inset: 0;
    border-radius: 16px;
  }
  
  .card-gradient-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(0,0,0,0) 0%,
      rgba(0,0,0,0.2) 40%,
      rgba(0,0,0,0.7) 100%
    );
    border-radius: 16px;
    z-index: 2;
  }
  
  .card-content {
    position: relative;
    z-index: 3;
    padding: 12px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  
  .card-border {
    position: absolute;
    inset: 0;
    border-radius: 16px;
    border: 3px solid;
    pointer-events: none;
    z-index: 4;
  }
  
  /* Barras de progreso FIJAS en bottom 0 */
  .progress-bars-fixed {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 3px;
    padding: 8px 16px;
    z-index: 500;
    pointer-events: auto;
  }
  
  .progress-bar {
    flex: 1;
    max-width: 40px;
    height: 4px;
    border-radius: 2px;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    background: rgba(255, 255, 255, 0.3);
    position: relative;
    overflow: hidden;
  }
  
  .progress-bar::after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--bar-color);
    border-radius: 2px;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.3s ease;
  }
  
  .progress-bar:hover {
    background: rgba(255, 255, 255, 0.5);
  }
  
  .progress-bar.past::after {
    transform: scaleX(1);
  }
  
  .progress-bar.active {
    background: rgba(255, 255, 255, 0.5);
  }
  
  .progress-bar.active::after {
    transform: scaleX(1);
    box-shadow: 0 0 8px var(--bar-color);
  }
  
  @keyframes card3DEntry {
    0% {
      opacity: 0;
      transform: 
        translateY(80px)
        translateZ(-100px)
        rotateX(45deg)
        scale(0.6);
    }
    60% {
      opacity: 1;
      transform: 
        translateY(-10px)
        translateZ(20px)
        rotateX(-5deg)
        scale(1.02);
    }
    100% {
      opacity: 1;
      transform: 
        translateY(0)
        translateZ(0)
        rotateX(0)
        scale(1);
    }
  }
  
  .card-bg-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 16px;
    transition: transform 0.4s ease;
    z-index: 1;
  }
  
  .option-text {
    font-size: 12px;
    font-weight: 600;
    color: #ffffff;
    text-shadow: 0 2px 8px rgba(0,0,0,0.8);
    text-align: left;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.3;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  
  /* Cards con imagen tienen texto en la parte inferior */
  .stack-card.has-image .option-text {
    text-shadow: 0 2px 12px rgba(0,0,0,1), 0 1px 4px rgba(0,0,0,0.9);
  }
  
  /* Cards sin imagen tienen texto centrado y más grande */
  .stack-card:not(.has-image) .card-content {
    height: 100%;
    justify-content: center;
    align-items: center;
    padding: 8px;
  }
  
  .stack-card:not(.has-image) .option-text {
    text-align: center;
    font-size: 14px;
    font-weight: 700;
    color: white;
    letter-spacing: 0;
    line-height: 1.2;
    text-shadow: none;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    word-break: break-word;
  }
  
  /* Comillas decorativas para cards de texto - mismo estilo que TrendingCarousel3D */
  .quote-mark {
    position: absolute;
    font-family: Georgia, 'Times New Roman', Times, serif !important;
    font-size: 60px;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.1);
    line-height: 1;
    pointer-events: none;
    z-index: 1;
    font-style: normal;
  }
  
  .quote-open {
    top: -6px;
    left: -2px;
  }
  
  .quote-close {
    bottom: -16px;
    right: -2px;
  }
  
  /* ===== VOTOS IZQUIERDA INCRUSTADO ===== */
  .vote-area {
    position: fixed;
    top: 100px;
    left: 20px;
    z-index: 200;
    pointer-events: auto;
    opacity: 0;
    transition: opacity 0.5s;
  }
  
  .vote-area.visible {
    opacity: 1;
  }
  
  .vote-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: rgba(255,255,255,0.1);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 20px;
    color: rgba(255,255,255,0.9);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.3s ease;
  }
  
  .vote-btn:hover {
    background: rgba(255,255,255,0.2);
  }
  
  .vote-icon {
    font-size: 14px;
  }
  
  .votes-display {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  
  .votes-number {
    font-size: 28px;
    font-weight: 300;
    color: rgba(255,255,255,0.6);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  
  .votes-label {
    font-size: 11px;
    font-weight: 400;
    color: rgba(255,255,255,0.4);
  }
  
  .vote-thanks {
    font-size: 13px;
    font-weight: 600;
    color: #4ade80;
  }
  
  /* ===== LOADING ===== */
  .loading-overlay {
    position: fixed;
    inset: 0;
    background: var(--embed-bg, #0a0a0f);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  /* ===== RESPONSIVE ===== */
  @media (max-width: 600px) {
    .header-area {
      padding: 12px 14px;
    }
    
    .logo-img {
      height: 28px;
    }
    
    .poll-title {
      font-size: 14px;
    }
    
    .creator-avatar, .creator-avatar-placeholder {
      width: 20px;
      height: 20px;
    }
    
    .creator-name {
      font-size: 11px;
    }
    
    .deck-card {
      width: 130px;
      height: 170px;
      margin: 0 -25px;
    }
    
    .option-text {
      font-size: 13px;
      padding: 14px;
    }
    
    .quote-open, .quote-close {
      font-size: 36px;
    }
    
    .cards-deck {
      bottom: 90px;
    }
    
    .vote-btn {
      padding: 12px 30px;
      font-size: 14px;
    }
  }
  
  @media (max-width: 400px) {
    .deck-card {
      width: 110px;
      height: 150px;
      margin: 0 -20px;
    }
    
    .option-text {
      font-size: 12px;
      padding: 10px;
    }
  }
  
  /* ===== ORIENTACIÓN VERTICAL (más alto que ancho) ===== */
  @media (max-aspect-ratio: 3/4) {
    .card-stack {
      height: 220px;
    }
    
    .stack-card {
      width: 120px;
      height: 165px;
      margin-left: -60px;
      margin-top: -82px;
    }
    
    .option-text {
      font-size: 14px;
    }
  }
  
  /* Muy vertical (tipo story) */
  @media (max-aspect-ratio: 1/2) {
    .card-stack {
      height: 260px;
    }
    
    .stack-card {
      width: 130px;
      height: 180px;
      margin-left: -65px;
      margin-top: -90px;
    }
    
    .option-text {
      font-size: 15px;
    }
  }
  
  /* ===== ORIENTACIÓN HORIZONTAL (más ancho que alto) ===== */
  @media (min-aspect-ratio: 4/3) {
    .card-stack {
      height: 200px;
      bottom: 10px;
    }
    
    .stack-card {
      width: 130px;
      height: 170px;
      margin-left: -65px;
      margin-top: -85px;
    }
    
    .option-text {
      font-size: 13px;
      padding: 10px;
    }
    
    .nav-btn {
      width: 36px;
      height: 36px;
      font-size: 22px;
    }
    
    .nav-prev { left: -45px; }
    .nav-next { right: -45px; }
  }
  
  /* Muy horizontal (tipo banner) */
  @media (min-aspect-ratio: 2/1) {
    .card-stack {
      height: 160px;
      bottom: 5px;
    }
    
    .stack-card {
      width: 100px;
      height: 130px;
      margin-left: -50px;
      margin-top: -65px;
    }
    
    .option-text {
      font-size: 11px;
      padding: 8px;
      -webkit-line-clamp: 3;
      line-clamp: 3;
    }
    
    .header-top {
      padding: 8px 12px;
    }
    
    .question {
      font-size: 14px;
    }
  }
</style>
