<script lang="ts">
  import { X, Sparkles, Trash2, ChevronRight } from "lucide-svelte";
  import { fade, fly } from "svelte/transition";
  import { onMount } from "svelte";
  import MediaEmbed from "./MediaEmbed.svelte";

  // --- INTERFACES ---
  interface PollOption {
    id: string;
    label: string;
    color: string;
    imageUrl?: string;
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
    extractUrlFromText: (text: string) => string | null;
    getLabelWithoutUrl: (label: string) => string;
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
    extractUrlFromText,
    getLabelWithoutUrl,
  }: Props = $props();

  let activeIndex = $derived(options.findIndex((o) => o.id === activeOptionId));
  let scrollContainer: HTMLElement | null = null;
  let isScrollingProgrammatically = false;

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
        
        <!-- Botón minimizar -->
        <button 
          onclick={onClose} 
          class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 pointer-events-auto border border-gray-400"
          aria-label="Minimizar"
        >
          <ChevronRight size={22} strokeWidth={2} class="text-gray-300" />
        </button>
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
                      class="{labelText.length > 60 ? 'text-3xl' : labelText.length > 40 ? 'text-4xl' : 'text-5xl'} font-bold text-white uppercase tracking-tighter leading-tight break-words text-center bg-transparent border-none outline-none w-full resize-none placeholder-white/50 pointer-events-auto"
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
                  
                  <!-- Línea divisoria en el borde inferior -->
                  <div class="card-divider-line card-divider-bottom"></div>
                </div>
                
                <!-- Barra inferior -->
                <div class="card-footer-bar" style="background-color: {opt.color};">
                  <div class="card-bottom-row">
                    <span class="text-white/50 text-sm">{labelText.length}/200</span>
                    <div class="flex gap-2">
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
                        <Sparkles size={24} strokeWidth={1.5} />
                      </button>
                      
                      <!-- Eliminar opción -->
                      {#if options.length > 2 && i > 0}
                        <button
                          type="button"
                          class="edit-btn delete-btn"
                          onclick={(e) => { e.stopPropagation(); onRemoveOption(opt.id); }}
                          aria-label="Eliminar opción"
                        >
                          <Trash2 size={24} strokeWidth={1.5} class="text-white" />
                        </button>
                      {/if}
                    </div>
                  </div>
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
                    
                    <!-- Línea divisoria -->
                    <div class="card-divider-line"></div>
                    
                    <!-- Barra de herramientas -->
                    <div class="card-bottom-row">
                      <span class="text-white/50 text-sm">{labelText.length}/200</span>
                      <div class="flex gap-2">
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
                          <Sparkles size={24} strokeWidth={1.5} />
                        </button>
                        
                        <!-- Eliminar opción -->
                        {#if options.length > 2 && i > 0}
                          <button
                            type="button"
                            class="edit-btn delete-btn"
                            onclick={(e) => { e.stopPropagation(); onRemoveOption(opt.id); }}
                            aria-label="Eliminar opción"
                          >
                            <Trash2 size={24} strokeWidth={1.5} class="text-white" />
                          </button>
                        {/if}
                      </div>
                    </div>
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
                      
                      <!-- Línea divisoria -->
                      <div class="card-divider-line"></div>
                      
                      <!-- Barra de herramientas -->
                      <div class="card-bottom-row">
                        <span class="text-white/50 text-sm">{labelText.length}/200</span>
                        <div class="flex gap-2">
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
                            <Sparkles size={24} strokeWidth={1.5} />
                          </button>
                          
                          <!-- Eliminar opción -->
                          {#if options.length > 2 && i > 0}
                            <button
                              type="button"
                              class="edit-btn delete-btn"
                              onclick={(e) => { e.stopPropagation(); onRemoveOption(opt.id); }}
                              aria-label="Eliminar opción"
                            >
                              <Trash2 size={24} strokeWidth={1.5} class="text-white" />
                            </button>
                          {/if}
                        </div>
                      </div>
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
    padding: 110px 12px 70px;
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
      padding: 100px 8px 60px;
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
</style>
