<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { markImageFailed, hasImageFailed, shouldRetryImage } from '$lib/stores/failed-images-store';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let options: any[] = [];
  export let activeIndex: number = 0;
  export let isTrendingMode: boolean = true; // true = solo colores, false = con thumbnails
  export let externalThumbnailsCache: Record<string, string> = {}; // Cache externo para persistir thumbnails
  
  // Estado local - inicializar desde cache externo
  let thumbnails: Record<string, string> = { ...externalThumbnailsCache };
  let startX = 0;
  let startY = 0;
  let isAnimating = false;
  
  $: totalCards = options?.length || 0;
  
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
  
  // Cargar thumbnails cuando cambian las opciones (solo si NO es modo trending)
  async function loadThumbnails() {
    if (isTrendingMode) return;
    
    console.log('[TrendingCarousel3D] Cargando thumbnails, isTrendingMode:', isTrendingMode);
    console.log('[TrendingCarousel3D] Options:', options.map(o => ({ key: o.key, label: o.label, imageUrl: o.imageUrl, url: o.url })));
    console.log('[TrendingCarousel3D] Cache externo:', Object.keys(externalThumbnailsCache));
    
    for (const option of options) {
      // Si ya está en cache (externo o local), no volver a cargar
      if (thumbnails[option.key]) {
        console.log('[TrendingCarousel3D] Opción', option.key, 'ya en cache:', thumbnails[option.key]);
        continue;
      }
      
      // Buscar URL en: imageUrl, url, o extraer del texto (label)
      let url = option.imageUrl || option.url || extractUrlFromText(option.label);
      console.log('[TrendingCarousel3D] Opción', option.key, 'URL encontrada:', url);
      
      if (url && isDirectImage(url)) {
        // Es imagen directa, usar directamente
        thumbnails[option.key] = url;
        thumbnails = thumbnails;
        // Notificar al padre para actualizar cache externo
        dispatch('thumbnailLoaded', { key: option.key, url });
        console.log('[TrendingCarousel3D] Imagen directa:', url);
      } else if (url && canHaveThumbnail(url)) {
        // Es URL que puede tener thumbnail, obtenerlo de la API
        const thumb = await fetchThumbnail(url);
        if (thumb) {
          thumbnails[option.key] = thumb;
          thumbnails = thumbnails;
          // Notificar al padre para actualizar cache externo
          dispatch('thumbnailLoaded', { key: option.key, url: thumb });
        }
      }
    }
  }
  
  // Recargar thumbnails cuando cambian options o isTrendingMode
  $: if (options && options.length > 0 && !isTrendingMode) {
    loadThumbnails();
  }
  
  onMount(() => {
    loadThumbnails();
  });
  
  // Obtener thumbnail para una opción (solo en modo encuesta activa)
  // NO devuelve URLs que han fallado 3+ veces para evitar loops
  function getCardImage(option: any): string | null {
    if (isTrendingMode) return null; // En trending no mostramos imágenes
    
    // Verificar thumbnail en cache - solo si no ha fallado permanentemente
    const cachedThumb = thumbnails[option.key];
    if (cachedThumb && shouldRetryImage(cachedThumb)) return cachedThumb;
    
    // Verificar imageUrl directa - solo si no ha fallado permanentemente
    if (option.imageUrl && isDirectImage(option.imageUrl) && shouldRetryImage(option.imageUrl)) {
      return option.imageUrl;
    }
    
    return null;
  }
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
    {#each options as option, i (option.key || i)}
      {@const pos = cardPositions[i]}
      {@const cardImage = getCardImage(option)}
      {@const hasImage = !!cardImage}
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
            src={cardImage} 
            alt="" 
            class="card-bg-image" 
            loading="lazy"
            onerror={(e: Event) => { 
              if (e.target) {
                (e.target as HTMLImageElement).style.display = 'none';
                markImageFailed(cardImage || '');
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
            <span class="card-votes">{option.displayText || '0 votos'}</span>
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
            <span class="card-votes">{option.displayText || '0 votos'}</span>
          </div>
        {/if}
      </button>
    {/each}
  </div>
  
  <!-- Botones de navegación -->
  <button class="nav-btn nav-prev" onclick={(e: MouseEvent) => { e.stopPropagation(); prevCard(); }} aria-label="Anterior" type="button">‹</button>
  <button class="nav-btn nav-next" onclick={(e: MouseEvent) => { e.stopPropagation(); nextCard(); }} aria-label="Siguiente" type="button">›</button>
  
  <!-- Indicadores de posición estilo oEmbed -->
  <div class="carousel-indicators">
    {#each options as option, i}
      <button 
        class="progress-bar" 
        class:active={i === activeIndex}
        class:past={i < activeIndex}
        style="--bar-color: {option.color};"
        onclick={(e: MouseEvent) => { e.stopPropagation(); activeIndex = i; dispatch('indexChange', { index: i }); }}
        type="button"
        aria-label="Ir a opción {i + 1}"
      ></button>
    {/each}
  </div>
</div>

<style>
  .carousel-container {
    position: relative;
    width: 100%;
    height: 180px;
    perspective: 800px;
    overflow: visible;
    touch-action: pan-y pinch-zoom;
    outline: none;
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
    width: 130px;
    height: 130px;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    transform-style: preserve-3d;
    cursor: pointer;
    border-radius: 12px;
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
  
  /* Indicadores estilo oEmbed con colores */
  .carousel-indicators {
    position: absolute;
    bottom: -12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 3px;
    z-index: 200;
    width: 90%;
    max-width: 250px;
  }
  
  .progress-bar {
    flex: 1;
    max-width: 40px;
    height: 4px;
    border-radius: 2px;
    border: none;
    cursor: pointer;
    padding: 0;
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
  
  /* Responsive */
  @media (max-width: 600px) {
    .carousel-container {
      height: 140px;
    }
    
    .carousel-card {
      width: 110px;
      height: 110px;
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
