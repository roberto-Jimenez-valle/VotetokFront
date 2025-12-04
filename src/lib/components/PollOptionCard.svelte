<script lang="ts">
  import { X, Trash2, Sparkles } from 'lucide-svelte';
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
    
    // Callbacks para vista
    onFriendsClick?: () => void;
    onClick?: () => void;
    onDoubleClick?: () => void;
    
    // Configuración
    showRemoveOption?: boolean;
    autoplay?: boolean;
    optionIndex?: number;
    isClickable?: boolean;
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
    onFriendsClick,
    onClick,
    onDoubleClick,
    showRemoveOption = false,
    autoplay = false,
    optionIndex = 0,
    isClickable = true
  }: Props = $props();

  // --- DETECCIÓN DE TIPO DE MEDIA ---
  function getMediaType(url: string): 'youtube' | 'vimeo' | 'spotify' | 'soundcloud' | 'video' | 'gif' | 'image' | 'text' {
    if (!url) return 'text';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('vimeo.com')) return 'vimeo';
    if (url.includes('spotify.com')) return 'spotify';
    if (url.includes('soundcloud.com')) return 'soundcloud';
    if (/\.(mp4|webm|mov)([?#]|$)/i.test(url)) return 'video';
    if (url.includes('giphy.com') || url.includes('tenor.com') || /\.gif([?#]|$)/i.test(url)) return 'gif';
    return 'image';
  }

  // Tipos derivados
  const mediaType = $derived(getMediaType(imageUrl));
  const isVideoType = $derived(['youtube', 'vimeo', 'spotify', 'soundcloud', 'video'].includes(mediaType));
  const isGifType = $derived(mediaType === 'gif');
  const isImageType = $derived(mediaType === 'image');
  const isTextOnly = $derived(mediaType === 'text');
  const hasMedia = $derived(!!imageUrl);

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
</script>

<div 
  class="poll-option-card {mode}"
  class:is-video={isVideoType}
  class:is-gif={isGifType}
  class:is-image={isImageType}
  class:is-text={isTextOnly}
  class:is-voted={isVoted}
  class:is-active={isActive}
  class:is-clickable={isClickable && mode === 'view'}
  style="--option-color: {color};"
  role={isClickable && mode === 'view' ? 'button' : undefined}
  tabindex={isClickable && mode === 'view' ? 0 : undefined}
  onclick={isClickable && mode === 'view' ? onClick : undefined}
  ondblclick={isClickable && mode === 'view' ? onDoubleClick : undefined}
  onkeydown={(e) => { if (isClickable && mode === 'view' && (e.key === 'Enter' || e.key === ' ')) onClick?.(); }}
>
  {#if isVideoType}
    <!-- === LAYOUT VIDEO/SPOTIFY/SOUNDCLOUD === -->
    <div class="card-video-wrapper" style="background-color: {color};">
      <!-- Área de video (55%) -->
      <div class="card-video-area">
        <MediaEmbed 
          url={imageUrl} 
          mode="full"
          width="100%"
          height="100%"
          {autoplay}
        />
        
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
          <textarea
            class="option-label-edit"
            placeholder="Opción {optionIndex + 1}"
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
        
        <!-- Footer - PORCENTAJE SIEMPRE VISIBLE -->
        <div class="card-bottom-row">
          <div class="card-percentage">
            <span class="percentage-value">{Math.round(percentage)}%</span>
            {#if hasVoted && mode === 'view'}
              <span class="percentage-label">DE LOS VOTOS</span>
            {/if}
          </div>
          
          {#if mode === 'edit'}
            <div class="edit-buttons">
              <button type="button" class="edit-btn color-btn" style="background-color: {color}" onclick={(e) => { e.stopPropagation(); onColorPickerOpen?.(); }} title="Cambiar color">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
              </button>
              <button type="button" class="edit-btn giphy-btn" onclick={(e) => { e.stopPropagation(); onGiphyPickerOpen?.(); }} title="Buscar GIF">
                <Sparkles class="w-4 h-4" />
              </button>
              {#if showRemoveOption}
                <button type="button" class="edit-btn delete-btn" onclick={(e) => { e.stopPropagation(); onRemoveOption?.(); }} title="Eliminar opción">
                  <Trash2 class="w-4 h-4" />
                </button>
              {/if}
            </div>
          {:else if friends.length > 0}
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
    <!-- === LAYOUT IMAGEN/GIF (fondo completo) === -->
    <div class="card-media-wrapper">
      <!-- Fondo de color -->
      <div class="option-background">
        <div class="noise-overlay"></div>
        <div class="media-embed-background">
          <MediaEmbed 
            url={imageUrl} 
            mode="full"
            width="100%"
            height="100%"
            {autoplay}
          />
        </div>
        <div class="media-gradient-overlay"></div>
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
          <textarea
            class="option-label-edit"
            placeholder="Opción {optionIndex + 1}"
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
          <div class="percentage-display">
            <span class="percentage-value">{Math.round(percentage)}%</span>
            <span class="percentage-label">DE LOS VOTOS</span>
          </div>
          
          {#if mode === 'edit'}
            <div class="edit-buttons">
              <button type="button" class="edit-btn color-btn" style="background-color: {color}" onclick={(e) => { e.stopPropagation(); onColorPickerOpen?.(); }} title="Cambiar color">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
              </button>
              <button type="button" class="edit-btn giphy-btn" onclick={(e) => { e.stopPropagation(); onGiphyPickerOpen?.(); }} title="Buscar GIF">
                <Sparkles class="w-4 h-4" />
              </button>
              {#if showRemoveOption}
                <button type="button" class="edit-btn delete-btn" onclick={(e) => { e.stopPropagation(); onRemoveOption?.(); }} title="Eliminar opción">
                  <Trash2 class="w-4 h-4" />
                </button>
              {/if}
            </div>
          {:else if friends.length > 0}
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
    <!-- === LAYOUT TEXTO PURO (sin área superior) === -->
    <div class="card-text-only" style="background-color: {color};">
      <div class="noise-overlay"></div>
      <div class="card-text-content">
        {#if mode === 'edit'}
          <textarea
            class="option-label-edit"
            placeholder="Opción {optionIndex + 1}"
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
        
        <div class="card-divider-line"></div>
        
        <div class="card-bottom-row">
          <div class="card-percentage">
            <span class="percentage-value">{Math.round(percentage)}%</span>
            <span class="percentage-label">DE LOS VOTOS</span>
          </div>
          
          {#if mode === 'edit'}
            <div class="edit-buttons">
              <button type="button" class="edit-btn color-btn" style="background-color: {color}" onclick={(e) => { e.stopPropagation(); onColorPickerOpen?.(); }} title="Cambiar color">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
              </button>
              <button type="button" class="edit-btn giphy-btn" onclick={(e) => { e.stopPropagation(); onGiphyPickerOpen?.(); }} title="Buscar GIF">
                <Sparkles class="w-4 h-4" />
              </button>
              {#if showRemoveOption}
                <button type="button" class="edit-btn delete-btn" onclick={(e) => { e.stopPropagation(); onRemoveOption?.(); }} title="Eliminar opción">
                  <Trash2 class="w-4 h-4" />
                </button>
              {/if}
            </div>
          {:else if friends.length > 0}
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
  {/if}
</div>

<style>
  .poll-option-card {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border-radius: 32px;
    overflow: hidden;
    border: none;
    padding: 0;
    background: transparent;
    text-align: left;
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
    height: 100%;
    padding: 4px;
    border-radius: 32px;
    overflow: hidden;
  }
  
  .card-video-area {
    flex: 0 0 55%;
    position: relative;
    overflow: hidden;
    background: var(--option-color);
    border-radius: 28px;
  }
  
  .card-video-area :global(.media-embed),
  .card-video-area :global(.embed-container) {
    width: 100% !important;
    height: 100% !important;
  }
  
  .card-video-area :global(iframe) {
    border-radius: 28px !important;
    width: 100% !important;
    height: 100% !important;
  }
  
  .card-video-area :global(.media-embed-container),
  .card-video-area :global(.embed-wrapper),
  .card-video-area :global(div) {
    background: inherit !important;
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
    border-radius: 32px;
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
    height: 100%;
    border-radius: 32px;
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
    text-transform: uppercase;
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
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .option-label-edit {
    background: transparent;
    border: none;
    outline: none;
    color: white;
    font-size: 16px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    line-height: 1.2;
    resize: none;
    width: 100%;
    min-height: 36px;
    max-height: 60px;
  }
  
  .option-label-edit::placeholder {
    color: rgba(255, 255, 255, 0.4);
    text-transform: none;
  }
  
  /* Botón eliminar media */
  .remove-media-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
    width: 32px;
    height: 32px;
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
    transform: scale(1.1);
  }
  
  /* Botones de edición */
  .edit-buttons {
    display: flex;
    gap: 8px;
  }
  
  .edit-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(0, 0, 0, 0.5);
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
  
  .edit-btn.delete-btn:hover {
    background: rgba(220, 38, 38, 0.8);
    border-color: #dc2626;
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
</style>
