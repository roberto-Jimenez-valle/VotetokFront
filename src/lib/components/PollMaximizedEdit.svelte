<script lang="ts">
  import { X, Sparkles, Trash2, CircleCheck, Loader2, Plus, Minimize2, Ban, Palette, ThumbsUp, ThumbsDown, Check } from "lucide-svelte";
  import { fade, fly } from "svelte/transition";
  import { onMount } from "svelte";
  import MediaEmbed from "./MediaEmbed.svelte";
  import { openFullscreenIframe } from '$lib/stores/globalState';

  // --- INTERFACES ---
  interface PollOption {
    id: string;
    label: string;
    color: string;
    imageUrl?: string;
    isYesNo?: boolean;
    isCorrect?: boolean;
    yesText?: string;
    noText?: string;
    correctAnswer?: 'yes' | 'no';
  }

  interface Props {
    options: PollOption[];
    activeOptionId: string;
    pollTitle: string;
    onClose: () => void;
    onOptionChange: (optionId: string) => void;
    onTitleChange: (title: string) => void;
    onLabelChange: (optionId: string, newLabel: string) => void;
    onOpenColorPicker: (optionId: string) => void;
    onOpenGiphyPicker: (optionId: string) => void;
    onRemoveMedia: (optionId: string) => void;
    onRemoveOption: (optionId: string) => void;
    onToggleYesNo?: (optionId: string) => void;
    onToggleCorrect?: (optionId: string, answer?: 'yes' | 'no') => void;
    onYesNoTextChange?: (optionId: string, yesText: string, noText: string) => void;
    extractUrlFromText: (text: string) => string | null;
    getLabelWithoutUrl: (label: string) => string;
    // Tipo de encuesta
    pollType?: string;
    pollTypes?: readonly { id: string; label: string; icon: string }[];
    onChangePollType?: (type: string) => void;
    onOpenTypeOptionsModal?: () => void;
    // Acciones adicionales
    onAddOption?: () => void;
    onAnimateCards?: () => void;
    isAnimatingCards?: boolean;
    canAddOption?: boolean;
    canAnimateCards?: boolean;
    // Info de encuesta
    totalOptions?: number;
    duration?: string;
    onDurationChange?: (value: string) => void;
    durations?: readonly { value: string; label: string }[];
    // Publicar
    onPublish?: () => void;
    canPublish?: boolean;
  }

  let {
    options = $bindable(),
    activeOptionId = $bindable(),
    pollTitle,
    onClose,
    onOptionChange,
    onTitleChange,
    onLabelChange,
    onOpenColorPicker,
    onOpenGiphyPicker,
    onRemoveMedia,
    onRemoveOption,
    onToggleYesNo,
    onToggleCorrect,
    onYesNoTextChange,
    extractUrlFromText,
    getLabelWithoutUrl,
    pollType = 'single',
    pollTypes = [],
    onChangePollType,
    onOpenTypeOptionsModal,
    onAddOption,
    onAnimateCards,
    isAnimatingCards = false,
    canAddOption = true,
    canAnimateCards = false,
    totalOptions = 0,
    duration = 'never',
    onDurationChange,
    durations = [],
    onPublish,
    canPublish = false,
  }: Props = $props();
  
  // Estado para dropdowns
  let showOptionsDropdown = $state(false);
  let showDurationDropdown = $state(false);
  let showCustomDatePicker = $state(false);
  let customEndDate = $state('');
  let customEndTime = $state('23:59');
  let draggedOptionIndex = $state<number | null>(null);
  let dragOverOptionIndex = $state<number | null>(null);
  
  // Funciones para fecha personalizada
  function getMinDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }
  
  function formatCustomDate(dateStr: string, timeStr: string): string {
    if (!dateStr) return '';
    const date = new Date(`${dateStr}T${timeStr}`);
    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  function applyCustomDate() {
    if (customEndDate) {
      onDurationChange?.(`custom:${customEndDate}T${customEndTime}`);
      showCustomDatePicker = false;
      showDurationDropdown = false;
    }
  }
  
  function isCustomDuration(dur: string): boolean {
    return dur?.startsWith('custom:') || false;
  }
  
  function getDurationLabel(dur: string): string {
    if (isCustomDuration(dur)) {
      const dateTime = dur.replace('custom:', '');
      const date = new Date(dateTime);
      return date.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return durations.find(d => d.value === dur)?.label || 'Sin límite';
  }
  
  // Funciones para drag and drop de opciones
  function handleOptionDragStart(e: DragEvent, index: number) {
    draggedOptionIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  }
  
  function handleOptionDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (draggedOptionIndex !== null && draggedOptionIndex !== index) {
      dragOverOptionIndex = index;
    }
  }
  
  function handleOptionDragLeave() {
    dragOverOptionIndex = null;
  }
  
  function handleOptionDrop(e: DragEvent, dropIndex: number) {
    e.preventDefault();
    if (draggedOptionIndex !== null && draggedOptionIndex !== dropIndex) {
      // Reordenar opciones
      const newOptions = [...options];
      const [draggedItem] = newOptions.splice(draggedOptionIndex, 1);
      newOptions.splice(dropIndex, 0, draggedItem);
      options = newOptions;
      
      // Actualizar opción activa si es necesario
      if (activeOptionId === options[draggedOptionIndex]?.id) {
        // La opción arrastrada era la activa, actualizar
      }
    }
    draggedOptionIndex = null;
    dragOverOptionIndex = null;
  }
  
  function handleOptionDragEnd() {
    draggedOptionIndex = null;
    dragOverOptionIndex = null;
  }
  
  // Extraer ID de YouTube de una URL (incluye Shorts)
  function getYoutubeId(url: string): string | null {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?\/]+)/,
      /youtube\.com\/shorts\/([^&\s?\/]+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
  
  // Obtener thumbnail de preview para una URL
  function getPreviewThumbnail(url: string): string {
    if (!url) return '';
    
    // YouTube thumbnail - directo sin API
    const ytId = getYoutubeId(url);
    if (ytId) {
      return `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    }
    
    // Vimeo thumbnail
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      return `https://vumbnail.com/${vimeoMatch[1]}.jpg`;
    }
    
    // Spotify - usar imagen genérica con color
    if (url.includes('spotify.com')) {
      return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#1DB954" width="100" height="100"/><circle cx="50" cy="50" r="40" fill="#000" opacity="0.3"/></svg>');
    }
    
    // SoundCloud
    if (url.includes('soundcloud.com')) {
      return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#ff5500" width="100" height="100"/></svg>');
    }
    
    // TikTok
    if (url.includes('tiktok.com')) {
      return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#000000" width="100" height="100"/></svg>');
    }
    
    // Placeholder genérico
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#333" width="100" height="100"/><polygon points="40,30 40,70 70,50" fill="#fff" opacity="0.8"/></svg>');
  }
  
  // Cache de previews obtenidos de la API (para Spotify, SoundCloud, etc.)
  let previewCache = $state<Record<string, { image: string; loading: boolean }>>({});
  
  // Placeholder según plataforma
  function getPlaceholderForPlatform(url: string): string {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('spotify.com')) return 'https://placehold.co/640x360/1DB954/white?text=%E2%99%AB+Spotify';
    if (lowerUrl.includes('soundcloud.com')) return 'https://placehold.co/640x360/ff5500/white?text=%E2%99%AB+SoundCloud';
    if (lowerUrl.includes('tiktok.com')) return 'https://placehold.co/640x360/010101/white?text=%E2%96%B6+TikTok';
    if (lowerUrl.includes('twitch.tv')) return 'https://placehold.co/640x360/9146FF/white?text=%E2%96%B6+Twitch';
    if (lowerUrl.includes('instagram.com')) return 'https://placehold.co/640x360/E1306C/white?text=%F0%9F%93%B7+Instagram';
    if (lowerUrl.includes('music.apple.com')) return 'https://placehold.co/640x360/FC3C44/white?text=%E2%99%AB+Apple+Music';
    if (lowerUrl.includes('deezer.com')) return 'https://placehold.co/640x360/FEAA2D/000000?text=%E2%99%AB+Deezer';
    if (lowerUrl.includes('bandcamp.com')) return 'https://placehold.co/640x360/1DA0C3/white?text=%E2%99%AB+Bandcamp';
    if (lowerUrl.includes('dailymotion.com') || lowerUrl.includes('dai.ly')) return 'https://placehold.co/640x360/0066DC/white?text=%E2%96%B6+Dailymotion';
    return 'https://placehold.co/640x360/1a1a2e/white?text=%E2%96%B6+Reproducir';
  }
  
  // Obtener thumbnail real de la API
  async function fetchPreviewThumbnail(optId: string, url: string) {
    if (!url || !optId) return;
    
    // Si ya está en cache con imagen real, no hacer nada
    if (previewCache[optId]?.image && !previewCache[optId].loading && !previewCache[optId].image.includes('placehold.co')) {
      return;
    }
    
    // Si está cargando, no hacer nada
    if (previewCache[optId]?.loading) return;
    
    // YouTube y Vimeo tienen thumbnails directos, no necesitan API
    const ytId = getYoutubeId(url);
    if (ytId) {
      previewCache = { ...previewCache, [optId]: { image: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`, loading: false } };
      return;
    }
    
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      previewCache = { ...previewCache, [optId]: { image: `https://vumbnail.com/${vimeoMatch[1]}.jpg`, loading: false } };
      return;
    }
    
    // Marcar como cargando
    previewCache = { ...previewCache, [optId]: { image: '', loading: true } };
    
    try {
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result;
        let image = data.imageProxied || data.image || data.thumbnailUrl;
        
        if (!image || image.includes('placehold.co')) {
          image = getPlaceholderForPlatform(url);
        }
        
        previewCache = { ...previewCache, [optId]: { image, loading: false } };
      } else {
        previewCache = { ...previewCache, [optId]: { image: getPlaceholderForPlatform(url), loading: false } };
      }
    } catch (error) {
      console.warn('[PollMaximizedEdit] Error fetching preview:', error);
      previewCache = { ...previewCache, [optId]: { image: getPlaceholderForPlatform(url), loading: false } };
    }
  }
  
  // Obtener thumbnail final (cache o placeholder)
  function getFinalThumbnail(optId: string, url: string): string {
    // Primero intentar cache
    if (previewCache[optId]?.image && !previewCache[optId].image.includes('placehold.co')) {
      return previewCache[optId].image;
    }
    
    // Luego intentar directo
    const directThumb = getPreviewThumbnail(url);
    if (directThumb && !directThumb.startsWith('data:')) {
      return directThumb;
    }
    
    // Si está en cache (aunque sea placeholder), usarlo
    if (previewCache[optId]?.image) {
      return previewCache[optId].image;
    }
    
    // Fallback a placeholder
    return getPlaceholderForPlatform(url);
  }

  let activeIndex = $derived(options.findIndex((o) => o.id === activeOptionId));
  let scrollContainer: HTMLElement | null = null;
  let isScrollingProgrammatically = false;
  let prevOptionsLength = $state(options.length);
  
  // Set para evitar fetch duplicados - previene bucle infinito
  const fetchedUrls = new Set<string>();

  // $effect para cargar previews de todas las opciones que tengan URL (embebible o genérico)
  $effect(() => {
    // Solo depender de options, no de previewCache
    const optionsCopy = options.map(o => ({ id: o.id, imageUrl: o.imageUrl, label: o.label }));
    
    for (const opt of optionsCopy) {
      const url = opt.imageUrl || extractUrlFromText(opt.label);
      const cacheKey = `${opt.id}:${url}`;
      
      if (url && !fetchedUrls.has(cacheKey)) {
        fetchedUrls.add(cacheKey);
        // Cargar preview para cualquier URL (embebible o generic-link)
        fetchPreviewThumbnail(opt.id, url);
      }
    }
  });

  // Manejar botón atrás del navegador
  let isClosingViaBack = false;
  
  onMount(() => {
    // Guardar el estado actual antes de pushear el nuevo
    const previousState = history.state;
    const previousUrl = window.location.href;
    history.pushState({ modal: 'maximizedEdit' }, '');
    
    const handlePopState = () => {
      if (isClosingViaBack) return;
      isClosingViaBack = true;
      
      // Restaurar el estado anterior inmediatamente para evitar cascada
      history.pushState(previousState, '', previousUrl);
      
      onClose();
    };
    
    const handleCloseModals = () => {
      if (isClosingViaBack) return;
      // Si se cierra por otro evento (no por back), quitar el estado del historial
      history.back();
    };
    
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('closeModals', handleCloseModals);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('closeModals', handleCloseModals);
    };
  });

  // --- LÓGICA DE SCROLL ---
  function handleScroll() {
    if (isScrollingProgrammatically) return;

    if (scrollContainer) {
      const index = Math.round(scrollContainer.scrollLeft / window.innerWidth);
      if (index !== activeIndex && index >= 0 && index < options.length) {
        onOptionChange(options[index].id);
      }
    }
  }

  function scrollToOption(index: number) {
    if (scrollContainer) {
      isScrollingProgrammatically = true;
      scrollContainer.scrollTo({
        left: index * window.innerWidth,
        behavior: "smooth",
      });
      setTimeout(() => {
        isScrollingProgrammatically = false;
      }, 500);
    }
  }

  // Sincronizar scroll cuando cambia activeOptionId externamente
  $effect(() => {
    if (activeIndex >= 0 && scrollContainer) {
      const currentScrollIndex = Math.round(
        scrollContainer.scrollLeft / window.innerWidth,
      );
      if (currentScrollIndex !== activeIndex) {
        scrollToOption(activeIndex);
      }
    }
  });
  
  // Scroll a la nueva opción cuando se añade una
  $effect(() => {
    if (options.length > prevOptionsLength) {
      // Se añadió una nueva opción, scroll al final
      setTimeout(() => {
        scrollToOption(options.length - 1);
      }, 100);
    }
    prevOptionsLength = options.length;
  });

  // Detectar tipo de media
  type MediaType = "youtube" | "vimeo" | "image" | "text" | "spotify" | "soundcloud" | "tiktok" | "twitch" | "twitter" | "applemusic" | "deezer" | "dailymotion" | "bandcamp" | "generic-link";
  
  function getMediaType(opt: PollOption): MediaType {
    const url = (opt.imageUrl || extractUrlFromText(opt.label) || '').toLowerCase();
    if (!url) return "text";
    // Video platforms
    if (url.includes("youtube.com") || url.includes("youtu.be") || url.includes("music.youtube.com")) return "youtube";
    if (url.includes("vimeo.com")) return "vimeo";
    if (url.includes("tiktok.com") || url.includes("vm.tiktok.com")) return "tiktok";
    if (url.includes("twitch.tv")) return "twitch";
    if (url.includes("dailymotion.com") || url.includes("dai.ly")) return "dailymotion";
    // Social
    if (url.includes("twitter.com") || url.includes("x.com")) return "twitter";
    // Audio platforms
    if (url.includes("spotify.com")) return "spotify";
    if (url.includes("soundcloud.com")) return "soundcloud";
    if (url.includes("music.apple.com")) return "applemusic";
    if (url.includes("deezer.com")) return "deezer";
    if (url.includes("bandcamp.com")) return "bandcamp";
    // Imagen directa o GIF
    if (/\.(jpg|jpeg|png|webp|gif|svg|bmp)([?#]|$)/i.test(url)) return "image";
    if (url.includes('giphy.com') || url.includes('tenor.com')) return "image";
    // Enlace genérico (no plataforma conocida ni imagen directa)
    return "generic-link";
  }
  
  // Detectar si un thumbnail es real (no placeholder)
  function hasRealThumbnail(optId: string, url: string): boolean {
    const thumb = getFinalThumbnail(optId, url);
    if (!thumb) return false;
    if (thumb.includes('placehold.co')) return false;
    if (thumb.includes('placeholder')) return false;
    if (thumb.startsWith('data:image/svg+xml')) return false; // SVGs generados son placeholders
    return true;
  }

  function getMediaUrl(opt: PollOption): string {
    return opt.imageUrl || extractUrlFromText(opt.label) || '';
  }
  
  // Detectar si debemos mostrar el enlace (cualquier URL válida excepto imágenes directas y GIFs)
  function shouldShowLink(url: string | undefined): boolean {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    // Si es una imagen directa, no mostramos enlace
    if (/\.(jpg|jpeg|png|webp|gif|svg|bmp)([?#]|$)/i.test(lowerUrl)) return false;
    // Si es un GIF de GIPHY/Tenor, no mostramos enlace (ya tiene badge GIPHY)
    if (lowerUrl.includes('giphy.com') || lowerUrl.includes('tenor.com')) return false;
    // Para todo lo demás mostramos enlace
    return true;
  }
  
  // Detectar si una URL tiene contenido embebible (plataformas con iframe)
  function hasEmbeddableContent(url: string | undefined): boolean {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return (
      lowerUrl.includes('youtube.com') ||
      lowerUrl.includes('youtu.be') ||
      lowerUrl.includes('vimeo.com') ||
      lowerUrl.includes('spotify.com') ||
      lowerUrl.includes('soundcloud.com') ||
      lowerUrl.includes('tiktok.com') ||
      lowerUrl.includes('twitch.tv') ||
      lowerUrl.includes('dailymotion.com') ||
      lowerUrl.includes('dai.ly') ||
      lowerUrl.includes('music.apple.com') ||
      lowerUrl.includes('deezer.com') ||
      lowerUrl.includes('bandcamp.com') ||
      lowerUrl.includes('ted.com/talks')
    );
  }
  
  // Handler para click en área de media: si no tiene embed, abrir enlace
  function handleMediaClick(url: string | undefined, e: MouseEvent) {
    if (!url) return;
    if (!hasEmbeddableContent(url)) {
      e.stopPropagation();
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
  
  // Obtener hostname de una URL
  function getHostname(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  }
</script>

<div
  class="fixed inset-0 z-[2147483640] w-full h-full flex flex-col overflow-hidden select-none maximized-edit"
>
  <!-- HEADER -->
  <div class="absolute top-0 left-0 w-full z-50 flex flex-col pointer-events-none">
    <!-- DataBar / Indicadores -->
    <div class="w-full px-2 flex gap-0.5 h-1 pointer-events-auto mt-1.5 z-50">
      {#each options as opt, idx}
        {@const isActive = idx === activeIndex}
        <button
          class="h-full transition-all duration-700 ease-out overflow-hidden relative rounded-sm flex-1 cursor-pointer"
          style:background-color={opt.color}
          style:transform={isActive ? "scaleY(1.3)" : "scaleY(1)"}
          style="box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);"
          onclick={() => {
            onOptionChange(opt.id);
            scrollToOption(idx);
          }}
          type="button"
          aria-label="Ir a opción {idx + 1}"
        ></button>
      {/each}
    </div>

    <!-- Título editable -->
    <div class="w-full px-4 py-4 z-40 relative">
      <div class="flex items-start gap-3">
        <textarea
          class="font-serif italic text-xl md:text-2xl leading-tight flex-1 bg-transparent border-none outline-none text-gray-300 placeholder-gray-400 resize-none pointer-events-auto"
          placeholder="¿Cuál es tu pregunta?"
          value={pollTitle}
          oninput={(e) => onTitleChange(e.currentTarget.value)}
          rows="2"
          maxlength="200"
        ></textarea>
        
        <!-- Botón minimizar/volver -->
        <button 
          onclick={onClose}
          class="minimize-btn-header"
          aria-label="Minimizar"
          type="button"
        >
          <Minimize2 size={20} />
        </button>
      </div>
      
      <!-- Info de opciones y tiempo con dropdowns -->
      <div class="poll-meta-info">
        <!-- Dropdown de opciones -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="dropdown-container" onmousedown={(e) => e.stopPropagation()}>
          <button 
            type="button"
            class="meta-dropdown-btn"
            onclick={() => showOptionsDropdown = !showOptionsDropdown}
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>{totalOptions || options.length} opciones</span>
            <svg class="w-3 h-3 chevron-icon {showOptionsDropdown ? 'open' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {#if showOptionsDropdown}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="meta-dropdown options-dropdown-max" transition:fly={{ y: -5, duration: 150 }} onclick={(e) => e.stopPropagation()}>
              <div class="dropdown-header-max">
                <span>Ir a opción</span>
                <span class="drag-hint-max">⋮⋮ Arrastra para ordenar</span>
              </div>
              {#each options as opt, i (opt.id)}
                {@const hasText = opt.label.trim().length > 0}
                {@const hasMedia = opt.imageUrl}
                <div 
                  class="dropdown-option-row-max {draggedOptionIndex === i ? 'dragging' : ''} {dragOverOptionIndex === i ? 'drag-over' : ''}"
                  draggable="true"
                  ondragstart={(e) => handleOptionDragStart(e, i)}
                  ondragover={(e) => handleOptionDragOver(e, i)}
                  ondragleave={handleOptionDragLeave}
                  ondrop={(e) => handleOptionDrop(e, i)}
                  ondragend={handleOptionDragEnd}
                  role="listitem"
                >
                  <!-- Drag handle -->
                  <div class="drag-handle-max">
                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="9" cy="6" r="1.5"/>
                      <circle cx="15" cy="6" r="1.5"/>
                      <circle cx="9" cy="12" r="1.5"/>
                      <circle cx="15" cy="12" r="1.5"/>
                      <circle cx="9" cy="18" r="1.5"/>
                      <circle cx="15" cy="18" r="1.5"/>
                    </svg>
                  </div>
                  <button
                    type="button"
                    class="dropdown-option-max {activeIndex === i ? 'active' : ''} {!hasText && !hasMedia ? 'incomplete' : ''}"
                    onclick={() => {
                      onOptionChange(opt.id);
                      scrollToOption(i);
                      showOptionsDropdown = false;
                    }}
                  >
                    <span class="option-dot-max" style="background-color: {opt.color};"></span>
                    <span class="option-num-max">{i + 1}</span>
                    <span class="option-text-max">{opt.label.trim() || `Opción ${i + 1}`}</span>
                    {#if !hasText && !hasMedia}
                      <svg class="w-3.5 h-3.5 warning-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    {:else if hasMedia}
                      <svg class="w-3 h-3 media-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    {/if}
                  </button>
                  <!-- Botón eliminar (solo si hay más de 2 opciones) -->
                  {#if options.length > 2}
                    <button
                      type="button"
                      class="delete-btn-max"
                      onclick={(e) => {
                        e.stopPropagation();
                        onRemoveOption(opt.id);
                      }}
                      title="Eliminar opción {i + 1}"
                      aria-label="Eliminar opción {i + 1}"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  {/if}
                </div>
              {/each}
              {#if canAddOption}
                <button type="button" class="dropdown-option-max add-btn-max" onclick={() => { onAddOption?.(); }}>
                  <Plus class="w-4 h-4" />
                  <span>Añadir opción</span>
                </button>
              {/if}
            </div>
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="dropdown-backdrop-max" onclick={() => showOptionsDropdown = false}></div>
          {/if}
        </div>
        
        <span class="meta-separator">•</span>
        
        <!-- Dropdown de duración -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="dropdown-container" onmousedown={(e) => e.stopPropagation()}>
          <button 
            type="button"
            class="meta-dropdown-btn"
            onclick={() => { showDurationDropdown = !showDurationDropdown; showCustomDatePicker = false; }}
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{getDurationLabel(duration)}</span>
            <svg class="w-3 h-3 chevron-icon {showDurationDropdown ? 'open' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {#if showDurationDropdown}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="meta-dropdown duration-dropdown-max" transition:fly={{ y: -5, duration: 150 }} onclick={(e) => e.stopPropagation()}>
              <div class="dropdown-header-max">Duración</div>
              
              {#if !showCustomDatePicker}
                {#each durations as dur}
                  <button
                    type="button"
                    class="dropdown-option-max {duration === dur.value ? 'active' : ''}"
                    onclick={() => {
                      onDurationChange?.(dur.value);
                      showDurationDropdown = false;
                    }}
                  >
                    <svg class="w-4 h-4 duration-icon-max" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="duration-text-max">{dur.label}</span>
                    {#if duration === dur.value}
                      <svg class="w-4 h-4 check-icon-max" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    {/if}
                  </button>
                {/each}
                
                <!-- Separador -->
                <div class="dropdown-divider-max"></div>
                
                <!-- Opción de fecha personalizada -->
                <button
                  type="button"
                  class="dropdown-option-max custom-date-btn {isCustomDuration(duration) ? 'active' : ''}"
                  onclick={() => showCustomDatePicker = true}
                >
                  <svg class="w-4 h-4 duration-icon-max" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span class="duration-text-max">Fecha exacta...</span>
                  {#if isCustomDuration(duration)}
                    <svg class="w-4 h-4 check-icon-max" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  {/if}
                </button>
              {:else}
                <!-- Selector de fecha/hora -->
                <div class="custom-date-picker-max">
                  <button 
                    type="button" 
                    class="back-btn-max"
                    onclick={() => showCustomDatePicker = false}
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Volver</span>
                  </button>
                  
                  <div class="date-time-inputs-max">
                    <div class="input-group-max">
                      <span class="input-label-max">Fecha de cierre</span>
                      <input 
                        type="date" 
                        bind:value={customEndDate}
                        min={getMinDate()}
                        class="date-input-max"
                      />
                    </div>
                    <div class="input-group-max">
                      <span class="input-label-max">Hora</span>
                      <input 
                        type="time" 
                        bind:value={customEndTime}
                        class="time-input-max"
                      />
                    </div>
                  </div>
                  
                  {#if customEndDate}
                    <div class="date-preview-max">
                      Cierra: {formatCustomDate(customEndDate, customEndTime)}
                    </div>
                  {/if}
                  
                  <button 
                    type="button" 
                    class="apply-date-btn-max"
                    onclick={applyCustomDate}
                    disabled={!customEndDate}
                  >
                    Aplicar fecha
                  </button>
                </div>
              {/if}
            </div>
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="dropdown-backdrop-max" onclick={() => { showDurationDropdown = false; showCustomDatePicker = false; }}></div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- SCROLL CONTAINER (MAIN CONTENT) -->
  <div 
    bind:this={scrollContainer}
    class="absolute inset-0 w-full h-full flex overflow-x-scroll snap-x snap-mandatory no-scrollbar focus:outline-none scroll-smooth"
    onscroll={handleScroll}
  >
    {#each options as opt, i (opt.id)}
      <!-- Key block forces re-render when previewCache updates for this option -->
      {#key previewCache[opt.id]?.image}
      {@const type = getMediaType(opt)}
      {@const mediaUrl = getMediaUrl(opt)}
      {@const labelText = getLabelWithoutUrl(opt.label)}
      {@const hasThumb = hasRealThumbnail(opt.id, mediaUrl)}
      {@const isGenericLinkWithThumb = type === 'generic-link' && hasThumb}
      {@const isVideoType = (type !== 'image' && type !== 'text' && type !== 'generic-link') || isGenericLinkWithThumb}
      {@const isMusicType = ['spotify', 'soundcloud', 'applemusic', 'deezer', 'bandcamp'].includes(type)}
      {@const isGifType = opt.imageUrl && (opt.imageUrl.includes('giphy.com') || opt.imageUrl.includes('tenor.com') || /\.gif([?#]|$)/i.test(opt.imageUrl))}
      {@const isGenericLinkWithoutThumb = type === 'generic-link' && !hasThumb}
      {@const shouldShowAsText = type === 'text' || isGenericLinkWithoutThumb}
      
      <div
        class="w-full h-full flex-shrink-0 snap-center relative"
        style="scroll-snap-stop: always;"
      >
        <!-- SlideContent -->
        <div class="w-full h-full relative overflow-hidden">
          
          <!-- CARD CONTAINER - Igual que PollMaximizedView -->
          <div class="option-card-container">
            <div class="option-card-rounded">
              
              {#if shouldShowAsText}
                <!-- === LAYOUT SOLO TEXTO (o enlace genérico sin thumbnail) === -->
                <!-- Área principal con color de fondo y comillas -->
                <div class="card-content-area" class:has-yesno={opt.isYesNo} style="background-color: {opt.color};">
                  <!-- Comillas decorativas -->
                  <span class="quote-decoration quote-open">"</span>
                  <span class="quote-decoration quote-close">"</span>
                  
                  <!-- Texto editable abajo izquierda -->
                  <div class="text-bottom-wrapper">
                    <!-- Contador de caracteres encima del texto -->
                    <div class="char-counter-above">
                      <span>{labelText.length}/200</span>
                    </div>
                    <textarea
                      class="card-bottom-label card-bottom-label-autosize pointer-events-auto"
                      placeholder="Opción {i + 1}..."
                      value={labelText}
                      oninput={(e) => {
                        const newValue = e.currentTarget.value;
                        const currentUrl = extractUrlFromText(opt.label);
                        if (currentUrl) {
                          onLabelChange(opt.id, newValue ? `${newValue} ${currentUrl}` : currentUrl);
                        } else {
                          onLabelChange(opt.id, newValue);
                        }
                        // Auto-resize textarea
                        e.currentTarget.style.height = 'auto';
                        e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                      }}
                      onclick={(e) => e.stopPropagation()}
                      rows="2"
                    ></textarea>
                    
                    <!-- Enlace debajo del texto si es enlace genérico -->
                    {#if isGenericLinkWithoutThumb && mediaUrl}
                      <div class="link-below-wrapper">
                        <a 
                          href={mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="link-below-text-edit"
                          onclick={(e) => e.stopPropagation()}
                        >
                          <img 
                            src="https://www.google.com/s2/favicons?domain={getHostname(mediaUrl)}&sz=16" 
                            alt="" 
                            class="link-below-favicon-edit"
                          />
                          <span class="link-below-domain-edit">{getHostname(mediaUrl)}</span>
                          <span class="link-below-arrow-edit">↗</span>
                        </a>
                        <button 
                          type="button"
                          class="link-remove-btn-edit"
                          onclick={(e) => { e.stopPropagation(); onRemoveMedia(opt.id); }}
                          aria-label="Eliminar enlace"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    {/if}
                  </div>
                  
                  <!-- Línea divisoria en el borde inferior -->
                  <div class="card-divider-line card-divider-bottom"></div>
                </div>
                
              {:else if isVideoType}
                <!-- === LAYOUT VIDEO CON PREVIEW FLOTANTE (igual que en View) === -->
                {@const platformColors: Record<string, string> = {
                  youtube: '#FF0000', vimeo: '#1ab7ea', spotify: '#1DB954', soundcloud: '#ff5500',
                  tiktok: '#000000', twitch: '#9146FF', twitter: '#000000', applemusic: '#FC3C44',
                  deezer: '#FEAA2D', dailymotion: '#0066DC', bandcamp: '#1DA0C3', video: '#666666',
                  image: '#666666', 'generic-link': '#666666'
                }}
                {@const canEmbed = hasEmbeddableContent(mediaUrl)}
                {@const thumbUrl = getFinalThumbnail(opt.id, mediaUrl)}
                <div class="card-video-wrapper {isMusicType ? 'is-music' : ''}" class:has-yesno={opt.isYesNo} style="background-color: {opt.color};">
                  <!-- Contenedor flotante del preview -->
                  <div class="floating-preview-frame" role="region" aria-label="Preview de contenido">
                    <div class="floating-preview-inner">
                      <!-- PREVIEW: Thumbnail con badge flotante (siempre visible en Edit) -->
                      {#if thumbUrl}
                        <button 
                          class="embed-preview-container thumbnail-fullscreen-btn"
                          onclick={(e) => { 
                            e.stopPropagation(); 
                            if (canEmbed) {
                              openFullscreenIframe(mediaUrl, opt.id, thumbUrl);
                            } else if (mediaUrl) {
                              window.open(mediaUrl, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          type="button"
                          aria-label={canEmbed ? "Reproducir contenido a pantalla completa" : "Abrir enlace"}
                          style="background-image: url('{thumbUrl}');"
                        >
                          <!-- Badge de plataforma -->
                          <div class="platform-badge-edit" style="--platform-color: {platformColors[type] || '#666'}">
                            {#if type === 'youtube'}
                              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                            {:else if type === 'vimeo'}
                              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z"/></svg>
                            {:else if type === 'spotify'}
                              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                            {:else if type === 'soundcloud'}
                              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.56 8.87V17h8.76c1.85-.13 2.68-1.27 2.68-2.67 0-1.48-1.12-2.67-2.53-2.67-.33 0-.65.08-.96.2-.11-2.02-1.69-3.63-3.66-3.63-1.24 0-2.34.64-2.99 1.64H11.56zm-1 0H9.4v8.13h1.16V8.87zm-2.16.52H7.24v7.61H8.4V9.39zm-2.16.91H5.08v6.7h1.16v-6.7zm-2.16.78H2.92v5.92h1.16v-5.92zm-2.16 1.3H.76v4.62h1.16v-4.62z"/></svg>
                            {:else if type === 'tiktok'}
                              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                            {:else if type === 'twitch'}
                              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                            {:else if type === 'generic-link' || !canEmbed}
                              <!-- Icono de enlace externo para enlaces genéricos -->
                              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zm-2 16H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7h-7z"/></svg>
                            {:else}
                              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                            {/if}
                          </div>
                          
                          </button>
                        <!-- Botón eliminar media (fuera del botón de fullscreen) -->
                        <button
                          type="button"
                          class="remove-media-btn-floating"
                          onclick={(e) => { e.stopPropagation(); onRemoveMedia(opt.id); }}
                          aria-label="Eliminar media"
                        >
                          <X size={20} strokeWidth={2} />
                        </button>
                      {:else}
                        <!-- Placeholder mientras carga el thumbnail -->
                        <div class="w-full h-full flex items-center justify-center rounded-2xl" style="background-color: {opt.color};">
                          <span class="text-white/50 text-sm">Cargando...</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                  
                  <!-- Contenido debajo del video -->
                  <div class="card-video-bottom">
                    <!-- Contador encima del texto -->
                    <div class="char-counter-above">
                      <span>{labelText.length}/200</span>
                    </div>
                    <!-- Label editable -->
                    <textarea
                      class="card-bottom-label pointer-events-auto"
                      placeholder="Opción {i + 1}..."
                      value={labelText}
                      oninput={(e) => {
                        const newValue = e.currentTarget.value;
                        const currentUrl = extractUrlFromText(opt.label);
                        if (currentUrl) {
                          onLabelChange(opt.id, newValue ? `${newValue} ${currentUrl}` : currentUrl);
                        } else {
                          onLabelChange(opt.id, newValue);
                        }
                      }}
                      onclick={(e) => e.stopPropagation()}
                      rows="2"
                    ></textarea>
                    
                    <!-- Enlace debajo del texto para URLs -->
                    {#if shouldShowLink(mediaUrl)}
                      <div class="link-below-wrapper">
                        <a 
                          href={mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="link-below-text-edit"
                          onclick={(e) => e.stopPropagation()}
                        >
                          <img 
                            src="https://www.google.com/s2/favicons?domain={getHostname(mediaUrl)}&sz=16" 
                            alt="" 
                            class="link-below-favicon-edit"
                          />
                          <span class="link-below-domain-edit">{getHostname(mediaUrl)}</span>
                          <span class="link-below-arrow-edit">↗</span>
                        </a>
                        <button 
                          type="button"
                          class="link-remove-btn-edit"
                          onclick={(e) => { e.stopPropagation(); onRemoveMedia(opt.id); }}
                          aria-label="Eliminar enlace"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>
                
              {:else}
                <!-- === LAYOUT GIF/IMAGEN === -->
                <!-- Wrapper con borde del color de la opción -->
                <div class="card-media-border" class:has-yesno={opt.isYesNo} style="--border-color: {opt.color};">
                  <!-- Imagen a pantalla completa con contenido overlay -->
                  <!-- Click abre enlace directamente si no tiene embed -->
                  <div 
                    class="card-media-fullscreen"
                    onclick={(e) => handleMediaClick(mediaUrl, e)}
                    role={!hasEmbeddableContent(mediaUrl) ? "link" : undefined}
                    style={!hasEmbeddableContent(mediaUrl) ? "cursor: pointer;" : ""}
                  >
                    <!-- Imagen de fondo -->
                    <div class="card-image-fullscreen">
                      {#if i === activeIndex}
                        {#key `media-edit-${opt.id}-${activeIndex}`}
                          <MediaEmbed
                            url={mediaUrl}
                            mode="full"
                            width="100%"
                            height="100%"
                            autoplay={isVideoType}
                          />
                        {/key}
                      {:else}
                        <!-- Placeholder mientras carga -->
                        <div class="w-full h-full flex items-center justify-center rounded-2xl" style="background-color: {opt.color};">
                          <span class="text-white/50 text-sm">Cargando...</span>
                        </div>
                      {/if}
                      
                      <!-- Botón eliminar media -->
                      <button
                        type="button"
                        class="remove-media-btn"
                        onclick={(e) => { e.stopPropagation(); onRemoveMedia(opt.id); }}
                        aria-label="Eliminar media"
                      >
                        <X size={24} strokeWidth={1.5} />
                      </button>
                    </div>
                    
                    <!-- Badge GIPHY -->
                    {#if isGifType}
                      <img src="/logoGIPHY.png" alt="GIPHY" class="giphy-badge-corner" />
                    {/if}
                    
                    <!-- Degradado inferior -->
                    <div class="card-bottom-gradient"></div>
                    
                    <!-- Contenido inferior: label + línea + herramientas -->
                    <div class="card-bottom-content">
                      <!-- Contador encima del texto -->
                      <div class="char-counter-above">
                        <span>{labelText.length}/200</span>
                      </div>
                      <!-- Label editable -->
                      <textarea
                        class="card-bottom-label pointer-events-auto"
                        placeholder="Opción {i + 1}..."
                        value={labelText}
                        oninput={(e) => {
                          const newValue = e.currentTarget.value;
                          const currentUrl = extractUrlFromText(opt.label);
                          if (currentUrl) {
                            onLabelChange(opt.id, newValue ? `${newValue} ${currentUrl}` : currentUrl);
                          } else {
                            onLabelChange(opt.id, newValue);
                          }
                        }}
                        onclick={(e) => e.stopPropagation()}
                        rows="2"
                      ></textarea>
                      
                      <!-- Enlace debajo del texto para URLs -->
                      {#if shouldShowLink(mediaUrl)}
                        <div class="link-below-wrapper">
                          <a 
                            href={mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="link-below-text-edit"
                            onclick={(e) => e.stopPropagation()}
                          >
                            <img 
                              src="https://www.google.com/s2/favicons?domain={getHostname(mediaUrl)}&sz=16" 
                              alt="" 
                              class="link-below-favicon-edit"
                            />
                            <span class="link-below-domain-edit">{getHostname(mediaUrl)}</span>
                            <span class="link-below-arrow-edit">↗</span>
                          </a>
                          <button 
                            type="button"
                            class="link-remove-btn-edit"
                            onclick={(e) => { e.stopPropagation(); onRemoveMedia(opt.id); }}
                            aria-label="Eliminar enlace"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}
              
              <!-- === BOTONES DE EDICIÓN UNIFICADOS (fuera de los layouts) === -->
              <div class="floating-actions-right">
                {#if onToggleYesNo}
                  <button
                    type="button"
                    class="tool-btn {opt.isYesNo ? 'active' : ''}"
                    onclick={(e) => { e.stopPropagation(); onToggleYesNo?.(opt.id); }}
                    aria-label="Toggle Sí/No"
                    title="Sí/No"
                  >
                    <Ban size={18} />
                  </button>
                {/if}
                <button
                  type="button"
                  class="tool-btn {opt.isCorrect || opt.correctAnswer ? 'active' : ''}"
                  onclick={(e) => { e.stopPropagation(); onToggleCorrect?.(opt.id); }}
                  aria-label="Marcar correcta"
                  title={opt.isCorrect || opt.correctAnswer ? 'Opción correcta' : 'Marcar como correcta'}
                >
                  <CircleCheck size={18} />
                </button>
                <button
                  type="button"
                  class="tool-btn"
                  onclick={(e) => { e.stopPropagation(); onOpenColorPicker(opt.id); }}
                  aria-label="Cambiar color"
                  title="Color"
                >
                  <Palette size={18} />
                </button>
                <button
                  type="button"
                  class="tool-btn sparkles-btn"
                  onclick={(e) => { e.stopPropagation(); onOpenGiphyPicker(opt.id); }}
                  aria-label="Buscar GIF"
                  title="GIF"
                >
                  <Sparkles size={18} />
                </button>
                {#if options.length > 2}
                  <button
                    type="button"
                    class="tool-btn danger-btn"
                    onclick={(e) => { e.stopPropagation(); onRemoveOption(opt.id); }}
                    aria-label="Eliminar opción"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                {/if}
              </div>

              <!-- === CAMPOS SÍ/NO (overlay dentro del contenido) === -->
              {#if opt.isYesNo}
                <div class="yesno-overlay">
                  <!-- Mensaje centrado según estado -->
                  {#if opt.isCorrect && !opt.correctAnswer}
                    <div class="yesno-select-label">
                      <CircleCheck size={10} />
                      <span>Selecciona el botón correcto</span>
                    </div>
                  {:else if opt.correctAnswer}
                    <div class="yesno-correct-label">
                      <CircleCheck size={10} />
                      <span>"{opt.correctAnswer === 'yes' ? (opt.yesText || 'Sí') : (opt.noText || 'No')}" es correcta</span>
                    </div>
                  {/if}
                  
                  <div class="yesno-row-max">
                    <button
                      type="button"
                      class="option-btn-max {opt.correctAnswer === 'yes' ? 'selected' : ''}"
                      onclick={(e) => { e.stopPropagation(); onToggleCorrect?.(opt.id, 'yes'); }}
                    >
                      {#if opt.isCorrect}
                        <div class="option-selector-max {opt.correctAnswer === 'yes' ? 'selected' : ''}">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      {/if}
                      <div class="option-content-max">
                        <input
                          type="text"
                          class="option-input-max"
                          placeholder="👍 Sí"
                          value={opt.yesText || ''}
                          oninput={(e) => { e.stopPropagation(); onYesNoTextChange?.(opt.id, e.currentTarget.value, opt.noText || ''); }}
                          onclick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </button>
                    <button
                      type="button"
                      class="option-btn-max {opt.correctAnswer === 'no' ? 'selected' : ''}"
                      onclick={(e) => { e.stopPropagation(); onToggleCorrect?.(opt.id, 'no'); }}
                    >
                      {#if opt.isCorrect}
                        <div class="option-selector-max {opt.correctAnswer === 'no' ? 'selected' : ''}">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      {/if}
                      <div class="option-content-max">
                        <input
                          type="text"
                          class="option-input-max"
                          placeholder="👎 No"
                          value={opt.noText || ''}
                          oninput={(e) => { e.stopPropagation(); onYesNoTextChange?.(opt.id, opt.yesText || '', e.currentTarget.value); }}
                          onclick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </button>
                  </div>
                </div>
              {/if}

              <!-- Mensaje de opción correcta sin Sí/No -->
              {#if !opt.isYesNo && opt.isCorrect}
                <div class="correct-hint-overlay">
                  <div class="correct-answer-hint">
                    <CircleCheck size={12} />
                    <span>Esta opción es correcta</span>
                  </div>
                </div>
              {/if}
              
            </div>
          </div>
        </div>
      </div>
      {/key}
    {/each}
  </div>
  
  <!-- Footer con todos los botones de acción -->
  <div class="actions-footer">
    <!-- Botones de tipo de votación a la izquierda -->
    {#if pollTypes && pollTypes.length > 0}
      <div class="poll-types-buttons">
        {#each pollTypes as type}
          <button
            type="button"
            class="footer-btn poll-type-btn"
            class:active={pollType === type.id}
            onclick={() => { onChangePollType?.(type.id); onOpenTypeOptionsModal?.(); }}
            aria-label="Tipo: {type.label}"
            title={type.label}
          >
            {#if type.icon === 'circle'}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke-width="2"/>
              </svg>
            {:else if type.icon === 'check-square'}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" rx="2" stroke-width="2"/>
              </svg>
            {:else if type.icon === 'users'}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
    
    <!-- Botones de acción a la derecha -->
    <div class="action-buttons">
      <!-- Botón de animar cards -->
      {#if canAnimateCards}
        <button
          type="button"
          class="footer-btn animate-btn"
          onclick={() => onAnimateCards?.()}
          disabled={isAnimatingCards}
          title={isAnimatingCards ? "Buscando GIFs..." : "Animar cards con GIFs"}
          aria-label="Animar cards con GIFs"
        >
          {#if isAnimatingCards}
            <Loader2 class="w-5 h-5 animate-spin" />
          {:else}
            <Sparkles class="w-5 h-5" />
          {/if}
        </button>
      {/if}
      
      <!-- Botón de minimizar -->
      <button
        type="button"
        class="footer-btn minimize-btn"
        onclick={() => onClose()}
        title="Minimizar"
        aria-label="Minimizar"
      >
        <Minimize2 class="w-5 h-5" />
      </button>
      
      <!-- Botón de añadir opción -->
      {#if canAddOption}
        <button
          type="button"
          class="footer-btn add-btn"
          onclick={() => onAddOption?.()}
          title="Añadir opción"
          aria-label="Añadir nueva opción"
        >
          <Plus class="w-6 h-6" />
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .maximized-edit {
    background: #0a0a0f;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  
  textarea {
    font-family: inherit;
    color: white !important;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }
  
  textarea::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  
  textarea::-webkit-scrollbar-track {
    background: transparent;
  }
  
  textarea::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
  
  textarea::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.4);
  }
  
  textarea::placeholder {
    text-shadow: none;
  }
  
  /* Scrollbar personalizada para contenedores multimedia */
  .card-video-area,
  .card-media-fullscreen,
  .card-image-fullscreen,
  .card-content-area {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }
  
  .card-video-area::-webkit-scrollbar,
  .card-media-fullscreen::-webkit-scrollbar,
  .card-image-fullscreen::-webkit-scrollbar,
  .card-content-area::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  
  .card-video-area::-webkit-scrollbar-track,
  .card-media-fullscreen::-webkit-scrollbar-track,
  .card-image-fullscreen::-webkit-scrollbar-track,
  .card-content-area::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .card-video-area::-webkit-scrollbar-thumb,
  .card-media-fullscreen::-webkit-scrollbar-thumb,
  .card-image-fullscreen::-webkit-scrollbar-thumb,
  .card-content-area::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
  
  .card-video-area::-webkit-scrollbar-thumb:hover,
  .card-media-fullscreen::-webkit-scrollbar-thumb:hover,
  .card-image-fullscreen::-webkit-scrollbar-thumb:hover,
  .card-content-area::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.4);
  }
  
  /* También para iframes y embeds dentro */
  .card-video-area :global(iframe),
  .card-media-fullscreen :global(iframe) {
    scrollbar-width: none;
  }
  
  .card-video-area :global(iframe)::-webkit-scrollbar,
  .card-media-fullscreen :global(iframe)::-webkit-scrollbar {
    display: none;
  }
  
  /* Ocultar overflow en contenedores de embeds (Spotify, etc) */
  .card-video-area :global(.media-embed),
  .card-video-area :global(.embed-container),
  .card-video-area :global(.spotify-embed),
  .card-video-area :global([class*="spotify"]) {
    overflow: hidden !important;
    scrollbar-width: none !important;
  }
  
  .card-video-area :global(.media-embed)::-webkit-scrollbar,
  .card-video-area :global(.embed-container)::-webkit-scrollbar,
  .card-video-area :global(.spotify-embed)::-webkit-scrollbar,
  .card-video-area :global([class*="spotify"])::-webkit-scrollbar {
    display: none !important;
  }
  
  /* Forzar overflow hidden en todo el área de video */
  .card-video-area,
  .card-video-area * {
    overflow: hidden !important;
  }
  
  .card-video-area :global(*) {
    scrollbar-width: none !important;
  }
  
  .card-video-area :global(*)::-webkit-scrollbar {
    display: none !important;
  }
  
  /* ========================================
     CARD CONTAINER - Igual que PollMaximizedView
     ======================================== */

  /* Contenedor que centra la card y deja espacio para header/footer */
  .option-card-container {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 145px 12px 70px;
  }

  /* Card con bordes redondeados - igual para todos los tipos */
  .option-card-rounded {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 32px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: transparent;
    border: none;
  }

  /* ========================================
     LAYOUT TEXTO - Color sólido + comillas
     ======================================== */

  .card-content-area {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: none;
    outline: none;
    border-radius: 32px 32px 0 0;
  }

  .quote-decoration {
    position: absolute;
    font-size: 120px;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.1);
    line-height: 1;
    pointer-events: none;
    font-family: Georgia, serif;
  }

  .quote-open {
    top: 20px;
    left: 20px;
  }

  .quote-close {
    bottom: 20px;
    right: 20px;
  }

  .text-bottom-wrapper {
    padding: 20px;
    width: 100%;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  /* ========================================
     FOOTER BAR - Igual para todos
     ======================================== */

  .card-footer-bar {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px 20px;
    border-radius: 0 0 32px 32px;
  }

  /* Línea divisoria en el borde inferior del área de contenido */
  .card-divider-bottom {
    position: absolute;
    bottom: 0;
    left: 16px;
    right: 16px;
    width: auto;
  }

  /* ========================================
     LAYOUT VIDEO - Video arriba, contenido abajo
     ======================================== */

  /* Wrapper con el color de la opción - borde fino */
  .card-video-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding: 4px;
    border-radius: 32px;
    overflow: hidden;
  }

  .card-video-area {
    flex: 0 0 55%;
    position: relative;
    overflow: hidden;
    background: inherit;
    border-radius: 28px;
  }
  
  /* Plataformas de música - mismo espacio que Spotify */
  .card-video-area.is-music {
    flex: 0 0 45%;
    min-height: 152px;
    max-height: 240px;
  }
  
  .card-video-wrapper.is-music .card-video-bottom {
    flex: 1;
  }

  .card-video-area :global(.media-embed),
  .card-video-area :global(.embed-container),
  .card-video-area :global(.mini-card),
  .card-video-area :global(.linkedin-card),
  .card-video-area :global(.oembed-container) {
    width: 100% !important;
    height: 100% !important;
    background: inherit !important;
    background-color: inherit !important;
  }
  
  /* Contenedor de iframe/video hereda el color */
  .card-video-area :global(.embed-container > div),
  .card-video-area :global(.oembed-container > div),
  .card-video-area :global(.media-embed > div) {
    background: inherit !important;
  }

  .card-video-area :global(iframe),
  .card-video-area :global(video) {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
    border-radius: 28px !important;
    /* El espacio vacío mostrará el color del padre */
  }

  /* Ocultar contenido extra en video */
  .card-video-area :global(.linkedin-content),
  .card-video-area :global(.mini-card-content) {
    display: none !important;
  }

  /* Contenedor inferior del video */
  .card-video-bottom {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 16px 16px 20px;
    gap: 8px;
    border-radius: 0 0 28px 28px;
  }

  /* ========================================
     FLOATING PREVIEW (idéntico a View)
     ======================================== */
  
  .floating-preview-frame {
    position: relative;
    width: 90%;
    max-width: 300px;
    margin: 20px auto 20px;
    aspect-ratio: 19 / 25;
    border-radius: 40px;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    z-index: 10;
  }

  .floating-preview-inner {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent;
  }

  .embed-preview-container {
    position: relative;
    width: 100%;
    height: 100%;
    border: none;
    cursor: pointer;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    background-color: #1a1a2e;
    border-radius: 16px;
  }

  .thumbnail-fullscreen-btn {
    position: relative;
    width: 100%;
    height: 100%;
    border: none;
    cursor: pointer;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    background-color: #1a1a2e;
    border-radius: 16px;
  }

  .thumbnail-fullscreen-btn:hover {
    filter: brightness(0.9);
  }

  .platform-badge-edit {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--platform-color, #666);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.4),
      0 0 0 2px rgba(255, 255, 255, 0.2);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
  }

  .embed-preview-container:hover .platform-badge-edit {
    transform: scale(1.1);
    box-shadow: 
      0 6px 16px rgba(0, 0, 0, 0.5),
      0 0 0 3px rgba(255, 255, 255, 0.3);
  }

  .platform-badge-edit svg {
    width: 26px;
    height: 26px;
    color: white;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }

  .remove-media-btn-floating {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 36px;
    height: 36px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    border: none;
    border-radius: 50%;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 20;
  }

  .remove-media-btn-floating:hover {
    background: rgba(239, 68, 68, 0.9);
    transform: scale(1.1);
  }

  /* Ajustar el contenido inferior cuando hay preview flotante */
  .card-video-wrapper .card-video-bottom {
    padding-top: 8px;
  }

  /* ========================================
     LAYOUT GIF/IMAGEN - Fullscreen con overlay
     ======================================== */

  /* Wrapper con borde del color de la opción */
  .card-media-border {
    width: 100%;
    height: 100%;
    padding: 4px;
    background-color: var(--border-color);
    border-radius: 32px;
  }

  /* Contenedor fullscreen para imagen */
  .card-media-fullscreen {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 28px;
  }

  /* Imagen de fondo a pantalla completa */
  .card-image-fullscreen {
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .card-image-fullscreen :global(.media-embed),
  .card-image-fullscreen :global(.embed-container) {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
  }

  .card-image-fullscreen :global(img),
  .card-image-fullscreen :global(video) {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
  }
  
  /* Forzar que las imágenes llenen todo el contenedor */
  .card-image-fullscreen :global(.image-with-link) {
    position: absolute !important;
    inset: 0 !important;
    display: flex !important;
    flex-direction: column !important;
  }
  
  .card-image-fullscreen :global(.image-container) {
    flex: 1 !important;
    position: relative !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
  }
  
  .card-image-fullscreen :global(.image-container img) {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    max-height: none !important;
    object-fit: cover !important;
  }

  /* Ocultar contenido extra de MediaEmbed */
  .card-image-fullscreen :global(.linkedin-content),
  .card-image-fullscreen :global(.mini-card-content),
  .card-image-fullscreen :global(.bottom-link-button),
  .card-image-fullscreen :global(.compact-link-container),
  .card-image-fullscreen :global(.mini-card),
  .card-image-fullscreen :global(.card-content),
  .card-image-fullscreen :global(.error-link),
  .card-image-fullscreen :global(.error-state) {
    display: none !important;
  }

  /* Enlace debajo del texto de la opción */
  .link-below-text-edit {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    margin-top: 8px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    color: rgba(255, 255, 255, 0.9);
    text-decoration: none;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s ease;
    width: fit-content;
    pointer-events: auto;
  }
  
  .link-below-text-edit:hover {
    background: rgba(255, 255, 255, 0.22);
    color: white;
  }
  
  .link-below-favicon-edit {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  
  .link-below-domain-edit {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 180px;
  }
  
  .link-below-arrow-edit {
    font-size: 12px;
    opacity: 0.7;
    flex-shrink: 0;
  }

  /* Wrapper para enlace con botón X */
  .link-below-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
  }

  .link-remove-btn-edit {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.15);
    border: none;
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
    pointer-events: auto;
  }

  .link-remove-btn-edit:hover {
    background: rgba(239, 68, 68, 0.8);
    color: white;
  }

  /* Badge GIPHY logo en esquina superior derecha */
  .giphy-badge-corner {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 28px;
    height: 28px;
    padding: 5px;
    background: rgba(0, 0, 0, 0.75);
    border-radius: 50%;
    object-fit: contain;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    z-index: 1;
    pointer-events: none;
  }

  /* Degradado inferior fuerte */
  .card-bottom-gradient {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.95) 0%,
      rgba(0, 0, 0, 0.75) 30%,
      rgba(0, 0, 0, 0.4) 60%,
      transparent 100%
    );
    z-index: 2;
    pointer-events: none;
  }

  /* Contenido inferior superpuesto */
  .card-bottom-content {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 3;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .card-bottom-label {
    background: transparent;
    border: none;
    outline: none;
    color: white;
    font-size: 32px;
    font-weight: 700;
    line-height: 1.2;
    resize: none;
    width: 100%;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }
  
  .card-bottom-label::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  /* Auto-resize para layout de solo texto */
  .card-bottom-label-autosize {
    overflow: hidden;
    min-height: 64px;
    max-height: 300px;
    overflow-y: auto;
    padding-left: 32px;
    padding-right: 32px;
    text-align: center;
  }

  /* Línea divisoria blanca fina */
  .card-divider-line {
    width: 100%;
    height: 1px;
    background: rgba(255, 255, 255, 0.4);
  }

  /* Botones de edición VERTICALES - Posición absoluta */
  .edit-buttons-vertical {
    position: absolute;
    right: 20px;
    bottom: 20px; /* Por encima de la línea divisoria */
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 10;
  }
  
  /* Ajuste para layout de texto (card-content-area) */
  .card-content-area .edit-buttons-vertical {
    right: 20px;
    bottom: 20px;
  }
  
  /* Ajuste para layout de video (card-video-bottom) */
  .card-video-bottom {
    position: relative;
  }
  
  .card-video-bottom .edit-buttons-vertical {
    right: 4px;
    bottom: 55px; /* Por encima de la línea divisoria y el footer */
  }
  
  /* Ajuste para layout de imagen (card-bottom-content) */
  .card-bottom-content .edit-buttons-vertical {
    right: 4px;
    bottom: 55px; /* Por encima de la línea divisoria y el footer */
  }
  
  /* Botones de edición - Estilo action-bar */
  .edit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: white;
    flex-shrink: 0;
  }
  
  .edit-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.4);
  }
  
  .edit-btn:active {
    transform: scale(0.95);
  }
  
  .edit-btn.color-btn {
    border-color: rgba(255, 255, 255, 0.5);
  }
  
  .edit-btn.giphy-btn {
    background: rgba(30, 30, 35, 0.8);
    border-color: rgba(147, 197, 253, 0.4);
  }
  
  .edit-btn.giphy-btn:hover {
    background: rgba(147, 197, 253, 0.2);
    border-color: rgba(147, 197, 253, 0.8);
  }
  
  .edit-btn.delete-btn {
    background: #2a2c31;
    border: none;
    border-bottom: 3px solid #ef4444;
  }
  
  .edit-btn.delete-btn :global(svg) {
    color: #ef4444;
  }
  
  .edit-btn.delete-btn:hover {
    background: #35373d;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
  }
  
  /* Botón Sí/No */
  .edit-btn.yesno-btn {
    background: #2a2c31;
    border: none;
    border-bottom: 3px solid rgba(255, 255, 255, 0.4);
    padding: 6px;
  }
  
  .edit-btn.yesno-btn:hover {
    background: #35373d;
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
  }
  
  .edit-btn.yesno-btn.active {
    background: #2a2c31;
    border-bottom-color: rgba(255, 255, 255, 0.8);
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
  }
  
  /* Botón Marcar Correcta */
  .edit-btn.correct-btn {
    background: rgba(30, 30, 35, 0.8);
    border-color: rgba(34, 197, 94, 0.4);
  }
  
  .edit-btn.correct-btn:hover {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.8);
  }
  
  .edit-btn.correct-btn.active {
    background: rgba(34, 197, 94, 0.5);
    border-color: rgba(34, 197, 94, 1);
    color: white;
  }
  
  /* Botón eliminar media */
  .remove-media-btn {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 12px;
    border-radius: 20px;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    transition: all 0.2s ease;
    pointer-events: auto;
  }
  
  .remove-media-btn:hover {
    background: rgba(239, 68, 68, 0.4);
    border-color: rgba(239, 68, 68, 0.6);
  }
  
  .remove-media-btn:active {
    transform: translateX(-50%) scale(0.95);
  }
  
  /* Responsive - Desktop */
  @media (min-width: 768px) {
    .option-card-container {
      padding: 130px 40px 80px;
    }
    
    .option-card-rounded {
      max-width: 500px;
      margin: 0 auto;
    }
    
    .card-bottom-label {
      font-size: 38px;
    }
    
    .quote-decoration {
      font-size: 140px;
    }
    
    .floating-preview-frame {
      max-width: 380px;
      min-height: 300px;
    }
  }
  
  /* Desktop grande */
  @media (min-width: 1024px) {
    .floating-preview-frame {
      max-width: 420px;
      min-height: 350px;
    }
  }
  
  /* Responsive - Mobile */
  @media (max-width: 480px) {
    .option-card-container {
      padding: 130px 10px 60px;
    }
    
    .option-card-rounded {
      border-radius: 12px;
    }
    
    .quote-decoration {
      font-size: 80px;
    }
    
    .quote-open {
      top: 12px;
      left: 12px;
    }

    .quote-close {
      bottom: 12px;
      right: 12px;
    }
    
    .text-bottom-wrapper {
      padding: 16px;
    }
    
    .card-footer-bar {
      padding: 12px 14px 16px;
    }
    
    .card-bottom-content {
      padding: 16px;
    }
  }
  
  /* Footer de acciones */
  .actions-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: transparent;
    z-index: 100;
  }
  
  .poll-types-buttons {
    display: flex;
    gap: 8px;
  }
  
  .action-buttons {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  
  .footer-btn {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(30, 30, 35, 0.8);
    backdrop-filter: blur(10px);
    border: 2px solid rgba(255, 255, 255, 0.2);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .footer-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.4);
  }
  
  .footer-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .footer-btn.poll-type-btn.active {
    background: white;
    border-color: white;
    color: #1f2937;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }
  
  .footer-btn.animate-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-color: rgba(102, 126, 234, 0.5);
  }
  
  .footer-btn.animate-btn:hover:not(:disabled) {
    border-color: rgba(102, 126, 234, 0.8);
    box-shadow: 0 0 16px rgba(102, 126, 234, 0.4);
  }
  
  .footer-btn.minimize-btn {
    border-color: rgba(255, 255, 255, 0.3);
  }
  
  .footer-btn.add-btn {
    width: 48px;
    height: 48px;
    background: #2a2c31;
    border: none;
    border-bottom: 3px solid #10b981;
  }
  
  .footer-btn.add-btn :global(svg) {
    color: #10b981;
  }
  
  .footer-btn.add-btn:hover {
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  :global(.animate-spin) {
    animation: spin 1s linear infinite;
  }
  
  /* Botón publicar en header */
  .publish-btn-header {
    padding: 8px 16px;
    background: #ffffff;
    border: none;
    border-radius: 6px;
    color: #000;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    pointer-events: auto;
    transition: all 0.2s;
  }
  
  .publish-btn-header:hover:not(:disabled) {
    background: #e5e5e5;
  }
  
  .publish-btn-header:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  
  /* Info de opciones y tiempo */
  .poll-meta-info {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
    padding-left: 4px;
  }
  
  .meta-separator {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.3);
  }
  
  /* Contador de caracteres encima del texto */
  .char-counter-above {
    display: flex;
    justify-content: flex-start;
    padding-bottom: 4px;
  }
  
  .char-counter-above span {
    font-size: 12px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.6);
  }

  
  /* Campos de Sí/No */
  .yesno-row {
    display: flex;
    gap: 8px;
    width: 100%;
    padding: 4px 0;
    box-sizing: border-box;
  }
  
  .yesno-input {
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    border-radius: 10px;
    border: 2px solid rgba(0, 0, 0, 0.1);
    background: white;
    font-size: 14px;
    font-weight: 600;
    text-align: center;
    outline: none;
    transition: all 0.2s;
    box-sizing: border-box;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    position: relative;
  }
  
  .yesno-input input {
    background: transparent;
    border: none;
    outline: none;
    color: inherit;
    font-size: 14px;
    font-weight: 600;
    text-align: center;
    width: 100%;
    cursor: text;
  }
  
  .yesno-input input::placeholder {
    color: rgba(0, 0, 0, 0.4);
  }
  
  .yesno-input:hover {
    border-color: rgba(0, 0, 0, 0.2);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .yesno-input.correct {
    border-color: #22c55e !important;
    border-width: 2px;
  }
  
  .yesno-input :global(.correct-icon) {
    color: rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
    transition: color 0.2s;
  }
  
  .yesno-input :global(.correct-icon.active) {
    color: #22c55e;
  }
  
  .yesno-yes {
    border-color: rgba(34, 197, 94, 0.3);
  }
  
  .yesno-yes:hover {
    border-color: rgba(34, 197, 94, 0.5);
  }
  
  .yesno-no {
    border-color: rgba(239, 68, 68, 0.3);
  }
  
  .yesno-no:hover {
    border-color: rgba(239, 68, 68, 0.5);
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  /* ========================================
     DROPDOWNS DE META INFO
     ======================================== */
  .poll-meta-info {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 0 8px;
    pointer-events: auto;
  }
  
  .meta-separator {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.3);
  }
  
  .dropdown-container {
    position: relative;
  }
  
  .meta-dropdown-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .meta-dropdown-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.9);
  }
  
  .meta-dropdown-btn svg {
    flex-shrink: 0;
    opacity: 0.7;
  }
  
  .chevron-icon {
    transition: transform 0.2s;
    opacity: 0.5;
  }
  
  .chevron-icon.open {
    transform: rotate(180deg);
  }
  
  .meta-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    min-width: 260px;
    max-width: 340px;
    max-height: 300px;
    overflow-y: auto;
    background: rgba(20, 20, 30, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    padding: 8px;
    z-index: 200;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(12px);
  }
  
  .duration-dropdown-max {
    left: 50%;
    transform: translateX(-50%);
  }
  
  .meta-dropdown::-webkit-scrollbar {
    width: 5px;
  }
  
  .meta-dropdown::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
  
  .dropdown-header-max {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.4);
    padding: 6px 12px 8px;
    font-weight: 600;
  }
  
  .dropdown-option-max {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    color: rgba(255, 255, 255, 0.85);
  }
  
  .dropdown-option-max:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  
  .dropdown-option-max.active {
    background: rgba(139, 92, 246, 0.15);
  }
  
  .dropdown-option-max.incomplete {
    opacity: 0.6;
  }
  
  .dropdown-option-max.incomplete .option-text-max {
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
  }
  
  .option-dot-max {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  
  .option-num-max {
    font-size: 12px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.5);
    min-width: 16px;
  }
  
  .option-text-max {
    flex: 1;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .warning-icon {
    color: #f59e0b;
    flex-shrink: 0;
  }
  
  .media-icon {
    color: rgba(255, 255, 255, 0.4);
    flex-shrink: 0;
  }
  
  .add-btn-max {
    color: rgba(139, 92, 246, 0.9);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    margin-top: 6px;
    padding-top: 12px;
  }
  
  .add-btn-max:hover {
    color: #8b5cf6;
    background: rgba(139, 92, 246, 0.1);
  }
  
  .duration-icon-max {
    color: rgba(255, 255, 255, 0.5);
    flex-shrink: 0;
  }
  
  .duration-text-max {
    flex: 1;
    font-size: 13px;
  }
  
  .check-icon-max {
    color: #8b5cf6;
    flex-shrink: 0;
    margin-left: auto;
  }
  
  .duration-dropdown-max .dropdown-option-max.active {
    background: rgba(139, 92, 246, 0.15);
  }
  
  .duration-dropdown-max .dropdown-option-max.active .duration-icon-max {
    color: #8b5cf6;
  }
  
  .dropdown-backdrop-max {
    position: fixed;
    inset: 0;
    z-index: 199;
  }
  
  /* Header del dropdown con hint de drag */
  .dropdown-header-max {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .drag-hint-max {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.3);
    font-weight: 400;
  }
  
  /* Fila de opción con drag y delete */
  .dropdown-option-row-max {
    display: flex;
    align-items: center;
    gap: 2px;
    position: relative;
    transition: all 0.15s;
  }
  
  .dropdown-option-row-max .dropdown-option-max {
    flex: 1;
  }
  
  .dropdown-option-row-max.dragging {
    opacity: 0.5;
    background: rgba(139, 92, 246, 0.1);
    border-radius: 8px;
  }
  
  .dropdown-option-row-max.drag-over {
    border-top: 2px solid #8b5cf6;
    margin-top: -2px;
  }
  
  /* Drag handle */
  .drag-handle-max {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 28px;
    color: rgba(255, 255, 255, 0.25);
    cursor: grab;
    flex-shrink: 0;
    transition: color 0.15s;
  }
  
  .drag-handle-max:hover {
    color: rgba(255, 255, 255, 0.5);
  }
  
  .drag-handle-max:active {
    cursor: grabbing;
  }
  
  /* Botón eliminar */
  .delete-btn-max {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  
  .delete-btn-max:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }
  
  /* Fecha personalizada */
  .dropdown-divider-max {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 8px 0;
  }
  
  .custom-date-btn .duration-icon-max {
    color: rgba(139, 92, 246, 0.7);
  }
  
  .custom-date-picker-max {
    padding: 8px 4px;
  }
  
  .back-btn-max {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s;
    margin-bottom: 8px;
  }
  
  .back-btn-max:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
  }
  
  .date-time-inputs-max {
    display: flex;
    gap: 10px;
    padding: 0 8px;
    align-items: flex-end;
  }
  
  .input-group-max {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .input-group-max:first-child {
    flex: 1.5;
  }
  
  .input-group-max:last-child {
    flex: 1;
    min-width: 100px;
  }
  
  .input-label-max {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 600;
  }
  
  .date-input-max,
  .time-input-max {
    width: 100%;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    color: white;
    font-size: 13px;
    outline: none;
    transition: all 0.15s;
  }
  
  .date-input-max:focus,
  .time-input-max:focus {
    border-color: rgba(139, 92, 246, 0.5);
    background: rgba(139, 92, 246, 0.08);
  }
  
  .date-input-max::-webkit-calendar-picker-indicator,
  .time-input-max::-webkit-calendar-picker-indicator {
    filter: invert(1) opacity(0.5);
    cursor: pointer;
  }
  
  .date-preview-max {
    padding: 10px 12px;
    margin: 12px 8px 8px;
    background: rgba(139, 92, 246, 0.1);
    border-radius: 8px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
    text-align: center;
  }
  
  .apply-date-btn-max {
    width: calc(100% - 16px);
    margin: 4px 8px 8px;
    padding: 12px;
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    border: none;
    border-radius: 10px;
    color: white;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .apply-date-btn-max:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
  }
  
  .apply-date-btn-max:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ========================================
     NUEVO DISEÑO - BOTONES FLOTANTES
     ======================================== */
  
  .floating-actions-max {
    position: absolute;
    right: 16px;
    bottom: 100px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 20;
  }

  .tool-btn-max {
    padding: 10px;
    border-radius: 9999px;
    background: rgba(0, 0, 0, 0.25);
    backdrop-filter: blur(8px);
    border: none;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tool-btn-max:hover {
    background: rgba(0, 0, 0, 0.45);
  }

  .tool-btn-max.active {
    background: white;
    color: #1f2937;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    transform: scale(1.1);
  }

  .tool-btn-max.danger-btn:hover {
    background: rgba(239, 68, 68, 0.8);
    color: white;
  }

  .tool-btn-max.sparkles-btn {
    opacity: 0.85;
  }

  /* === BOTONES UNIFICADOS - ESQUINA INFERIOR DERECHA === */
  .floating-actions-right {
    position: absolute;
    right: 16px;
    bottom: 16px;
    display: flex;
    flex-direction: column-reverse;
    gap: 10px;
    z-index: 30;
  }

  .tool-btn {
    padding: 10px;
    border-radius: 9999px;
    background: rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(8px);
    border: none;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tool-btn:hover {
    background: rgba(0, 0, 0, 0.55);
  }

  .tool-btn.active {
    background: white;
    color: #1f2937;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    transform: scale(1.1);
  }

  .tool-btn.danger-btn:hover {
    background: rgba(239, 68, 68, 0.8);
    color: white;
  }

  .tool-btn.sparkles-btn {
    opacity: 0.85;
  }

  /* === CAMPOS SÍ/NO - overlay superpuesto dentro del contenido === */
  .yesno-overlay {
    position: absolute;
    bottom: 16px;
    left: 0;
    right: 0;
    z-index: 25;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 0 20px;
    pointer-events: auto;
    /* Sin fondo - se integra con el GIF/imagen/video detrás */
  }

  /* Empujar contenido cuando Sí/No está activo */
  .has-yesno .text-bottom-wrapper {
    padding-bottom: 90px;
  }

  .has-yesno .card-video-bottom {
    padding-bottom: 90px;
  }

  /* Para layout GIF/imagen (position absolute) - cambiar bottom en lugar de padding */
  .has-yesno .card-bottom-content {
    bottom: 90px;
  }

  .yesno-overlay .yesno-row-max {
    width: 100%;
  }

  .yesno-overlay .option-btn-max {
    flex: 1;
    min-width: 0;
  }

  /* === MENSAJE DE CORRECTA SIN SÍ/NO === */
  .correct-hint-overlay {
    position: absolute;
    bottom: 20px;
    left: 16px;
    right: 80px;
    z-index: 25;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  .correct-answer-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 8px 14px;
    background: #22c55e;
    border-radius: 12px;
    color: white;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
  }

  .correct-answer-hint :global(svg) {
    flex-shrink: 0;
  }

  /* Botón minimizar en header */
  .minimize-btn-header {
    padding: 10px;
    border-radius: 12px;
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(8px);
    border: 2px solid #334155;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    flex-shrink: 0;
  }

  .minimize-btn-header:hover {
    border-color: #475569;
    color: white;
    background: rgba(30, 41, 59, 0.8);
  }

  .minimize-btn-header:active {
    transform: scale(0.95);
  }

  /* ========================================
     NUEVO DISEÑO - BOTONES SÍ/NO
     ======================================== */

  .card-footer-bar-new {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .yesno-row-max {
    display: flex;
    gap: 12px;
    width: 100%;
  }

  /* Etiqueta de respuesta correcta centrada */
  .yesno-correct-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 12px;
    background: #22c55e;
    border-radius: 12px;
    color: white;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
    margin-bottom: 8px;
    align-self: center;
  }

  .yesno-correct-label :global(svg) {
    flex-shrink: 0;
  }

  /* Etiqueta "Selecciona el botón correcto" - amarillo pastel */
  .yesno-select-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 12px;
    background: #fef3c7;
    border-radius: 12px;
    color: #92400e;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);
    margin-bottom: 8px;
    align-self: center;
  }

  .yesno-select-label :global(svg) {
    flex-shrink: 0;
    color: #f59e0b;
  }

  .option-btn-max {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 16px;
    background: white;
    border: 2px solid transparent;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    transition: all 0.2s;
    overflow: hidden;
  }

  .option-btn-max:hover {
    border-color: rgba(236, 72, 153, 0.2);
  }

  .option-btn-max.selected {
    border-color: #22c55e;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3);
  }

  .option-selector-max {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: transparent;
    transition: all 0.2s;
    z-index: 10;
  }

  .option-selector-max.selected {
    background: #22c55e;
    border-color: #22c55e;
    color: white;
  }

  .option-content-max {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .option-content-max :global(.thumbs-up-max) {
    color: #22c55e;
    fill: #dcfce7;
    flex-shrink: 0;
  }

  .option-content-max :global(.thumbs-down-max) {
    color: #ef4444;
    fill: #fee2e2;
    flex-shrink: 0;
  }

  .option-input-max {
    flex: 1;
    background: #f1f5f9;
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 8px 12px;
    font-weight: 700;
    font-size: 14px;
    color: #334155;
    outline: none;
    transition: all 0.2s;
    min-width: 0;
  }

  .option-input-max::placeholder {
    color: #94a3b8;
  }

  .option-input-max:hover {
    background: #e2e8f0;
  }

  .option-input-max:focus {
    background: white;
    border-color: rgba(34, 197, 94, 0.5);
  }
</style>
