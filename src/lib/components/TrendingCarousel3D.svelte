<script lang="ts">
  import { createEventDispatcher, onMount, afterUpdate, tick } from 'svelte';
  import { markImageFailed, hasImageFailed, shouldRetryImage } from '$lib/stores/failed-images-store';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let options: any[] = [];
  export let activeIndex: number = 0;
  export let isTrendingMode: boolean = true; // true = solo colores, false = con thumbnails
  export let externalThumbnailsCache: Record<string, string> = {}; // Cache externo para persistir thumbnails
  export let hasVoted: boolean = false; // Si el usuario ha votado
  export let totalVotes: number = 0; // Total de votos para calcular porcentajes
  
  // Estado local - inicializar desde cache externo
  let thumbnails: Record<string, string> = { ...externalThumbnailsCache };
  let startX = 0;
  let startY = 0;
  let isAnimating = false;
  let loadingKeys = new Set<string>(); // Track qué keys están cargando
  
  // Sincronizar cache externo cuando cambia
  $: {
    if (externalThumbnailsCache && Object.keys(externalThumbnailsCache).length > 0) {
      thumbnails = { ...thumbnails, ...externalThumbnailsCache };
    }
  }
  
  $: totalCards = options?.length || 0;
  $: showColorsAndPercentages = isTrendingMode || hasVoted;
  
  // Calcular posiciones de cada card en el stack
  $: cardPositions = options?.map((_: any, i: number) => {
    let diff = i - activeIndex;
    if (totalCards > 0) {
      if (diff > totalCards / 2) diff -= totalCards;
      if (diff < -totalCards / 2) diff += totalCards;
    }
    return diff;
  }) || [];
  
  function nextCard() {
    if (isAnimating || totalCards === 0) return;
    isAnimating = true;
    activeIndex = (activeIndex + 1) % totalCards;
    dispatch('indexChange', { index: activeIndex });
    setTimeout(() => isAnimating = false, 400);
  }
  
  function prevCard() {
    if (isAnimating || totalCards === 0) return;
    isAnimating = true;
    activeIndex = (activeIndex - 1 + totalCards) % totalCards;
    dispatch('indexChange', { index: activeIndex });
    setTimeout(() => isAnimating = false, 400);
  }
  
  // Variables para detectar dirección del gesto
  let gestureDirection: 'horizontal' | 'vertical' | null = null;
  
  function handleTouchStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    gestureDirection = null; // Reset al iniciar
  }
  
  function handleTouchMove(e: TouchEvent) {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = Math.abs(currentX - startX);
    const deltaY = Math.abs(currentY - startY);
    
    // Detectar dirección en el primer movimiento significativo
    if (!gestureDirection && (deltaX > 10 || deltaY > 10)) {
      gestureDirection = deltaX > deltaY ? 'horizontal' : 'vertical';
    }
    
    // Solo prevenir scroll si es gesto horizontal (para cambiar cards)
    // Si es vertical, dejar que pase al BottomSheet
    if (gestureDirection === 'horizontal' && deltaX > 10) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
  
  function handleTouchEnd(e: TouchEvent) {
    const endX = e.changedTouches[0].clientX;
    const deltaX = endX - startX;
    
    // Solo procesar si fue un gesto horizontal
    if (gestureDirection === 'horizontal' && Math.abs(deltaX) > 30) {
      if (deltaX < 0) {
        nextCard();
      } else {
        prevCard();
      }
    }
    
    gestureDirection = null;
  }
  
  function handleWheel(e: WheelEvent) {
    // Solo responder a scroll horizontal, dejar vertical para el BottomSheet
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 20) {
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaX > 0) nextCard();
      else prevCard();
    }
    // Si es scroll vertical, no hacer nada - dejar que pase al BottomSheet
  }
  
  function handleCardClick(index: number, option: any) {
    if (cardPositions[index] === 0) {
      // Card activa - abrir la encuesta
      dispatch('selectPoll', { option, index });
    } else {
      // Card no activa - navegar a ella
      activeIndex = index;
      dispatch('indexChange', { index: activeIndex });
    }
  }
  
  function handleCardDoubleClick(index: number, option: any) {
    // Doble click - expandir BottomSheet
    dispatch('requestExpand');
  }
  
  // Verificar si es imagen directa
  function isDirectImage(url: string): boolean {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url);
  }
  
  // Verificar si es una URL válida que puede tener thumbnail
  function canHaveThumbnail(url: string): boolean {
    if (!url) return false;
    // Si es imagen directa, no necesita fetch
    if (isDirectImage(url)) return false;
    // Cualquier URL http/https puede tener thumbnail
    return /^https?:\/\//i.test(url);
  }
  
  // Obtener thumbnail desde la API
  async function fetchThumbnail(url: string): Promise<string | null> {
    try {
      console.log('[TrendingCarousel3D] 📡 Fetching thumbnail for:', url);
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result;
        const thumb = data.imageProxied || data.image || data.thumbnailUrl || data.thumbnail_url;
        if (thumb) {
          console.log('[TrendingCarousel3D] ✅ Thumbnail found:', thumb);
          return thumb;
        }
        console.log('[TrendingCarousel3D] ⚠️ No thumbnail in response');
      } else {
        console.warn('[TrendingCarousel3D] ❌ link-preview failed:', response.status);
      }
    } catch (err) {
      console.warn('[TrendingCarousel3D] Error fetching thumbnail:', err);
    }
    return null;
  }
  
  // Extraer URL del texto de una opción
  function extractUrlFromText(text: string): string | null {
    if (!text) return null;
    const urlMatch = text.match(/https?:\/\/[^\s]+/i);
    return urlMatch ? urlMatch[0] : null;
  }
  
  // Limpiar URL del texto para mostrar solo el título
  function cleanTextFromUrl(text: string): string {
    if (!text) return '';
    return text.replace(/https?:\/\/[^\s]+/gi, '').trim() || text;
  }
  
  // Cargar thumbnail para una opción específica
  async function loadThumbnailForOption(option: any) {
    if (!option?.key) {
      console.log('[TrendingCarousel3D] ⚠️ Opción sin key:', option);
      return;
    }
    if (thumbnails[option.key]) {
      console.log('[TrendingCarousel3D] ✅ Ya en cache:', option.key);
      return;
    }
    if (loadingKeys.has(option.key)) {
      console.log('[TrendingCarousel3D] ⏳ Ya cargando:', option.key);
      return;
    }
    
    const url = option.imageUrl || option.url || extractUrlFromText(option.label);
    console.log('[TrendingCarousel3D] 🔗 URL para', option.key, ':', url);
    if (!url) {
      console.log('[TrendingCarousel3D] ❌ Sin URL para:', option.key, 'label:', option.label);
      return;
    }
    
    if (isDirectImage(url)) {
      thumbnails[option.key] = url;
      thumbnails = { ...thumbnails };
      dispatch('thumbnailLoaded', { key: option.key, url });
      preloadImage(url);
      return;
    }
    
    if (!canHaveThumbnail(url)) return;
    
    // Marcar como cargando
    loadingKeys.add(option.key);
    
    try {
      const thumb = await fetchThumbnail(url);
      if (thumb) {
        thumbnails[option.key] = thumb;
        thumbnails = { ...thumbnails };
        forceUpdateCounter++; // Forzar re-render
        dispatch('thumbnailLoaded', { key: option.key, url: thumb });
        preloadImage(thumb);
      }
    } finally {
      loadingKeys.delete(option.key);
    }
  }
  
  // Cargar thumbnails cuando cambian las opciones (solo si NO es modo trending)
  function loadThumbnails() {
    if (isTrendingMode) {
      console.log('[TrendingCarousel3D] 🚫 Modo trending, no cargar thumbnails');
      return;
    }
    if (!options || options.length === 0) {
      console.log('[TrendingCarousel3D] 🚫 Sin opciones');
      return;
    }
    
    console.log('[TrendingCarousel3D] 🚀 Iniciando carga de thumbnails para', options.length, 'opciones');
    console.log('[TrendingCarousel3D] 📊 Opciones:', options.map(o => ({ key: o.key, imageUrl: o.imageUrl, label: o.label?.substring(0, 30) })));
    
    // Cargar cada opción de forma independiente en paralelo
    options.forEach(option => loadThumbnailForOption(option));
  }
  
  // Precargar imagen para que esté lista cuando se muestre
  function preloadImage(url: string) {
    if (!url) return;
    const img = new Image();
    img.src = url;
  }
  
  // Forzar carga cuando cambian las opciones
  let lastOptionsKey = '';
  $: {
    const newKey = options?.map(o => o.key).join(',') || '';
    if (newKey !== lastOptionsKey) {
      lastOptionsKey = newKey;
      if (!isTrendingMode && options?.length > 0) {
        console.log('[TrendingCarousel3D] 🔄 Opciones cambiaron, cargando thumbnails...');
        // Usar tick para asegurar que el estado esté actualizado
        tick().then(() => loadThumbnails());
      }
    }
  }
  
  // También disparar cuando isTrendingMode cambia a false
  let prevTrendingMode = isTrendingMode;
  $: {
    if (prevTrendingMode !== isTrendingMode) {
      prevTrendingMode = isTrendingMode;
      if (!isTrendingMode && options?.length > 0) {
        console.log('[TrendingCarousel3D] 🔄 Modo cambiado a encuesta, cargando thumbnails...');
        tick().then(() => loadThumbnails());
      }
    }
  }
  
  onMount(() => {
    console.log('[TrendingCarousel3D] 🚀 onMount - isTrendingMode:', isTrendingMode, 'options:', options?.length);
    if (!isTrendingMode && options?.length > 0) {
      loadThumbnails();
    }
  });
  
  // Usar afterUpdate como respaldo para asegurar que se carguen
  let hasLoadedOnce = false;
  afterUpdate(() => {
    if (!isTrendingMode && options?.length > 0 && !hasLoadedOnce) {
      const needsLoad = options.some(opt => !thumbnails[opt.key] && (opt.imageUrl || opt.url || extractUrlFromText(opt.label)));
      if (needsLoad) {
        console.log('[TrendingCarousel3D] 🔄 afterUpdate - cargando thumbnails faltantes...');
        loadThumbnails();
        hasLoadedOnce = true;
      }
    }
    // Reset hasLoadedOnce cuando cambian las opciones
    if (lastOptionsKey !== options?.map(o => o.key).join(',')) {
      hasLoadedOnce = false;
    }
  });
  
  // Combinar opciones con thumbnails/imageUrl en un array reactivo
  // Depende de: options, isTrendingMode, thumbnails
  $: optionsWithImages = (options || []).map(option => {
    if (isTrendingMode) {
      return { ...option, cardImage: null };
    }
    // Priorizar imageUrl directa, luego thumbnail cargado
    const cardImage = option.imageUrl || thumbnails[option.key] || null;
    return { ...option, cardImage };
  });
