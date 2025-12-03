<script lang="ts">
  import { X, Sparkles, Trash2, ChevronDown } from "lucide-svelte";
  import { fade, fly } from "svelte/transition";
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
  function getMediaType(opt: PollOption): "youtube" | "vimeo" | "image" | "text" | "spotify" {
    const url = opt.imageUrl || extractUrlFromText(opt.label);
    if (!url) return "text";
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
    if (url.includes("vimeo.com")) return "vimeo";
    if (url.includes("spotify.com")) return "spotify";
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
          class="font-serif italic text-xl md:text-2xl leading-tight flex-1 bg-transparent border-none outline-none text-white placeholder-white/50 resize-none pointer-events-auto"
          placeholder="Escribe tu pregunta..."
          value={pollTitle}
          oninput={(e) => onTitleChange(e.currentTarget.value)}
          rows="2"
          maxlength="200"
        ></textarea>
        
        <!-- Botón minimizar -->
        <button 
          onclick={onClose} 
          class="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center border border-white/20 flex-shrink-0 pointer-events-auto transition-all hover:bg-black/60 active:scale-95"
          aria-label="Minimizar"
        >
          <ChevronDown size={18} class="text-white" />
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
      
      <div
        class="w-full h-full flex-shrink-0 snap-center relative"
        style="scroll-snap-stop: always;"
      >
        <!-- SlideContent -->
        <div class="w-full h-full relative overflow-hidden">
          {#if type === "text"}
            <!-- SOLO TEXTO - Igual que PollMaximizedView -->
            <div
              class="w-full h-full flex flex-col items-center justify-center px-6 py-16 text-center relative overflow-hidden"
              style="background-color: {opt.color};"
            >
              <!-- Marco decorativo para la opción -->
              <div class="option-card-frame">
                <div class="option-card-inner">
                  <textarea
                    class="text-5xl md:text-7xl font-bold text-white uppercase tracking-tighter leading-none break-words bg-transparent border-none outline-none w-full text-center resize-none overflow-auto placeholder-white/50 pointer-events-auto"
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
                  
                  <!-- Contador de caracteres -->
                  <div class="text-white/50 text-sm">
                    {labelText.length}/200
                  </div>
                </div>
              </div>
              
              <!-- Barra de herramientas de edición -->
              <div class="edit-toolbar">
                <span class="text-white/60 text-sm">Opción {i + 1} de {options.length}</span>
                <div class="flex gap-3">
                  <!-- Color picker -->
                  <button
                    type="button"
                    class="edit-btn color-btn"
                    style:background-color={opt.color}
                    onclick={(e) => { e.stopPropagation(); onOpenColorPicker(opt.id); }}
                    aria-label="Cambiar color"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  </button>
                  
                  <!-- Giphy picker -->
                  <button
                    type="button"
                    class="edit-btn giphy-btn"
                    onclick={(e) => { e.stopPropagation(); onOpenGiphyPicker(opt.id); }}
                    aria-label="Buscar GIF"
                  >
                    <Sparkles size={20} />
                  </button>
                  
                  <!-- Eliminar opción -->
                  {#if options.length > 2 && i > 0}
                    <button
                      type="button"
                      class="edit-btn delete-btn"
                      style:background-color={opt.color}
                      onclick={(e) => { e.stopPropagation(); onRemoveOption(opt.id); }}
                      aria-label="Eliminar opción"
                    >
                      <Trash2 size={20} class="text-white" />
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          {:else}
            <!-- MEDIA CONTENT - Diseño tipo tarjeta flotante igual que PollMaximizedView -->
            <div 
              class="w-full h-full grid grid-rows-[1fr_auto]"
              style="background-color: {opt.color};"
            >
              <!-- Área superior con la tarjeta flotante -->
              <div class="flex items-start justify-center px-1 pt-28 pb-4 overflow-hidden relative">
                <div class="floating-media-card">
                  <div class="floating-media-inner">
                    {#if Math.abs(i - activeIndex) <= 1}
                      <MediaEmbed
                        url={mediaUrl}
                        mode="full"
                        width="100%"
                        height="100%"
                        autoplay={i === activeIndex}
                      />
                    {:else}
                      <div class="w-full h-full flex items-center justify-center bg-black/20">
                        <span class="text-white/50">Cargando...</span>
                      </div>
                    {/if}
                  </div>
                </div>
                
                <!-- Botón eliminar media -->
                <button
                  type="button"
                  class="remove-media-btn"
                  onclick={(e) => { e.stopPropagation(); onRemoveMedia(opt.id); }}
                  aria-label="Eliminar media"
                >
                  <X size={20} />
                </button>
              </div>
              
              <!-- Panel inferior glassmorphism -->
              <div class="floating-glass-panel">
                <div class="option-card-frame">
                  <div class="option-card-inner">
                    <textarea
                      class="text-3xl md:text-4xl font-bold text-white uppercase tracking-tighter leading-none break-words bg-transparent border-none outline-none w-full text-left resize-none overflow-auto placeholder-white/50 pointer-events-auto"
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
                    
                    <!-- Barra de herramientas -->
                    <div class="w-full flex items-center justify-between mt-3">
                      <span class="text-white/50 text-sm">{labelText.length}/200</span>
                      <div class="flex gap-3">
                        <!-- Color picker -->
                        <button
                          type="button"
                          class="edit-btn color-btn"
                          style:background-color={opt.color}
                          onclick={(e) => { e.stopPropagation(); onOpenColorPicker(opt.id); }}
                          aria-label="Cambiar color"
                        >
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                          </svg>
                        </button>
                        
                        <!-- Giphy picker -->
                        <button
                          type="button"
                          class="edit-btn giphy-btn"
                          onclick={(e) => { e.stopPropagation(); onOpenGiphyPicker(opt.id); }}
                          aria-label="Buscar GIF"
                        >
                          <Sparkles size={20} />
                        </button>
                        
                        <!-- Eliminar opción -->
                        {#if options.length > 2 && i > 0}
                          <button
                            type="button"
                            class="edit-btn delete-btn"
                            style:background-color={opt.color}
                            onclick={(e) => { e.stopPropagation(); onRemoveOption(opt.id); }}
                            aria-label="Eliminar opción"
                          >
                            <Trash2 size={20} class="text-white" />
                          </button>
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/if}
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
  }
  
  textarea::placeholder {
    text-shadow: none;
  }
  
  /* Marco decorativo para opciones */
  .option-card-frame {
    position: relative;
    max-width: 90%;
    width: 100%;
    padding: 3px;
    border-radius: 24px;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.4) 0%,
      rgba(255, 255, 255, 0.1) 50%,
      rgba(255, 255, 255, 0.3) 100%
    );
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  
  .option-card-inner {
    position: relative;
    background: rgba(0, 0, 0, 0.25);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: 22px;
    padding: 32px 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  
  /* Floating media card */
  .floating-media-card {
    position: relative;
    width: 100%;
    height: 100%;
    max-height: 100%;
    padding: 8px;
    background: white;
    border-radius: 20px;
    box-shadow: 
      0 20px 60px rgba(0, 0, 0, 0.3),
      0 8px 20px rgba(0, 0, 0, 0.2);
  }
  
  .floating-media-inner {
    width: 100%;
    height: 100%;
    border-radius: 14px;
    overflow: hidden;
    background: #000;
  }
  
  .floating-media-inner :global(img),
  .floating-media-inner :global(video) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  /* Panel inferior glassmorphism */
  .floating-glass-panel {
    display: flex;
    justify-content: center;
    padding: 0;
  }
  
  .floating-glass-panel .option-card-frame {
    max-width: 100%;
    width: 100%;
    border-radius: 24px 24px 0 0;
    padding-bottom: 120px;
  }
  
  .floating-glass-panel .option-card-inner {
    padding: 20px 24px 40px 24px;
    border-radius: 22px 22px 0 0;
    align-items: flex-start;
  }
  
  /* Barra de herramientas de edición */
  .edit-toolbar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    padding-bottom: 80px;
    background: linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%);
    z-index: 10;
    pointer-events: auto;
  }
  
  /* Botones de edición */
  .edit-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  .edit-btn:hover {
    transform: scale(1.1);
  }
  
  .edit-btn.color-btn {
    /* Color se aplica con style */
  }
  
  .edit-btn.giphy-btn {
    background: rgba(30, 30, 35, 0.9);
    backdrop-filter: blur(10px);
    border-color: rgba(147, 197, 253, 0.5);
  }
  
  .edit-btn.giphy-btn:hover {
    background: rgba(147, 197, 253, 0.2);
    border-color: rgba(147, 197, 253, 0.9);
  }
  
  .edit-btn.delete-btn {
    border-radius: 12px;
  }
  
  .edit-btn.delete-btn:hover {
    filter: brightness(1.2);
  }
  
  /* Botón eliminar media */
  .remove-media-btn {
    position: absolute;
    top: 100px;
    right: 16px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    border: 2px solid rgba(255, 255, 255, 0.5);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 100;
    transition: all 0.2s ease;
    pointer-events: auto;
  }
  
  .remove-media-btn:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: scale(1.1);
    border-color: white;
  }
  
  /* Responsive */
  @media (max-width: 480px) {
    .option-card-frame {
      max-width: 95%;
      padding: 2px;
      border-radius: 20px;
    }
    
    .option-card-inner {
      padding: 24px 20px;
      border-radius: 18px;
      gap: 12px;
    }
    
    .floating-glass-panel .option-card-frame {
      border-radius: 20px 20px 0 0;
      padding-bottom: 110px;
    }
    
    .floating-glass-panel .option-card-inner {
      padding: 16px 20px 36px 20px;
      border-radius: 18px 18px 0 0;
    }
    
    .edit-btn {
      width: 40px;
      height: 40px;
    }
  }
</style>
