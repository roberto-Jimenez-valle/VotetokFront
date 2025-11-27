<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    Share2,
    Globe,
    Zap,
    BarChart3,
    Music,
    Youtube,
    Video,
    Type,
    AlignLeft,
    User,
    MoreHorizontal,
    X,
    ChevronDown,
    Check,
    MessageCircle,
    MoreVertical,
    Activity,
    Repeat2,
    Eye,
    Bookmark,
    Flag,
    EyeOff,
    Link,
    Square,
    SquareCheck,
  } from "lucide-svelte";
  import { fade, fly, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import MediaEmbed from "./MediaEmbed.svelte";
  import AuthModal from "../AuthModal.svelte";

  // --- INTERFACES ---
  interface PollOption {
    id: string;
    label: string;
    color: string;
    imageUrl?: string;
    pct?: number;
    votes?: number;
    voted?: boolean;
    // Campos adicionales para el nuevo diseño (opcionales para compatibilidad)
    type?: "youtube" | "vimeo" | "image" | "text" | "spotify";
    artist?: string;
    description?: string;
    youtubeId?: string;
    vimeoId?: string;
  }

  interface PollCreator {
    id?: number;
    username: string;
    avatar?: string;
  }

  interface PollStats {
    totalVotes: number;
    totalViews: number;
  }

  interface Friend {
    id: string;
    name: string;
    username?: string;
    avatarUrl?: string | null;
  }

  interface Props {
    options: PollOption[];
    activeOptionId: string;
    pollTitle: string;
    pollType?: "simple" | "multiple" | "collaborative";
    pollRegion?: string;
    pollCreatedAt?: string | Date;
    creator?: PollCreator;
    stats?: PollStats;
    readOnly?: boolean;
    showAllOptions?: boolean;
    hasVoted?: boolean;
    isAuthenticated?: boolean;
    friendsByOption?: Record<string, Friend[]>;
    onClose: () => void;
    onOptionChange: (optionId: string) => void;
    onSwipeVertical?: (direction: "up" | "down") => void;
    onVote?: (optionId: string) => void;
    onShare?: () => void;
    onBookmark?: () => void;
    onRepost?: () => void;
    onOpenInGlobe?: () => void;
    onGoToChart?: () => void;
    onOpenAuthModal?: () => void;
    onTitleChange?: (title: string) => void;
    onLabelChange?: (optionId: string, newLabel: string) => void;
    onOpenColorPicker?: (optionId: string) => void;
    onOpenProfile?: (userId: number) => void;
  }

  let {
    options,
    activeOptionId = $bindable(),
    pollTitle,
    pollType = "simple",
    creator,
    stats,
    readOnly = false,
    showAllOptions = false,
    hasVoted = false,
    isAuthenticated = false,
    friendsByOption = {},
    onClose,
    onOptionChange,
    onSwipeVertical = () => {},
    onVote = () => {},
    onShare = () => {},
    onBookmark = () => {},
    onRepost = () => {},
    onOpenInGlobe = () => {},
    onGoToChart = () => {},
    onOpenAuthModal = () => {
      showAuthModal = true;
    },
    onTitleChange = () => {},
    onLabelChange = () => {},
    onOpenColorPicker = () => {},
    onOpenProfile = () => {},
  }: Props = $props();

  let totalVotes = $derived(options.reduce((a, b) => a + (b.votes || 0), 0));
  let maxVotes = $derived(Math.max(...options.map((o) => o.votes || 0), 1)); // Evitar div por 0
  let activeIndex = $derived(options.findIndex((o) => o.id === activeOptionId));
  
  // Usar $state con $effect para evitar problemas con análisis estático
  let voteColor = $state('#10b981');
  
  $effect(() => {
    const index = options.findIndex((o) => o.id === activeOptionId);
    if (index !== -1 && options[index]) {
      voteColor = options[index].color || '#10b981';
    } else {
      voteColor = '#10b981';
    }
  });

  let scrollContainer: HTMLElement | null = null;
  let showLikeAnim = $state(false);
  let lastTapTime = 0;
  let transitionY = $state(100);
  let showAuthModal = $state(false);

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
      // Re-habilitar detección de scroll manual después de la animación
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
      // Solo hacer scroll si la diferencia es real para evitar bucles
      if (currentScrollIndex !== activeIndex) {
        scrollToOption(activeIndex);
      }
    }
  });

  // --- LÓGICA DE VOTO (DOBLE TAP) Y SWIPE VERTICAL ---
  let touchStartY = 0;
  let touchStartX = 0;
  let lastTouchEndTime = 0;

  function handleTouchStart(e: TouchEvent) {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }

  function handleTouchEnd(e: TouchEvent) {
    // Si es click en controles interactivos, ignorar
    if ((e.target as HTMLElement).closest("button, a, input, textarea")) return;

    const now = Date.now();
    lastTouchEndTime = now;

    // Lógica de Swipe Vertical
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;

    const diffY = touchStartY - touchEndY;
    const diffX = touchStartX - touchEndX;

    // Si el movimiento vertical es mayor que el horizontal y supera un umbral (reducido a 25px para más sensibilidad)
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 25) {
      if (diffY > 0) {
        transitionY = window.innerHeight;
        onSwipeVertical("down"); // Deslizar hacia arriba -> Siguiente
        setTimeout(() => (transitionY = 100), 500);
      } else {
        transitionY = -window.innerHeight;
        onSwipeVertical("up"); // Deslizar hacia abajo -> Anterior
        setTimeout(() => (transitionY = 100), 500);
      }
      return;
    }

    // Lógica de Doble Tap (Touch)
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapTime < DOUBLE_TAP_DELAY) {
      if (!hasVoted && readOnly) {
        // Check authentication before voting
        if (!isAuthenticated) {
          onOpenAuthModal();
          lastTapTime = 0;
          return;
        }

        const opt = options[activeIndex];
        if (opt) {
          onVote(opt.id);
          showLikeAnim = true;
          setTimeout(() => (showLikeAnim = false), 1000);
        }
      }
      lastTapTime = 0; // Reset
    } else {
      lastTapTime = now;
    }
  }

  function handleClick(e: MouseEvent) {
    // Si es click en controles interactivos, ignorar
    if ((e.target as HTMLElement).closest("button, a, input, textarea")) return;

    // Si hubo un evento touch reciente, ignorar este click (ghost click)
    if (Date.now() - lastTouchEndTime < 500) return;

    // Lógica de Doble Click (Mouse)
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapTime < DOUBLE_TAP_DELAY) {
      if (!hasVoted && readOnly) {
        // Check authentication before voting
        if (!isAuthenticated) {
          onOpenAuthModal();
          lastTapTime = 0;
          return;
        }

        const opt = options[activeIndex];
        if (opt) {
          onVote(opt.id);
          showLikeAnim = true;
          setTimeout(() => (showLikeAnim = false), 1000);
        }
      }
      lastTapTime = 0; // Reset
    } else {
      lastTapTime = now;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      if (e.key === " ") e.preventDefault();

      if (!hasVoted && readOnly) {
        // Check authentication before voting
        if (!isAuthenticated) {
          onOpenAuthModal();
          return;
        }

        const opt = options[activeIndex];
        if (opt) {
          onVote(opt.id);
          showLikeAnim = true;
          setTimeout(() => (showLikeAnim = false), 1000);
        }
      }
    }
  }

  // Mouse wheel handler for vertical navigation
  function handleWheel(e: WheelEvent) {
    if (Math.abs(e.deltaY) > 50) {
      e.preventDefault();
      if (e.deltaY > 0) {
        transitionY = window.innerHeight;
        onSwipeVertical("down");
        setTimeout(() => (transitionY = 100), 500);
      } else {
        transitionY = -window.innerHeight;
        onSwipeVertical("up");
        setTimeout(() => (transitionY = 100), 500);
      }
    }
  }

  // Handle share with Web Share API
  async function handleShare() {
    console.log("[PollMaximizedView] Share button clicked");

    try {
      // Check if Web Share API is supported
      if (navigator.share) {
        console.log(
          "[PollMaximizedView] Web Share API supported, opening share dialog",
        );
        await navigator.share({
          title: pollTitle,
          text: `Vota en esta encuesta: ${pollTitle}`,
          url: window.location.href,
        });
        console.log("[PollMaximizedView] Share successful");
      } else {
        console.log(
          "[PollMaximizedView] Web Share API not supported, using clipboard fallback",
        );
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        alert("Enlace copiado al portapapeles");
      }
    } catch (error: any) {
      // User cancelled or error occurred
      if (error.name === "AbortError") {
        console.log("[PollMaximizedView] User cancelled share");
      } else {
        console.error("[PollMaximizedView] Error sharing:", error);
        // Try clipboard as fallback
        try {
          await navigator.clipboard.writeText(window.location.href);
          alert("Enlace copiado al portapapeles");
        } catch (clipboardError) {
          console.error(
            "[PollMaximizedView] Clipboard also failed:",
            clipboardError,
          );
          alert("No se pudo compartir. URL: " + window.location.href);
        }
      }
    }

    // Also call the parent's onShare if provided
    onShare();
  }

  // --- DETECCIÓN DE TIPO DE MEDIA (SI NO VIENE EXPLÍCITO) ---
  function getMediaType(
    opt: PollOption,
  ): "youtube" | "vimeo" | "image" | "text" | "spotify" {
    if (opt.type) return opt.type;
    if (!opt.imageUrl) return "text";
    if (
      opt.imageUrl.includes("youtube.com") ||
      opt.imageUrl.includes("youtu.be")
    )
      return "youtube";
    if (opt.imageUrl.includes("vimeo.com")) return "vimeo";
    if (opt.imageUrl.includes("spotify.com")) return "spotify";
    return "image";
  }

  function getYoutubeId(url?: string): string {
    if (!url) return "";
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : "";
  }

  function getVimeoId(url?: string): string {
    if (!url) return "";
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : "";
  }

  function getSpotifyId(url?: string): { type: string; id: string } | null {
    if (!url) return null;
    const match = url.match(
      /spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/,
    );
    if (match) {
      return { type: match[1], id: match[2] };
    }
    return null;
  }

  let interactingOptionId = $state<string | null>(null);
  let isTitleExpanded = $state(false);
  let expandedOptions = $state<Record<string, boolean>>({});
  let isMoreMenuOpen = $state(false);
  
  // Swipe para cerrar bottom sheet
  let sheetTouchStartY = 0;
  let sheetCurrentY = 0;
  let sheetTranslateY = $state(0);
  let sheetElement: HTMLDivElement | null = null;
  let canSwipeClose = false;
  
  function handleSheetTouchStart(e: TouchEvent) {
    sheetTouchStartY = e.touches[0].clientY;
    sheetCurrentY = sheetTouchStartY;
    // Solo permitir swipe si el scroll está en la parte superior
    canSwipeClose = sheetElement ? sheetElement.scrollTop <= 0 : true;
  }
  
  function handleSheetTouchMove(e: TouchEvent) {
    if (!canSwipeClose) return;
    sheetCurrentY = e.touches[0].clientY;
    const diff = sheetCurrentY - sheetTouchStartY;
    if (diff > 0) {
      sheetTranslateY = diff;
      e.preventDefault(); // Prevenir scroll mientras arrastramos
    }
  }
  
  function handleSheetTouchEnd() {
    if (sheetTranslateY > 80) {
      isMoreMenuOpen = false;
    }
    sheetTranslateY = 0;
    canSwipeClose = false;
  }

  // Formatear números grandes
  function formatCount(num: number | undefined): string {
    if (!num) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  }

  // Copiar enlace al portapapeles
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      isMoreMenuOpen = false;
      // Podríamos mostrar un toast aquí
    } catch (err) {
      console.error('Error copiando enlace:', err);
    }
  }

  // Cerrar menú al hacer clic fuera
  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.more-menu-container')) {
      isMoreMenuOpen = false;
    }
  }

  $effect(() => {
    // Reset interaction when changing slides
    if (activeIndex !== -1) {
      interactingOptionId = null;
    }
  });

  // --- COMPONENTES VISUALES (INLINE) ---