</script>

<!-- Carrusel 3D de Cards de Trending -->
<div 
  class="carousel-container"
  onwheel={(e: WheelEvent) => { e.preventDefault(); e.stopPropagation(); handleWheel(e); }}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  onkeydown={(e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') prevCard();
    if (e.key === 'ArrowRight') nextCard();
  }}
  role="listbox"
  tabindex="0"
>
  <div class="carousel-3d">
    {#each optionsWithImages as option, i (option.key || i)}
      {@const pos = cardPositions[i]}
      {@const hasImage = !!option.cardImage}
      <button
        class="carousel-card"
        class:active={pos === 0}
        class:past={pos < 0}
        class:future={pos > 0}
        class:has-image={hasImage}
        style="--stack-pos: {pos}; --abs-pos: {Math.abs(pos)}; --card-color: {option.color}; border-color: {option.color}; {!hasImage ? `background: ${option.color};` : ''}"
        onclick={(e: MouseEvent) => { e.stopPropagation(); handleCardClick(i, option); }}
        ondblclick={(e: MouseEvent) => { e.stopPropagation(); handleCardDoubleClick(i, option); }}
        type="button"
      >
        {#if hasImage}
          <!-- Modo con imagen de fondo -->
          <img 
            src={option.cardImage} 
            alt="" 
            class="card-bg-image" 
            loading={pos === 0 ? 'eager' : 'lazy'}
            decoding="async"
            fetchpriority={pos === 0 ? 'high' : 'low'}
            onerror={(e: Event) => { 
              if (e.target) {
                (e.target as HTMLImageElement).style.display = 'none';
                markImageFailed(option.cardImage || '');
              }
            }}
          />
          <div class="card-gradient-overlay"></div>
          
          <!-- Avatar badge (solo en trending con imagen) -->
          {#if isTrendingMode}
            <div class="avatar-badge">
              {#if option.pollData?.user?.avatarUrl && shouldRetryImage(option.pollData.user.avatarUrl)}
                <img 
                  src={option.pollData.user.avatarUrl} 
                  alt="" 
                  class="avatar-img"
                  onerror={(e: Event) => { 
                    if (e.target) {
                      (e.target as HTMLImageElement).style.display = 'none';
                      markImageFailed(option.pollData?.user?.avatarUrl || '');
                    }
                  }}
                />
              {:else if option.pollData?.creator?.avatarUrl && shouldRetryImage(option.pollData.creator.avatarUrl)}
                <img 
                  src={option.pollData.creator.avatarUrl} 
                  alt="" 
                  class="avatar-img"
                  onerror={(e: Event) => { 
                    if (e.target) {
                      (e.target as HTMLImageElement).style.display = 'none';
                      markImageFailed(option.pollData?.creator?.avatarUrl || '');
                    }
                  }}
                />
              {:else}
                <div class="avatar-placeholder">
                  {option.label?.charAt(0) || '?'}
                </div>
              {/if}
            </div>
          {/if}
          
          <!-- Contenido con imagen -->
          <div class="card-content with-image">
            <span class="card-title">{cleanTextFromUrl(option.label) || 'Sin título'}</span>
            <span class="card-votes">{option.displayText || '0%'}</span>
          </div>
        {:else}
          <!-- Modo texto: comillas decorativas -->
          <span class="quote-decoration quote-open">“</span>
          <span class="quote-decoration quote-close">”</span>
          
          <!-- Contenido texto centrado -->
          <div class="card-text-center">
            <span class="card-title-text">{cleanTextFromUrl(option.label) || 'Sin título'}</span>
          </div>
          
          <!-- Votos en la parte inferior (mismo estilo que con imagen) -->
          <div class="card-content with-image">
            <span class="card-votes">{option.displayText || '0%'}</span>
          </div>
        {/if}
      </button>
    {/each}
  </div>
  
  <!-- Botones de navegación -->
  <button class="nav-btn nav-prev" onclick={(e: MouseEvent) => { e.stopPropagation(); prevCard(); }} aria-label="Anterior" type="button">‹</button>
  <button class="nav-btn nav-next" onclick={(e: MouseEvent) => { e.stopPropagation(); nextCard(); }} aria-label="Siguiente" type="button">›</button>
  
  <!-- Indicadores de posición estilo PollMaximizedView -->
  <div class="carousel-indicators" class:show-colors={showColorsAndPercentages}>
    {#each options as option, i}
      {@const isActive = i === activeIndex}
      {@const flexWeight = showColorsAndPercentages ? Math.max(option.pct || option.votes || 1, 2) : 1}
      <button 
        class="progress-bar" 
        class:active={isActive}
        class:past={i < activeIndex}
        style="flex: {flexWeight} 1 0%; --bar-color: {option.color}; opacity: {isActive ? 1 : (showColorsAndPercentages ? 0.5 : 0.6)}; transform: {isActive ? 'scaleY(1.4)' : 'scaleY(1)'};"
        onclick={(e: MouseEvent) => { e.stopPropagation(); activeIndex = i; dispatch('indexChange', { index: i }); }}
        type="button"
        aria-label="Ir a opción {i + 1}"
      >
        <span 
          class="progress-fill"
          style="width: 100%; background-color: {showColorsAndPercentages ? option.color : (isActive ? '#fff' : 'rgba(255, 255, 255, 0.3)')};"
        ></span>
      </button>
    {/each}
  </div>
</div>

<style>
  .carousel-container {
    position: relative;
    width: 100%;
    height: 12em; /* ~192px, usando em para escalar con fuente */
    padding-bottom: 1.5em; /* Espacio para indicadores */
    perspective: 800px;
    overflow: visible; /* Permitir que el contenido sea visible */
    touch-action: pan-y pinch-zoom;
    outline: none;
    box-sizing: border-box;
  }
  
  .carousel-3d {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .carousel-card {
    position: absolute;
    width: 8.125em; /* ~130px */
    height: 8.125em;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    transform-style: preserve-3d;
    cursor: pointer;
    border-radius: 0.75em;
    overflow: hidden;
    border: 2px solid;
    padding: 10px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  
  /* Cards futuras (a la derecha) */
  .carousel-card.future {
    transform: 
      translateX(calc(var(--stack-pos) * 90px))
      translateZ(calc(var(--abs-pos) * -50px))
      rotateY(-35deg);
    filter: brightness(calc(1 - var(--abs-pos) * 0.15));
  }
  
  /* Card activa (al centro) - SIN opacidad */
  .carousel-card.active {
    transform: 
      translateX(0)
      translateZ(60px)
      rotateY(0deg)
      scale(1.1);
    filter: brightness(1);
    z-index: 100;
    opacity: 1;
  }
  
  /* Cards pasadas (a la izquierda) */
  .carousel-card.past {
    transform: 
      translateX(calc(var(--stack-pos) * 90px))
      translateZ(calc(var(--abs-pos) * -50px))
      rotateY(35deg);
    filter: brightness(calc(1 - var(--abs-pos) * 0.15));
  }
  
  /* Cards con imagen de fondo */
  .carousel-card.has-image {
    padding: 0;
    justify-content: flex-end;
    align-items: stretch;
  }
  
  .card-bg-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 10px;
  }
  
  .card-gradient-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      rgba(0,0,0,0.9) 0%,
      rgba(0,0,0,0.5) 40%,
      transparent 100%
    );
    border-radius: 10px;
  }
  
  /* Comillas decorativas estilo oEmbed/PollMaximizedView */
  .quote-decoration {
    position: absolute;
    font-size: 60px;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.1);
    line-height: 1;
    pointer-events: none;
    font-family: Georgia, serif;
    z-index: 1;
  }
  
  .quote-open {
    top: -6px;
    left: -2px;
  }
  
  .quote-close {
    bottom: -16px;
    right: -2px;
  }
  
  .card-content.with-image {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 10;
    padding: 8px;
    text-align: left;
    align-items: flex-start;
  }
  
  .avatar-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(255,255,255,0.9);
    z-index: 10;
    background: rgba(0,0,0,0.3);
  }
  
  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 11px;
    font-weight: bold;
    background: rgba(0,0,0,0.3);
  }
  
  .card-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
  }
  
  .card-title {
    font-size: 12px;
    font-weight: 600;
    color: #ffffff;
    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.3;
  }
  
  .card-votes {
    font-size: 10px;
    color: rgba(255,255,255,0.9);
    text-shadow: 0 1px 2px rgba(0,0,0,0.4);
    margin-top: auto;
  }
  
  /* === Estilos para cards de solo texto === */
  .card-text-center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    z-index: 2;
  }
  
  .card-title-text {
    font-size: 14px;
    font-weight: 700;
    color: white;
    letter-spacing: 0;
    line-height: 1.2;
    text-align: center;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }
  
  /* Botones de navegación - mismo estilo que oEmbed */
  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    font-size: 18px;
    font-weight: 300;
    cursor: pointer;
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    padding: 0;
    padding-bottom: 2px;
  }
  
  .nav-btn:hover {
    background: rgba(255, 255, 255, 0.35);
    transform: translateY(-50%) scale(1.1);
  }
  
  .nav-prev {
    left: 4px;
  }
  
  .nav-next {
    right: 4px;
  }
  
  /* Indicadores estilo PollMaximizedView */
  .carousel-indicators {
    position: absolute;
    bottom: 0; /* Dentro del contenedor, no fuera */
    left: 0;
    right: 0;
    display: flex;
    gap: 0.2em;
    z-index: 200;
    width: 100%;
    padding: 0 0.5em;
    box-sizing: border-box;
  }
  
  .progress-bar {
    height: 0.375em; /* 6px */
    border-radius: 0.1875em;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: rgba(255, 255, 255, 0.15);
    position: relative;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .progress-fill {
    display: block;
    height: 100%;
    border-radius: 3px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .progress-bar:hover {
    opacity: 0.85 !important;
  }
  
  .progress-bar.active {
    box-shadow: 0 2px 6px rgba(255, 255, 255, 0.2);
  }
  
  /* Responsive */
  @media (max-width: 600px) {
    .carousel-container {
      height: 10em; /* ~160px en móvil */
      padding-bottom: 1.1em;
    }
    
    .carousel-card {
      width: 7em;
      height: 7em;
    }
    
    .carousel-card.future,
    .carousel-card.past {
      transform: 
        translateX(calc(var(--stack-pos) * 70px))
        translateZ(calc(var(--abs-pos) * -40px))
        rotateY(calc(var(--stack-pos) * -25deg));
    }
    
    .card-title {
      font-size: 10px;
    }
  }
</style>
