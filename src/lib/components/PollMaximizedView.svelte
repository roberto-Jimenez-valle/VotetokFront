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
    ChevronRight,
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
    Volume2,
    VolumeX,
  } from "lucide-svelte";
  import { fade, fly, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import MediaEmbed from "./MediaEmbed.svelte";
  import AuthModal from "../AuthModal.svelte";
  import FriendsVotesModal from "./FriendsVotesModal.svelte";
  import CommentsModal from "./CommentsModal.svelte";
  import Portal from "./Portal.svelte";
  import { apiPost, apiDelete } from '$lib/api/client';

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
    type?: "youtube" | "vimeo" | "image" | "text" | "spotify" | "soundcloud";
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
    commentsCount?: number;
    repostCount?: number;
  }

  interface Friend {
    id: string;
    name: string;
    username?: string;
    avatarUrl?: string | null;
    optionKey?: string;
  }

  interface Props {
    options: PollOption[];
    activeOptionId: string;
    pollId: number;
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
    pollId,
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
  // Si el usuario ya votó, mostrar el color de la opción votada
  // Si no ha votado, mostrar el color de la opción activa
  let voteColor = $state('#10b981');
  
  // Color neutro para opciones antes de votar
  const NEUTRAL_COLOR = '#3a3d42';
  
  $effect(() => {
    if (hasVoted) {
      // Buscar la opción que el usuario votó
      const votedOption = options.find((o) => o.voted === true);
      if (votedOption) {
        voteColor = votedOption.color || '#10b981';
      } else {
        voteColor = '#10b981';
      }
    } else {
      // Si no ha votado, usar blanco
      voteColor = '#ffffff';
    }
  });

  let scrollContainer: HTMLElement | null = null;
  let showLikeAnim = $state(false);
  let lastTapTime = 0;
  let transitionY = $state(100);
  let showAuthModal = $state(false);
  let showFriendsVotesModal = $state(false);
  let showCommentsModal = $state(false);
  
  // Estado para repost
  let hasReposted = $state(false);
  let repostCount = $state(stats?.repostCount || 0);
  let isReposting = $state(false);
  
  // Estado para views
  let viewCount = $state(stats?.totalViews || 0);
  
  // Estado para shares
  let shareCount = $state((stats as any)?.shareCount || 0);
  let isSharing = $state(false);
  let showShareToast = $state(false);
  let shareToastTimeout: any = null;
  
  // Registrar visualización al montar
  $effect(() => {
    if (pollId) {
      registerView();
    }
  });
  
  // Manejar botón atrás del navegador
  let historyPushed = false;
  
  // Agregar entrada al historial cuando se monta (el componente solo existe cuando está visible)
  onMount(() => {
    history.pushState({ modal: 'maximized' }, '');
    historyPushed = true;
    
    const handlePopState = () => {
      if (historyPushed) {
        historyPushed = false;
        onClose();
      }
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
  
  async function registerView() {
    try {
      const result = await apiPost(`/api/polls/${pollId}/view`, {});
      if (result.viewCount !== undefined) {
        viewCount = result.viewCount;
      }
    } catch (error) {
      // Silenciar errores de view (no crítico)
      console.debug('[View] Error registrando:', error);
    }
  }
  
  // Función para republicar
  async function handleRepost() {
    if (!isAuthenticated) {
      showAuthModal = true;
      return;
    }
    
    if (isReposting) return;
    isReposting = true;
    
    try {
      if (hasReposted) {
        const result = await apiDelete(`/api/polls/${pollId}/repost`);
        hasReposted = false;
        repostCount = result.repostCount || Math.max(0, repostCount - 1);
      } else {
        const result = await apiPost(`/api/polls/${pollId}/repost`, {});
        hasReposted = true;
        repostCount = result.repostCount || repostCount + 1;
      }
    } catch (error: any) {
      console.error('[Repost] Error:', error);
    } finally {
      isReposting = false;
    }
  }

  // Debug: verificar friendsByOption
  $effect(() => {
    console.log('[PollMaximizedView] friendsByOption:', friendsByOption);
    console.log('[PollMaximizedView] options IDs:', options.map(o => o.id));
    console.log('[PollMaximizedView] friendsByOption keys:', Object.keys(friendsByOption || {}));
  });

  // Helper para obtener amigos de una opción (busca por múltiples claves)
  function getFriendsForOption(optId: string): Friend[] {
    if (!friendsByOption) return [];
    // Intentar diferentes claves posibles
    return friendsByOption[optId] || friendsByOption[`opt_${optId}`] || [];
  }
  
  // Verificar si hay amigos en total
  let hasFriendsVotes = $derived(
    friendsByOption && Object.values(friendsByOption).some(arr => arr && arr.length > 0)
  );

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

  // Handle share with Web Share API - redirige a handleShareAction
  async function handleShare() {
    await handleShareAction();
  }

  // --- DETECCIÓN DE TIPO DE MEDIA (SI NO VIENE EXPLÍCITO) ---
  type MediaType = "youtube" | "vimeo" | "image" | "text" | "spotify" | "soundcloud" | "tiktok" | "twitch" | "twitter" | "applemusic" | "deezer" | "dailymotion" | "bandcamp";
  
  function getMediaType(opt: PollOption): MediaType {
    if (opt.type) return opt.type as MediaType;
    if (!opt.imageUrl) return "text";
    const url = opt.imageUrl.toLowerCase();
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
  
  // Estado del sonido para videos
  let isMuted = $state(true); // Los videos empiezan muteados por autoplay
  
  // Detectar si la opción actual es un video (YouTube, Vimeo, o video directo)
  function isVideoContent(opt: PollOption): boolean {
    if (!opt?.imageUrl) return false;
    const url = opt.imageUrl.toLowerCase();
    return (
      url.includes('youtube.com') ||
      url.includes('youtu.be') ||
      url.includes('vimeo.com') ||
      url.match(/\.(mp4|webm|ogg|mov)(\?|$)/) !== null
    );
  }
  
  // Activar sonido del video actual
  function unmuteCurrentVideo() {
    if (!scrollContainer) return;
    
    const iframes = scrollContainer.querySelectorAll('iframe');
    const videos = scrollContainer.querySelectorAll('video');
    
    // Para iframes de YouTube/Vimeo
    iframes.forEach((iframe) => {
      try {
        const src = iframe.src || '';
        
        // YouTube - usar postMessage API
        if (src.includes('youtube.com') || src.includes('youtu.be')) {
          // Modificar src para quitar mute
          const newSrc = src.replace(/[&?]mute=1/, '').replace(/mute=1[&]?/, '');
          if (newSrc !== src) {
            iframe.src = newSrc;
          }
          // También enviar comando de unmute
          iframe.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
            '*'
          );
        }
        
        // Vimeo - usar postMessage API
        if (src.includes('vimeo.com')) {
          const newSrc = src.replace(/[&?]muted=1/, '').replace(/muted=1[&]?/, '');
          if (newSrc !== src) {
            iframe.src = newSrc;
          }
          iframe.contentWindow?.postMessage(
            JSON.stringify({ method: 'setVolume', value: 1 }),
            '*'
          );
        }
      } catch (e) {
        console.warn('[PollMaximizedView] Error al activar sonido:', e);
      }
    });
    
    // Para videos HTML5 nativos
    videos.forEach((video) => {
      video.muted = false;
    });
    
    isMuted = false;
    console.log('[PollMaximizedView] 🔊 Sonido activado');
  }
  
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
      const url = `https://voutop.com/?poll=${pollId}`;
      await navigator.clipboard.writeText(url);
      isMoreMenuOpen = false;
      showShareToastNotification();
      registerShare();
    } catch (err) {
      console.error('Error copiando enlace:', err);
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = `https://voutop.com/?poll=${pollId}`;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showShareToastNotification();
        registerShare();
      } catch (e) {}
      document.body.removeChild(textarea);
    }
  }
  
  // Mostrar toast de enlace copiado
  function showShareToastNotification() {
    showShareToast = true;
    if (shareToastTimeout) clearTimeout(shareToastTimeout);
    shareToastTimeout = setTimeout(() => {
      showShareToast = false;
    }, 2000);
  }
  
  // Registrar share en API
  async function registerShare() {
    if (isSharing) return;
    isSharing = true;
    
    try {
      const result = await apiPost(`/api/polls/${pollId}/share`, {});
      if (result.shareCount !== undefined) {
        shareCount = result.shareCount;
      } else {
        shareCount++;
      }
    } catch (error) {
      // Incrementar localmente si falla API
      shareCount++;
    } finally {
      isSharing = false;
    }
  }
  
  // Handler para compartir - copia texto formateado al portapapeles
  async function handleShareAction() {
    const shareUrl = `https://voutop.com/?poll=${pollId}`;
    const shareTitle = pollTitle || 'Encuesta';
    
    // Emojis de números para las opciones
    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];
    
    // Crear texto con formato bonito
    const optionLabels = options.slice(0, 6).map((opt, i) => `${numberEmojis[i]} ${opt.label}`).join('\n');
    const shareText = `❓${shareTitle}\n\n🧩 Opciones:\n${optionLabels}\n\n🗳️ ¡Vota ahora!\n${shareUrl}`;

    // Copiar directamente al portapapeles (más confiable que Web Share API)
    try {
      await navigator.clipboard.writeText(shareText);
      showShareToastNotification();
      registerShare();
    } catch {
      // Fallback con textarea
      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showShareToastNotification();
      registerShare();
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
  
  // Resetear estado de mute cuando cambie la opción activa (cada video empieza muteado)
  $effect(() => {
    if (activeIndex >= 0) {
      isMuted = true; // Cada nuevo slide empieza muteado
    }
  });
  
  // Derivado: ¿la opción actual es video?
  let currentOptionIsVideo = $derived(
    activeIndex >= 0 && options[activeIndex] ? isVideoContent(options[activeIndex]) : false
  );

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
              class="h-full transition-all duration-700 ease-out overflow-hidden relative rounded-sm"
              style:flex="{flexWeight} 1 0%"
              style:background-color={hasVoted ? opt.color : "rgba(255, 255, 255, 0.2)"}
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
                style:background-color={hasVoted ? "transparent" : "#fff"}
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
            
            <!-- Botón minimizar (en línea con la pregunta) -->
            <button 
              onclick={onClose} 
              class="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center border border-white/20 flex-shrink-0 pointer-events-auto transition-all hover:bg-black/60 active:scale-95"
              aria-label="Minimizar"
            >
              <ChevronRight size={18} class="text-white" />
            </button>
          </div>
        </div>
      </div>

      <!-- SCROLL CONTAINER (MAIN CONTENT) -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div bind:this={scrollContainer}
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
          {@const isVideoType = type !== 'image' && type !== 'text'}
          {@const isGifType = opt.imageUrl && (opt.imageUrl.includes('giphy.com') || opt.imageUrl.includes('tenor.com') || /\.gif([?#]|$)/i.test(opt.imageUrl))}
          {@const isImageType = type === 'image' && !isGifType}
          <div
            class="w-full h-full flex-shrink-0 snap-center relative"
            style="scroll-snap-stop: always;"
          >
            <!-- SlideContent -->
            <div class="w-full h-full relative overflow-hidden">
              
              <!-- CARD CONTAINER - Igual para todos los tipos -->
              <div class="option-card-container">
                <div class="option-card-rounded">
                  
                  {#if type === "text"}
                    <!-- === LAYOUT SOLO TEXTO === -->
                    <!-- Área principal con color de fondo y comillas -->
                    <div class="card-content-area" style="background-color: {hasVoted ? opt.color : NEUTRAL_COLOR};">
                      <!-- Comillas decorativas -->
                      <span class="quote-decoration quote-open">"</span>
                      <span class="quote-decoration quote-close">"</span>
                      
                      <!-- Texto centrado -->
                      <div class="text-center-wrapper">
                        <h1 class="{opt.label.length > 60 ? 'text-3xl' : opt.label.length > 40 ? 'text-4xl' : 'text-5xl'} font-bold text-white uppercase tracking-tighter leading-tight break-words text-center">
                          {opt.label}
                        </h1>
                      </div>
                      
                      <!-- Línea divisoria en el borde inferior -->
                      <div class="card-divider-line card-divider-bottom"></div>
                    </div>
                    
                    <!-- Barra inferior -->
                    <div class="card-footer-bar" style="background-color: {hasVoted ? opt.color : NEUTRAL_COLOR};">
                      <div class="card-bottom-row">
                        {#if hasVoted && totalVotes > 0}
                          <div class="card-percentage">
                            <span class="card-percentage-value">{Math.round(((opt.votes || 0) / totalVotes) * 100)}%</span>
                            <span class="card-percentage-label">DE LOS VOTOS</span>
                          </div>
                        {:else}
                          <div></div>
                        {/if}
                        
                        <!-- Avatares de amigos -->
                        <div class="card-avatars-group">
                          {#if getFriendsForOption(opt.id).length > 0}
                            <button 
                              class="friends-avatars-stack"
                              onclick={(e) => { e.stopPropagation(); if (hasVoted) showFriendsVotesModal = true; }}
                              disabled={!hasVoted}
                              type="button"
                              aria-label={hasVoted ? 'Ver votos de amigos' : 'Vota para ver quién eligió esta opción'}
                            >
                              {#each getFriendsForOption(opt.id).slice(0, 3) as friend, idx}
                                {#if hasVoted}
                                  <img 
                                    class="friend-avatar-stacked" 
                                    style="z-index: {10 - idx}; margin-left: {idx > 0 ? '-8px' : '0'};"
                                    src={friend.avatarUrl || '/default-avatar.png'}
                                    alt={friend.name || 'Amigo'}
                                  />
                                {:else}
                                  <div class="friend-avatar-mystery" style="z-index: {10 - idx}; margin-left: {idx > 0 ? '-8px' : '0'};">
                                    <span>?</span>
                                  </div>
                                {/if}
                              {/each}
                              {#if getFriendsForOption(opt.id).length > 3}
                                <span class="friends-more-count">+{getFriendsForOption(opt.id).length - 3}</span>
                              {/if}
                            </button>
                          {/if}
                        </div>
                      </div>
                    </div>
                    
                  {:else if isVideoType}
                    <!-- === LAYOUT VIDEO === -->
                    <!-- Card con color de fondo de la opción -->
                    <div class="card-video-wrapper" style="background-color: {hasVoted ? opt.color : NEUTRAL_COLOR};">
                      <!-- Área de video más alta -->
                      <div class="card-video-area">
                        {#if Math.abs(i - activeIndex) <= 1}
                          <MediaEmbed
                            url={opt.imageUrl || ""}
                            mode="full"
                            width="100%"
                            height="100%"
                            autoplay={false}
                          />
                        {:else}
                          <div class="w-full h-full flex items-center justify-center bg-black">
                            <span class="text-white/50">Cargando...</span>
                          </div>
                        {/if}
                      </div>
                      
                      <!-- Contenido debajo del video -->
                      <div class="card-video-bottom">
                        <!-- Label -->
                        <h2 class="{opt.label.length > 40 ? 'text-xl' : opt.label.length > 25 ? 'text-2xl' : 'text-3xl'} font-bold text-white uppercase tracking-tighter leading-tight card-bottom-label">
                          {opt.label}
                        </h2>
                        
                        <!-- Línea divisoria -->
                        <div class="card-divider-line"></div>
                        
                        <!-- Footer con porcentaje y avatares -->
                        <div class="card-bottom-row">
                          {#if hasVoted && totalVotes > 0}
                            <div class="card-percentage">
                              <span class="card-percentage-value">{Math.round(((opt.votes || 0) / totalVotes) * 100)}%</span>
                              <span class="card-percentage-label">DE LOS VOTOS</span>
                            </div>
                          {:else}
                            <div></div>
                          {/if}
                          
                          <!-- Avatares de amigos -->
                          <div class="card-avatars-group">
                            {#if getFriendsForOption(opt.id).length > 0}
                              <button 
                                class="friends-avatars-stack"
                                onclick={(e) => { e.stopPropagation(); if (hasVoted) showFriendsVotesModal = true; }}
                                disabled={!hasVoted}
                                type="button"
                                aria-label={hasVoted ? 'Ver votos de amigos' : 'Vota para ver quién eligió esta opción'}
                              >
                                {#each getFriendsForOption(opt.id).slice(0, 3) as friend, idx}
                                  {#if hasVoted}
                                    <img 
                                      class="friend-avatar-stacked" 
                                      style="z-index: {10 - idx}; margin-left: {idx > 0 ? '-8px' : '0'};"
                                      src={friend.avatarUrl || '/default-avatar.png'}
                                      alt={friend.name || 'Amigo'}
                                    />
                                  {:else}
                                    <div class="friend-avatar-mystery" style="z-index: {10 - idx}; margin-left: {idx > 0 ? '-8px' : '0'};">
                                      <span>?</span>
                                    </div>
                                  {/if}
                                {/each}
                                {#if getFriendsForOption(opt.id).length > 3}
                                  <span class="friends-more-count">+{getFriendsForOption(opt.id).length - 3}</span>
                                {/if}
                              </button>
                            {/if}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                  {:else}
                    <!-- === LAYOUT GIF/IMAGEN === -->
                    <!-- Wrapper con borde del color de la opción -->
                    <div class="card-media-border" style="--border-color: {hasVoted ? opt.color : NEUTRAL_COLOR};">
                      <!-- Imagen a pantalla completa con contenido overlay -->
                      <div class="card-media-fullscreen">
                        <!-- Imagen de fondo -->
                        <div class="card-image-fullscreen">
                        {#if Math.abs(i - activeIndex) <= 1}
                          <MediaEmbed
                            url={opt.imageUrl || ""}
                            mode="full"
                            width="100%"
                            height="100%"
                            autoplay={false}
                          />
                        {:else}
                          <div class="w-full h-full flex items-center justify-center bg-black">
                            <span class="text-white/50">Cargando...</span>
                          </div>
                        {/if}
                        
                        <!-- Badge GIPHY -->
                        {#if isGifType}
                          <span class="giphy-badge-corner">GIPHY</span>
                        {/if}
                      </div>
                      
                      <!-- Degradado inferior -->
                      <div class="card-bottom-gradient"></div>
                      
                      <!-- Contenido inferior: label + línea + porcentaje + avatar -->
                      <div class="card-bottom-content">
                        <!-- Label -->
                        <h2 class="{opt.label.length > 40 ? 'text-xl' : opt.label.length > 25 ? 'text-2xl' : 'text-3xl'} font-bold text-white uppercase tracking-tighter leading-tight card-bottom-label">
                          {opt.label}
                        </h2>
                        
                        <!-- Línea divisoria -->
                        <div class="card-divider-line"></div>
                        
                        <!-- Fila: Porcentaje a la izquierda, avatar a la derecha -->
                        <div class="card-bottom-row">
                          {#if hasVoted && totalVotes > 0}
                            <div class="card-percentage">
                              <span class="card-percentage-value">{Math.round(((opt.votes || 0) / totalVotes) * 100)}%</span>
                              <span class="card-percentage-label">DE LOS VOTOS</span>
                            </div>
                          {:else}
                            <div></div>
                          {/if}
                          
                          <!-- Avatares de amigos -->
                          <div class="card-avatars-group">
                            {#if getFriendsForOption(opt.id).length > 0}
                              <button 
                                class="friends-avatars-stack"
                                onclick={(e) => { e.stopPropagation(); if (hasVoted) showFriendsVotesModal = true; }}
                                disabled={!hasVoted}
                                type="button"
                                aria-label={hasVoted ? 'Ver votos de amigos' : 'Vota para ver quién eligió esta opción'}
                              >
                                {#each getFriendsForOption(opt.id).slice(0, 3) as friend, idx}
                                  {#if hasVoted}
                                    <img 
                                      class="friend-avatar-stacked" 
                                      style="z-index: {10 - idx}; margin-left: {idx > 0 ? '-8px' : '0'};"
                                      src={friend.avatarUrl || '/default-avatar.png'}
                                      alt={friend.name || 'Amigo'}
                                    />
                                  {:else}
                                    <div class="friend-avatar-mystery" style="z-index: {10 - idx}; margin-left: {idx > 0 ? '-8px' : '0'};">
                                      <span>?</span>
                                    </div>
                                  {/if}
                                {/each}
                                {#if getFriendsForOption(opt.id).length > 3}
                                  <span class="friends-more-count">+{getFriendsForOption(opt.id).length - 3}</span>
                                {/if}
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

  
  <!-- BOTTOM ACTION BAR - New Design -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div 
    class="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto more-menu-container"
    onclick={handleClickOutside} >
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
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; showCommentsModal = true; }}
          >
            <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <MessageCircle size={20} class="text-white" />
            </div>
            <div class="flex-1">
              <span class="font-medium">Comentarios</span>
              <p class="text-xs text-gray-400">Ver comentarios</p>
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
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; handleShareAction(); }}
          >
            <div class="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Share2 size={20} class="text-blue-400" />
            </div>
            <div class="flex-1">
              <span class="font-medium">Compartir</span>
              <p class="text-xs text-gray-400">{formatCount(shareCount)} compartidos</p>
            </div>
          </button>

          <!-- Repostear -->
          <button 
            class="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition text-left"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; handleRepost(); }}
            disabled={isReposting}
          >
            <div class="w-10 h-10 rounded-full {hasReposted ? 'bg-green-500/40' : 'bg-green-500/20'} flex items-center justify-center">
              <Repeat2 size={20} class={hasReposted ? 'text-green-300' : 'text-green-400'} />
            </div>
            <div class="flex-1">
              <span class="font-medium {hasReposted ? 'text-green-400' : ''}">{hasReposted ? 'Republicado' : 'Repostear'}</span>
              <p class="text-xs text-gray-400">{formatCount(repostCount)} reposts</p>
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
    <div class="w-full flex items-center gap-3 h-14 px-4 bg-transparent">
      
      <!-- A. ZONA FIJA (Acciones Principales) -->
      <div class="flex items-center gap-1 shrink-0">
        
        <!-- Votar -->
        <button 
          class="action-bar-btn"
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
            <SquareCheck size={26} strokeWidth={1.5} style="color: {voteColor}" />
          {:else}
            <Square size={26} strokeWidth={1.5} class="text-white/80" />
          {/if}
          <span class="action-bar-count" class:voted={hasVoted} style={hasVoted ? `color: ${voteColor}` : ''}>{formatCount(stats?.totalVotes)}</span>
        </button>
 
        <!-- Mensajes -->
        <button 
          class="action-bar-btn"
          aria-label="Comentarios"
          onclick={(e) => { e.stopPropagation(); showCommentsModal = true; }}
        >
          <MessageCircle size={26} strokeWidth={1.5} class="text-white/80" />
          <span class="action-bar-count">{stats?.commentsCount || 0}</span>
        </button>

      </div>

      <!-- B. ZONA SCROLLABLE (Acciones Secundarias) -->
      <div class="overflow-x-auto hide-scrollbar scroll-mask-right flex-1">
        <div class="flex items-center gap-1 pr-24">
          
          <!-- Menú (3 puntos) -->
          <button 
            class="action-bar-btn"
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = !isMoreMenuOpen; }}
            aria-label="Más opciones"
          >
            <MoreVertical size={26} strokeWidth={1.5} class="text-white/80" />
          </button>

          <!-- Mundo - Solo si ha votado -->
          {#if hasVoted}
            <button 
              class="action-bar-btn"
              onclick={onOpenInGlobe}
              aria-label="Ver en globo"
            >
              <Globe size={26} strokeWidth={1.5} class="text-white/80" />
            </button>

            <!-- Gráfico (Pulso) -->
            <button 
              class="action-bar-btn"
              onclick={onGoToChart}
              aria-label="Ver estadísticas"
            >
              <Activity size={26} strokeWidth={1.5} class="text-white/80" />
            </button>
          {/if}

          <!-- Share -->
          <button 
            class="action-bar-btn"
            onclick={handleShare}
            aria-label="Compartir"
          >
            <Share2 size={26} strokeWidth={1.5} class="text-white/80" />
            <span class="action-bar-count">{formatCount(shareCount)}</span>
          </button>

          <!-- Retweet -->
          <button 
            class="action-bar-btn {hasReposted ? 'reposted' : ''}"
            onclick={handleRepost}
            aria-label={hasReposted ? 'Quitar repost' : 'Repostear'}
            disabled={isReposting}
          >
            <Repeat2 size={26} strokeWidth={1.5} class={hasReposted ? 'text-green-400' : 'text-white/80'} />
            <span class="action-bar-count" class:reposted={hasReposted}>{formatCount(repostCount)}</span>
          </button>

          <!-- Vistas -->
          <button 
            class="action-bar-btn"
            aria-label="Vistas"
          >
            <Eye size={26} strokeWidth={1.5} class="text-white/80" />
            <span class="action-bar-count">{formatCount(viewCount)}</span>
          </button>

          <!-- Bookmark -->
          <button 
            class="action-bar-btn"
            onclick={onBookmark}
            aria-label="Guardar"
          >
            <Bookmark size={26} strokeWidth={1.5} class="text-white/80" />
          </button>

          <!-- Copiar enlace -->
          <button 
            class="action-bar-btn"
            onclick={copyLink}
            aria-label="Copiar enlace"
          >
            <Link size={26} strokeWidth={1.5} class="text-white/80" />
          </button>

          <!-- No me interesa -->
          <button 
            class="action-bar-btn"
            aria-label="No me interesa"
          >
            <EyeOff size={26} strokeWidth={1.5} class="text-white/80" />
          </button>

          <!-- Reportar -->
          <button 
            class="action-bar-btn"
            aria-label="Reportar"
          >
            <Flag size={26} strokeWidth={1.5} class="text-red-400/80" />
          </button>

        </div>
      </div>

    </div>
  </div>

  <!-- AUTH MODAL -->
  <AuthModal bind:isOpen={showAuthModal} />

  <!-- FRIENDS VOTES MODAL -->
  <FriendsVotesModal 
    bind:isOpen={showFriendsVotesModal}
    pollTitle={pollTitle}
    options={options.map(opt => ({ id: opt.id, key: opt.id, label: opt.label, color: opt.color, votes: opt.votes }))}
    {friendsByOption}
    onClose={() => showFriendsVotesModal = false}
  />

  <!-- COMMENTS MODAL -->
  <CommentsModal 
    bind:isOpen={showCommentsModal}
    {pollId}
    {pollTitle}
  />
  
  <!-- Toast de enlace copiado -->
  {#if showShareToast}
    <div class="share-toast-fixed">
      ✓ Enlace copiado
    </div>
  {/if}
</div>

<style>
  /* ========================================
     ACTION BAR - Iconos grandes estilo línea
     ======================================== */
  .action-bar-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .action-bar-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .action-bar-btn:active {
    transform: scale(0.95);
  }

  .action-bar-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-bar-count {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    font-family: system-ui, -apple-system, sans-serif;
  }

  .action-bar-count.voted,
  .action-bar-count.reposted {
    font-weight: 600;
  }

  .action-bar-count.reposted {
    color: #4ade80;
  }

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

  /* ========================================
     MARCO DECORATIVO PARA OPCIONES DE TEXTO
     ======================================== */
  
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
  
  /* Botón de color dentro del card */
  .option-card-inner button[title="Cambiar color"] {
    position: absolute;
    top: 12px;
    right: 12px;
  }
  
  /* Responsive para móviles */
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
  }
  
  /* Porcentaje en opciones de texto */
  .text-percentage-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-top: 16px;
    padding: 12px 24px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .text-percentage-value {
    font-size: 42px;
    font-weight: 900;
    color: white;
    line-height: 1;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .text-percentage-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    font-weight: 600;
  }
  
  @media (max-width: 480px) {
    .text-percentage-value {
      font-size: 36px;
    }
  }

  /* Porcentaje en línea (izquierda) */
  .text-percentage-inline {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  
  .text-percentage-value-inline {
    font-size: 32px;
    font-weight: 900;
    color: white;
    line-height: 1;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .text-percentage-label-inline {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
  }
  
  @media (max-width: 480px) {
    .text-percentage-value-inline {
      font-size: 28px;
    }
  }

  /* ========================================
     FLOATING MEDIA CARD (ESTILO TARJETA FLOTANTE)
     ======================================== */
  
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
    padding-bottom: 70px;
  }
  
  .floating-glass-panel .option-card-inner {
    padding: 20px 24px;
    border-radius: 22px 22px 0 0;
    align-items: flex-start;
  }
  
  /* Responsive */
  @media (max-width: 380px) {
    .floating-glass-panel .option-card-frame {
      border-radius: 20px 20px 0 0;
      padding-bottom: 60px;
    }
    
    .floating-glass-panel .option-card-inner {
      padding: 16px 20px;
      border-radius: 18px 18px 0 0;
    }
  }
  
  
  /* ========================================
     AVATARES DE AMIGOS - Clickeables
     ======================================== */
  
  .friends-avatars-btn {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    width: fit-content;
  }

  .friends-avatars-btn:hover {
    filter: brightness(1.15);
  }

  .friends-avatars-btn:active {
    filter: brightness(0.9);
  }

  .friend-avatar-item {
    transition: filter 0.2s ease;
  }
  
  .friends-avatars-btn:hover .friend-avatar-item img {
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
  }

  /* ========================================
     PORCENTAJE DE VOTACIÓN - Estilo atractivo
     ======================================== */
  
  .option-percentage-voted-maximized {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    margin-top: 12px;
  }

  .percentage-value-maximized {
    font-size: 56px;
    font-weight: 900;
    line-height: 1;
    text-shadow: 
      0 4px 16px rgba(0, 0, 0, 0.6),
      0 2px 6px rgba(0, 0, 0, 0.4);
    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4));
    letter-spacing: -0.02em;
  }

  .percentage-subtitle-maximized {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    font-weight: 700;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  /* Responsive */
  @media (max-width: 480px) {
    .percentage-value-maximized {
      font-size: 48px;
    }
    
    .percentage-subtitle-maximized {
      font-size: 11px;
    }
  }

  /* ========================================
     BOTÓN DE ACTIVAR SONIDO
     ======================================== */
  
  .unmute-button {
    position: absolute;
    top: calc(50% + 50px);
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 60;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 24px 32px;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    cursor: pointer;
    transition: all 0.2s ease;
    animation: pulseUnmute 2s ease-in-out infinite;
  }

  .unmute-button:hover {
    background: rgba(0, 0, 0, 0.85);
    transform: translate(-50%, -50%) scale(1.05);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .unmute-button:active {
    transform: translate(-50%, -50%) scale(0.98);
  }

  .unmute-icon-wrapper {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid rgba(255, 255, 255, 0.2);
  }

  .unmute-text {
    font-size: 14px;
    font-weight: 600;
    color: white;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  @keyframes pulseUnmute {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.3);
    }
    50% {
      box-shadow: 0 0 0 15px rgba(255, 255, 255, 0);
    }
  }

  /* Responsive para móvil */
  @media (max-width: 480px) {
    .unmute-button {
      padding: 20px 28px;
      gap: 10px;
    }

    .unmute-icon-wrapper {
      width: 64px;
      height: 64px;
    }

    .unmute-icon-wrapper :global(svg) {
      width: 36px;
      height: 36px;
    }

    .unmute-text {
      font-size: 12px;
    }
  }

  /* ========================================
     SCROLLBAR PERSONALIZADO
     ======================================== */
  
  :global(.overflow-y-auto) {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  :global(.overflow-y-auto)::-webkit-scrollbar {
    width: 4px;
  }

  :global(.overflow-y-auto)::-webkit-scrollbar-track {
    background: transparent;
  }

  :global(.overflow-y-auto)::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  /* ========================================
     TOAST DE ENLACE COPIADO
     ======================================== */
  
  .share-toast-fixed {
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 12px 24px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4),
                0 2px 8px rgba(16, 185, 129, 0.3);
    z-index: 999999;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: toast-in 0.3s ease-out;
  }
  
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @media (max-width: 640px) {
    .share-toast-fixed {
      top: 60px;
      padding: 10px 20px;
      font-size: 13px;
    }
  }

  /* ========================================
     NUEVOS LAYOUTS MAXIMIZED (Imágenes de referencia)
     ======================================== */

  /* ========================================
     CARD CONTAINER - Estructura unificada
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

  .card-video-area :global(.media-embed),
  .card-video-area :global(.embed-container),
  .card-video-area :global(.mini-card),
  .card-video-area :global(.linkedin-card),
  .card-video-area :global(.oembed-container) {
    width: 100% !important;
    height: 100% !important;
    background: transparent !important;
    background-color: transparent !important;
  }

  .card-video-area :global(iframe),
  .card-video-area :global(video) {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    border-radius: 28px !important;
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

  /* Ocultar el contenido extra de MediaEmbed */
  .card-image-fullscreen :global(.linkedin-content),
  .card-image-fullscreen :global(.mini-card-content) {
    display: none !important;
  }

  /* Badge GIPHY en esquina superior derecha */
  .giphy-badge-corner {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    z-index: 10;
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

  .card-percentage {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-percentage-value {
    font-size: 36px;
    font-weight: 900;
    line-height: 1;
    color: white;
    text-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.5),
      0 4px 16px rgba(0, 0, 0, 0.3);
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }

  .card-percentage-label {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }

  .card-creator-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.8);
    object-fit: cover;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  /* Grupo de avatares (creador + amigos) */
  .card-avatars-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Stack de avatares de amigos */
  .friends-avatars-stack {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: transform 0.2s ease;
  }

  .friends-avatars-stack:hover {
    transform: scale(1.05);
  }

  .friend-avatar-stacked {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.9);
    object-fit: cover;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }

  /* Avatar misterioso cuando no ha votado */
  .friend-avatar-mystery {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.5);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%);
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .friend-avatar-mystery span {
    color: white;
    font-size: 14px;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .friends-avatars-stack:disabled {
    cursor: default;
    opacity: 0.9;
  }

  .friends-more-count {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    border: 2px solid rgba(255, 255, 255, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: -8px;
    font-size: 11px;
    font-weight: 700;
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  /* ========================================
     RESPONSIVE
     ======================================== */

  @media (max-width: 480px) {
    .option-card-container {
      padding: 100px 10px 60px;
    }

    .option-card-rounded {
      border-radius: 12px;
    }

    .quote-decoration {
      font-size: 80px;
    }

    .card-footer-bar {
      padding: 12px 14px;
    }

    .card-percentage-value {
      font-size: 24px;
    }

    .card-creator-avatar {
      width: 36px;
      height: 36px;
    }
  }

  /* === ELEMENTOS COMUNES === */
  .maximized-footer {
    position: absolute;
    bottom: 70px;
    left: 0;
    right: 0;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 0 24px;
    z-index: 10;
  }

  .percentage-section-max {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .percentage-big-max {
    font-size: 42px;
    font-weight: 900;
    color: white;
    line-height: 1;
    text-shadow: 0 3px 12px rgba(0, 0, 0, 0.5);
  }

  .percentage-label-max {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.8);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  }

  .creator-avatar-max {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.9);
    object-fit: cover;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  /* Responsive */
  @media (max-width: 480px) {
    .decorative-quote-max {
      font-size: 100px;
    }

    .quote-open-max {
      top: 50px;
      left: 16px;
    }

    .quote-close-max {
      bottom: 90px;
      right: 16px;
    }

    .video-area-max {
      flex: 0 0 50%;
      margin: 6px;
    }

    .video-content-max {
      padding: 16px 20px 90px;
    }

    .media-area-max {
      margin: 6px 6px 0;
    }

    .media-footer-max {
      padding: 12px 20px 90px;
    }

    .maximized-footer {
      bottom: 60px;
      padding: 0 20px;
    }

    .percentage-big-max {
      font-size: 32px;
    }

    .creator-avatar-max {
      width: 42px;
      height: 42px;
    }
  }
</style>
