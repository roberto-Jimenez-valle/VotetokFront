<script lang="ts">
  import { X, Trash2, Sparkles, Play, CircleCheck, Ban, Palette, ThumbsUp, ThumbsDown, Check } from 'lucide-svelte';
  import MediaEmbed from './MediaEmbed.svelte';

  const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Ccircle cx="20" cy="20" r="20" fill="%23e5e7eb"/%3E%3Cpath d="M20 20a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0 2c-5.33 0-16 2.67-16 8v4h32v-4c0-5.33-10.67-8-16-8z" fill="%239ca3af"/%3E%3C/svg%3E';

  // --- INTERFACES ---
  interface Friend {
    id: string;
    name: string;
    username?: string;
    avatarUrl?: string | null;
  }

  // --- PROPS ---
  interface Props {
    // Datos de la opción
    label: string;
    color: string;
    imageUrl?: string;
    percentage?: number;
    isVoted?: boolean;
    
    // Modo de visualización
    mode?: 'view' | 'edit';
    isActive?: boolean;
    
    // Datos adicionales para vista
    friends?: Friend[];
    totalVotes?: number;
    hasVoted?: boolean;
    userHasVoted?: boolean;  // Si el usuario actual ha votado (para mostrar avatares o ?)
    showPercentageLabel?: boolean;  // Mostrar "DE LOS VOTOS"
    
    // Callbacks para edición
    onLabelChange?: (newLabel: string) => void;
    onColorPickerOpen?: () => void;
    onGiphyPickerOpen?: () => void;
    onRemoveMedia?: () => void;
    onRemoveOption?: () => void;
    onToggleCorrect?: () => void;
    
    // Estados de opción
    isCorrect?: boolean;
    
    // Callbacks para vista
    onFriendsClick?: () => void;
    onClick?: () => void;
    onDoubleClick?: () => void;
    
    // Configuración
    showRemoveOption?: boolean;
    autoplay?: boolean;
    optionIndex?: number;
    isClickable?: boolean;
    compact?: boolean;  // Modo compacto: muestra thumbnail con icono en vez de iframe
    size?: 'normal' | 'maximized';  // Tamaño: normal para grid, maximized para fullscreen
  }

  let {
    label,
    color,
    imageUrl = '',
    percentage = 0,
    isVoted = false,
    mode = 'view',
    isActive = false,
    friends = [],
    totalVotes = 0,
    hasVoted = false,
    userHasVoted = false,
    showPercentageLabel = true,
    onLabelChange,
    onColorPickerOpen,
    onGiphyPickerOpen,
    onRemoveMedia,
    onRemoveOption,
    onToggleCorrect,
    isCorrect = false,
    onFriendsClick,
    onClick,
    onDoubleClick,
    showRemoveOption = false,
    autoplay = false,
    optionIndex = 0,
    isClickable = true,
    compact = false,
    size = 'normal'
  }: Props = $props();

  // --- DETECCIÓN DE TIPO DE MEDIA ---
  type MediaPlatform = 'youtube' | 'vimeo' | 'spotify' | 'soundcloud' | 'tiktok' | 'twitch' | 'twitter' | 'applemusic' | 'deezer' | 'dailymotion' | 'bandcamp' | 'video' | 'gif' | 'image' | 'text';
  
  function getMediaType(url: string): MediaPlatform {
    if (!url) return 'text';
    // Video platforms
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('vimeo.com')) return 'vimeo';
    if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) return 'tiktok';
    if (url.includes('twitch.tv')) return 'twitch';
    if (url.includes('dailymotion.com') || url.includes('dai.ly')) return 'dailymotion';
    // Social
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    // Audio platforms
    if (url.includes('spotify.com')) return 'spotify';
    if (url.includes('soundcloud.com')) return 'soundcloud';
    if (url.includes('music.apple.com')) return 'applemusic';
    if (url.includes('deezer.com')) return 'deezer';
    if (url.includes('bandcamp.com')) return 'bandcamp';
    // Direct media
    if (/\.(mp4|webm|mov)([?#]|$)/i.test(url)) return 'video';
    if (url.includes('giphy.com') || url.includes('tenor.com') || /\.gif([?#]|$)/i.test(url)) return 'gif';
    return 'image';
  }

  // Tipos derivados
  const mediaType = $derived(getMediaType(imageUrl));
  // Plataformas de media que muestran thumbnail fullscreen (excluye video directo)
  const isThumbnailPlatform = $derived(['youtube', 'vimeo', 'dailymotion', 'tiktok', 'twitch', 'twitter', 'applemusic', 'deezer', 'bandcamp', 'spotify', 'soundcloud'].includes(mediaType));
  // Para compatibilidad
  const isVideoType = $derived(false); // Ya no usamos el layout compacto de video
  const isGifType = $derived(mediaType === 'gif');
  const isImageType = $derived(mediaType === 'image' || isThumbnailPlatform);
  const isTextOnly = $derived(mediaType === 'text');
  const hasMedia = $derived(!!imageUrl);
  
  // Detectar si es un enlace genérico (debe mostrar favicon)
  function isGenericLink(url: string): boolean {
    if (!url) return false;
    // Si es una imagen directa, no es un enlace genérico
    if (/\.(jpg|jpeg|png|webp|gif|svg|bmp)([?#]|$)/i.test(url)) return false;
    // Si es una plataforma conocida o GIF, no es genérico (ya tienen su propio badge)
    if (isThumbnailPlatform || isGifType) return false;
    // Todo lo demás es un enlace genérico (Wikipedia, GitHub, noticias, etc.)
    return true;
  }
  
  const showGenericLinkBadge = $derived(isGenericLink(imageUrl));
  
  // Obtener hostname de una URL
  function getHostname(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  }
  

  // Extraer URL del label si existe
  function extractUrlFromText(text: string): string | null {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  }

  function getLabelWithoutUrl(text: string): string {
    return text.replace(/(https?:\/\/[^\s]+)/gi, '').trim();
  }

  const displayLabel = $derived(getLabelWithoutUrl(label));
  
  // Color neutro cuando no ha votado (solo en modo view)
  const NEUTRAL_COLOR = '#3a3d42';
  const displayColor = $derived(mode === 'edit' || userHasVoted ? color : NEUTRAL_COLOR);

  // --- FUNCIONES PARA MODO COMPACTO ---
  
  // Placeholder por defecto según plataforma
  function getDefaultThumbnail(type: string): string {
    const placeholders: Record<string, string> = {
      youtube: 'https://placehold.co/320x180/FF0000/white?text=YouTube',
      vimeo: 'https://placehold.co/320x180/1ab7ea/white?text=Vimeo',
      spotify: 'https://placehold.co/320x180/1DB954/white?text=Spotify',
      soundcloud: 'https://placehold.co/320x180/ff5500/white?text=SoundCloud',
      tiktok: 'https://placehold.co/320x180/000000/white?text=TikTok',
      twitch: 'https://placehold.co/320x180/9146FF/white?text=Twitch',
      twitter: 'https://placehold.co/320x180/000000/white?text=X',
      applemusic: 'https://placehold.co/320x180/FC3C44/white?text=Apple+Music',
      deezer: 'https://placehold.co/320x180/FEAA2D/white?text=Deezer',
      dailymotion: 'https://placehold.co/320x180/0066DC/white?text=Dailymotion',
      bandcamp: 'https://placehold.co/320x180/1DA0C3/white?text=Bandcamp',
      video: 'https://placehold.co/320x180/333/white?text=Video'
    };
    return placeholders[type] || placeholders.video;
  }

  // Estado para thumbnail obtenido de la API
  let fetchedThumbnail = $state<string | null>(null);
  let thumbnailLoading = $state(false);

  // Obtener thumbnail real - TODAS las plataformas pasan por el backend
  async function fetchRealThumbnail(url: string, type: string): Promise<string> {
    try {
      console.log('[PollOptionCard] 📡 Fetching thumbnail for:', type, url);
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result;
        // Prioridad: imageProxied > image > thumbnailUrl
        const thumbnail = data.imageProxied || data.image || data.thumbnailUrl || data.thumbnail_url;
        if (thumbnail) {
          console.log('[PollOptionCard] ✅ Thumbnail found:', thumbnail);
          return thumbnail;
        }
        console.log('[PollOptionCard] ⚠️ No thumbnail in response');
      } else {
        console.warn('[PollOptionCard] ❌ link-preview failed:', response.status);
      }
    } catch (err) {
      console.warn('[PollOptionCard] Error fetching thumbnail:', err);
    }
    
    return getDefaultThumbnail(type);
  }

  // Efecto para cargar el thumbnail real cuando el componente se monta
  // Para videos embebidos Y plataformas de thumbnail (TikTok, Twitter, etc.)
  $effect(() => {
    if ((isVideoType || isThumbnailPlatform) && imageUrl && !fetchedThumbnail && !thumbnailLoading) {
      thumbnailLoading = true;
      fetchRealThumbnail(imageUrl, mediaType).then(thumb => {
        fetchedThumbnail = thumb;
        thumbnailLoading = false;
      });
    }
  });

  // Thumbnail final: usar el obtenido de la API o el placeholder
  const videoThumbnail = $derived(fetchedThumbnail || getDefaultThumbnail(mediaType));

  // Colores de marca por plataforma
  const platformColors: Record<string, string> = {
    youtube: '#FF0000',
    vimeo: '#1ab7ea',
    spotify: '#1DB954',
    soundcloud: '#ff5500',
    tiktok: '#000000',
    twitch: '#9146FF',
    twitter: '#000000', // X (antes Twitter) usa negro
    applemusic: '#FC3C44',
    deezer: '#FEAA2D',
    dailymotion: '#0066DC',
    bandcamp: '#1DA0C3',
    video: '#666666'
  };

  // Estado para controlar carga lazy del iframe (solo cargar al hacer click)
  let videoActivated = $state(false);

  // Función para activar el video (cargar iframe)
  function activateVideo(e: Event) {
    e.stopPropagation();
    videoActivated = true;
  }

  // Mostrar thumbnail si está en modo compacto O si el video no ha sido activado
  const showThumbnail = $derived(compact || !videoActivated);
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div 
  class="poll-option-card {mode}"
  class:is-video={isVideoType}
  class:is-gif={isGifType}
  class:is-image={isImageType}
  class:is-text={isTextOnly}
  class:is-voted={isVoted}
  class:is-active={isActive}
  class:is-clickable={isClickable && mode === 'view'}
  class:size-maximized={size === 'maximized'}
  style="--option-color: {displayColor};"
  role={isClickable && mode === 'view' ? 'button' : undefined}
  tabindex={isClickable && mode === 'view' ? 0 : undefined}
  onclick={isClickable && mode === 'view' ? onClick : undefined}
  ondblclick={isClickable && mode === 'view' ? onDoubleClick : undefined}
  onkeydown={(e) => { if (isClickable && mode === 'view' && (e.key === 'Enter' || e.key === ' ')) onClick?.(); }}
>
  {#if isVideoType}
    <!-- === LAYOUT VIDEO/SPOTIFY/SOUNDCLOUD === -->
    <div class="card-video-wrapper"  style="background-color: {displayColor};">
      <!-- Área de video (55%) -->
      <div class="card-video-area">
        {#if showThumbnail}
          <!-- MODO THUMBNAIL: Click para cargar video -->
          <button 
            type="button"
            class="compact-video-thumbnail"
            onclick={activateVideo}
            aria-label="Click para reproducir video"
          >
            <img 
              src={videoThumbnail} 
              alt={displayLabel || 'Video'} 
              loading="lazy"
              onerror={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/320x180/333/white?text=Video'; }}
            />
            <div class="platform-icon-overlay" style="--platform-color: {platformColors[mediaType] || '#666'}">
              {#if mediaType === 'youtube'}
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              {:else if mediaType === 'vimeo'}
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z"/></svg>
              {:else if mediaType === 'spotify'}
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
              {:else if mediaType === 'soundcloud'}
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.56 8.87V17h8.76c1.85-.13 2.68-1.27 2.68-2.67 0-1.48-1.12-2.67-2.53-2.67-.33 0-.65.08-.96.2-.11-2.02-1.69-3.63-3.66-3.63-1.24 0-2.34.64-2.99 1.64H11.56zm-1 0H9.4v8.13h1.16V8.87zm-2.16.52H7.24v7.61H8.4V9.39zm-2.16.91H5.08v6.7h1.16v-6.7zm-2.16.78H2.92v5.92h1.16v-5.92zm-2.16 1.3H.76v4.62h1.16v-4.62z"/></svg>
              {:else if mediaType === 'tiktok'}
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
              {:else if mediaType === 'twitch'}
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
              {:else if mediaType === 'twitter'}
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              {:else if mediaType === 'applemusic'}
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.8.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 0 0 1.57-.1c.822-.106 1.596-.35 2.296-.81a5.046 5.046 0 0 0 1.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.455-2.105-1.245-.227-.56-.2-1.13.063-1.676.328-.68.88-1.106 1.596-1.29.39-.1.79-.148 1.19-.202.246-.033.494-.06.736-.108.27-.053.415-.2.46-.47a1.327 1.327 0 0 0 .015-.18V8.24a.677.677 0 0 0-.013-.12c-.05-.3-.2-.453-.505-.46-.304-.01-.61.013-.914.055-.505.07-1.01.15-1.514.227-.634.097-1.268.197-1.902.297-.346.054-.552.27-.59.615a2.24 2.24 0 0 0-.014.18v7.63c0 .426-.063.847-.25 1.236-.29.6-.77.97-1.406 1.148-.33.09-.665.134-1.01.152-.978.044-1.81-.424-2.14-1.236-.23-.566-.2-1.14.064-1.69.328-.684.89-1.106 1.6-1.287.38-.096.77-.147 1.156-.197.256-.035.51-.065.764-.11.26-.045.416-.196.458-.456.013-.083.014-.166.014-.25V6.8c0-.29.127-.49.387-.584.055-.02.113-.032.17-.045.348-.066.696-.133 1.044-.198.692-.13 1.386-.257 2.078-.385l2.052-.385 1.19-.22c.072-.014.144-.023.213-.052z"/></svg>
              {:else if mediaType === 'deezer'}
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.81 4.16v3.03H24V4.16h-5.19zM6.27 8.38v3.027h5.189V8.38h-5.19zm12.54 0v3.027H24V8.38h-5.19zM6.27 12.594v3.027h5.189v-3.027h-5.19zm6.271 0v3.027h5.19v-3.027h-5.19zm6.27 0v3.027H24v-3.027h-5.19zM0 16.81v3.029h5.19v-3.03H0zm6.27 0v3.029h5.19v-3.03h-5.19zm6.271 0v3.029h5.19v-3.03h-5.19zm6.27 0v3.029H24v-3.03h-5.19z"/></svg>
              {:else if mediaType === 'dailymotion'}
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.006 13.24c-1.47 0-2.66-1.2-2.66-2.67s1.2-2.67 2.66-2.67 2.67 1.19 2.67 2.67c0 1.47-1.2 2.67-2.67 2.67zM18 2H6C3.79 2 2 3.79 2 6v12c0 2.21 1.79 4 4 4h12c2.21 0 4-1.79 4-4V6c0-2.21-1.79-4-4-4zm-5.99 14.91c-3.32 0-6.01-2.69-6.01-6.01 0-3.32 2.69-6.01 6.01-6.01 3.32 0 6.01 2.69 6.01 6.01 0 3.32-2.69 6.01-6.01 6.01z"/></svg>
              {:else if mediaType === 'bandcamp'}
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M0 18.75l7.437-13.5H24l-7.438 13.5H0z"/></svg>
              {:else}
                <Play class="play-icon" />
              {/if}
            </div>
          </button>
        {:else}
          <!-- MODO REPRODUCCIÓN: iframe cargado después del click -->
          <MediaEmbed 
            url={imageUrl} 
            mode="full"
            width="100%"
            height="100%"
            autoplay={false}
          />
        {/if}
        
        {#if mode === 'edit' && hasMedia}
          <button
            type="button"
            class="remove-media-btn"
            onclick={(e) => { e.stopPropagation(); onRemoveMedia?.(); }}
            aria-label="Eliminar media"
          >
            <X class="w-4 h-4" />
          </button>
        {/if}
      </div>
      
      <!-- Contenido debajo del video -->
      <div class="card-video-bottom">
        {#if mode === 'edit'}
          <!-- Contador encima del texto -->
          <div class="char-counter-above">
            <span>{label.length}/200</span>
          </div>
          <textarea
            class="option-label-edit"
            placeholder="Opción {optionIndex + 1}..."
            value={displayLabel}
            oninput={(e) => onLabelChange?.((e.target as HTMLTextAreaElement).value)}
            onclick={(e) => e.stopPropagation()}
            maxlength="200"
          ></textarea>
        {:else}
          <h2 class="option-label-view">
            {displayLabel}
          </h2>
        {/if}
        
        <!-- Línea divisoria -->
        <div class="card-divider-line"></div>
        
        <!-- Footer - PORCENTAJE SOLO SI HA VOTADO -->
        <div class="card-bottom-row">
          {#if userHasVoted}
            <div class="card-percentage">
              <span class="percentage-value">{Math.round(percentage)}%</span>
              {#if showPercentageLabel && mode === 'view'}
                <span class="percentage-label">DE LOS VOTOS</span>
              {/if}
            </div>
          {:else}
            <div class="card-percentage-placeholder"></div>
          {/if}
          
          {#if friends.length > 0 && mode !== 'edit'}
            <button 
              type="button"
              class="friends-avatars-btn"
              onclick={(e) => { e.stopPropagation(); if (userHasVoted) onFriendsClick?.(); }}
              disabled={!userHasVoted}
              aria-label="Ver votos de amigos"
            >
              {#each friends.slice(0, 3) as friend, i}
                <div class="friend-avatar-wrapper" style="z-index: {10 - i};">
                  {#if userHasVoted}
                    <img src={friend.avatarUrl || DEFAULT_AVATAR} alt={friend.name} class="friend-avatar" loading="lazy" />
                  {:else}
                    <div class="friend-avatar-mystery"><span>?</span></div>
                  {/if}
                </div>
              {/each}
              {#if friends.length > 3}
                <span class="friends-more">+{friends.length - 3}</span>
              {/if}
            </button>
          {/if}
        </div>
      </div>
    </div>
    
  {:else if hasMedia}
    <!-- === LAYOUT IMAGEN/GIF/THUMBNAIL (fondo completo) === -->
    <div class="card-media-wrapper" >
      <!-- Fondo de color -->
      <div class="option-background">
        <div class="noise-overlay"></div>
        <div class="media-embed-background">
          {#if isThumbnailPlatform && videoThumbnail}
            <!-- Thumbnail de plataforma a pantalla completa -->
            <div class="thumbnail-fullscreen" style="background-image: url('{videoThumbnail}');">
              <div class="platform-badge" style="--platform-color: {platformColors[mediaType] || '#666'}">
                {#if mediaType === 'youtube'}
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                {:else if mediaType === 'vimeo'}
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z"/></svg>
                {:else if mediaType === 'dailymotion'}
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.006 13.24c-1.47 0-2.66-1.2-2.66-2.67s1.2-2.67 2.66-2.67 2.67 1.19 2.67 2.67c0 1.47-1.2 2.67-2.67 2.67zM18 2H6C3.79 2 2 3.79 2 6v12c0 2.21 1.79 4 4 4h12c2.21 0 4-1.79 4-4V6c0-2.21-1.79-4-4-4zm-5.99 14.91c-3.32 0-6.01-2.69-6.01-6.01 0-3.32 2.69-6.01 6.01-6.01 3.32 0 6.01 2.69 6.01 6.01 0 3.32-2.69 6.01-6.01 6.01z"/></svg>
                {:else if mediaType === 'tiktok'}
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                {:else if mediaType === 'twitch'}
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                {:else if mediaType === 'twitter'}
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                {:else if mediaType === 'spotify'}
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                {:else if mediaType === 'soundcloud'}
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.56 8.87V17h8.76c1.85-.13 2.68-1.27 2.68-2.67 0-1.48-1.12-2.67-2.53-2.67-.33 0-.65.08-.96.2-.11-2.02-1.69-3.63-3.66-3.63-1.24 0-2.34.64-2.99 1.64H11.56zm-1 0H9.4v8.13h1.16V8.87zm-2.16.52H7.24v7.61H8.4V9.39zm-2.16.91H5.08v6.7h1.16v-6.7zm-2.16.78H2.92v5.92h1.16v-5.92zm-2.16 1.3H.76v4.62h1.16v-4.62z"/></svg>
                {:else if mediaType === 'applemusic'}
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.8.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 0 0 1.57-.1c.822-.106 1.596-.35 2.296-.81a5.046 5.046 0 0 0 1.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.455-2.105-1.245-.227-.56-.2-1.13.063-1.676.328-.68.88-1.106 1.596-1.29.39-.1.79-.148 1.19-.202.246-.033.494-.06.736-.108.27-.053.415-.2.46-.47a1.327 1.327 0 0 0 .015-.18V8.24a.677.677 0 0 0-.013-.12c-.05-.3-.2-.453-.505-.46-.304-.01-.61.013-.914.055-.505.07-1.01.15-1.514.227-.634.097-1.268.197-1.902.297-.346.054-.552.27-.59.615a2.24 2.24 0 0 0-.014.18v7.63c0 .426-.063.847-.25 1.236-.29.6-.77.97-1.406 1.148-.33.09-.665.134-1.01.152-.978.044-1.81-.424-2.14-1.236-.23-.566-.2-1.14.064-1.69.328-.684.89-1.106 1.6-1.287.38-.096.77-.147 1.156-.197.256-.035.51-.065.764-.11.26-.045.416-.196.458-.456.013-.083.014-.166.014-.25V6.8c0-.29.127-.49.387-.584.055-.02.113-.032.17-.045.348-.066.696-.133 1.044-.198.692-.13 1.386-.257 2.078-.385l2.052-.385 1.19-.22c.072-.014.144-.023.213-.052z"/></svg>
                {:else if mediaType === 'deezer'}
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.81 4.16v3.03H24V4.16h-5.19zM6.27 8.38v3.027h5.189V8.38h-5.19zm12.54 0v3.027H24V8.38h-5.19zM6.27 12.594v3.027h5.189v-3.027h-5.19zm6.271 0v3.027h5.19v-3.027h-5.19zm6.27 0v3.027H24v-3.027h-5.19zM0 16.81v3.029h5.19v-3.03H0zm6.27 0v3.029h5.19v-3.03h-5.19zm6.271 0v3.029h5.19v-3.03h-5.19zm6.27 0v3.029H24v-3.03h-5.19z"/></svg>
                {:else if mediaType === 'bandcamp'}
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M0 18.75l7.437-13.5H24l-7.438 13.5H0z"/></svg>
                {:else if mediaType === 'video'}
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                {/if}
              </div>
            </div>
          {:else}
            <MediaEmbed 
              url={imageUrl} 
              mode="full"
              width="100%"
              height="100%"
              {autoplay}
            />
          {/if}
          
        </div>
        <div class="media-gradient-overlay"></div>
        
        <!-- Badge GIPHY en esquina superior derecha -->
        {#if isGifType}
          <img src="/logoGIPHY.png" alt="GIPHY" class="giphy-badge" />
        {/if}
        
        <!-- Badge favicon para enlaces genéricos (Wikipedia, GitHub, etc.) -->
        {#if showGenericLinkBadge && imageUrl}
          <div class="generic-link-badge" title={getHostname(imageUrl)}>
            <img 
              src="https://www.google.com/s2/favicons?domain={getHostname(imageUrl)}&sz=32" 
              alt=""
              class="generic-link-favicon"
            />
          </div>
        {/if}
      </div>
      
      {#if mode === 'edit'}
        <button
          type="button"
          class="remove-media-btn"
          onclick={(e) => { e.stopPropagation(); onRemoveMedia?.(); }}
          aria-label="Eliminar media"
        >
          <X class="w-4 h-4" />
        </button>
      {/if}
      
      <!-- Degradado inferior -->
      <div class="bottom-gradient"></div>
      
      <!-- Contenido inferior -->
      <div class="option-content-bottom">
        {#if mode === 'edit'}
          <!-- Contador encima del texto -->
          <div class="char-counter-above">
            <span>{label.length}/200</span>
          </div>
          <textarea
            class="option-label-edit"
            placeholder="Opción {optionIndex + 1}..."
            value={displayLabel}
            oninput={(e) => onLabelChange?.((e.target as HTMLTextAreaElement).value)}
            onclick={(e) => e.stopPropagation()}
            maxlength="200"
          ></textarea>
        {:else}
          <h2 class="option-label-view">
            {displayLabel}
          </h2>
        {/if}
        
        <div class="divider-line"></div>
        
        <div class="option-footer">
          {#if userHasVoted}
            <div class="percentage-display">
              <span class="percentage-value">{Math.round(percentage)}%</span>
              {#if showPercentageLabel}
                <span class="percentage-label">DE LOS VOTOS</span>
              {/if}
            </div>
          {:else}
            <div class="percentage-display-placeholder"></div>
          {/if}
          
          {#if friends.length > 0 && mode !== 'edit'}
            <button 
              type="button"
              class="friends-avatars-btn"
              onclick={(e) => { e.stopPropagation(); if (userHasVoted) onFriendsClick?.(); }}
              disabled={!userHasVoted}
              aria-label="Ver votos de amigos"
            >
              {#each friends.slice(0, 3) as friend, i}
                <div class="friend-avatar-wrapper" style="z-index: {10 - i};">
                  {#if userHasVoted}
                    <img src={friend.avatarUrl || DEFAULT_AVATAR} alt={friend.name} class="friend-avatar" loading="lazy" />
                  {:else}
                    <div class="friend-avatar-mystery"><span>?</span></div>
                  {/if}
                </div>
              {/each}
              {#if friends.length > 3}
                <span class="friends-more">+{friends.length - 3}</span>
              {/if}
            </button>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <!-- === LAYOUT TEXTO PURO (nuevo diseño React-style) === -->
    <div class="card-text-only"  style="background-color: {displayColor};">
      <div class="noise-overlay"></div>
      
      <div class="card-text-content-new">
        <!-- Spacer para empujar contenido hacia abajo -->
        <div class="content-spacer"></div>
        
        <!-- Textarea de texto -->
        {#if mode === 'edit'}
          <!-- Contador de caracteres encima del texto -->
          <div class="char-counter-new">
            <span>{label.length}/200</span>
          </div>
          <textarea
            class="option-label-edit-new option-label-autosize"
            placeholder="Opción {optionIndex + 1}..."
            value={displayLabel}
            oninput={(e) => {
              onLabelChange?.((e.target as HTMLTextAreaElement).value);
              // Auto-resize textarea
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
            onclick={(e) => e.stopPropagation()}
            maxlength="200"
            rows="2"
          ></textarea>
        {:else}
          <h2 class="option-label-view">
            {displayLabel}
          </h2>
        {/if}
        
        {#if mode === 'view'}
          <!-- Vista de porcentaje para modo view -->
          {#if userHasVoted}
            <div class="card-bottom-row">
              <div class="card-percentage">
                <span class="percentage-value">{Math.round(percentage)}%</span>
                {#if showPercentageLabel}
                  <span class="percentage-label">DE LOS VOTOS</span>
                {/if}
              </div>
              {#if friends.length > 0}
                <button 
                  type="button"
                  class="friends-avatars-btn"
                  onclick={(e) => { e.stopPropagation(); if (userHasVoted) onFriendsClick?.(); }}
                  disabled={!userHasVoted}
                  aria-label="Ver votos de amigos"
                >
                  {#each friends.slice(0, 3) as friend, i}
                    <div class="friend-avatar-wrapper" style="z-index: {10 - i};">
                      <img src={friend.avatarUrl || DEFAULT_AVATAR} alt={friend.name} class="friend-avatar" loading="lazy" />
                    </div>
                  {/each}
                  {#if friends.length > 3}
                    <span class="friends-more">+{friends.length - 3}</span>
                  {/if}
                </button>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
  
  <!-- Botones de edición - SIEMPRE en la misma posición -->
  {#if mode === 'edit'}
    <div class="floating-actions-right">
      <button
        type="button"
        class="tool-btn {isCorrect ? 'active' : ''}"
        onclick={(e) => { e.stopPropagation(); onToggleCorrect?.(); }}
        title={isCorrect ? 'Opción correcta' : 'Marcar como correcta'}
        aria-label="Marcar correcta"
      >
        <CircleCheck size={18} />
      </button>
      <button
        type="button"
        class="tool-btn"
        onclick={(e) => { e.stopPropagation(); onColorPickerOpen?.(); }}
        title="Cambiar color"
        aria-label="Color"
      >
        <Palette size={18} />
      </button>
      <button
        type="button"
        class="tool-btn sparkles-btn"
        onclick={(e) => { e.stopPropagation(); onGiphyPickerOpen?.(); }}
        title="Buscar GIF"
        aria-label="GIF"
      >
        <Sparkles size={18} />
      </button>
      {#if showRemoveOption}
        <button
          type="button"
          class="tool-btn danger-btn"
          onclick={(e) => { e.stopPropagation(); onRemoveOption?.(); }}
          title="Eliminar opción"
          aria-label="Eliminar"
        >
          <Trash2 size={18} />
        </button>
      {/if}
    </div>
  {/if}
  
  <!-- Mensaje de opción correcta en edición -->
  {#if mode === 'edit' && isCorrect}
    <div class="correct-hint-overlay">
      <div class="correct-answer-hint">
        <CircleCheck size={12} />
        <span>Esta opción es correcta</span>
      </div>
    </div>
  {/if}
  
  <!-- === MODO VIEW: Indicador de opción correcta === -->
  {#if mode === 'view' && isCorrect && userHasVoted}
    <div class="correct-indicator-overlay">
      <div class="correct-indicator-badge {isVoted ? 'correct' : 'incorrect'}">
        {#if isVoted}
          <Check size={14} />
          <span>¡Acertaste!</span>
        {:else}
          <CircleCheck size={14} />
          <span>Esta era la correcta</span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .poll-option-card {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border-radius: 24px;
    overflow: hidden;
    border: none;
    padding: 0;
    background: #1a1a1a;
    text-align: left;
    /* Flex layout para que Sí/No esté dentro del flujo */
    display: flex;
    flex-direction: column;
    /* Ocultar scrollbars */
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  .poll-option-card::-webkit-scrollbar {
    display: none;
  }
  
  /* Ocultar scrollbars en todos los contenedores internos */
  .poll-option-card *,
  .poll-option-card *::-webkit-scrollbar {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  
  .poll-option-card *::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  
  /* Forzar overflow hidden en contenedores que podrían tener scroll */
  .poll-option-card :global(iframe),
  .poll-option-card :global(video),
  .poll-option-card :global(.media-embed),
  .poll-option-card :global(.embed-container),
  .poll-option-card :global(.oembed-container) {
    overflow: hidden !important;
  }
  
  .poll-option-card.is-clickable {
    cursor: pointer;
  }

  /* ========================================
     LAYOUT VIDEO/SPOTIFY/SOUNDCLOUD
     ======================================== */
  
  .card-video-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex: 1;
    min-height: 0;
    padding: 4px;
    border-radius: 24px;
    overflow: hidden;
  }
  
  .card-video-area {
    flex: 0 0 55%;
    position: relative;
    overflow: hidden;
    background: var(--option-color);
    border-radius: 22px;
  }
  
  .card-video-area :global(.media-embed),
  .card-video-area :global(.embed-container),
  .card-video-area :global(.oembed-container) {
    width: 100% !important;
    height: 100% !important;
    background: inherit !important;
  }
  
  .card-video-area :global(iframe),
  .card-video-area :global(video) {
    border-radius: 22px !important;
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
    /* El espacio vacío (letterbox) mostrará el color del padre */
  }
  
  .card-video-area :global(.media-embed-container),
  .card-video-area :global(.embed-wrapper),
  .card-video-area :global(div) {
    background: inherit !important;
  }
  
  /* ========================================
     MODO COMPACTO - THUMBNAIL
     ======================================== */
  
  .compact-video-thumbnail {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    border-radius: 22px;
    overflow: hidden;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  
  .compact-video-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: brightness(0.8);
    transition: filter 0.2s ease, transform 0.3s ease;
  }
  
  .compact-video-thumbnail:hover img {
    filter: brightness(1);
    transform: scale(1.02);
  }
  
  .platform-icon-overlay {
    position: absolute;
    bottom: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    background: rgba(0, 0, 0, 0.75);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    transition: transform 0.2s ease, background 0.2s ease;
  }
  
  .compact-video-thumbnail:hover .platform-icon-overlay {
    transform: scale(1.1);
    background: var(--platform-color, rgba(0, 0, 0, 0.9));
  }
  
  .platform-icon-overlay svg {
    width: 18px;
    height: 18px;
    color: white;
  }
  
  .platform-icon-overlay :global(.play-icon) {
    width: 18px;
    height: 18px;
    color: white;
  }
  
  /* Colores específicos de plataforma al hover */
  .poll-option-card:hover .platform-icon-overlay svg {
    color: white;
  }
  
  /* ========================================
     THUMBNAIL FULLSCREEN (TikTok, Twitter, etc.)
     ======================================== */
  
  .thumbnail-fullscreen {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }
  
  .platform-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 18px;
    height: 18px;
    background: var(--platform-color, rgba(0, 0, 0, 0.8));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    z-index: 10;
  }
  
  .platform-badge svg {
    width: 10px;
    height: 10px;
    color: white;
  }
  
  /* Badge GIPHY logo en esquina superior derecha */
  .giphy-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 18px;
    height: 18px;
    padding: 3px;
    background: rgba(0, 0, 0, 0.75);
    border-radius: 50%;
    object-fit: contain;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
    z-index: 20;
    pointer-events: none;
  }
  
  /* Badge favicon para enlaces genéricos - redondo sin fondo */
  .generic-link-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
    pointer-events: none;
    overflow: hidden;
  }
  
  .generic-link-favicon {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    object-fit: cover;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
  }
  
  .card-video-bottom {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 12px 16px 8px;
    gap: 8px;
  }
  
  .card-divider-line {
    width: 100%;
    height: 1px;
    background: rgba(255, 255, 255, 0.3);
  }
  
  .card-bottom-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .card-percentage {
    display: flex;
    flex-direction: column;
  }
  
  /* Layout texto puro (sin área superior) */
  .card-text-only {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 24px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  
  .card-text-only > .noise-overlay {
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    opacity: 0.08;
    mix-blend-mode: overlay;
    pointer-events: none;
    z-index: 0;
  }
  
  .card-text-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    padding: 16px;
    gap: 12px;
  }
  
  /* ========================================
     LAYOUT IMAGEN/GIF/TEXTO
     ======================================== */
  
  .card-media-wrapper {
    position: relative;
    width: 100%;
    flex: 1;
    min-height: 0;
    border-radius: 24px;
    overflow: hidden;
  }
  
  .option-background {
    position: absolute;
    inset: 0;
    background-color: var(--option-color);
  }
  
  .option-background::before {
    content: '';
    position: absolute;
    inset: 0;
    background-color: var(--option-color);
    opacity: 0.7;
  }
  
  /* En modo edit, fondo oscuro sin color de opción visible */
  .poll-option-card.edit .option-background {
    background-color: #1a1a1a;
  }
  
  .poll-option-card.edit .option-background::before {
    display: none;
  }
  
  .noise-overlay {
    position: absolute;
    inset: 0;
    background-image: url('https://grainy-gradients.vercel.app/noise.svg');
    opacity: 0.4;
    mix-blend-mode: overlay;
    pointer-events: none;
  }
  
  .media-embed-background {
    position: absolute;
    inset: 0;
    z-index: 1;
  }
  
  .media-embed-background :global(.media-embed),
  .media-embed-background :global(.embed-container),
  .media-embed-background :global(img),
  .media-embed-background :global(video) {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
  }
  
  /* Forzar que las imágenes llenen todo el contenedor sin recorte extra */
  .media-embed-background :global(.image-with-link) {
    position: absolute !important;
    inset: 0 !important;
    display: flex !important;
    flex-direction: column !important;
  }
  
  .media-embed-background :global(.image-container) {
    flex: 1 !important;
    position: relative !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
  }
  
  .media-embed-background :global(.image-container img) {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    max-height: none !important;
    object-fit: cover !important;
  }
  
  /* Ocultar todo el contenido extra de MediaEmbed */
  .media-embed-background :global(.bottom-link-button),
  .media-embed-background :global(.compact-link-container),
  .media-embed-background :global(.linkedin-content),
  .media-embed-background :global(.mini-card-content),
  .media-embed-background :global(.mini-card),
  .media-embed-background :global(.card-content),
  .media-embed-background :global(.error-link),
  .media-embed-background :global(.error-state) {
    display: none !important;
  }
  
  /* Asegurar que el embed container llene todo */
  .media-embed-background :global(.embed-container) {
    position: absolute !important;
    inset: 0 !important;
  }
  
  /* Imágenes directas dentro del embed */
  .media-embed-background :global(.embed-container > img) {
    position: absolute !important;
    inset: 0 !important;
    object-fit: cover !important;
  }
  
  .media-gradient-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.3) 0%,
      transparent 40%,
      transparent 60%,
      rgba(0, 0, 0, 0.4) 100%
    );
    z-index: 2;
    pointer-events: none;
  }
  
  .bottom-gradient {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 70%;
    background: linear-gradient(
      to top,
      rgba(0, 0, 0, 0.95) 0%,
      rgba(0, 0, 0, 0.8) 25%,
      rgba(0, 0, 0, 0.5) 50%,
      rgba(0, 0, 0, 0.2) 75%,
      transparent 100%
    );
    z-index: 3;
    pointer-events: none;
  }
  
  .option-content-bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 4;
    display: flex;
    flex-direction: column;
    padding: 16px;
    gap: 8px;
  }
  
  .divider-line {
    width: 100%;
    height: 1px;
    background: rgba(255, 255, 255, 0.3);
  }
  
  .option-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .percentage-display {
    display: flex;
    flex-direction: column;
  }
  
  /* ========================================
     ELEMENTOS COMPARTIDOS - ESTILO UNIFICADO
     ======================================== */
  
  /* Porcentaje - ESTILO UNIFICADO */
  .percentage-value {
    font-size: 32px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.02em;
    color: white;
    text-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.5),
      0 1px 3px rgba(0, 0, 0, 0.3);
  }
  
  /* Subtítulo del porcentaje - ESTILO UNIFICADO */
  .percentage-label {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }
  
  /* Label de opción - ESTILO UNIFICADO */
  .option-label-view {
    font-size: 18px;
    font-weight: 800;
    color: white;
    letter-spacing: -0.02em;
    line-height: 1.1;
    text-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.6),
      0 1px 3px rgba(0, 0, 0, 0.8);
    margin: 0;
  }
  
  /* Truncar a 1 línea en layouts con media (video/imagen) */
  .card-video-bottom .option-label-view,
  .option-content-bottom .option-label-view {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  
  /* Texto puro puede tener múltiples líneas */
  .card-text-content .option-label-view {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .option-label-edit {
    background: transparent;
    border: none;
    outline: none;
    color: white;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.2;
    resize: none;
    width: 100%;
    min-height: 36px;
    max-height: 60px;
  }
  
  .option-label-edit::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
  
  /* Botón eliminar media - centrado arriba */
  .remove-media-btn {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 25;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .remove-media-btn:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: translateX(-50%) scale(1.1);
  }
  
  /* Botones de edición - VERTICAL en esquina derecha, centrados */
  .edit-buttons {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 10;
  }
  
  .edit-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .edit-btn:hover {
    transform: scale(1.1);
    background: rgba(0, 0, 0, 0.7);
  }
  
  /* Botón Eliminar */
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
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
  }
  
  /* Botón Sí/No */
  .edit-btn.yesno-btn {
    background: #2a2c31;
    border: none;
    border-bottom: 3px solid rgba(255, 255, 255, 0.4);
    padding: 4px;
  }
  
  .edit-btn.yesno-btn:hover {
    background: #35373d;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.1);
  }
  
  .edit-btn.yesno-btn.active {
    background: #2a2c31;
    border-bottom-color: rgba(255, 255, 255, 0.8);
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
  }
  
  /* Botón Marcar Correcta */
  .edit-btn.correct-btn {
    border-color: rgba(34, 197, 94, 0.4);
  }
  
  .edit-btn.correct-btn:hover {
    background: rgba(34, 197, 94, 0.3);
    border-color: rgba(34, 197, 94, 0.8);
  }
  
  .edit-btn.correct-btn.active {
    background: rgba(34, 197, 94, 0.6);
    border-color: rgba(34, 197, 94, 1);
    color: white;
  }
  
  /* Contador de caracteres */
  .char-counter-above {
    display: flex;
    justify-content: flex-start;
    padding: 4px 0 0;
  }
  
  .char-counter-above span {
    font-size: 12px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.6);
  }
  
  /* Campos de Sí/No */
  .yesno-row {
    display: flex;
    gap: 6px;
    width: 100%;
    padding: 4px 8px;
    box-sizing: border-box;
  }
  
  .yesno-input {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1.5px solid rgba(0, 0, 0, 0.1);
    background: white;
    font-size: 12px;
    font-weight: 600;
    text-align: center;
    outline: none;
    transition: all 0.2s;
    box-sizing: border-box;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    position: relative;
  }
  
  .yesno-input input {
    background: transparent;
    border: none;
    outline: none;
    color: inherit;
    font-size: 12px;
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
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
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
  
  /* Overlay para mensaje de opción correcta - posicionado arriba de los campos Sí/No */
  .correct-hint-overlay {
    position: absolute;
    bottom: 60px; /* Encima de los campos Sí/No */
    left: 12px;
    right: 60px;
    z-index: 26;
    pointer-events: none;
  }

  /* Mensaje de opción correcta */
  .correct-answer-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: #22c55e;
    border-radius: 12px;
    color: white;
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
    animation: fadeIn 0.2s ease-out;
    backdrop-filter: blur(8px);
  }
  
  .correct-answer-hint :global(svg) {
    flex-shrink: 0;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  /* Avatares de amigos */
  .friends-avatars-btn {
    display: flex;
    align-items: center;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
  }
  
  .friends-avatars-btn:disabled {
    cursor: default;
  }
  
  .friend-avatar-wrapper {
    position: relative;
    margin-left: -8px;
  }
  
  .friend-avatar-wrapper:first-child {
    margin-left: 0;
  }
  
  .friend-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid rgba(0, 0, 0, 0.5);
    object-fit: cover;
  }
  
  .friend-avatar-mystery {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    border: 2px solid rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .friend-avatar-mystery span {
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-weight: bold;
  }
  
  .friends-more {
    margin-left: 4px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  /* ========================================
     TAMAÑO MAXIMIZADO (fullscreen)
     ======================================== */
  
  .poll-option-card.size-maximized {
    position: relative;
    inset: auto;
    width: 100vw;
    height: 100%;
    border-radius: 0;
    flex-shrink: 0;
  }
  
  .size-maximized .card-video-wrapper {
    border-radius: 0;
    padding: 0;
  }
  
  .size-maximized .card-video-area {
    flex: 0 0 60%;
    border-radius: 0;
  }
  
  .size-maximized .card-video-bottom {
    padding: 16px 20px 12px;
  }
  
  .size-maximized .option-label-view {
    font-size: 24px;
  }
  
  .size-maximized .percentage-value {
    font-size: 48px;
  }
  
  .size-maximized .card-media-wrapper {
    border-radius: 0;
  }
  
  .size-maximized .compact-video-thumbnail {
    border-radius: 0;
  }
  
  .size-maximized .card-text-only {
    border-radius: 0;
  }
  
  .size-maximized .card-text-content {
    padding: 24px;
  }
  
  .size-maximized .card-text-content .option-label-view {
    font-size: 32px;
    -webkit-line-clamp: 6;
    line-clamp: 6;
  }

  /* ========================================
     NUEVO DISEÑO - BOTONES FLOTANTES Y YES/NO
     ======================================== */
  
  /* Botones flotantes a la derecha */
  .floating-actions-right {
    position: absolute;
    bottom: 100px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 20;
  }

  .tool-btn {
    padding: 8px;
    border-radius: 9999px;
    background: rgba(0, 0, 0, 0.2);
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
    background: rgba(0, 0, 0, 0.4);
  }

  .tool-btn.active {
    background: white;
    color: #1f2937;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    transform: scale(1.1);
  }

  .tool-btn.danger-btn:hover {
    background: rgba(239, 68, 68, 0.8);
    color: white;
  }

  .tool-btn.sparkles-btn {
    opacity: 0.8;
  }

  .tool-btn.sparkles-btn:hover {
    opacity: 1;
  }

  /* Contenido de tarjeta nuevo */
  .card-text-content-new {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px;
    padding-right: 56px; /* Espacio para botones flotantes */
  }

  .content-spacer {
    flex: 1;
    cursor: text;
  }

  .option-label-edit-new {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    color: white;
    font-size: 32px;
    font-weight: 700;
    line-height: 1.2;
    padding: 0;
    margin-bottom: 4px;
  }

  .option-label-edit-new::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  /* Auto-resize para layout de solo texto */
  .option-label-autosize {
    overflow: hidden;
    min-height: 48px;
    max-height: 150px;
    overflow-y: auto;
  }

  .char-counter-new {
    display: flex;
    justify-content: flex-start;
    padding-bottom: 4px;
  }

  .char-counter-new span {
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    font-weight: 700;
  }

  .divider-line-new {
    width: 100%;
    height: 1px;
    background: rgba(255, 255, 255, 0.2);
    margin-bottom: 16px;
  }

  /* Campos Sí/No - overlay superpuesto dentro del contenido */
  .yesno-overlay {
    position: absolute;
    bottom: 12px;
    left: 0;
    right: 0;
    z-index: 25;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    pointer-events: auto;
    /* Sin fondo - se integra con el contenido detrás */
  }

  /* Empujar contenido cuando Sí/No está activo */
  /* Para layout GIF/imagen (position absolute) - cambiar bottom */
  .has-yesno .option-content-bottom {
    bottom: 70px;
  }

  .has-yesno .card-text-content-new {
    padding-bottom: 70px;
  }

  .has-yesno .card-video-bottom {
    padding-bottom: 70px;
  }

  /* Etiqueta de respuesta correcta centrada */
  .yesno-correct-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: #22c55e;
    border-radius: 12px;
    color: white;
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(34, 197, 94, 0.4);
    animation: fadeIn 0.2s ease-out;
  }

  .yesno-correct-label :global(svg) {
    flex-shrink: 0;
  }

  /* Etiqueta "Selecciona el botón correcto" - amarillo pastel */
  .yesno-select-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: #fef3c7;
    border-radius: 12px;
    color: #92400e;
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(251, 191, 36, 0.3);
    animation: fadeIn 0.2s ease-out;
  }

  .yesno-select-label :global(svg) {
    flex-shrink: 0;
    color: #f59e0b;
  }

  /* Mensaje de opción correcta (sin Sí/No) - abajo centrado */
  .correct-hint-overlay {
    position: absolute;
    bottom: 12px;
    left: 12px;
    right: 60px;
    z-index: 25;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  .correct-answer-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: #22c55e;
    border-radius: 12px;
    color: white;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
  }

  .correct-answer-hint :global(svg) {
    flex-shrink: 0;
  }

  /* Fila de opciones Sí/No */
  .yesno-row-new {
    display: flex;
    gap: 8px;
    width: 100%;
  }

  .option-btn-new {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.95);
    border: 2px solid transparent;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    transition: all 0.2s;
    overflow: hidden;
    backdrop-filter: blur(8px);
  }

  .option-btn-new:hover {
    border-color: rgba(236, 72, 153, 0.2);
  }

  .option-btn-new.selected {
    border-color: #22c55e;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3);
  }

  .option-selector {
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

  .option-selector.selected {
    background: #22c55e;
    border-color: #22c55e;
    color: white;
  }

  .option-btn-new:hover .option-selector:not(.selected) {
    border-color: #86efac;
  }

  .option-content-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding-right: 4px;
  }

  .option-content-btn :global(.thumbs-up) {
    color: #22c55e;
    fill: #dcfce7;
    flex-shrink: 0;
    margin-left: 4px;
  }

  .option-content-btn :global(.thumbs-down) {
    color: #ef4444;
    fill: #fee2e2;
    flex-shrink: 0;
    margin-left: 4px;
  }

  .option-input-new {
    width: 100%;
    background: #f1f5f9;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 6px 12px;
    font-weight: 700;
    font-size: 14px;
    color: #334155;
    outline: none;
    transition: all 0.2s;
  }

  .option-input-new::placeholder {
    color: #94a3b8;
  }

  .option-input-new:hover {
    background: #e2e8f0;
  }

  .option-input-new:focus {
    background: white;
    border-color: rgba(34, 197, 94, 0.5);
  }

  /* ========================================
     MODO VIEW: Botones Sí/No para votar
     ======================================== */
  
  .yesno-vote-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 16px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 100%);
    z-index: 30;
  }

  .yesno-vote-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .yesno-vote-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 16px;
    border: none;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 100px;
    justify-content: center;
  }

  .yesno-vote-btn.yes {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
  }

  .yesno-vote-btn.yes:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(34, 197, 94, 0.5);
  }

  .yesno-vote-btn.no {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
  }

  .yesno-vote-btn.no:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(239, 68, 68, 0.5);
  }

  .yesno-vote-btn :global(svg) {
    flex-shrink: 0;
  }

  /* ========================================
     MODO VIEW: Resultado después de votar
     ======================================== */
  
  .yesno-result-overlay {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 30;
  }

  .yesno-result-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    backdrop-filter: blur(8px);
    animation: popIn 0.3s ease-out;
  }

  .yesno-result-badge.correct {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
  }

  .yesno-result-badge.incorrect {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
  }

  .yesno-result-badge :global(svg) {
    flex-shrink: 0;
  }

  /* ========================================
     MODO VIEW: Indicador de opción correcta
     ======================================== */
  
  .correct-indicator-overlay {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 30;
  }

  .correct-indicator-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 700;
    backdrop-filter: blur(8px);
    animation: popIn 0.3s ease-out;
  }

  .correct-indicator-badge.correct {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
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
