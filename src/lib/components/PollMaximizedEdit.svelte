<script lang="ts">
  import { X, Sparkles, Trash2, CircleCheck, Loader2, Plus, Minimize2 } from "lucide-svelte";
  import { fade, fly } from "svelte/transition";
  import { onMount } from "svelte";
  import MediaEmbed from "./MediaEmbed.svelte";

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
    onPublish,
    canPublish = false,
  }: Props = $props();

  let activeIndex = $derived(options.findIndex((o) => o.id === activeOptionId));
  let scrollContainer: HTMLElement | null = null;
  let isScrollingProgrammatically = false;
  let prevOptionsLength = $state(options.length);

  // Manejar botón atrás del navegador
  onMount(() => {
    history.pushState({ modal: 'maximizedEdit' }, '');
    
    const handlePopState = () => {
      onClose();
    };
    
    const handleCloseModals = () => {
      onClose();
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
  type MediaType = "youtube" | "vimeo" | "image" | "text" | "spotify" | "soundcloud" | "tiktok" | "twitch" | "twitter" | "applemusic" | "deezer" | "dailymotion" | "bandcamp";
  
  function getMediaType(opt: PollOption): MediaType {
    const url = (opt.imageUrl || extractUrlFromText(opt.label) || '').toLowerCase();
    if (!url) return "text";
    // Video platforms
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
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
    return "image";
  }

  function getMediaUrl(opt: PollOption): string {
    return opt.imageUrl || extractUrlFromText(opt.label) || '';
  }
</script>

<div
  class="fixed inset-0 z-[2147483640] w-full h-full flex flex-col overflow-hidden select-none maximized-edit"
>
  <!-- HEADER -->
  <div class="absolute top-0 left-0 w-full z-50 flex flex-col pointer-events-none">
    <!-- DataBar / Indicadores -->
    <div class="w-full px-2 flex gap-0.5 h-1.5 pointer-events-auto mt-2 z-50">
      {#each options as opt, idx}
        {@const isActive = idx === activeIndex}
        <button
          class="h-full transition-all duration-700 ease-out overflow-hidden relative rounded-sm flex-1 cursor-pointer"
          style:background-color={opt.color}
          style:transform={isActive ? "scaleY(1.5)" : "scaleY(1)"}
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
          placeholder="Escribe tu pregunta..."
          value={pollTitle}
          oninput={(e) => onTitleChange(e.currentTarget.value)}
          rows="2"
          maxlength="200"
        ></textarea>
        
        <!-- Botón publicar -->
        <button 
          onclick={onPublish}
          class="publish-btn-header"
          aria-label="Publicar encuesta"
          disabled={!canPublish}
        >
          Publicar
        </button>
      </div>
      
      <!-- Info de opciones y tiempo -->
      <div class="poll-meta-info">
        <div class="meta-item-row">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span>{totalOptions || options.length} opciones</span>
        </div>
        <span class="meta-separator">•</span>
        <div class="meta-item-row">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <select class="duration-select-maximized" bind:value={duration} onchange={(e) => onDurationChange?.(e.currentTarget.value)}>
            <option value="1d">1 día</option>
            <option value="3d">3 días</option>
            <option value="7d">7 días</option>
            <option value="30d">30 días</option>
            <option value="never">Sin límite</option>
          </select>
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
      {@const type = getMediaType(opt)}
      {@const mediaUrl = getMediaUrl(opt)}
      {@const labelText = getLabelWithoutUrl(opt.label)}
      {@const isVideoType = type !== 'image' && type !== 'text'}
      {@const isMusicType = ['spotify', 'soundcloud', 'applemusic', 'deezer', 'bandcamp'].includes(type)}
      {@const isGifType = opt.imageUrl && (opt.imageUrl.includes('giphy.com') || opt.imageUrl.includes('tenor.com') || /\.gif([?#]|$)/i.test(opt.imageUrl))}
      
      <div
        class="w-full h-full flex-shrink-0 snap-center relative"
        style="scroll-snap-stop: always;"
      >
        <!-- SlideContent -->
        <div class="w-full h-full relative overflow-hidden">
          
          <!-- CARD CONTAINER - Igual que PollMaximizedView -->
          <div class="option-card-container">
            <div class="option-card-rounded">
              
              {#if type === "text"}
                <!-- === LAYOUT SOLO TEXTO === -->
                <!-- Área principal con color de fondo y comillas -->
                <div class="card-content-area" style="background-color: {opt.color};">
                  <!-- Comillas decorativas -->
                  <span class="quote-decoration quote-open">"</span>
                  <span class="quote-decoration quote-close">"</span>
                  
                  <!-- Texto editable centrado -->
                  <div class="text-center-wrapper">
                    <textarea
                      class="{labelText.length > 60 ? 'text-3xl' : labelText.length > 40 ? 'text-4xl' : 'text-5xl'} font-bold text-white uppercase tracking-tighter leading-tight break-words text-center bg-transparent border-none outline-none w-full resize-none placeholder-gray-300 pointer-events-auto"
                      placeholder="Opción {i + 1}"
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
                      rows="4"
                    ></textarea>
                  </div>
                  
                  <!-- Botones de edición VERTICALES -->
                  <div class="edit-buttons-vertical">
                    <!-- Botón Sí/No -->
                    <button
                      type="button"
                      class="edit-btn yesno-btn"
                      class:active={opt.isYesNo}
                      onclick={(e) => { e.stopPropagation(); onToggleYesNo?.(opt.id); }}
                      aria-label="Activar votación Sí/No"
                      title="Sí/No"
                    >
                      <svg class="w-9 h-9" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="16" cy="16" r="16" fill="#808080"></circle>
                        <circle cx="16" cy="16" r="14" fill="#333333"></circle>
                        <path d="M 16 2 A 14 14 0 0 0 16 30 Z" fill="#EEEEEE"></path>
                        <circle cx="16" cy="9" r="7" fill="#EEEEEE"></circle>
                        <circle cx="16" cy="23" r="7" fill="#333333"></circle>
                        <path d="M12 9 L15 12 L20 6" stroke="#333333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                        <path d="M13 20 L19 26 M19 20 L13 26" stroke="#EEEEEE" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                      </svg>
                    </button>
                    <!-- Botón Marcar Correcta (oculto si isYesNo) -->
                    {#if !opt.isYesNo}
                      <button
                        type="button"
                        class="edit-btn correct-btn"
                        class:active={opt.isCorrect}
                        onclick={(e) => { e.stopPropagation(); onToggleCorrect?.(opt.id); }}
                        aria-label="Marcar como correcta"
                        title="Correcta"
                      >
                        <CircleCheck size={20} strokeWidth={1.5} />
                      </button>
                    {/if}
                    <!-- Color picker -->
                    <button
                      type="button"
                      class="edit-btn color-btn"
                      style:background-color={opt.color}
                      onclick={(e) => { e.stopPropagation(); onOpenColorPicker(opt.id); }}
                      aria-label="Cambiar color"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                    </button>
                    <!-- Giphy picker -->
                    <button
                      type="button"
                      class="edit-btn giphy-btn"
                      onclick={(e) => { e.stopPropagation(); onOpenGiphyPicker(opt.id); }}
                      aria-label="Buscar GIF"
                    >
                      <Sparkles size={20} strokeWidth={1.5} />
                    </button>
                    <!-- Eliminar opción -->
                    {#if options.length > 2 && i > 0}
                      <button
                        type="button"
                        class="edit-btn delete-btn"
                        onclick={(e) => { e.stopPropagation(); onRemoveOption(opt.id); }}
                        aria-label="Eliminar opción"
                      >
                        <Trash2 size={20} strokeWidth={1.5} class="text-white" />
                      </button>
                    {/if}
                  </div>
                  
                  <!-- Contador de caracteres encima de la línea -->
                  <div class="char-counter-above">
                    <span class="text-white/50 text-xs">{labelText.length}/200</span>
                  </div>
                  
                  <!-- Línea divisoria en el borde inferior -->
                  <div class="card-divider-line card-divider-bottom"></div>
                </div>
                
                <!-- Barra inferior -->
                <div class="card-footer-bar" style="background-color: {opt.color};">
                  {#if opt.isYesNo}
                    <!-- Campos editables de Sí/No con indicador de correcta -->
                    <div class="yesno-row">
                      <button
                        type="button"
                        class="yesno-input yesno-yes"
                        class:correct={opt.correctAnswer === 'yes'}
                        style="color: {opt.color}"
                        onclick={(e) => { e.stopPropagation(); onToggleCorrect?.(opt.id, 'yes'); }}
                      >
                        <CircleCheck size={20} class={opt.correctAnswer === 'yes' ? 'correct-icon active' : 'correct-icon'} />
                        <input
                          type="text"
                          inputmode="text"
                          placeholder="👍 Sí"
                          value={opt.yesText || ''}
                          oninput={(e) => { e.stopPropagation(); onYesNoTextChange?.(opt.id, e.currentTarget.value, opt.noText || ''); }}
                          onclick={(e) => e.stopPropagation()}
                        />
                      </button>
                      <button
                        type="button"
                        class="yesno-input yesno-no"
                        class:correct={opt.correctAnswer === 'no'}
                        style="color: {opt.color}"
                        onclick={(e) => { e.stopPropagation(); onToggleCorrect?.(opt.id, 'no'); }}
                      >
                        <CircleCheck size={20} class={opt.correctAnswer === 'no' ? 'correct-icon active' : 'correct-icon'} />
                        <input
                          type="text"
                          inputmode="text"
                          placeholder="👎 No"
                          value={opt.noText || ''}
                          oninput={(e) => { e.stopPropagation(); onYesNoTextChange?.(opt.id, opt.yesText || '', e.currentTarget.value); }}
                          onclick={(e) => e.stopPropagation()}
                        />
                      </button>
                    </div>
                  {/if}
                  
                  <!-- Mensaje de opción correcta -->
                  {#if opt.isYesNo && opt.correctAnswer}
                    <div class="correct-answer-hint">
                      <CircleCheck size={12} />
                      <span>"{opt.correctAnswer === 'yes' ? (opt.yesText || 'Sí') : (opt.noText || 'No')}" es correcta</span>
                    </div>
                  {:else if !opt.isYesNo && opt.isCorrect}
                    <div class="correct-answer-hint">
                      <CircleCheck size={12} />
                      <span>Esta opción es correcta</span>
                    </div>
                  {/if}
                </div>
                
              {:else if isVideoType}
                <!-- === LAYOUT VIDEO/SPOTIFY === -->
                <div class="card-video-wrapper {isMusicType ? 'is-music' : ''}" style="background-color: {opt.color};">
                  <!-- Área de video/música -->
                  <div class="card-video-area {isMusicType ? 'is-music' : ''}">
                    {#if i === activeIndex}
                      {#key `video-edit-${opt.id}-${activeIndex}`}
                        <MediaEmbed
                          url={mediaUrl}
                          mode="full"
                          width="100%"
                          height="100%"
                          autoplay={true}
                        />
                      {/key}
                    {:else}
                      <div class="w-full h-full flex items-center justify-center bg-black">
                        <span class="text-white/50"></span>
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
                  
                  <!-- Contenido debajo del video -->
                  <div class="card-video-bottom">
                    <!-- Label editable -->
                    <textarea
                      class="{labelText.length > 40 ? 'text-xl' : labelText.length > 25 ? 'text-2xl' : 'text-3xl'} font-bold text-white uppercase tracking-tighter leading-tight bg-transparent border-none outline-none w-full resize-none placeholder-white/50 pointer-events-auto card-bottom-label"
                      placeholder="Opción {i + 1}"
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
                    
                    <!-- Botones de edición VERTICALES -->
                    <div class="edit-buttons-vertical">
                      <!-- Botón Sí/No -->
                      <button
                        type="button"
                        class="edit-btn yesno-btn"
                        class:active={opt.isYesNo}
                        onclick={(e) => { e.stopPropagation(); onToggleYesNo?.(opt.id); }}
                        aria-label="Activar votación Sí/No"
                        title="Sí/No"
                      >
                        <svg class="w-9 h-9" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="16" cy="16" r="16" fill="#808080"></circle>
                          <circle cx="16" cy="16" r="14" fill="#333333"></circle>
                          <path d="M 16 2 A 14 14 0 0 0 16 30 Z" fill="#EEEEEE"></path>
                          <circle cx="16" cy="9" r="7" fill="#EEEEEE"></circle>
                          <circle cx="16" cy="23" r="7" fill="#333333"></circle>
                          <path d="M12 9 L15 12 L20 6" stroke="#333333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                          <path d="M13 20 L19 26 M19 20 L13 26" stroke="#EEEEEE" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                        </svg>
                      </button>
                      <!-- Botón Marcar Correcta -->
                      <button
                        type="button"
                        class="edit-btn correct-btn"
                        class:active={opt.isCorrect}
                        onclick={(e) => { e.stopPropagation(); onToggleCorrect?.(opt.id); }}
                        aria-label="Marcar como correcta"
                        title="Correcta"
                      >
                        <CircleCheck size={20} strokeWidth={1.5} />
                      </button>
                      <!-- Color picker -->
                      <button
                        type="button"
                        class="edit-btn color-btn"
                        style:background-color={opt.color}
                        onclick={(e) => { e.stopPropagation(); onOpenColorPicker(opt.id); }}
                        aria-label="Cambiar color"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                      </button>
                      <!-- Giphy picker -->
                      <button
                        type="button"
                        class="edit-btn giphy-btn"
                        onclick={(e) => { e.stopPropagation(); onOpenGiphyPicker(opt.id); }}
                        aria-label="Buscar GIF"
                      >
                        <Sparkles size={20} strokeWidth={1.5} />
                      </button>
                      <!-- Eliminar opción -->
                      {#if options.length > 2 && i > 0}
                        <button
                          type="button"
                          class="edit-btn delete-btn"
                          onclick={(e) => { e.stopPropagation(); onRemoveOption(opt.id); }}
                          aria-label="Eliminar opción"
                        >
                          <Trash2 size={20} strokeWidth={1.5} class="text-white" />
                        </button>
                      {/if}
                    </div>
                    
                    <!-- Contador encima de línea -->
                    <div class="char-counter-above">
                      <span class="text-white/50 text-xs">{labelText.length}/200</span>
                    </div>
                    
                    <!-- Línea divisoria -->
                    <div class="card-divider-line"></div>
                    
                    <!-- Campos Sí/No -->
                    {#if opt.isYesNo}
                      <div class="yesno-row">
                        <input
                          type="text"
                          class="yesno-input yesno-yes"
                          placeholder="👍 Sí"
                          value={opt.yesText || ''}
                          oninput={(e) => onYesNoTextChange?.(opt.id, e.currentTarget.value, opt.noText || '')}
                          onclick={(e) => e.stopPropagation()}
                        />
                        <input
                          type="text"
                          class="yesno-input yesno-no"
                          placeholder="👎 No"
                          value={opt.noText || ''}
                          oninput={(e) => onYesNoTextChange?.(opt.id, opt.yesText || '', e.currentTarget.value)}
                          onclick={(e) => e.stopPropagation()}
                        />
                      </div>
                    {/if}
                  </div>
                </div>
                
              {:else}
                <!-- === LAYOUT GIF/IMAGEN === -->
                <!-- Wrapper con borde del color de la opción -->
                <div class="card-media-border" style="--border-color: {opt.color};">
                  <!-- Imagen a pantalla completa con contenido overlay -->
                  <div class="card-media-fullscreen">
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
                        <div class="w-full h-full flex items-center justify-center bg-black">
                          <span class="text-white/50"></span>
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
                      <!-- Label editable -->
                      <textarea
                        class="{labelText.length > 40 ? 'text-xl' : labelText.length > 25 ? 'text-2xl' : 'text-3xl'} font-bold text-white uppercase tracking-tighter leading-tight bg-transparent border-none outline-none w-full resize-none placeholder-white/50 pointer-events-auto card-bottom-label"
                        placeholder="Opción {i + 1}"
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
                      
                      <!-- Botones de edición VERTICALES -->
                      <div class="edit-buttons-vertical">
                        <!-- Botón Sí/No -->
                        <button
                          type="button"
                          class="edit-btn yesno-btn"
                          class:active={opt.isYesNo}
                          onclick={(e) => { e.stopPropagation(); onToggleYesNo?.(opt.id); }}
                          aria-label="Activar votación Sí/No"
                          title="Sí/No"
                        >
                          <svg class="w-9 h-9" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="16" cy="16" r="16" fill="#808080"></circle>
                            <circle cx="16" cy="16" r="14" fill="#333333"></circle>
                            <path d="M 16 2 A 14 14 0 0 0 16 30 Z" fill="#EEEEEE"></path>
                            <circle cx="16" cy="9" r="7" fill="#EEEEEE"></circle>
                            <circle cx="16" cy="23" r="7" fill="#333333"></circle>
                            <path d="M12 9 L15 12 L20 6" stroke="#333333" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                            <path d="M13 20 L19 26 M19 20 L13 26" stroke="#EEEEEE" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                          </svg>
                        </button>
                        <!-- Botón Marcar Correcta -->
                        <button
                          type="button"
                          class="edit-btn correct-btn"
                          class:active={opt.isCorrect}
                          onclick={(e) => { e.stopPropagation(); onToggleCorrect?.(opt.id); }}
                          aria-label="Marcar como correcta"
                          title="Correcta"
                        >
                          <CircleCheck size={20} strokeWidth={1.5} />
                        </button>
                        <!-- Color picker -->
                        <button
                          type="button"
                          class="edit-btn color-btn"
                          style:background-color={opt.color}
                          onclick={(e) => { e.stopPropagation(); onOpenColorPicker(opt.id); }}
                          aria-label="Cambiar color"
                        >
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                          </svg>
                        </button>
                        <!-- Giphy picker -->
                        <button
                          type="button"
                          class="edit-btn giphy-btn"
                          onclick={(e) => { e.stopPropagation(); onOpenGiphyPicker(opt.id); }}
                          aria-label="Buscar GIF"
                        >
                          <Sparkles size={20} strokeWidth={1.5} />
                        </button>
                        <!-- Eliminar opción -->
                        {#if options.length > 2 && i > 0}
                          <button
                            type="button"
                            class="edit-btn delete-btn"
                            onclick={(e) => { e.stopPropagation(); onRemoveOption(opt.id); }}
                            aria-label="Eliminar opción"
                          >
                            <Trash2 size={20} strokeWidth={1.5} class="text-white" />
                          </button>
                        {/if}
                      </div>
                      
                      <!-- Contador encima de línea -->
                      <div class="char-counter-above">
                        <span class="text-white/50 text-xs">{labelText.length}/200</span>
                      </div>
                      
                      <!-- Línea divisoria -->
                      <div class="card-divider-line"></div>
                      
                      <!-- Campos Sí/No -->
                      {#if opt.isYesNo}
                        <div class="yesno-row">
                          <input
                            type="text"
                            class="yesno-input yesno-yes"
                            placeholder="👍 Sí"
                            value={opt.yesText || ''}
                            oninput={(e) => onYesNoTextChange?.(opt.id, e.currentTarget.value, opt.noText || '')}
                            onclick={(e) => e.stopPropagation()}
                          />
                          <input
                            type="text"
                            class="yesno-input yesno-no"
                            placeholder="👎 No"
                            value={opt.noText || ''}
                            oninput={(e) => onYesNoTextChange?.(opt.id, opt.yesText || '', e.currentTarget.value)}
                            onclick={(e) => e.stopPropagation()}
                          />
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}
              
            </div>
          </div>
        </div>
      </div>
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
    padding: 120px 12px 80px;
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

  .text-center-wrapper {
    padding: 24px;
    max-width: 90%;
    z-index: 2;
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
    z-index: 50;
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
    text-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.7),
      0 4px 16px rgba(0, 0, 0, 0.5);
  }

  /* Línea divisoria blanca fina */
  .card-divider-line {
    width: 100%;
    height: 1px;
    background: rgba(255, 255, 255, 0.4);
  }

  .card-bottom-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
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
    background: rgba(239, 68, 68, 0.3);
    border-color: rgba(239, 68, 68, 0.5);
  }
  
  .edit-btn.delete-btn:hover {
    background: rgba(239, 68, 68, 0.5);
    border-color: rgba(239, 68, 68, 0.8);
  }
  
  /* Botón Sí/No */
  .edit-btn.yesno-btn {
    background: rgba(30, 30, 35, 0.8);
    border-color: rgba(255, 255, 255, 0.3);
    padding: 6px;
  }
  
  .edit-btn.yesno-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.5);
  }
  
  .edit-btn.yesno-btn.active {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.6);
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
    right: 16px;
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
    transform: scale(0.95);
  }
  
  /* Responsive */
  @media (max-width: 480px) {
    .option-card-container {
      padding: 110px 8px 70px;
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
    
    .text-center-wrapper {
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
    background: rgba(255, 255, 255, 0.15);
    border-color: white;
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.2);
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
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border-color: rgba(16, 185, 129, 0.5);
  }
  
  .footer-btn.add-btn:hover {
    border-color: rgba(16, 185, 129, 0.8);
    box-shadow: 0 0 16px rgba(16, 185, 129, 0.4);
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .animate-spin {
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
  
  .meta-item-row {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }
  
  .meta-item-row svg {
    flex-shrink: 0;
    opacity: 0.7;
  }
  
  .meta-separator {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.3);
  }
  
  .duration-select-maximized {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    cursor: pointer;
    padding: 0;
    outline: none;
    pointer-events: auto;
  }
  
  .duration-select-maximized:hover {
    color: rgba(255, 255, 255, 0.8);
  }
  
  .duration-select-maximized option {
    background: #1a1a2e;
    color: white;
  }
  
  /* Contador de caracteres encima de línea */
  .char-counter-above {
    position: absolute;
    bottom: 8px;
    left: 12px;
    font-size: 10px;
    color: #9ca3af;
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
  
  /* Mensaje de opción correcta flotante al lado */
  .correct-answer-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    margin-top: 6px;
    background: #22c55e;
    border-radius: 16px;
    color: white;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
    animation: fadeIn 0.2s ease-out;
  }
  
  .correct-answer-hint :global(svg) {
    flex-shrink: 0;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
