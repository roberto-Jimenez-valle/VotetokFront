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
    Grid,
    X,
    Heart,
    ChevronDown,
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
  }: Props = $props();

  let totalVotes = $derived(options.reduce((a, b) => a + (b.votes || 0), 0));
  let maxVotes = $derived(Math.max(...options.map((o) => o.votes || 0), 1)); // Evitar div por 0
  let activeIndex = $derived(options.findIndex((o) => o.id === activeOptionId));

  let scrollContainer: HTMLElement | null = null;
  let showLikeAnim = $state(false);
  let isGridOpen = $state(showAllOptions); // Mapear prop inicial
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

    // Si el movimiento vertical es mayor que el horizontal y supera un umbral
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 50) {
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

  $effect(() => {
    // Reset interaction when changing slides
    if (activeIndex !== -1) {
      interactingOptionId = null;
    }
  });

  // --- COMPONENTES VISUALES (INLINE) ---
</script>

<div
  class="fixed inset-0 z-[2147483647] w-full h-full flex flex-col bg-black text-white overflow-hidden select-none"
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
              class="h-full transition-all duration-700 ease-out overflow-hidden relative bg-white/20 backdrop-blur-sm rounded-sm"
              style:flex="{flexWeight} 1 0%"
              style:opacity={hasVoted ? (isActive ? 1 : 0.3) : 1}
              style:transform={hasVoted && isActive
                ? "scaleY(1.5)"
                : "scaleY(1)"}
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
          class="w-full px-4 py-6 z-40 relative pointer-events-none bg-gradient-to-b from-black/80 to-transparent"
        >
          <div class="flex flex-col items-start gap-2">
            <div class="flex items-center gap-2 opacity-80">
              <div
                class="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center overflow-hidden ring-2 ring-white/20"
              >
                {#if creator?.avatar}
                  <img
                    src={creator.avatar}
                    alt={creator.username}
                    class="w-full h-full rounded-full object-cover"
                  />
                {:else}
                  <User size={14} class="text-white" />
                {/if}
              </div>
            </div>
            {#if readOnly}
              <h2
                class="font-serif italic text-3xl leading-tight max-w-[95%] text-white drop-shadow-xl"
              >
                {pollTitle}
              </h2>
            {:else}
              <textarea
                class="font-serif italic text-3xl leading-tight w-full bg-transparent border-none outline-none text-white placeholder-white/50 resize-none drop-shadow-xl"
                placeholder="Escribe tu pregunta..."
                value={pollTitle}
                oninput={(e) => onTitleChange(e.currentTarget.value)}
                rows="2"
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
        class="absolute inset-0 w-full h-full flex overflow-x-scroll snap-x snap-mandatory no-scrollbar focus:outline-none"
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
                  class="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-zinc-950 relative overflow-hidden"
                >
                  <div
                    class="absolute inset-0 opacity-30"
                    style:background-color={opt.color}
                  ></div>
                  <div
                    class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-overlay"
                  ></div>
                  <span
                    class="text-[20rem] font-black leading-none absolute opacity-10 select-none pointer-events-none"
                    style:color={opt.color}
                  >
                    {opt.label.charAt(0)}
                  </span>
                  <div
                    class="relative z-10 flex flex-col items-center gap-6 max-w-lg"
                  >
                    {#if !readOnly}
                      <textarea
                        class="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter leading-none text-shadow-xl break-words bg-transparent border-none outline-none w-full text-center resize-none overflow-hidden placeholder-white/50"
                        placeholder="Opción {i + 1}"
                        value={opt.label}
                        oninput={(e) =>
                          onLabelChange(opt.id, e.currentTarget.value)}
                        onclick={(e) => e.stopPropagation()}
                        rows="2"
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
                      <h1
                        class="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter leading-none text-shadow-xl break-words"
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
                  </div>
                </div>
              {:else}
                <!-- Media Content -->
                {#if opt.imageUrl}
                  <img
                    src={opt.imageUrl}
                    alt={opt.label}
                    class="absolute inset-0 w-full h-full object-cover -z-10 opacity-50 blur-xl"
                  />
                {/if}
                <div
                  class="absolute inset-0 z-0 bg-black flex items-center justify-center"
                >
                  <MediaEmbed
                    url={opt.imageUrl || ""}
                    mode="full"
                    width="100%"
                    height="350px"
                    autoplay={i === activeIndex}
                  />
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
                      class="bg-white text-black text-[9px] font-black uppercase px-2 py-0.5 tracking-widest rounded-sm"
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
                      class="text-5xl md:text-6xl font-black text-white uppercase tracking-tighter leading-[0.9] drop-shadow-2xl break-words bg-transparent border-none outline-none w-full resize-none overflow-hidden placeholder-white/50"
                      placeholder="Opción {i + 1}"
                      value={opt.label}
                      oninput={(e) =>
                        onLabelChange(opt.id, e.currentTarget.value)}
                      onclick={(e) => e.stopPropagation()}
                      rows="2"
                    ></textarea>
                  {:else}
                    <h1
                      class="text-5xl md:text-6xl font-black text-white uppercase tracking-tighter leading-[0.9] drop-shadow-2xl break-words"
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
                        class="text-4xl font-black text-white"
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
                          <div class="w-8 h-8 rounded-full border-2 border-white/40 bg-white/10 backdrop-blur-md flex items-center justify-center shadow-lg hover:scale-110 hover:z-50 transition-transform cursor-help">
                            <span class="text-white text-sm font-bold drop-shadow-md">?</span>
                          </div>
                        {/if}
                      </div>
                    {/each}
                    {#if friendsByOption[opt.id].length > 5}
                      <div 
                        class="w-8 h-8 rounded-full border-2 border-white/40 bg-black/70 backdrop-blur-md flex items-center justify-center shadow-lg"
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

  <!-- LIKE ANIMATION -->
  {#if showLikeAnim}
    <div
      class="absolute inset-0 z-50 pointer-events-none flex items-center justify-center"
      in:scale={{ duration: 300, start: 0.5, easing: cubicOut }}
      out:fade={{ duration: 200 }}
    >
      <Heart
        size={120}
        class="fill-white text-white drop-shadow-2xl animate-pulse"
      />
    </div>
  {/if}

  <!-- SOCIAL SIDEBAR -->
  <div
    class="absolute right-3 bottom-20 z-50 flex flex-col gap-4 items-center pointer-events-auto"
  >
    <button onclick={() => (isGridOpen = true)} class="group">
      <div
        class="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 group-active:scale-95 transition-all"
      >
        <Grid size={20} class="text-white" stroke-width={2} />
      </div>
    </button>

    <button class="group">
      <div
        class="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 group-active:scale-95 transition-all"
      >
        <MoreHorizontal size={20} class="text-white" stroke-width={2} />
      </div>
    </button>

    <!-- Close Button (Minimizar) -->
    <button onclick={onClose} class="group mt-4">
      <div
        class="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 group-active:scale-95 transition-all"
      >
        <ChevronDown size={24} class="text-white" />
      </div>
    </button>
  </div>

  <!-- GRID VIEW OVERLAY -->
  {#if isGridOpen}
    <div
      class="absolute inset-0 z-50 bg-zinc-950/95 backdrop-blur-xl flex flex-col"
      in:fly={{ y: 500, duration: 300 }}
      out:fly={{ y: 500, duration: 300 }}
    >
      <div
        class="p-6 flex justify-between items-center border-b border-white/10"
      >
        <h2 class="text-xl font-black uppercase tracking-wider text-white">
          Todas las Opciones ({options.length})
        </h2>
        <button
          onclick={() => (isGridOpen = false)}
          class="p-2 bg-white/10 rounded-full hover:bg-white/20"
        >
          <X size={24} class="text-white" />
        </button>
      </div>
      <div
        class="flex-1 overflow-y-auto p-4 grid grid-cols-3 gap-1.5 content-start"
      >
        {#each options as opt, i}
          {@const percent = hasVoted
            ? Math.round(((opt.votes || 0) / maxVotes) * 100)
            : 0}
          {@const type = getMediaType(opt)}

          <button
            onclick={() => {
              scrollToOption(i);
              onOptionChange(opt.id);
              isGridOpen = false;
            }}
            class="relative aspect-[3/4] bg-zinc-900 rounded-lg overflow-hidden group border border-white/5 hover:border-white/50 transition-all"
          >
            {#if type === "text"}
              <div
                class="w-full h-full flex items-center justify-center"
                style:background-color={`${opt.color}20`}
              >
                <Type style={`color: ${opt.color}`} />
              </div>
            {:else}
              <img
                src={opt.imageUrl}
                alt={opt.label}
                class="w-full h-full object-cover opacity-80 group-hover:opacity-100"
              />
            {/if}

            <div
              class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-2"
            >
              <span
                class="text-[10px] font-bold text-white uppercase truncate w-full text-left"
                >{opt.label}</span
              >
              {#if hasVoted}
                <div
                  class="w-full bg-white/20 h-1 rounded-full mt-1 overflow-hidden"
                >
                  <div
                    class="h-full bg-white"
                    style:width={`${percent}%`}
                    style:background-color={opt.color}
                  ></div>
                </div>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- BOTTOM ACTION BAR -->
  <div class="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto">
    <div
      class="flex items-center justify-between px-6 py-4 bg-gradient-to-t from-black/90 via-black/70 to-transparent backdrop-blur-sm"
    >
      <!-- Left side actions -->
      <div class="flex items-center gap-5">
        <!-- Vote count -->
        <button
          class="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
            ></path>
          </svg>
          <span class="text-sm font-semibold"
            >{stats?.totalVotes
              ? stats.totalVotes / 1000 >= 1
                ? (stats.totalVotes / 1000).toFixed(1) + "K"
                : stats.totalVotes
              : "0"}</span
          >
        </button>

        <!-- Views count -->
        <button
          class="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span class="text-sm font-semibold">{stats?.totalViews || "0"}</span>
        </button>

        <!-- Globe -->
        <button
          onclick={onOpenInGlobe}
          class="text-white/80 hover:text-white transition-colors"
        >
          <Globe size={22} stroke-width={2} />
        </button>

        <!-- Statistics Chart -->
        <button
          onclick={onGoToChart}
          class="text-white/80 hover:text-white transition-colors"
          title="Ver estadísticas"
        >
          <BarChart3 size={22} stroke-width={2} />
        </button>
      </div>

      <!-- Right side actions -->
      <div class="flex items-center gap-5">
        <!-- Bookmark -->
        <button
          onclick={onBookmark}
          class="flex items-center gap-1 text-white/80 hover:text-white transition-colors"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <span class="text-xs font-medium">0</span>
        </button>

        <!-- Repost -->
        <button
          onclick={onRepost}
          class="flex items-center gap-1 text-white/80 hover:text-white transition-colors"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M17 1l4 4-4 4" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="M7 23l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          <span class="text-xs font-medium">0</span>
        </button>

        <!-- Share -->
        <button
          onclick={handleShare}
          class="flex items-center gap-1 text-white/80 hover:text-white transition-colors"
        >
          <Share2 size={22} stroke-width={2} />
          <span class="text-xs font-medium">0</span>
        </button>
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

  .text-shadow-xl {
    text-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
  }
</style>