</script>

<div
  class="fixed inset-0 z-[2147483647] w-full h-full flex flex-col overflow-hidden select-none maximized-view"
  onwheel={handleWheel}
>
  <!-- HEADER & DATA BAR -->
  {#key pollTitle}
    <div
      in:fly={{ y: transitionY, duration: 500 }}
      out:fly={{ y: -transitionY, duration: 500 }}
      class="absolute inset-0 w-full h-full flex flex-col"
    >
      <div
        class="absolute top-0 left-0 w-full z-50 flex flex-col pointer-events-none"
      >
        <!-- DataBar -->
        <div
          class="w-full px-2 flex gap-0.5 h-1.5 pointer-events-none mt-2 z-50"
        >
          {#each options as opt, idx}
            {@const isActive = idx === activeIndex}
            {@const flexWeight = hasVoted
              ? Math.max(opt.votes || 0, totalVotes * 0.02)
              : 1}
            <div
              class="h-full transition-all duration-700 ease-out overflow-hidden relative bg-white/20 rounded-sm"
              style:flex="{flexWeight} 1 0%"
              style:opacity={hasVoted ? (isActive ? 1 : 0.3) : 1}
              style:transform={hasVoted && isActive
                ? "scaleY(1.5)"
                : "scaleY(1)"}
              style="box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);"
            >
              <div
                class="h-full transition-all duration-300"
                style:width={hasVoted
                  ? "100%"
                  : idx < activeIndex
                    ? "100%"
                    : isActive
                      ? "100%"
                      : "0%"}
                style:background-color={hasVoted ? opt.color : "#fff"}
              ></div>
            </div>
          {/each}
        </div>

        <!-- QuestionHeader -->
        <div
          class="w-full px-4 py-4 z-40 relative pointer-events-none"
        >
          <div class="flex items-start gap-3">
            <!-- Avatar -->
            <button
              class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden ring-2 ring-white/20 flex-shrink-0 pointer-events-auto cursor-pointer transition-transform hover:scale-110"
              onclick={(e) => {
                e.stopPropagation();
                if (creator?.id) {
                  onOpenProfile(creator.id);
                }
              }}
              type="button"
              aria-label="Ver perfil de {creator?.username || 'usuario'}"
            >
              {#if creator?.avatar}
                <img
                  src={creator.avatar}
                  alt={creator?.username}
                  class="w-full h-full rounded-full object-cover"
                />
              {:else}
                <User size={18} class="text-white" />
              {/if}
            </button>
            
            <!-- Título de la pregunta (mismo nivel que avatar) -->
            {#if readOnly}
              <button
                class="font-serif italic text-xl md:text-2xl leading-tight text-white text-left flex-1 pointer-events-auto cursor-pointer transition-all hover:opacity-80"
                style={!isTitleExpanded ? "display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; word-break: break-word;" : "word-break: break-word;"}
                onclick={() => isTitleExpanded = !isTitleExpanded}
                type="button"
                aria-label={isTitleExpanded ? "Contraer título" : "Expandir título"}
              >
                {pollTitle}
              </button>
            {:else}
              <textarea
                class="font-serif italic text-xl md:text-2xl leading-tight flex-1 bg-transparent border-none outline-none text-white placeholder-white/50 resize-none"
                placeholder="Escribe tu pregunta..."
                value={pollTitle}
                oninput={(e) => onTitleChange(e.currentTarget.value)}
                rows="2"
                maxlength="200"
                style="pointer-events: auto;"
              ></textarea>
            {/if}
          </div>
        </div>
      </div>

      <!-- SCROLL CONTAINER (MAIN CONTENT) -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div
        bind:this={scrollContainer}
        class="absolute inset-0 w-full h-full flex overflow-x-scroll snap-x snap-mandatory no-scrollbar focus:outline-none scroll-smooth"
        onscroll={handleScroll}
        ontouchstart={handleTouchStart}
        ontouchend={handleTouchEnd}
        onclick={handleClick}
        onkeydown={handleKeyDown}
        tabindex="0"
        role="region"
        aria-label="Opciones de encuesta"
      >
        {#each options as opt, i (opt.id)}
          {@const type = getMediaType(opt)}
          <div
            class="w-full h-full flex-shrink-0 snap-center relative"
            style="scroll-snap-stop: always;"
          >
            <!-- SlideContent -->
            <div class="w-full h-full relative overflow-hidden">
              {#if type === "text"}
                <div
                  class="w-full h-full flex flex-col items-center justify-center px-8 py-16 text-center relative overflow-hidden"
                  style="background-color: {opt.color};"
                >
                  <div
                    class="relative z-10 flex flex-col items-center gap-6 max-w-2xl w-full"
                  >
                    {#if !readOnly}
                      <textarea
                        class="text-5xl md:text-7xl font-bold text-white uppercase tracking-tighter leading-none break-words bg-transparent border-none outline-none w-full text-center resize-none overflow-auto placeholder-white/50"
                        placeholder="Opción {i + 1}"
                        value={opt.label}
                        oninput={(e) =>
                          onLabelChange(opt.id, e.currentTarget.value)}
                        onclick={(e) => e.stopPropagation()}
                        rows="4"
                      ></textarea>
                      <button
                        class="absolute top-8 right-8 w-10 h-10 rounded-full border-2 border-white/50 shadow-lg z-50 hover:scale-110 transition-transform"
                        style:background-color={opt.color}
                        onclick={(e) => {
                          e.stopPropagation();
                          onOpenColorPicker(opt.id);
                        }}
                        title="Cambiar color"
                      ></button>
                    {:else}
                      {@const textLength = opt.label.length}
                      {@const fontSize = textLength > 60 ? 'text-4xl md:text-5xl' : textLength > 40 ? 'text-5xl md:text-6xl' : 'text-5xl md:text-7xl'}
                      {@const shouldTruncate = textLength > 100}
                      <h1 
                        class="{fontSize} font-bold text-white uppercase tracking-tighter leading-none break-words text-center w-full"
                        style={shouldTruncate && !expandedOptions[opt.id] ? "display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 7; overflow: hidden; cursor: pointer;" : shouldTruncate ? "cursor: pointer;" : ""}
                        onclick={() => {
                          if (shouldTruncate) {
                            expandedOptions[opt.id] = !expandedOptions[opt.id];
                          }
                        }}
                        role={shouldTruncate ? "button" : undefined}
                        tabindex={shouldTruncate ? 0 : undefined}
                        aria-label={shouldTruncate ? (expandedOptions[opt.id] ? "Contraer texto" : "Expandir texto") : undefined}
                      >
                        {opt.label}
                      </h1>
                    {/if}
                    {#if opt.artist}
                      <span
                        class="text-sm font-bold uppercase tracking-widest text-white/60 bg-black/20 px-3 py-1 rounded-full"
                      >
                        {opt.artist}
                      </span>
                    {/if}
                    {#if opt.description}
                      <p
                        class="text-xl text-white/80 font-serif italic leading-relaxed mt-4 max-w-sm"
                      >
                        "{opt.description}"
                      </p>
                    {/if}
                    
                    <!-- Avatares de amigos en opciones de texto -->
                    {#if friendsByOption && friendsByOption[opt.id] && friendsByOption[opt.id].length > 0}
                      <div class="mt-4 flex items-center gap-2">
                        {#each friendsByOption[opt.id].slice(0, 5) as friend, idx}
                          <div 
                            class="relative" 
                            style="margin-left: {idx > 0 ? '-8px' : '0'}; z-index: {10 - idx};"
                            title={friend.name}
                          >
                            {#if hasVoted}
                              <img 
                                src={friend.avatarUrl || '/default-avatar.png'}
                                alt={friend.name}
                                class="w-8 h-8 rounded-full border-2 border-white/50 object-cover shadow-lg hover:scale-110 hover:z-50 transition-transform"
                              />
                            {:else}
                              <div class="w-8 h-8 rounded-full border-2 border-white/30 bg-white/10 shadow-lg"></div>
                            {/if}
                          </div>
                        {/each}
                        {#if friendsByOption[opt.id].length > 5}
                          <div 
                            class="w-8 h-8 rounded-full border-2 border-white/40 bg-black/80 flex items-center justify-center shadow-lg"
                            style="margin-left: -8px; z-index: 0;"
                          >
                            <span class="text-white text-xs font-bold">+{friendsByOption[opt.id].length - 5}</span>
                          </div>
                        {/if}
                        {#if !hasVoted}
                          <span class="text-white/60 text-sm ml-2">🔒 Vota para ver quién votó</span>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>
              {:else}
                <!-- Media Content -->
                {#if opt.imageUrl}
                  <!-- Fondo borroso de la imagen (optimizado) -->
                  {#if Math.abs(i - activeIndex) <= 1}
                    <img
                      src={opt.imageUrl}
                      alt=""
                      class="absolute inset-0 w-full h-full object-cover -z-10"
                      style="filter: blur(30px); opacity: 0.5; will-change: transform;"
                    />
                  {/if}
                {/if}
                <div
                  class="absolute inset-0 z-0 bg-black flex justify-center media-container"
                  style="align-items: flex-start;"
                >
                  {#if Math.abs(i - activeIndex) <= 1}
                    <div class="media-wrapper">
                      <MediaEmbed
                        url={opt.imageUrl || ""}
                        mode="full"
                        width="100%"
                        height="100%"
                        autoplay={i === activeIndex}
                      />
                    </div>
                  {:else}
                    <!-- Placeholder para opciones lejanas -->
                    <div class="w-full h-full flex items-center justify-center text-white/50">
                      <span>Cargando...</span>
                    </div>
                  {/if}
                </div>
                <div
                  class="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none"
                ></div>
              {/if}
            </div>

            <!-- InfoOverlay -->
            {#if type !== "text"}
              <div
                class="absolute bottom-0 left-0 w-full p-6 pb-20 z-40 pointer-events-none flex flex-col gap-2 max-w-[75%]"
                style:opacity={i === activeIndex ? 1 : 0}
                style:transition="opacity 0.3s"
              >
                <div
                  class="flex flex-col items-start gap-1"
                  in:fly={{ y: 20, duration: 500 }}
                >
                  {#if opt.artist}
                    <span
                      class="bg-white text-black text-[9px] font-bold uppercase px-2 py-0.5 tracking-widest rounded-sm"
                    >
                      {opt.artist}
                    </span>
                  {/if}
                  {#if !readOnly}
                    <button
                      class="absolute -top-12 right-0 w-10 h-10 rounded-full border-2 border-white/50 shadow-lg z-50 hover:scale-110 transition-transform"
                      style:background-color={opt.color}
                      onclick={(e) => {
                        e.stopPropagation();
                        onOpenColorPicker(opt.id);
                      }}
                      title="Cambiar color"
                    ></button>
                    <textarea
                      class="text-5xl md:text-6xl font-bold text-white uppercase tracking-tighter leading-[0.9] break-words bg-transparent border-none outline-none w-full resize-none overflow-auto placeholder-white/50"
                      placeholder="Opción {i + 1}"
                      value={opt.label}
                      oninput={(e) =>
                        onLabelChange(opt.id, e.currentTarget.value)}
                      onclick={(e) => e.stopPropagation()}
                      rows="3"
                    ></textarea>
                  {:else}
                    {@const textLength = opt.label.length}
                    {@const fontSize = textLength > 80 ? 'text-3xl md:text-4xl' : textLength > 50 ? 'text-4xl md:text-5xl' : 'text-5xl md:text-6xl'}
                    {@const shouldTruncate = textLength > 120}
                    <h1
                      class="{fontSize} font-bold text-white uppercase tracking-tighter leading-[0.9] break-words text-left pointer-events-auto"
                      style={shouldTruncate && !expandedOptions[opt.id] ? "display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; cursor: pointer;" : shouldTruncate ? "cursor: pointer;" : ""}
                      onclick={() => {
                        if (shouldTruncate) {
                          expandedOptions[opt.id] = !expandedOptions[opt.id];
                        }
                      }}
                      role={shouldTruncate ? "button" : undefined}
                      tabindex={shouldTruncate ? 0 : undefined}
                      aria-label={shouldTruncate ? (expandedOptions[opt.id] ? "Contraer texto" : "Expandir texto") : undefined}
                    >
                      {opt.label}
                    </h1>
                  {/if}

                  {#if hasVoted}
                    <div
                      class="flex items-center gap-2 mt-2"
                      in:fly={{ x: -20, duration: 500 }}
                    >
                      <span
                        class="text-4xl font-bold text-white"
                        style:color={opt.color}
                      >
                        {Math.round(((opt.votes || 0) / totalVotes) * 100)}%
                      </span>
                      <span
                        class="text-xs text-zinc-400 font-medium uppercase tracking-wider"
                        >del total</span
                      >
                    </div>
                  {/if}
                </div>

                <!-- Avatares de amigos en lugar del círculo "i" -->
                {#if friendsByOption && friendsByOption[opt.id] && friendsByOption[opt.id].length > 0}
                  <div class="mt-4 flex items-center gap-2">
                    {#each friendsByOption[opt.id].slice(0, 5) as friend, idx}
                      <div 
                        class="relative" 
                        style="margin-left: {idx > 0 ? '-8px' : '0'}; z-index: {10 - idx};"
                        title={hasVoted ? friend.name : 'Vota para ver quién eligió esta opción'}
                      >
                        {#if hasVoted}
                          <img 
                            src={friend.avatarUrl || '/default-avatar.png'}
                            alt={friend.name}
                            class="w-8 h-8 rounded-full border-2 border-white/50 object-cover shadow-lg hover:scale-110 hover:z-50 transition-transform"
                          />
                        {:else}
                          <div class="w-8 h-8 rounded-full border-2 border-white/40 bg-white/10 flex items-center justify-center shadow-lg hover:scale-110 hover:z-50 transition-transform cursor-help">
                            <span class="text-white text-sm font-bold">?</span>
                          </div>
                        {/if}
                      </div>
                    {/each}
                    {#if friendsByOption[opt.id].length > 5}
                      <div 
                        class="w-8 h-8 rounded-full border-2 border-white/40 bg-black/80 flex items-center justify-center shadow-lg"
                        style="margin-left: -8px; z-index: 0;"
                      >
                        <span class="text-white text-xs font-bold">+{friendsByOption[opt.id].length - 5}</span>
                      </div>
                    {/if}
                    {#if !hasVoted}
                      <span
                        class="text-[10px] font-mono uppercase tracking-widest text-white/60 ml-2"
                      >
                        Vota para descubrir
                      </span>
                    {/if}
                  </div>
                {:else if !hasVoted}
                  <div
                    class="mt-4 flex items-center gap-3 opacity-80 animate-pulse"
                  >
                    <div
                      class="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center"
                    >
                      <div class="w-1 h-4 bg-white rounded-full"></div>
                    </div>
                    <span
                      class="text-[10px] font-mono uppercase tracking-widest text-white shadow-black drop-shadow-md"
                    >
                      Doble toque para votar
                    </span>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/key}

  <!-- VOTE CHECK ANIMATION -->
  {#if showLikeAnim}
    {@const activeOption = options[activeIndex]}
    <div
      class="absolute inset-0 z-50 pointer-events-none flex items-center justify-center"
      out:fade={{ duration: 400 }}
    >
      <!-- Backdrop blur pulse -->
      <div class="absolute inset-0 vote-backdrop"></div>
      
      <!-- Outer ring animation -->
      <div class="vote-ring-outer" style="--check-color: {activeOption?.color || '#22c55e'}"></div>
      
      <!-- Middle ring -->
      <div class="vote-ring-middle" style="--check-color: {activeOption?.color || '#22c55e'}"></div>
      
      <!-- Main check container -->
      <div class="vote-check-container" style="--check-color: {activeOption?.color || '#22c55e'}">
        <!-- Gradient background circle -->
        <div class="vote-circle-bg"></div>
        
        <!-- SVG Check with draw animation -->
        <svg class="vote-check-svg" viewBox="0 0 52 52" fill="none">
          <!-- Circle stroke animation -->
          <circle 
            class="vote-circle-stroke" 
            cx="26" cy="26" r="24" 
            stroke="currentColor" 
            stroke-width="2"
            fill="none"
          />
          <!-- Check mark path -->
          <path 
            class="vote-check-path" 
            d="M14 27L22 35L38 17" 
            stroke="white" 
            stroke-width="4" 
            stroke-linecap="round" 
            stroke-linejoin="round"
            fill="none"
          />
        </svg>
        
        <!-- Inner glow -->
        <div class="vote-inner-glow"></div>
      </div>
      
      <!-- Particles -->
      <div class="vote-particles">
        {#each Array(12) as _, i}
          <div 
            class="vote-particle" 
            style="--i: {i}; --color: {activeOption?.color || '#22c55e'}"
          ></div>
        {/each}
      </div>
      
      <!-- Success text -->
      <div class="vote-success-text">
        <span>¡Votado!</span>
      </div>
    </div>
  {/if}

  <!-- FLOATING CLOSE BUTTON -->
  <div
    class="absolute right-3 bottom-24 z-50 flex flex-col gap-3 items-center pointer-events-auto"
  >
    <button onclick={onClose} class="group">
      <div
        class="w-10 h-10 bg-black/40 rounded-full flex items-center justify-center border border-white/10 group-active:scale-95 transition-all"
      >
        <ChevronDown size={24} class="text-white" />
      </div>
    </button>
  </div>

  <!-- BOTTOM ACTION BAR - New Design -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div 
    class="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto more-menu-container"
    onclick={handleClickOutside}
  >
    <!-- Modal Bottom Sheet -->
    {#if isMoreMenuOpen}
      <!-- Overlay -->
      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div 
        class="fixed inset-0 bg-black/60 z-[100]"
        onclick={() => isMoreMenuOpen = false}
      ></div>
      <!-- Bottom Sheet -->
      <div 
        bind:this={sheetElement}
        class="fixed bottom-0 left-0 right-0 z-[101] bg-[#1a1a1a] rounded-t-3xl p-4 pb-6 shadow-2xl max-h-[60vh] overflow-y-auto transition-transform"
        style="transform: translateY({sheetTranslateY}px)"
        in:fly={{ y: 300, duration: 300, easing: cubicOut }}
        out:fly={{ y: 300, duration: 200 }}
        ontouchstart={handleSheetTouchStart}
        ontouchmove={handleSheetTouchMove}
        ontouchend={handleSheetTouchEnd}
      >
        <!-- Handle -->
        <div class="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4"></div>
        
        <div class="flex flex-col gap-1 text-white max-w-md mx-auto">
          <!-- Votar -->
          <button 
            class="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition text-left"
            onclick={(e) => { 
              e.stopPropagation(); 
              isMoreMenuOpen = false;
              if (!hasVoted && readOnly) {
                if (!isAuthenticated) {
                  onOpenAuthModal();
                  return;
                }
                const opt = options[activeIndex];
                if (opt) {
                  onVote(opt.id);
                  showLikeAnim = true;
                  setTimeout(() => (showLikeAnim = false), 1000);
                }
              }
            }}
          >
            <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background-color: {hasVoted ? `${voteColor}33` : 'rgba(255, 255, 255, 0.1)'}">
              {#if hasVoted}
                <SquareCheck size={20} style="color: {voteColor}" />
              {:else}
                <Square size={20} class="text-white" />
              {/if}
            </div>
            <div class="flex-1">
              <span class="font-medium">{hasVoted ? 'Votado' : 'Votar'}</span>
              <p class="text-xs text-gray-400">{formatCount(stats?.totalVotes)} votos</p>
            </div>
          </button>

          <!-- Comentarios -->
          <button 
            class="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition text-left"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; }}
          >
            <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <MessageCircle size={20} class="text-white" />
            </div>
            <div class="flex-1">
              <span class="font-medium">Comentarios</span>
              <p class="text-xs text-gray-400">0 comentarios</p>
            </div>
          </button>

          <!-- Ver en globo -->
          <button 
            class="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition text-left"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; onOpenInGlobe(); }}
          >
            <div class="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <Globe size={20} class="text-cyan-400" />
            </div>
            <div>
              <span class="font-medium">Ver en el globo</span>
              <p class="text-xs text-gray-400">Explorar ubicación</p>
            </div>
          </button>

          <!-- Estadísticas -->
          <button 
            class="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition text-left"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; onGoToChart(); }}
          >
            <div class="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Activity size={20} class="text-purple-400" />
            </div>
            <div>
              <span class="font-medium">Estadísticas</span>
              <p class="text-xs text-gray-400">Ver gráficos y datos</p>
            </div>
          </button>

          <div class="h-px bg-white/10 my-2"></div>

          <!-- Compartir -->
          <button 
            class="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition text-left"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; handleShare(); }}
          >
            <div class="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Share2 size={20} class="text-blue-400" />
            </div>
            <div class="flex-1">
              <span class="font-medium">Compartir</span>
              <p class="text-xs text-gray-400">0 compartidos</p>
            </div>
          </button>

          <!-- Repostear -->
          <button 
            class="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition text-left"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; onRepost(); }}
          >
            <div class="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Repeat2 size={20} class="text-green-400" />
            </div>
            <div class="flex-1">
              <span class="font-medium">Repostear</span>
              <p class="text-xs text-gray-400">0 reposts</p>
            </div>
          </button>

          <!-- Guardar -->
          <button 
            class="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition text-left"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; onBookmark(); }}
          >
            <div class="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Bookmark size={20} class="text-yellow-400" />
            </div>
            <div class="flex-1">
              <span class="font-medium">Guardar</span>
              <p class="text-xs text-gray-400">Añadir a guardados</p>
            </div>
          </button>

          <!-- Copiar enlace -->
          <button 
            class="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition text-left"
            onclick={(e) => { e.stopPropagation(); copyLink(); }}
          >
            <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <Link size={20} class="text-white" />
            </div>
            <div>
              <span class="font-medium">Copiar enlace</span>
              <p class="text-xs text-gray-400">Compartir URL</p>
            </div>
          </button>

          <div class="h-px bg-white/10 my-2"></div>

          <!-- No me interesa -->
          <button 
            class="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition text-left"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; }}
          >
            <div class="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center">
              <EyeOff size={20} class="text-gray-400" />
            </div>
            <div>
              <span class="font-medium">No me interesa</span>
              <p class="text-xs text-gray-400">Ver menos como esto</p>
            </div>
          </button>

          <!-- Reportar -->
          <button 
            class="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition text-left"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; }}
          >
            <div class="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <Flag size={20} class="text-red-400" />
            </div>
            <div>
              <span class="font-medium">Reportar</span>
              <p class="text-xs text-gray-400">Denunciar contenido</p>
            </div>
          </button>
        </div>
      </div>
    {/if}

    <!-- Barra de control principal -->
    <div class="w-full flex items-center gap-3 h-16 px-4 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
      
      <!-- A. ZONA FIJA (Acciones Principales) -->
      <div class="flex items-center gap-0 shrink-0">
        
        <!-- Votar -->
        <button 
          class="flex items-center gap-1.5 btn-press px-2 py-1.5 rounded-full transition-all select-none {hasVoted ? 'bg-emerald-400/10' : 'bg-transparent hover:bg-white/10'}"
          onclick={() => {
            if (!hasVoted && readOnly) {
              if (!isAuthenticated) {
                onOpenAuthModal();
                return;
              }
              const opt = options[activeIndex];
              if (opt) {
                onVote(opt.id);
                showLikeAnim = true;
                setTimeout(() => (showLikeAnim = false), 1000);
              }
            }
          }}
          aria-label="Votar"
        >
          {#if hasVoted}
            <SquareCheck size={20} class="icon-shadow vote-icon-beat" style="color: {voteColor}" />
            <span class="text-xs font-mono font-bold text-shadow-sm" style="color: {voteColor}">{formatCount(stats?.totalVotes)}</span>
          {:else}
            <Square size={20} class="text-white icon-shadow" />
            <span class="text-xs font-mono font-bold text-white text-shadow-sm">{formatCount(stats?.totalVotes)}</span>
          {/if}
        </button>
 
        <!-- Mensajes -->
        <button 
          class="flex items-center gap-1.5 btn-press bg-transparent px-2 py-1.5 rounded-full hover:bg-white/10 transition-all select-none"
          aria-label="Comentarios"
        >
          <MessageCircle size={20} class="text-white icon-shadow" />
          <span class="text-[11px] font-mono text-white text-shadow-sm">0</span>
        </button>

      </div>

      <!-- B. ZONA SCROLLABLE (Acciones Secundarias) -->
      <div class="overflow-x-auto hide-scrollbar scroll-mask-right">
        <div class="flex items-center gap-3 pr-24">
          
          <!-- Menú (3 puntos) -->
          <button 
            class="flex items-center justify-center shrink-0 btn-press opacity-60 hover:opacity-100 transition"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = !isMoreMenuOpen; }}
            aria-label="Más opciones"
          >
            <MoreVertical size={20} class="text-white icon-shadow" />
          </button>

          <!-- Mundo -->
          <button 
            class="flex items-center shrink-0 opacity-80 hover:opacity-100 transition btn-press"
            onclick={onOpenInGlobe}
            aria-label="Ver en globo"
          >
            <Globe size={20} class="text-white icon-shadow" />
          </button>

          <!-- Gráfico (Pulso) -->
          <button 
            class="flex items-center shrink-0 opacity-80 hover:opacity-100 transition btn-press"
            onclick={onGoToChart}
            aria-label="Ver estadísticas"
          >
            <Activity size={22} class="text-white icon-shadow" />
          </button>

          <!-- Share -->
          <button 
            class="flex items-center gap-1.5 shrink-0 opacity-90 hover:opacity-100 transition btn-press"
            onclick={handleShare}
            aria-label="Compartir"
          >
            <Share2 size={20} class="text-white icon-shadow" />
            <span class="text-[11px] font-mono text-gray-300 text-shadow-sm">0</span>
          </button>

          <!-- Retweet -->
          <button 
            class="flex items-center gap-1.5 shrink-0 opacity-90 hover:opacity-100 transition btn-press"
            onclick={onRepost}
            aria-label="Repostear"
          >
            <Repeat2 size={20} class="text-white icon-shadow" />
            <span class="text-[11px] font-mono text-gray-300 text-shadow-sm">0</span>
          </button>

          <!-- Vistas -->
          <button 
            class="flex items-center gap-1.5 shrink-0 opacity-80 hover:opacity-100 transition btn-press"
            aria-label="Vistas"
          >
            <Eye size={20} class="text-white icon-shadow" />
            <span class="text-[11px] font-mono text-shadow-sm text-gray-300">{formatCount(stats?.totalViews)}</span>
          </button>

          <!-- Bookmark -->
          <button 
            class="flex items-center gap-1.5 shrink-0 opacity-80 hover:opacity-100 transition btn-press"
            onclick={onBookmark}
            aria-label="Guardar"
          >
            <Bookmark size={20} class="text-white icon-shadow" />
            <span class="text-[11px] font-mono text-shadow-sm text-gray-300">0</span>
          </button>

          <!-- Copiar enlace -->
          <button 
            class="flex items-center shrink-0 opacity-60 hover:opacity-100 transition btn-press"
            onclick={copyLink}
            aria-label="Copiar enlace"
          >
            <Link size={18} class="text-white icon-shadow" />
          </button>

          <!-- No me interesa -->
          <button 
            class="flex items-center shrink-0 opacity-60 hover:opacity-100 transition btn-press"
            aria-label="No me interesa"
          >
            <EyeOff size={18} class="text-white icon-shadow" />
          </button>

          <!-- Reportar -->
          <button 
            class="flex items-center shrink-0 opacity-60 hover:opacity-100 transition btn-press"
            aria-label="Reportar"
          >
            <Flag size={18} class="text-red-400 icon-shadow" />
          </button>

        </div>
      </div>

    </div>
  </div>

  <!-- AUTH MODAL -->
  <AuthModal bind:isOpen={showAuthModal} />
</div>

<style>
  /* Hide scrollbar for Chrome, Safari and Opera */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  /* Hide scrollbar for IE, Edge and Firefox */
  .no-scrollbar {
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
  }

  /* Scroll horizontal más sensible (threshold reducido) */
  .snap-x {
    scroll-snap-type: x mandatory;
    scroll-padding: 0;
    /* Propiedades adicionales para mayor sensibilidad */
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
  }
  
  .snap-center {
    scroll-snap-align: center;
    scroll-snap-stop: always;
  }
  
  .scroll-smooth {
    scroll-behavior: smooth;
  }
  
  /* Aumentar sensibilidad táctil */
  .overflow-x-scroll {
    touch-action: pan-x;
  }

  .text-shadow-xl {
    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
  }

  /* Optimizaciones para iOS/Safari */
  @supports (-webkit-touch-callout: none) {
    /* Solo para iOS */
    .snap-x {
      /* Reducir aceleración de hardware en scroll */
      -webkit-transform: translateZ(0);
      transform: translateZ(0);
    }
    
    /* Optimizar renders */
    img, video, iframe {
      -webkit-transform: translateZ(0);
      transform: translateZ(0);
    }
    
    /* Reducir blur en iOS para mejor rendimiento */
    [style*="blur"] {
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
    }
  }

  /* Contenedor de medios - sistema flexible */
  .media-container {
    padding-top: 12vh; /* Espacio para el título */
    padding-bottom: 20vh; /* Espacio para el texto de la opción */
  }

  /* Wrapper interno con tamaño controlado */
  .media-wrapper {
    width: 100%;
    max-width: 100%;
    height: auto;
    max-height: 55vh; /* Máximo 55% de la altura de la pantalla */
    aspect-ratio: 16 / 9; /* Mantener proporción de video */
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Landscape (horizontal) - videos más grandes */
  @media (orientation: landscape) {
    .media-container {
      padding-top: 8vh;
      padding-bottom: 15vh;
    }
    
    .media-wrapper {
      max-height: 65vh;
    }
  }

  /* Portrait (vertical) - balance entre título y texto */
  @media (orientation: portrait) {
    .media-container {
      padding-top: 15vh;
      padding-bottom: 25vh;
    }
    
    .media-wrapper {
      max-height: 45vh;
    }
  }

  /* Pantallas pequeñas (móviles) */
  @media (max-height: 700px) {
    .media-container {
      padding-top: 10vh;
      padding-bottom: 15vh;
    }
    
    .media-wrapper {
      max-height: 50vh;
    }
  }

  /* Pantallas muy pequeñas */
  @media (max-height: 600px) {
    .media-container {
      padding-top: 8vh;
      padding-bottom: 12vh;
    }
    
    .media-wrapper {
      max-height: 55vh;
    }
  }

  /* ========================================
     VOTE CHECK ANIMATION - Premium Style
     ======================================== */
  
  .vote-backdrop {
    background: radial-gradient(circle at center, rgba(0,0,0,0.4) 0%, transparent 70%);
    animation: backdropPulse 0.8s ease-out forwards;
  }

  @keyframes backdropPulse {
    0% { opacity: 0; transform: scale(0.8); }
    50% { opacity: 1; }
    100% { opacity: 0; transform: scale(1.5); }
  }

  .vote-ring-outer {
    position: absolute;
    width: 180px;
    height: 180px;
    border-radius: 50%;
    border: 2px solid var(--check-color, #22c55e);
    opacity: 0;
    animation: ringExpand 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  }

  .vote-ring-middle {
    position: absolute;
    width: 140px;
    height: 140px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.3);
    opacity: 0;
    animation: ringExpand 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.1s forwards;
  }

  @keyframes ringExpand {
    0% { 
      transform: scale(0.5); 
      opacity: 0.8; 
    }
    100% { 
      transform: scale(2); 
      opacity: 0; 
    }
  }

  .vote-check-container {
    position: relative;
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: containerPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes containerPop {
    0% { 
      transform: scale(0); 
      opacity: 0; 
    }
    50% { 
      transform: scale(1.2); 
    }
    100% { 
      transform: scale(1); 
      opacity: 1; 
    }
  }

  .vote-circle-bg {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--check-color, #22c55e) 0%, color-mix(in srgb, var(--check-color, #22c55e) 70%, black) 100%);
    box-shadow: 
      0 10px 40px -10px var(--check-color, #22c55e),
      0 0 0 4px rgba(255,255,255,0.1),
      inset 0 -4px 12px rgba(0,0,0,0.2),
      inset 0 4px 12px rgba(255,255,255,0.2);
    animation: circlePulse 0.8s ease-out;
  }

  @keyframes circlePulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  .vote-check-svg {
    position: relative;
    width: 52px;
    height: 52px;
    z-index: 10;
    color: rgba(255,255,255,0.3);
  }

  .vote-circle-stroke {
    stroke-dasharray: 166;
    stroke-dashoffset: 166;
    animation: circleStroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
  }

  @keyframes circleStroke {
    100% { stroke-dashoffset: 0; }
  }

  .vote-check-path {
    stroke-dasharray: 48;
    stroke-dashoffset: 48;
    animation: checkDraw 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.3s forwards;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
  }

  @keyframes checkDraw {
    100% { stroke-dashoffset: 0; }
  }

  .vote-inner-glow {
    position: absolute;
    inset: 10%;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 60%);
    pointer-events: none;
  }

  .vote-particles {
    position: absolute;
    width: 100px;
    height: 100px;
    pointer-events: none;
  }

  .vote-particle {
    position: absolute;
    width: 8px;
    height: 8px;
    left: 50%;
    top: 50%;
    margin: -4px;
    border-radius: 50%;
    background: var(--color, #22c55e);
    box-shadow: 0 0 10px var(--color, #22c55e);
    opacity: 0;
    animation: particleExplode 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    animation-delay: calc(var(--i) * 0.02s + 0.2s);
  }

  @keyframes particleExplode {
    0% {
      transform: rotate(calc(var(--i) * 30deg)) translateY(0) scale(1);
      opacity: 1;
    }
    100% {
      transform: rotate(calc(var(--i) * 30deg)) translateY(80px) scale(0);
      opacity: 0;
    }
  }

  .vote-success-text {
    position: absolute;
    bottom: -60px;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0;
    animation: textFadeUp 0.5s ease-out 0.4s forwards;
  }

  .vote-success-text span {
    font-size: 18px;
    font-weight: 700;
    color: white;
    text-transform: uppercase;
    letter-spacing: 3px;
    text-shadow: 0 2px 10px rgba(0,0,0,0.5);
    background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  @keyframes textFadeUp {
    0% {
      opacity: 0;
      transform: translateX(-50%) translateY(10px);
    }
    100% {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  /* ========================================
     BOTTOM ACTION BAR - New Menu Styles
     ======================================== */

  /* Ocultar scrollbar pero mantener funcionalidad */
  .hide-scrollbar::-webkit-scrollbar { display: none; }
  .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

  /* Máscara de desvanecimiento para el scroll derecho */
  .scroll-mask-right {
    -webkit-mask-image: linear-gradient(to right, black 95%, transparent 100%);
    mask-image: linear-gradient(to right, black 95%, transparent 100%);
  }

  /* Sombras para legibilidad sobre cualquier fondo */
  :global(.icon-shadow) { 
    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.9)); 
  }
  
  .text-shadow-sm { 
    text-shadow: 0 1px 2px rgba(0,0,0,1); 
  }

  /* Efecto de pulsación */
  .btn-press:active { 
    transform: scale(0.95); 
  }

  /* Menú Flotante (Glassmorphism) */
  .glass-menu {
    background: rgba(20, 20, 20, 0.95);
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
    border: 1px solid rgba(255,255,255,0.1);
  }

  /* Animación de Latido (Icono de voto) */
  @keyframes iconBeat {
    0% { transform: scale(1); }
    14% { transform: scale(1.3); }
    28% { transform: scale(1); }
    42% { transform: scale(1.3); }
    70% { transform: scale(1); }
  }

  :global(.vote-icon-beat) { 
    animation: iconBeat 1s ease-out; 
  }

  /* Force dark theme colors regardless of global theme */
  .maximized-view {
    background-color: #000000 !important;
    color: #ffffff !important;
  }

  .maximized-view :global(.text-white) {
    color: #ffffff !important;
  }

  .maximized-view :global(.bg-black) {
    background-color: #000000 !important;
  }

  .maximized-view :global(.bg-white) {
    background-color: #ffffff !important;
  }

  .maximized-view :global(.text-black) {
    color: #000000 !important;
  }

  .maximized-view :global(.border-white) {
    border-color: #ffffff !important;
  }

  .maximized-view img {
    display: block !important;
    opacity: 1 !important;
  }

  .maximized-view :global(.ring-white) {
    --tw-ring-color: rgba(255, 255, 255, 0.2) !important;
  }
</style>
