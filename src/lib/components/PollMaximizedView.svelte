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
    ArrowLeft,
    UserPlus,
    Diamond,
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
    Circle,
    CircleCheck,
    Volume2,
    VolumeX,
    BadgeCheck,
    Plus,
    ThumbsUp,
    ThumbsDown,
    Ban,
  } from "lucide-svelte";
  import { fade, fly, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import MediaEmbed from "./MediaEmbed.svelte";
  import AuthModal from "../AuthModal.svelte";
  import FriendsVotesModal from "./FriendsVotesModal.svelte";
  import CommentsModal from "./CommentsModal.svelte";
  import Portal from "./Portal.svelte";
  import StatsBottomModal from "./StatsBottomModal.svelte";
  import { apiPost, apiDelete } from '$lib/api/client';
  import { openFullscreenIframe as openFullscreenIframeStore, preloadIframe, clearPreloadIframe } from '$lib/stores/globalState';

  // --- INTERFACES ---
  interface PollOption {
    id: string;
    label: string;
    color: string;
    imageUrl?: string;
    pct?: number;
    votes?: number;
    voted?: boolean;
    // Campos alternativos de la API (para compatibilidad con diferentes formatos)
    key?: string;
    optionKey?: string;
    optionLabel?: string;
    voteCount?: number;
    // Campos adicionales para el nuevo diseño (opcionales para compatibilidad)
    type?: "youtube" | "vimeo" | "image" | "text" | "spotify" | "soundcloud";
    artist?: string;
    description?: string;
    youtubeId?: string;
    vimeoId?: string;
    // Campo para indicar si esta opción es la correcta
    isCorrect?: boolean;
  }

  interface PollCreator {
    id?: number;
    username: string;
    avatar?: string;
    verified?: boolean;
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
    onRemoveAllVotes?: () => void;
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
    onAddOption?: (label: string, color: string) => void;
  }

  let {
    options,
    activeOptionId = $bindable(),
    pollId,
    pollTitle,
    pollType = "simple",
    pollCreatedAt,
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
    onRemoveAllVotes = () => {},
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
    onAddOption = (label: string, color: string) => {},
  }: Props = $props();

  let totalVotes = $derived(options.reduce((a, b) => a + (b.votes || 0), 0));
  let maxVotes = $derived(Math.max(...options.map((o) => o.votes || 0), 1)); // Evitar div por 0
  let activeIndex = $derived(options.findIndex((o) => o.id === activeOptionId));
  
  // Estado para añadir nueva opción colaborativa
  let isAddingOption = $state(false);
  let newOptionLabel = $state('');
  let newOptionColor = $state('#8b5cf6');
  let newOptionInputRef: HTMLTextAreaElement | null = null;
  let showNewOptionColorPicker = $state(false);
  
  // Estado del color picker circular
  let selectedHue = $state(270); // Púrpura por defecto
  let selectedSaturation = $state(85);
  let isDraggingColor = $state(false);
  let selectedColor = $derived(`hsl(${selectedHue}, ${selectedSaturation}%, 55%)`);
  
  // Convertir HSL a hex
  function hslToHex(h: number, s: number, l: number): string {
    s = s / 100;
    l = l / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c/2;
    let r = 0, g = 0, b = 0;
    if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
    else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
    else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
    else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
    else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  
  // Confirmar color seleccionado
  function confirmColorSelection() {
    newOptionColor = hslToHex(selectedHue, selectedSaturation, 55);
    showNewOptionColorPicker = false;
  }
  
  // Colores disponibles para nueva opción
  const optionColors = [
    '#ef4444', '#f97316', '#f59e0b', '#10b981', 
    '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'
  ];
  
  // Función para iniciar añadir opción
  function startAddingOption() {
    if (!isAuthenticated) {
      onOpenAuthModal();
      return;
    }
    isAddingOption = true;
    newOptionLabel = '';
    newOptionColor = optionColors[Math.floor(Math.random() * optionColors.length)];
    // Scroll al final para mostrar el nuevo slide
    setTimeout(() => {
      if (scrollContainer) {
        scrollContainer.scrollTo({ left: scrollContainer.scrollWidth, behavior: 'smooth' });
      }
      if (newOptionInputRef) {
        newOptionInputRef.focus();
      }
    }, 100);
  }
  
  // Función para cancelar añadir opción
  function cancelAddingOption() {
    isAddingOption = false;
    newOptionLabel = '';
  }
  
  // Función para publicar la nueva opción
  async function publishNewOption() {
    if (!newOptionLabel.trim()) return;
    
    // Llamar al callback con los datos de la nueva opción
    onAddOption(newOptionLabel.trim(), newOptionColor);
    
    // Resetear estado
    isAddingOption = false;
    newOptionLabel = '';
  }
  
  // Color neutro para opciones antes de votar
  const NEUTRAL_COLOR = '#3a3d42';
  
  // Calcular el color del voto directamente (sin $effect para evitar flash)
  const getVoteColor = () => {
    if (hasVoted) {
      const votedOption = options.find((o) => o.voted === true);
      return votedOption?.color || '#ffffff';
    }
    return '#ffffff';
  };
  
  // Usar $derived para que se recalcule reactivamente
  let voteColor = $derived(getVoteColor());
  
  // Verificar si la opción actualmente visible está votada
  let currentOptionVoted = $derived(activeIndex >= 0 && options[activeIndex]?.voted === true);
  let currentOptionColor = $derived(activeIndex >= 0 ? (options[activeIndex]?.color || voteColor) : voteColor);
  
  // Contar opciones votadas (para múltiple)
  let votedOptionsCount = $derived(options.filter(o => o.voted === true).length);

  let scrollContainer: HTMLElement | null = null;
  let showLikeAnim = $state(false);
  let lastTapTime = 0;
  let transitionY = $state(100);
  let showAuthModal = $state(false);
  let showFriendsVotesModal = $state(false);
  let showCommentsModal = $state(false);
  let showStatsModal = $state(false);
  
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
    console.log('[PollMaximizedView] options:', options.map(o => ({ id: o.id, key: o.key, optionKey: o.optionKey })));
    console.log('[PollMaximizedView] friendsByOption keys:', Object.keys(friendsByOption || {}));
  });

  // Helper para obtener amigos de una opción (busca por múltiples claves)
  function getFriendsForOption(opt: PollOption): Friend[] {
    if (!friendsByOption) return [];
    
    // Intentar diferentes claves posibles basadas en los campos de la opción
    const idStr = opt.id != null ? String(opt.id) : null;
    const possibleKeys = [
      idStr,
      opt.key,
      opt.optionKey,
      idStr ? `opt_${idStr}` : null,
      idStr?.replace('opt_', ''),
      opt.key ? String(opt.key) : null,
    ].filter(Boolean) as string[];
    
    for (const key of possibleKeys) {
      if (friendsByOption[key] && friendsByOption[key].length > 0) {
        console.log(`[getFriendsForOption] Found friends for option using key ${key}:`, friendsByOption[key]);
        return friendsByOption[key];
      }
    }
    
    return [];
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
      const opt = options[activeIndex];
      // Permitir votar si: no has votado, o es múltiple, o la opción actual no está votada
      const canVote = !hasVoted || pollType === 'multiple' || !currentOptionVoted;
      if (canVote && readOnly) {
        // Check authentication before voting
        if (!isAuthenticated) {
          onOpenAuthModal();
          lastTapTime = 0;
          return;
        }

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
      const opt = options[activeIndex];
      // Permitir votar si: no has votado, o es múltiple, o la opción actual no está votada
      const canVote = !hasVoted || pollType === 'multiple' || !currentOptionVoted;
      if (canVote && readOnly) {
        // Check authentication before voting
        if (!isAuthenticated) {
          onOpenAuthModal();
          lastTapTime = 0;
          return;
        }

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

      // Permitir votar si: no has votado, o es múltiple, o la opción actual no está votada
      const canVote = !hasVoted || pollType === 'multiple' || !currentOptionVoted;
      if (canVote && readOnly) {
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
  
  // Detectar si debemos mostrar el enlace (cualquier URL válida excepto imágenes directas y GIFs)
  function shouldShowLink(url: string | undefined): boolean {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    // Si es una imagen directa, no mostramos enlace
    if (/\.(jpg|jpeg|png|webp|gif|svg|bmp)([?#]|$)/i.test(lowerUrl)) return false;
    // Si es un GIF de GIPHY/Tenor, no mostramos enlace (ya tiene badge GIPHY)
    if (lowerUrl.includes('giphy.com') || lowerUrl.includes('tenor.com')) return false;
    // Para todo lo demás (YouTube, Twitter, enlaces genéricos, etc.) mostramos enlace
    return true;
  }
  
  // Obtener hostname de una URL
  function getHostname(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  }
  
  // Obtener el texto de la etiqueta sin la URL
  function getLabelWithoutUrl(text: string): string {
    return text.replace(/(https?:\/\/[^\s]+)/gi, '').trim();
  }

  function getYoutubeId(url?: string): string {
    if (!url) return "";
    // Incluye soporte para YouTube Shorts
    const patterns = [
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?\/]*).*/,
      /youtube\.com\/shorts\/([^#&?\/]+)/
    ];
    for (const regExp of patterns) {
      const match = url.match(regExp);
      if (match) {
        const id = match[2] || match[1];
        if (id && id.length === 11) return id;
      }
    }
    return "";
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
  
  // Cache de previews obtenidos de la API
  let previewCache = $state<Record<string, { image: string; title?: string; loading: boolean }>>({});
  
  // --- IFRAME FULLSCREEN (usa store global) ---
  function handleOpenFullscreenIframe(opt: PollOption) {
    console.log('[PollMaximizedView] Opening fullscreen iframe', opt);
    if (!opt?.imageUrl) return;
    const thumbnail = previewCache[opt.id]?.image || getPreviewThumbnail(opt);
    openFullscreenIframeStore(opt.imageUrl, opt.id, thumbnail);
  }
  
  // --- DETECCIÓN DE SWIPE VERTICAL EN PREVIEW ---
  let previewTouchStartY = 0;
  let previewTouchStartX = 0;
  
  function handlePreviewTouchStart(e: TouchEvent) {
    previewTouchStartY = e.touches[0].clientY;
    previewTouchStartX = e.touches[0].clientX;
  }
  
  function handlePreviewTouchEnd(e: TouchEvent) {
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    
    const diffY = previewTouchStartY - touchEndY;
    const diffX = previewTouchStartX - touchEndX;
    
    // Si el movimiento vertical es mayor que el horizontal y supera un umbral
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 30) {
      e.stopPropagation();
      if (diffY > 0) {
        // Swipe hacia arriba -> siguiente poll
        transitionY = window.innerHeight;
        onSwipeVertical("down");
        setTimeout(() => (transitionY = 100), 500);
      } else {
        // Swipe hacia abajo -> poll anterior
        transitionY = -window.innerHeight;
        onSwipeVertical("up");
        setTimeout(() => (transitionY = 100), 500);
      }
    }
  }
  
  // Verificar si una opción tiene contenido embebible (YouTube, Spotify, etc.)
  function hasEmbeddableContent(opt: PollOption): boolean {
    if (!opt?.imageUrl) return false;
    const url = opt.imageUrl.toLowerCase();
    return (
      url.includes('youtube.com') ||
      url.includes('youtu.be') ||
      url.includes('vimeo.com') ||
      url.includes('spotify.com') ||
      url.includes('soundcloud.com') ||
      url.includes('tiktok.com') ||
      url.includes('twitch.tv') ||
      url.includes('dailymotion.com') ||
      url.includes('dai.ly') ||
      url.includes('music.apple.com') ||
      url.includes('deezer.com') ||
      url.includes('bandcamp.com')
    );
  }
  
  // Obtener thumbnail de preview - primero intenta YouTube directo, luego usa cache/API
  function getPreviewThumbnail(opt: PollOption): string {
    if (!opt?.imageUrl) return '';
    const url = opt.imageUrl;
    
    // YouTube thumbnail - directo sin API
    const ytId = getYoutubeId(url);
    if (ytId) {
      return `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    }
    
    // Vimeo thumbnail - extraer ID y usar thumbs.vimeo.com
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      return `https://vumbnail.com/${vimeoMatch[1]}.jpg`;
    }
    
    // Para otras plataformas, usar el cache si existe y tiene imagen real
    if (previewCache[opt.id]?.image && !previewCache[opt.id].image.includes('placehold.co')) {
      return previewCache[opt.id].image;
    }
    
    // Placeholder mientras carga
    return getPlaceholderForPlatform(url);
  }
  
  // Placeholder según plataforma con logos/iconos reales
  function getPlaceholderForPlatform(url: string): string {
    const lowerUrl = url.toLowerCase();
    // Spotify - verde con texto
    if (lowerUrl.includes('spotify.com')) return 'https://placehold.co/640x360/1DB954/white?text=%E2%99%AB+Spotify';
    // SoundCloud - naranja con onda
    if (lowerUrl.includes('soundcloud.com')) return 'https://placehold.co/640x360/ff5500/white?text=%E2%99%AB+SoundCloud';
    // Vimeo - azul oscuro
    if (lowerUrl.includes('vimeo.com')) return 'https://placehold.co/640x360/1ab7ea/white?text=%E2%96%B6+Vimeo';
    // TikTok - negro
    if (lowerUrl.includes('tiktok.com')) return 'https://placehold.co/640x360/010101/white?text=%E2%96%B6+TikTok';
    // Twitch - morado
    if (lowerUrl.includes('twitch.tv')) return 'https://placehold.co/640x360/9146FF/white?text=%E2%96%B6+Twitch';
    // Dailymotion - azul
    if (lowerUrl.includes('dailymotion.com') || lowerUrl.includes('dai.ly')) return 'https://placehold.co/640x360/0066DC/white?text=%E2%96%B6+Dailymotion';
    // Apple Music - rojo
    if (lowerUrl.includes('music.apple.com')) return 'https://placehold.co/640x360/FC3C44/white?text=%E2%99%AB+Apple+Music';
    // Deezer - naranja dorado
    if (lowerUrl.includes('deezer.com')) return 'https://placehold.co/640x360/FEAA2D/000000?text=%E2%99%AB+Deezer';
    // Bandcamp - azul verdoso
    if (lowerUrl.includes('bandcamp.com')) return 'https://placehold.co/640x360/1DA0C3/white?text=%E2%99%AB+Bandcamp';
    // Mixcloud
    if (lowerUrl.includes('mixcloud.com')) return 'https://placehold.co/640x360/5000ff/white?text=%E2%99%AB+Mixcloud';
    // Default
    return 'https://placehold.co/640x360/1a1a2e/white?text=%E2%96%B6+Reproducir';
  }
  
  // Obtener thumbnail directo sin API para ciertas plataformas
  function getDirectThumbnail(url: string): string | null {
    const lowerUrl = url.toLowerCase();
    
    // YouTube
    const ytId = getYoutubeId(url);
    if (ytId) return `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    
    // Vimeo - usar servicio vumbnail
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) return `https://vumbnail.com/${vimeoMatch[1]}.jpg`;
    
    // Dailymotion
    const dmMatch = url.match(/dailymotion\.com\/video\/([a-z0-9]+)/i) || url.match(/dai\.ly\/([a-z0-9]+)/i);
    if (dmMatch) return `https://www.dailymotion.com/thumbnail/video/${dmMatch[1]}`;
    
    return null;
  }
  
  // Cargar preview desde la API de link-preview
  async function fetchPreviewForOption(opt: PollOption) {
    if (!opt?.imageUrl || !opt?.id) return;
    
    // Si ya está en cache con imagen real, no hacer nada
    if (previewCache[opt.id]?.image && !previewCache[opt.id].loading && !previewCache[opt.id].image.includes('placehold.co')) {
      return;
    }
    
    // Si está cargando, no hacer nada
    if (previewCache[opt.id]?.loading) return;
    
    // Primero intentar thumbnail directo (YouTube, Vimeo, Dailymotion)
    const directThumb = getDirectThumbnail(opt.imageUrl);
    if (directThumb) {
      previewCache = { 
        ...previewCache, 
        [opt.id]: { image: directThumb, loading: false } 
      };
      return;
    }
    
    // Marcar como cargando
    previewCache = { ...previewCache, [opt.id]: { image: '', loading: true } };
    
    try {
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(opt.imageUrl)}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result;
        
        if (data) {
          // Obtener la imagen del preview - priorizar imageProxied, luego image
          let image = data.imageProxied || data.image;
          
          // Si no hay imagen, usar placeholder de la plataforma
          if (!image || image.includes('undefined') || image === 'null') {
            image = getPlaceholderForPlatform(opt.imageUrl);
          }
          
          previewCache = { 
            ...previewCache, 
            [opt.id]: { 
              image, 
              title: data.title,
              loading: false 
            } 
          };
        } else {
          // Sin datos, usar placeholder
          previewCache = { 
            ...previewCache, 
            [opt.id]: { 
              image: getPlaceholderForPlatform(opt.imageUrl), 
              loading: false 
            } 
          };
        }
      } else {
        // Error de respuesta, usar placeholder
        previewCache = { 
          ...previewCache, 
          [opt.id]: { 
            image: getPlaceholderForPlatform(opt.imageUrl), 
            loading: false 
          } 
        };
      }
    } catch (error) {
      console.warn('[PollMaximizedView] Error fetching preview:', error);
      // Usar placeholder en caso de error
      previewCache = { 
        ...previewCache, 
        [opt.id]: { 
          image: getPlaceholderForPlatform(opt.imageUrl), 
          loading: false 
        } 
      };
    }
  }
  
  // Cargar previews para TODAS las opciones con contenido embebible al iniciar
  $effect(() => {
    // Cargar previews de todas las opciones que tengan contenido embebible
    for (const opt of options) {
      if (hasEmbeddableContent(opt)) {
        fetchPreviewForOption(opt);
      }
    }
  });
  
  // Obtener icono de play según la plataforma
  function getPlatformIcon(opt: PollOption): string {
    if (!opt?.imageUrl) return '▶';
    const url = opt.imageUrl.toLowerCase();
    
    if (url.includes('youtube.com') || url.includes('youtu.be')) return '▶';
    if (url.includes('spotify.com')) return '♫';
    if (url.includes('soundcloud.com')) return '♫';
    if (url.includes('music.apple.com')) return '♫';
    if (url.includes('deezer.com')) return '♫';
    if (url.includes('bandcamp.com')) return '♫';
    return '▶';
  }
  
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

  // Formatear tiempo relativo (Hace 2h, Hace 3d, etc.)
  function formatRelativeTime(date: string | Date | undefined): string {
    if (!date) return "Reciente";
    
    try {
      const now = new Date();
      const past = new Date(date);
      
      // Verificar si la fecha es válida
      if (isNaN(past.getTime())) return "Reciente";
      
      const diffMs = now.getTime() - past.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);
      const diffWeek = Math.floor(diffDay / 7);
      const diffMonth = Math.floor(diffDay / 30);

      if (diffSec < 60) return "Ahora";
      if (diffMin < 60) return `Hace ${diffMin}m`;
      if (diffHour < 24) return `Hace ${diffHour}h`;
      if (diffDay < 7) return `Hace ${diffDay}d`;
      if (diffWeek < 4) return `Hace ${diffWeek}sem`;
      return `Hace ${diffMonth}mes`;
    } catch {
      return "Reciente";
    }
  }

  // Obtener texto del tipo de voto
  function getPollTypeText(type: string): string {
    switch (type) {
      case "multiple": return "Voto Múltiple";
      case "collaborative": return "Colaborativo";
      default: return "Voto Único";
    }
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
  
  // Precargar iframe cuando el usuario esté viendo una opción con contenido embebible
  $effect(() => {
    if (activeIndex >= 0 && options[activeIndex]) {
      const opt = options[activeIndex];
      if (hasEmbeddableContent(opt) && opt.imageUrl) {
        // Precargar el iframe en segundo plano después de un pequeño delay
        const timeout = setTimeout(() => {
          preloadIframe(opt.imageUrl!);
        }, 500); // 500ms de delay para no precargar si el usuario está pasando rápido
        
        return () => {
          clearTimeout(timeout);
          clearPreloadIframe();
        };
      } else {
        clearPreloadIframe();
      }
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

        <!-- QuestionHeader - Nuevo diseño tipo Twitter -->
        <div class="question-header-new z-40 relative pointer-events-none">
          <!-- Fila superior: Back + Avatar + Username + Metadata + Menu -->
          <div class="header-top-row">
            <!-- Botón atrás -->
            <button 
              onclick={onClose} 
              class="header-back-btn pointer-events-auto"
              aria-label="Volver"
            >
              <ArrowLeft size={20} class="text-white" />
            </button>
            
            <!-- Avatar clickeable -->
            <button
              class="header-avatar pointer-events-auto"
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
            
            <!-- Info del usuario y metadatos -->
            <div class="header-user-info">
              <div class="header-username-row">
                <span class="header-username">@{creator?.username || 'usuario'}</span>
                <!-- Botón seguir usuario -->
                <button
                  class="header-follow-btn pointer-events-auto"
                  onclick={(e) => { e.stopPropagation(); /* TODO: Follow logic */ }}
                  type="button"
                  aria-label="Seguir a {creator?.username || 'usuario'}"
                >
                  <span class="follow-text">Seguir</span>
                </button>
              </div>
              <div class="header-metadata">
                <span>{formatRelativeTime(pollCreatedAt)}</span>
                <span class="header-metadata-dot">·</span>
                <span class="header-vote-type">
                  <Diamond size={10} class="header-diamond-icon" />
                  {getPollTypeText(pollType)}
                </span>
              </div>
            </div>
            
            <!-- Botón menú (3 puntos) -->
            <button 
              onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = !isMoreMenuOpen; }}
              class="header-menu-btn pointer-events-auto"
              aria-label="Más opciones"
            >
              <MoreVertical size={18} class="text-white" />
            </button>
          </div>
          
          <!-- Fila inferior: Pregunta -->
          <div class="header-question-row">
            {#if readOnly}
              <button
                class="header-question-text pointer-events-auto"
                style={!isTitleExpanded ? "display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; word-break: break-word;" : "word-break: break-word;"}
                onclick={() => isTitleExpanded = !isTitleExpanded}
                type="button"
                aria-label={isTitleExpanded ? "Contraer título" : "Expandir título"}
              >
                {pollTitle}
              </button>
            {:else}
              <textarea
                class="header-question-edit pointer-events-auto"
                placeholder="Escribe tu pregunta..."
                value={pollTitle}
                oninput={(e) => onTitleChange(e.currentTarget.value)}
                rows="2"
                maxlength="200"
              ></textarea>
            {/if}
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
        role="listbox"
        aria-label="Opciones de encuesta"
        aria-activedescendant={options[activeIndex]?.id ? `option-${options[activeIndex].id}` : undefined}
      >
        {#each options as opt, i (opt.id)}
          {@const type = getMediaType(opt)}
          {@const isVideoType = type !== 'image' && type !== 'text'}
          {@const isMusicType = ['spotify', 'soundcloud', 'applemusic', 'deezer', 'bandcamp'].includes(type)}
          {@const isGifType = opt.imageUrl && (opt.imageUrl.includes('giphy.com') || opt.imageUrl.includes('tenor.com') || /\.gif([?#]|$)/i.test(opt.imageUrl))}
          {@const isImageType = type === 'image' && !isGifType}
          {@const labelText = getLabelWithoutUrl(opt.label)}
          <div
            id="option-{opt.id}"
            class="w-full h-full flex-shrink-0 snap-center relative"
            style="scroll-snap-stop: always;"
            role="option"
            aria-selected={i === activeIndex}
          >
            <!-- SlideContent -->
            <div class="w-full h-full relative overflow-hidden">
              
              <!-- CARD CONTAINER - Igual para todos los tipos -->
              <div class="option-card-container">
                <div class="option-card-rounded" style="--option-color: {hasVoted ? opt.color : '#555'};">
                  
                                    
                  {#if type === "text"}
                    <!-- === LAYOUT SOLO TEXTO === -->
                    <!-- Área principal con color de fondo y comillas -->
                    <div class="card-content-area" style="background-color: {hasVoted ? opt.color : NEUTRAL_COLOR};">
                      <!-- Comillas decorativas -->
                      <span class="quote-decoration quote-open">"</span>
                      <span class="quote-decoration quote-close">"</span>
                      
                      <!-- Texto centrado -->
                      <div class="text-center-wrapper">
                        <h1 class="{opt.label.length > 60 ? 'text-3xl' : opt.label.length > 40 ? 'text-4xl' : 'text-5xl'} font-bold text-white tracking-tighter leading-tight break-words text-center">
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
                            {#if getFriendsForOption(opt).length > 0}
                              <button 
                                class="friends-avatars-stack"
                                onclick={(e) => { e.stopPropagation(); if (hasVoted) showFriendsVotesModal = true; }}
                                disabled={!hasVoted}
                                type="button"
                                aria-label={hasVoted ? 'Ver votos de amigos' : 'Vota para ver quién eligió esta opción'}
                              >
                                {#each getFriendsForOption(opt).slice(0, 3) as friend, idx}
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
                                {#if getFriendsForOption(opt).length > 3}
                                  <span class="friends-more-count">+{getFriendsForOption(opt).length - 3}</span>
                                {/if}
                              </button>
                            {/if}
                          </div>
                        </div>
                    </div>
                    
                    <!-- === INDICADOR DE RESPUESTA CORRECTA === -->
                    {#if hasVoted && opt.isCorrect}
                      <div class="correct-indicator-overlay">
                        <div class="correct-indicator-badge {opt.voted ? 'correct' : 'incorrect'}">
                          {#if opt.voted}
                            <Check size={14} />
                            <span>¡Acertaste!</span>
                          {:else}
                            <CircleCheck size={14} />
                            <span>Esta era la correcta</span>
                          {/if}
                        </div>
                      </div>
                    {/if}
                    
                  {:else if isVideoType}
                    <!-- === LAYOUT VIDEO CON PREVIEW FLOTANTE === -->
                    <!-- Card con color de fondo de la opción -->
                    <div class="card-video-wrapper {isMusicType ? 'is-music' : ''}" style="background-color: {hasVoted ? opt.color : NEUTRAL_COLOR};">
                      <!-- Contenedor flotante del preview que sobresale -->
                      <div 
                        class="floating-preview-frame"
                        ontouchstart={handlePreviewTouchStart}
                        ontouchend={handlePreviewTouchEnd}
                        role="region"
                        aria-label="Preview de contenido"
                      >
                        <div class="floating-preview-inner">
                          {#if i === activeIndex}
                            {#if hasEmbeddableContent(opt)}
                              <!-- PREVIEW: Thumbnail con badge flotante (click abre fullscreen) -->
                              {@const thumbUrl = previewCache[opt.id]?.image || getPreviewThumbnail(opt)}
                              {@const platformType = getMediaType(opt)}
                              {@const platformColors: Record<string, string> = {
                                youtube: '#FF0000', vimeo: '#1ab7ea', spotify: '#1DB954', soundcloud: '#ff5500',
                                tiktok: '#000000', twitch: '#9146FF', twitter: '#000000', applemusic: '#FC3C44',
                                deezer: '#FEAA2D', dailymotion: '#0066DC', bandcamp: '#1DA0C3', video: '#666666',
                                image: '#666666'
                              }}
                              <button 
                                class="embed-preview-container thumbnail-fullscreen-btn"
                                onclick={(e) => { e.stopPropagation(); handleOpenFullscreenIframe(opt); }}
                                type="button"
                                aria-label="Reproducir contenido a pantalla completa"
                                style="background-image: url('{thumbUrl}');"
                              >
                                <!-- Badge de plataforma -->
                                <div class="platform-badge-max" style="--platform-color: {platformColors[platformType] || '#666'}">
                                {#if platformType === 'youtube'}
                                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                                {:else if platformType === 'vimeo'}
                                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z"/></svg>
                                {:else if platformType === 'spotify'}
                                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                                {:else if platformType === 'soundcloud'}
                                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.56 8.87V17h8.76c1.85-.13 2.68-1.27 2.68-2.67 0-1.48-1.12-2.67-2.53-2.67-.33 0-.65.08-.96.2-.11-2.02-1.69-3.63-3.66-3.63-1.24 0-2.34.64-2.99 1.64H11.56zm-1 0H9.4v8.13h1.16V8.87zm-2.16.52H7.24v7.61H8.4V9.39zm-2.16.91H5.08v6.7h1.16v-6.7zm-2.16.78H2.92v5.92h1.16v-5.92zm-2.16 1.3H.76v4.62h1.16v-4.62z"/></svg>
                                {:else if platformType === 'tiktok'}
                                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                                {:else if platformType === 'twitch'}
                                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                                {:else if platformType === 'twitter'}
                                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                                {:else if platformType === 'applemusic'}
                                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.8.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 0 0 1.57-.1c.822-.106 1.596-.35 2.296-.81a5.046 5.046 0 0 0 1.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.455-2.105-1.245-.227-.56-.2-1.13.063-1.676.328-.68.88-1.106 1.596-1.29.39-.1.79-.148 1.19-.202.246-.033.494-.06.736-.108.27-.053.415-.2.46-.47a1.327 1.327 0 0 0 .015-.18V8.24a.677.677 0 0 0-.013-.12c-.05-.3-.2-.453-.505-.46-.304-.01-.61.013-.914.055-.505.07-1.01.15-1.514.227-.634.097-1.268.197-1.902.297-.346.054-.552.27-.59.615a2.24 2.24 0 0 0-.014.18v7.63c0 .426-.063.847-.25 1.236-.29.6-.77.97-1.406 1.148-.33.09-.665.134-1.01.152-.978.044-1.81-.424-2.14-1.236-.23-.566-.2-1.14.064-1.69.328-.684.89-1.106 1.6-1.287.38-.096.77-.147 1.156-.197.256-.035.51-.065.764-.11.26-.045.416-.196.458-.456.013-.083.014-.166.014-.25V6.8c0-.29.127-.49.387-.584.055-.02.113-.032.17-.045.348-.066.696-.133 1.044-.198.692-.13 1.386-.257 2.078-.385l2.052-.385 1.19-.22c.072-.014.144-.023.213-.052z"/></svg>
                                {:else if platformType === 'deezer'}
                                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.81 4.16v3.03H24V4.16h-5.19zM6.27 8.38v3.027h5.189V8.38h-5.19zm12.54 0v3.027H24V8.38h-5.19zM6.27 12.594v3.027h5.189v-3.027h-5.19zm6.271 0v3.027h5.19v-3.027h-5.19zm6.27 0v3.027H24v-3.027h-5.19zM0 16.81v3.029h5.19v-3.03H0zm6.27 0v3.029h5.19v-3.03h-5.19zm6.271 0v3.029h5.19v-3.03h-5.19zm6.27 0v3.029H24v-3.03h-5.19z"/></svg>
                                {:else if platformType === 'dailymotion'}
                                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.006 13.24c-1.47 0-2.66-1.2-2.66-2.67s1.2-2.67 2.66-2.67 2.67 1.19 2.67 2.67c0 1.47-1.2 2.67-2.67 2.67zM18 2H6C3.79 2 2 3.79 2 6v12c0 2.21 1.79 4 4 4h12c2.21 0 4-1.79 4-4V6c0-2.21-1.79-4-4-4zm-5.99 14.91c-3.32 0-6.01-2.69-6.01-6.01 0-3.32 2.69-6.01 6.01-6.01 3.32 0 6.01 2.69 6.01 6.01 0 3.32-2.69 6.01-6.01 6.01z"/></svg>
                                {:else if platformType === 'bandcamp'}
                                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M0 18.75l7.437-13.5H24l-7.438 13.5H0z"/></svg>
                                {:else}
                                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                {/if}
                              </div>
                            </button>
                            {/if}
                          {:else}
                            <div class="w-full h-full flex items-center justify-center bg-black/50 rounded-2xl">
                              <span class="text-white/50"></span>
                            </div>
                          {/if}
                        </div>
                      </div>
                      
                      <!-- Contenido debajo del video -->
                      <div class="card-video-bottom">
                        <!-- Label (sin URL) -->
                        <h2 class="{labelText.length > 40 ? 'text-xl' : labelText.length > 25 ? 'text-2xl' : 'text-3xl'} font-bold text-white tracking-tighter leading-tight card-bottom-label">
                          {labelText}
                        </h2>
                        
                        <!-- Enlace debajo del texto para URLs con embed -->
                        {#if shouldShowLink(opt.imageUrl)}
                          <a 
                            href={opt.imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="link-below-text-max"
                            onclick={(e) => e.stopPropagation()}
                          >
                            <img 
                              src="https://www.google.com/s2/favicons?domain={getHostname(opt.imageUrl || '')}&sz=16" 
                              alt="" 
                              class="link-below-favicon-max"
                            />
                            <span class="link-below-domain-max">{getHostname(opt.imageUrl || '')}</span>
                            <span class="link-below-arrow-max">↗</span>
                          </a>
                        {/if}
                        
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
                              {#if getFriendsForOption(opt).length > 0}
                                <button 
                                  class="friends-avatars-stack"
                                  onclick={(e) => { e.stopPropagation(); if (hasVoted) showFriendsVotesModal = true; }}
                                  disabled={!hasVoted}
                                  type="button"
                                  aria-label={hasVoted ? 'Ver votos de amigos' : 'Vota para ver quién eligió esta opción'}
                                >
                                  {#each getFriendsForOption(opt).slice(0, 3) as friend, idx}
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
                                  {#if getFriendsForOption(opt).length > 3}
                                    <span class="friends-more-count">+{getFriendsForOption(opt).length - 3}</span>
                                  {/if}
                                </button>
                              {/if}
                            </div>
                          </div>
                      </div>
                    </div>
                    
                    <!-- === INDICADOR CORRECTA VIDEO === -->
                    {#if hasVoted && opt.isCorrect}
                      <div class="correct-indicator-overlay">
                        <div class="correct-indicator-badge {opt.voted ? 'correct' : 'incorrect'}">
                          {#if opt.voted}
                            <Check size={14} />
                            <span>¡Acertaste!</span>
                          {:else}
                            <CircleCheck size={14} />
                            <span>Esta era la correcta</span>
                          {/if}
                        </div>
                      </div>
                    {/if}
                    
                  {:else}
                    <!-- === LAYOUT GIF/IMAGEN === -->
                    <!-- Wrapper con borde del color de la opción -->
                    <div class="card-media-border" style="--border-color: {hasVoted ? opt.color : NEUTRAL_COLOR};">
                      <!-- Imagen a pantalla completa con contenido overlay -->
                      <div class="card-media-fullscreen">
                        <!-- Imagen de fondo -->
                        <div class="card-image-fullscreen">
                        {#if i === activeIndex}
                          {#key `media-${opt.id}-${activeIndex}`}
                            <MediaEmbed
                              url={opt.imageUrl || ""}
                              mode="full"
                              width="100%"
                              height="100%"
                              autoplay={isVideoContent(opt)}
                            />
                          {/key}
                        {:else}
                          <div class="w-full h-full flex items-center justify-center bg-black">
                            <span class="text-white/50"></span>
                          </div>
                        {/if}
                        
                      </div>
                      
                      <!-- Badge GIPHY -->
                      {#if isGifType}
                        <img src="/logoGIPHY.png" alt="GIPHY" class="giphy-badge-corner" />
                      {/if}
                      
                      <!-- Degradado inferior -->
                      <div class="card-bottom-gradient"></div>
                      
                      <!-- Contenido inferior: label + línea + porcentaje + avatar -->
                      <div class="card-bottom-content">
                        <!-- Label (sin URL) -->
                        <h2 class="{labelText.length > 40 ? 'text-xl' : labelText.length > 25 ? 'text-2xl' : 'text-3xl'} font-bold text-white tracking-tighter leading-tight card-bottom-label">
                          {labelText}
                        </h2>
                        
                        <!-- Enlace debajo del texto para URLs con embed -->
                        {#if shouldShowLink(opt.imageUrl)}
                          <a 
                            href={opt.imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="link-below-text-max"
                            onclick={(e) => e.stopPropagation()}
                          >
                            <img 
                              src="https://www.google.com/s2/favicons?domain={getHostname(opt.imageUrl || '')}&sz=16" 
                              alt="" 
                              class="link-below-favicon-max"
                            />
                            <span class="link-below-domain-max">{getHostname(opt.imageUrl || '')}</span>
                            <span class="link-below-arrow-max">↗</span>
                          </a>
                        {/if}
                        
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
                            {#if getFriendsForOption(opt).length > 0}
                              <button 
                                class="friends-avatars-stack"
                                onclick={(e) => { e.stopPropagation(); if (hasVoted) showFriendsVotesModal = true; }}
                                disabled={!hasVoted}
                                type="button"
                                aria-label={hasVoted ? 'Ver votos de amigos' : 'Vota para ver quién eligió esta opción'}
                              >
                                {#each getFriendsForOption(opt).slice(0, 3) as friend, idx}
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
                                {#if getFriendsForOption(opt).length > 3}
                                  <span class="friends-more-count">+{getFriendsForOption(opt).length - 3}</span>
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

        <!-- Slide para añadir nueva opción (colaborativas) -->
        {#if isAddingOption && pollType === 'collaborative'}
          <div
            class="w-full h-full flex-shrink-0 snap-center relative"
            style="scroll-snap-stop: always;"
          >
            <div class="w-full h-full relative overflow-hidden">
              <div class="option-card-container">
                <div class="option-card-rounded" style="--option-color: {newOptionColor};">
                  <div class="card-content-area new-option-card" style="background-color: {newOptionColor};">
                    <!-- Comillas decorativas -->
                    <span class="quote-decoration quote-open">"</span>
                    <span class="quote-decoration quote-close">"</span>
                    
                    <!-- Textarea para el texto -->
                    <div class="new-option-input-wrapper">
                      <textarea
                        bind:this={newOptionInputRef}
                        bind:value={newOptionLabel}
                        class="new-option-textarea-max"
                        placeholder="Escribe tu opción..."
                        maxlength="100"
                        rows="2"
                      ></textarea>
                    </div>
                    
                    <!-- Barra de edición (igual que mini) -->
                    <div class="new-option-edit-bar">
                      <!-- Botón de color - abre modal -->
                      <button 
                        type="button" 
                        class="edit-btn-max color-btn-max" 
                        style="background-color: {newOptionColor};"
                        onclick={(e) => {
                          e.stopPropagation();
                          showNewOptionColorPicker = true;
                        }}
                        title="Cambiar color"
                        aria-label="Cambiar color"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="white" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                      </button>
                      
                      <!-- Botón cancelar -->
                      <button
                        type="button"
                        class="edit-btn-max cancel-btn-max"
                        onclick={cancelAddingOption}
                        title="Cancelar"
                        aria-label="Cancelar"
                      >
                        <X size={20} strokeWidth={2.5} />
                      </button>
                      
                      <!-- Botón publicar -->
                      <button
                        type="button"
                        class="edit-btn-max publish-btn-max"
                        onclick={publishNewOption}
                        disabled={!newOptionLabel.trim()}
                        title="Publicar"
                        aria-label="Publicar"
                      >
                        <Check size={20} strokeWidth={2.5} />
                      </button>
                    </div>
                    
                    <div class="card-divider-line card-divider-bottom"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}
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
              // Permitir votar si: no has votado, o es múltiple, o la opción actual no está votada
              const canVote = !hasVoted || pollType === 'multiple' || !currentOptionVoted;
              if (canVote && readOnly) {
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
              {#if pollType === 'multiple'}
                {#if hasVoted}
                  <SquareCheck size={20} style="color: {voteColor}" />
                {:else}
                  <Square size={20} class="text-white" />
                {/if}
              {:else}
                {#if hasVoted}
                  <CircleCheck size={20} style="color: {voteColor}" />
                {:else}
                  <Circle size={20} class="text-white" />
                {/if}
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
            onclick={(e) => { e.stopPropagation(); isMoreMenuOpen = false; showStatsModal = true; }}
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

    <!-- Barra de control principal - Comments/Vote/Globe/Stats fijos + scroll -->
    <div class="action-bar-container">
      <!-- Zona fija: Vote, Comments, Globe, Stats -->
      <div class="action-bar-fixed">
        <!-- Votar -->
        <div class="vote-btn-wrapper">
          {#if hasVoted}
            <button 
              class="vote-remove-badge"
              style="background-color: {voteColor}"
              onclick={(e) => {
                e.stopPropagation();
                // Quitar todos los votos
                onRemoveAllVotes();
              }}
              aria-label="Eliminar votos"
            >
              <span class="vote-remove-count">{votedOptionsCount}</span>
              <X size={12} strokeWidth={3} />
            </button>
          {/if}
          <button 
            class="action-bar-btn"
            onclick={() => {
              if (readOnly) {
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
            {#if currentOptionVoted}
              <div class="vote-icon-voted-container" class:is-multiple={pollType === 'multiple'} style="background-color: {currentOptionColor}">
                <Check size={32} strokeWidth={3.5} class="vote-check-icon" />
              </div>
            {:else}
              <div class="vote-icon-empty-container" class:is-multiple={pollType === 'multiple'}>
                {#if pollType === 'multiple'}
                  <Square size={20} strokeWidth={2.5} class="vote-icon-inner" />
                {:else}
                  <Circle size={20} strokeWidth={2.5} class="vote-icon-inner" />
                {/if}
              </div>
            {/if}
            <span class="action-bar-count" class:voted={currentOptionVoted} style={currentOptionVoted ? `color: ${currentOptionColor}` : ''}>{formatCount(stats?.totalVotes)}</span>
          </button>
        </div>

        <!-- Mensajes (a la derecha del voto) -->
        <button 
          class="action-bar-btn"
          aria-label="Comentarios"
          onclick={(e) => { e.stopPropagation(); showCommentsModal = true; }}
        >
          <MessageCircle size={26} strokeWidth={1.5} />
          <span class="action-bar-count">{stats?.commentsCount || 0}</span>
        </button>

        <!-- Mundo y Estadísticas - Solo si ha votado, fijos al lado del botón de votación -->
        {#if hasVoted}
          <button 
            class="action-bar-btn"
            onclick={onOpenInGlobe}
            aria-label="Ver en globo"
          >
            <Globe size={26} strokeWidth={1.5} />
          </button>

          <button 
            class="action-bar-btn"
            onclick={(e) => { 
              e.stopPropagation(); 
              showStatsModal = true; 
            }}
            aria-label="Ver estadísticas"
          >
            <Activity size={26} strokeWidth={1.5} />
          </button>
        {/if}

        </div>

      <!-- Zona scroll: resto de acciones -->
      <div class="action-bar-scroll hide-scrollbar">
        <div class="action-bar-content">

          <!-- Share -->
          <button 
            class="action-bar-btn"
            onclick={handleShare}
            aria-label="Compartir"
          >
            <Share2 size={26} strokeWidth={1.5} />
            <span class="action-bar-count">{formatCount(shareCount)}</span>
          </button>

          <!-- Retweet -->
          <button 
            class="action-bar-btn {hasReposted ? 'reposted' : ''}"
            onclick={handleRepost}
            aria-label={hasReposted ? 'Quitar repost' : 'Repostear'}
            disabled={isReposting}
          >
            <Repeat2 size={26} strokeWidth={1.5} class={hasReposted ? 'text-green-400' : ''} />
            <span class="action-bar-count" class:reposted={hasReposted}>{formatCount(repostCount)}</span>
          </button>

        </div>
      </div>

      <!-- Botón añadir opción (colaborativas) - fijo a la derecha -->
      {#if pollType === 'collaborative' && !isAddingOption}
        <button 
          class="add-option-btn"
          style="border-bottom-color: {newOptionColor}; --icon-color: {newOptionColor};"
          onclick={(e) => { 
            e.stopPropagation(); 
            startAddingOption();
          }}
          aria-label="Añadir opción"
          title="Añadir nueva opción"
        >
          <Plus size={22} strokeWidth={2.5} style="color: {newOptionColor};" />
        </button>
      {/if}
    </div>
  </div>

  <!-- AUTH MODAL -->
  <AuthModal bind:isOpen={showAuthModal} />

  <!-- FRIENDS VOTES MODAL -->
  <FriendsVotesModal 
    bind:isOpen={showFriendsVotesModal}
    pollTitle={pollTitle}
    options={options.map(opt => ({ id: opt.id, key: opt.key || opt.optionKey || opt.id, label: opt.label, color: opt.color, votes: opt.votes }))}
    {friendsByOption}
    onClose={() => showFriendsVotesModal = false}
  />

  <!-- COMMENTS MODAL (Portal para salir del contexto padre) -->
  <Portal>
    <CommentsModal 
      bind:isOpen={showCommentsModal}
      {pollId}
      {pollTitle}
    />
  </Portal>
  
  <!-- STATS MODAL (Portal para salir del contexto padre) -->
  <Portal>
    <StatsBottomModal 
      bind:isOpen={showStatsModal}
      {pollId}
      {pollTitle}
      options={options.map(opt => ({ 
        key: opt.key || opt.optionKey || String(opt.id),
        label: opt.label || opt.optionLabel || '', 
        color: opt.color,
        votes: opt.voteCount || opt.votes || 0
      }))}
      onClose={() => showStatsModal = false}
    />
  </Portal>
  
  <!-- Toast de enlace copiado -->
  {#if showShareToast}
    <div class="share-toast-fixed">
      ✓ Enlace copiado
    </div>
  {/if}

  <!-- COLOR PICKER MODAL circular para nueva opción -->
  {#if showNewOptionColorPicker}
    <div 
      class="color-picker-overlay" 
      onclick={() => showNewOptionColorPicker = false}
      onkeydown={(e) => { if (e.key === 'Escape') showNewOptionColorPicker = false; }}
      role="button"
      tabindex="0"
      aria-label="Cerrar selector de color"
    >
      <div 
        class="color-picker-modal-circular" 
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => { if (e.key === 'Escape') showNewOptionColorPicker = false; }}
        role="dialog"
        aria-labelledby="color-picker-title"
        tabindex="-1"
      >
        <div class="color-picker-header-circular">
          <h3 id="color-picker-title">Selecciona un color</h3>
          <button onclick={() => showNewOptionColorPicker = false} type="button" aria-label="Cerrar" class="color-picker-close-circular">
            <X size={20} />
          </button>
        </div>
        
        <!-- Círculo de colores -->
        <div class="color-wheel-container">
          <div 
            class="color-wheel"
            role="slider"
            aria-label="Selector de color"
            aria-valuenow={selectedHue}
            aria-valuemin={0}
            aria-valuemax={360}
            tabindex="0"
            onmousedown={(e) => {
              isDraggingColor = true;
              const rect = e.currentTarget.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              const deltaX = e.clientX - centerX;
              const deltaY = e.clientY - centerY;
              const angle = Math.atan2(deltaY, deltaX);
              const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
              const maxDistance = rect.width / 2;
              selectedHue = Math.round(((angle * 180 / Math.PI) + 360 + 90) % 360);
              selectedSaturation = Math.round(Math.min(100, (distance / maxDistance) * 100));
            }}
            onmousemove={(e) => {
              if (isDraggingColor) {
                const rect = e.currentTarget.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const deltaX = e.clientX - centerX;
                const deltaY = e.clientY - centerY;
                const angle = Math.atan2(deltaY, deltaX);
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const maxDistance = rect.width / 2;
                selectedHue = Math.round(((angle * 180 / Math.PI) + 360 + 90) % 360);
                selectedSaturation = Math.round(Math.min(100, (distance / maxDistance) * 100));
              }
            }}
            onmouseup={() => isDraggingColor = false}
            onmouseleave={() => isDraggingColor = false}
            ontouchstart={(e) => {
              isDraggingColor = true;
              const touch = e.touches[0];
              const rect = e.currentTarget.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              const deltaX = touch.clientX - centerX;
              const deltaY = touch.clientY - centerY;
              const angle = Math.atan2(deltaY, deltaX);
              const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
              const maxDistance = rect.width / 2;
              selectedHue = Math.round(((angle * 180 / Math.PI) + 360 + 90) % 360);
              selectedSaturation = Math.round(Math.min(100, (distance / maxDistance) * 100));
            }}
            ontouchmove={(e) => {
              if (isDraggingColor) {
                const touch = e.touches[0];
                const rect = e.currentTarget.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const deltaX = touch.clientX - centerX;
                const deltaY = touch.clientY - centerY;
                const angle = Math.atan2(deltaY, deltaX);
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const maxDistance = rect.width / 2;
                selectedHue = Math.round(((angle * 180 / Math.PI) + 360 + 90) % 360);
                selectedSaturation = Math.round(Math.min(100, (distance / maxDistance) * 100));
              }
            }}
            ontouchend={() => isDraggingColor = false}
          >
            <!-- Gradiente radial para saturación -->
            <div class="color-wheel-saturation"></div>
            
            <!-- Indicador de color seleccionado -->
            <div 
              class="color-wheel-indicator"
              style="background: {selectedColor}; transform: translate(-50%, -50%) rotate({selectedHue}deg) translateY({-selectedSaturation * 1.2}px);"
            ></div>
          </div>
          
          <!-- Botón confirmar -->
          <button
            onclick={confirmColorSelection}
            type="button"
            class="color-confirm-btn"
            style="background: {selectedColor};"
          >
            Seleccionar Color
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ========================================
     ACTION BAR - Contenedor centrado con ancho máximo
     ======================================== */
  .action-bar-container {
    position: relative;
    width: 100%;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
  }

  .action-bar-fixed {
    display: flex;
    align-items: center;
    gap: 0;
    flex-shrink: 0;
  }

  .action-bar-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
    -webkit-overflow-scrolling: touch;
    /* Ancho máximo para el scroll */
    max-width: 160px;
  }

  .action-bar-scroll::-webkit-scrollbar {
    display: none;
  }

  .action-bar-content {
    display: flex;
    align-items: center;
    gap: 0;
    width: max-content;
  }

  /* ========================================
     ACTION BAR - Iconos grandes estilo línea
     ======================================== */
  .action-bar-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px;
    background: transparent;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    white-space: nowrap;
    /* Forzar color blanco en todos los temas */
    color: rgba(255, 255, 255, 0.8) !important;
  }

  /* Forzar iconos SVG a ser blancos en todos los temas */
  .action-bar-btn :global(svg:not([style*="color"])) {
    color: rgba(255, 255, 255, 0.8);
    stroke: currentColor;
  }

  .action-bar-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .action-bar-btn:hover :global(svg:not([style*="color"])) {
    color: rgba(255, 255, 255, 1);
  }

  .action-bar-btn:active {
    transform: scale(0.95);
  }

  .action-bar-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-bar-count {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7) !important;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .action-bar-count.voted,
  .action-bar-count.reposted {
    font-weight: 600;
  }

  .action-bar-count.reposted {
    color: #4ade80;
  }

  /* ========================================
     NUEVA OPCIÓN - Edición (estilo mini)
     ======================================== */
  .new-option-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .new-option-input-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    width: 100%;
    padding: 0 24px;
  }

  .new-option-textarea-max {
    width: 100%;
    max-width: 500px;
    padding: 16px 20px;
    font-size: 2rem;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: -0.5px;
    background: rgba(0, 0, 0, 0.25);
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-radius: 16px;
    color: white;
    resize: none;
    outline: none;
    font-family: inherit;
    line-height: 1.2;
  }

  .new-option-textarea-max::placeholder {
    color: rgba(255, 255, 255, 0.4);
    text-transform: none;
    font-weight: 500;
  }

  .new-option-textarea-max:focus {
    border-color: rgba(255, 255, 255, 0.5);
    background: rgba(0, 0, 0, 0.35);
  }

  /* Barra de edición con iconos */
  .new-option-edit-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    position: absolute;
    bottom: 60px;
    left: 50%;
    transform: translateX(-50%);
  }

  .edit-btn-max {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .color-btn-max {
    border: 2px solid rgba(255, 255, 255, 0.4);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .color-btn-max:hover {
    transform: scale(1.1);
    border-color: rgba(255, 255, 255, 0.7);
  }

  .cancel-btn-max {
    background: rgba(239, 68, 68, 0.9);
    color: white;
  }

  .cancel-btn-max:hover {
    background: #ef4444;
    transform: scale(1.1);
  }

  .publish-btn-max {
    background: rgba(34, 197, 94, 0.9);
    color: white;
  }

  .publish-btn-max:hover:not(:disabled) {
    background: #22c55e;
    transform: scale(1.1);
  }

  .publish-btn-max:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ========================================
     COLOR PICKER MODAL CIRCULAR
     ======================================== */
  .color-picker-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    padding: 1rem;
  }

  .color-picker-modal-circular {
    background: rgba(30, 30, 30, 0.98);
    border-radius: 20px;
    padding: 32px;
    max-width: 400px;
    width: 90%;
  }

  .color-picker-header-circular {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
  }

  .color-picker-header-circular h3 {
    color: white;
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }

  .color-picker-close-circular {
    background: rgba(255,255,255,0.1);
    border: none;
    border-radius: 8px;
    padding: 8px;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .color-picker-close-circular:hover {
    background: rgba(255,255,255,0.2);
  }

  .color-wheel-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }

  .color-wheel {
    width: 280px;
    height: 280px;
    border-radius: 50%;
    position: relative;
    cursor: pointer;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    background: conic-gradient(
      from 0deg, 
      hsl(0, 100%, 50%), 
      hsl(30, 100%, 50%), 
      hsl(60, 100%, 50%), 
      hsl(90, 100%, 50%), 
      hsl(120, 100%, 50%), 
      hsl(150, 100%, 50%), 
      hsl(180, 100%, 50%), 
      hsl(210, 100%, 50%), 
      hsl(240, 100%, 50%), 
      hsl(270, 100%, 50%), 
      hsl(300, 100%, 50%), 
      hsl(330, 100%, 50%), 
      hsl(360, 100%, 50%)
    );
  }

  .color-wheel-saturation {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: radial-gradient(circle, white 0%, transparent 100%);
    pointer-events: none;
  }

  .color-wheel-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 4px solid white;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    pointer-events: none;
  }

  .color-confirm-btn {
    width: 100%;
    padding: 16px;
    color: white;
    border: none;
    border-radius: 16px;
    font-weight: 600;
    font-size: 16px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: transform 0.2s;
  }

  .color-confirm-btn:hover {
    transform: scale(1.02);
  }

  /* Footer de nueva opción con línea de color */
  .new-option-footer {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0;
    height: auto;
    min-height: 0;
  }

  .new-option-color-line {
    width: 100%;
    height: 6px;
    border-radius: 0 0 24px 24px;
  }

  /* Botón añadir opción - fijo a la derecha, estilo original */
  .add-option-btn {
    position: absolute !important;
    right: 12px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 36px !important;
    height: 36px !important;
    min-width: 36px !important;
    border-radius: 8px !important;
    background: #2a2c31 !important;
    border: none;
    border-top: none;
    border-left: none;
    border-right: none;
    border-bottom: 2.5px solid #8b5cf6;
    color: white !important;
    cursor: pointer;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    z-index: 10;
  }

  .add-option-btn:hover {
    transform: translateY(-50%) scale(1.05) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .add-option-btn:active {
    transform: translateY(-50%) scale(0.95) !important;
  }

  .add-option-btn :global(svg) {
    width: 22px !important;
    height: 22px !important;
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

  /* Indicador de tipo de encuesta (círculo o cuadrado) */
  .poll-type-indicator {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    color: rgba(255, 255, 255, 0.7);
  }

  .poll-type-indicator.is-multiple {
    border-radius: 8px;
  }

  .poll-type-indicator.is-collaborative {
    border-radius: 50%;
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

  .card-video-area {
    position: relative;
    overflow: hidden;
    background: #121212;
    border-radius: 28px;
    width: 100%;
    /* Altura para Spotify versión medium */
    height: 232px;
    min-height: 232px;
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
    background: #121212 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  
  /* Contenedor de iframe/video - fondo uniforme */
  .card-video-area :global(.embed-container > div),
  .card-video-area :global(.oembed-container > div),
  .card-video-area :global(.media-embed > div) {
    background: #121212 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
    height: 100% !important;
  }

  .card-video-area :global(iframe),
  .card-video-area :global(video) {
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    max-height: 100% !important;
    min-height: 100% !important;
    object-fit: contain !important;
    border-radius: 28px !important;
    background: #121212 !important;
    border: none !important;
    margin: 0 !important;
    padding: 0 !important;
    position: relative !important;
  }

  /* Forzar aspecto uniforme en TODOS los iframes */
  .card-video-area :global(iframe[src*="youtube"]),
  .card-video-area :global(iframe[src*="vimeo"]),
  .card-video-area :global(iframe[src*="spotify"]),
  .card-video-area :global(iframe[src*="soundcloud"]),
  .card-video-area :global(iframe[src*="tiktok"]),
  .card-video-area :global(iframe[src*="twitch"]),
  .card-video-area :global(iframe[src*="dailymotion"]),
  .card-video-area :global(iframe[src*="deezer"]),
  .card-video-area :global(iframe[src*="apple"]),
  .card-video-area :global(iframe[src*="bandcamp"]) {
    width: 100% !important;
    height: 100% !important;
    min-height: 100% !important;
    background: #121212 !important;
    border: none !important;
  }

  /* Ocultar contenido extra en video */
  .card-video-area :global(.linkedin-content),
  .card-video-area :global(.mini-card-content) {
    display: none !important;
  }

  /* Ocultar overflow en contenedores de embeds (Spotify, SoundCloud, etc) */
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
     PREVIEW ANTES DE CARGAR IFRAME
     ======================================== */
  
  .embed-preview-container {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: none;
    background: #000;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 0;
    margin: 0;
  }
  
  .embed-preview-thumbnail {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease, filter 0.3s ease;
  }
  
  .embed-preview-container:hover .embed-preview-thumbnail {
    transform: scale(1.05);
    filter: brightness(0.7);
  }
  
  .embed-preview-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.4);
    transition: background 0.3s ease;
  }
  
  .embed-preview-container:hover .embed-preview-overlay {
    background: rgba(0, 0, 0, 0.5);
  }
  
  .embed-preview-play-btn {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 4px rgba(255, 255, 255, 0.2);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  
  .embed-preview-container:hover .embed-preview-play-btn {
    transform: scale(1.1);
    box-shadow: 0 6px 30px rgba(0, 0, 0, 0.5), 0 0 0 6px rgba(255, 255, 255, 0.3);
  }
  
  .embed-preview-play-icon {
    font-size: 36px;
    color: #1a1a1a;
    margin-left: 4px; /* Ajuste visual para centrar el triángulo */
  }
  
  .embed-preview-text {
    font-size: 14px;
    font-weight: 500;
    color: white;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    opacity: 0.9;
  }
  
  .embed-preview-container:active .embed-preview-play-btn {
    transform: scale(0.95);
  }

  /* ========================================
     CONTENEDOR FLOTANTE DEL PREVIEW - ESTILO INSTAGRAM
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

  /* Iframe con fondo blur de la preview */
  .iframe-with-blur-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .blur-bg-layer {
    position: absolute;
    inset: -20px;
    background-image: var(--bg-image);
    background-size: cover;
    background-position: center;
    filter: blur(20px) brightness(0.6);
    transform: scale(1.1);
    z-index: 0;
  }

  .iframe-content-layer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
  }

  .iframe-content-layer :global(iframe),
  .iframe-content-layer :global(.media-embed),
  .iframe-content-layer :global(.embed-container),
  .iframe-content-layer :global(div) {
    background: transparent !important;
    background-color: transparent !important;
  }

  .iframe-content-layer :global(.media-embed),
  .iframe-content-layer :global(.embed-container),
  .iframe-content-layer :global(div) {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    justify-content: flex-start !important;
    height: 100% !important;
  }

  .iframe-content-layer :global(iframe) {
    margin-top: 0 !important;
    margin-bottom: auto !important;
    align-self: flex-start !important;
    background: transparent !important;
    background-color: transparent !important;
  }

  /* Thumbnail fullscreen con badge */
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

  .platform-badge-max {
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

  .thumbnail-fullscreen-btn:hover .platform-badge-max {
    transform: scale(1.1);
    box-shadow: 
      0 6px 16px rgba(0, 0, 0, 0.5),
      0 0 0 3px rgba(255, 255, 255, 0.3);
  }

  .platform-badge-max svg {
    width: 26px;
    height: 26px;
    color: white;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }

  /* Ajustar el contenido inferior cuando hay preview flotante */
  .card-video-wrapper .card-video-bottom {
    padding-top: 8px;
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
  
  /* Forzar que las imágenes llenen todo el contenedor sin recorte extra */
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

  /* Ocultar el contenido extra de MediaEmbed */
  .card-image-fullscreen :global(.linkedin-content),
  .card-image-fullscreen :global(.mini-card-content),
  .card-image-fullscreen :global(.bottom-link-button),
  .card-image-fullscreen :global(.compact-link-container),
  .card-image-fullscreen :global(.error-link),
  .card-image-fullscreen :global(.error-state) {
    display: none !important;
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

  /* Enlace debajo del texto de la opción */
  .link-below-text-max {
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
  }
  
  .link-below-text-max:hover {
    background: rgba(255, 255, 255, 0.22);
    color: white;
  }
  
  .link-below-favicon-max {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  
  .link-below-domain-max {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 180px;
  }
  
  .link-below-arrow-max {
    font-size: 12px;
    opacity: 0.7;
    flex-shrink: 0;
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

  /* Desktop - Cards centradas y más grandes */
  @media (min-width: 768px) {
    .option-card-container {
      padding: 130px 40px 80px;
    }
    
    .option-card-rounded {
      max-width: 500px;
      margin: 0 auto;
    }
    
    .quote-decoration {
      font-size: 140px;
    }
    
    .card-bottom-label {
      font-size: 38px;
    }
  }

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

  /* ========================================
     NUEVO HEADER ESTILO TWITTER
     ======================================== */

  .question-header-new {
    width: 100%;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .header-top-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-back-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s ease;
    flex-shrink: 0;
  }

  .header-back-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .header-back-btn:active {
    transform: scale(0.95);
  }

  .header-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: none;
    cursor: pointer;
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }

  .header-avatar:hover {
    transform: scale(1.05);
  }

  .header-user-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .header-username-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-username {
    font-size: 14px;
    font-weight: 600;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.header-verified-badge) {
    color: #1d9bf0;
    flex-shrink: 0;
  }

  .header-follow-btn {
    padding: 2px 8px;
    border-radius: 4px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  .header-follow-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .header-follow-btn:active {
    transform: scale(0.95);
  }

  .follow-text {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
  }

  :global(.header-diamond-icon) {
    color: rgba(255, 255, 255, 0.6);
    margin-right: 2px;
  }

  /* Iconos de votar */
  .vote-icon-empty-container {
    position: relative;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(45, 45, 45, 0.95);
    border: 3px solid rgba(70, 70, 70, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .vote-icon-empty-container.is-multiple {
    border-radius: 10px;
  }

  :global(.vote-icon-inner) {
    color: rgba(255, 255, 255, 0.45);
  }

  .vote-icon-voted-container {
    position: relative;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  }

  .vote-icon-voted-container.is-multiple {
    border-radius: 10px;
  }

  :global(.vote-check-icon) {
    color: white;
    position: absolute;
    top: 48%;
    left: 52%;
    transform: translate(-50%, -50%);
    filter: drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.15));
  }

  /* Wrapper para el botón de votar con badge */
  .vote-btn-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .vote-remove-badge {
    position: absolute;
    top: -4px;
    left: -4px;
    display: flex;
    align-items: center;
    gap: 1px;
    padding: 2px 5px;
    background: rgba(50, 50, 50, 0.95);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    z-index: 10;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    transition: all 0.15s ease;
  }

  .vote-remove-badge:hover {
    background: rgba(70, 70, 70, 0.95);
    transform: scale(1.1);
  }

  .vote-remove-badge:active {
    transform: scale(0.9);
  }

  .vote-remove-count {
    font-size: 10px;
    font-weight: 700;
  }

  .header-metadata {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
  }

  .header-metadata-dot {
    color: rgba(255, 255, 255, 0.4);
  }

  .header-vote-type {
    display: flex;
    align-items: center;
    color: rgba(255, 255, 255, 0.6);
  }

  .header-menu-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s ease;
    flex-shrink: 0;
  }

  .header-menu-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .header-question-row {
    padding-left: 42px; /* Alinear con el contenido después del botón back */
    padding-right: 32px; /* Espacio para el botón de menú */
  }

  /* Título/pregunta - ESTILO UNIFICADO (igual que CreatePollModal) */
  .header-question-text {
    font-size: 24px;
    font-weight: 400;
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    color: #d1d5db;
    line-height: 1.3;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    transition: opacity 0.2s ease;
  }

  .header-question-text:hover {
    opacity: 0.85;
  }

  .header-question-edit {
    font-size: 24px;
    font-weight: 400;
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
    color: #d1d5db;
    line-height: 1.3;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    width: 100%;
  }

  .header-question-edit::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  /* Responsive para móvil */
  @media (max-width: 480px) {
    .question-header-new {
      padding: 10px 12px;
    }

    .header-avatar {
      width: 32px;
      height: 32px;
    }

    .header-username {
      font-size: 13px;
    }

    .header-metadata {
      font-size: 11px;
    }

    .header-question-row {
      padding-left: 38px;
      padding-right: 28px;
    }

    .header-question-text,
    .header-question-edit {
      font-size: 18px;
    }
  }

  /* ========================================
     BOTONES SÍ/NO INLINE (debajo de línea divisoria)
     ======================================== */
  
  .yesno-vote-buttons-inline {
    display: flex;
    gap: 10px;
    justify-content: center;
    width: 100%;
    padding: 8px 0;
  }

  .yesno-vote-btn-inline {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    border-radius: 12px;
    border: none;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    flex: 1;
    max-width: 140px;
    justify-content: center;
  }

  .yesno-vote-btn-inline.yes {
    background: rgba(255, 255, 255, 0.95);
    color: #22c55e;
    border: 2px solid transparent;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(8px);
  }

  .yesno-vote-btn-inline.yes:hover {
    transform: scale(1.05);
    border-color: #22c55e;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3);
  }

  .yesno-vote-btn-inline.no {
    background: rgba(255, 255, 255, 0.95);
    color: #ef4444;
    border: 2px solid transparent;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(8px);
  }

  .yesno-vote-btn-inline.no:hover {
    transform: scale(1.05);
    border-color: #ef4444;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3);
  }

  .yesno-vote-btn-inline :global(svg) {
    flex-shrink: 0;
  }

  /* ========================================
     INDICADOR DE RESPUESTA CORRECTA
     ======================================== */
  
  .correct-indicator-overlay {
    position: absolute;
    top: 150px;
    right: 12px;
    z-index: 30;
  }

  .correct-indicator-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 8px 14px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    backdrop-filter: blur(8px);
    animation: popIn 0.3s ease-out;
  }

  .correct-indicator-badge.correct {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
  }

  .correct-indicator-badge.incorrect {
    background: rgba(34, 197, 94, 0.9);
    color: white;
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
  }

  .correct-indicator-badge :global(svg) {
    flex-shrink: 0;
  }

  @keyframes popIn {
    0% {
      opacity: 0;
      transform: scale(0.8);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  </style>
