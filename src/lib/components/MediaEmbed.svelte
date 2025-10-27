<script lang="ts">
  import { onMount } from 'svelte';
  
  interface Props {
    url: string;
    width?: string;
    height?: string;
    mode?: 'full' | 'preview'; // full = 180px alto, preview = 130px
  }
  
  let { url, width = '100%', height = 'auto', mode = 'preview' }: Props = $props();
  
  let embedType: string = $state('');
  let embedHTML: string = $state('');
  let metadata: any = $state(null);
  let loading: boolean = $state(true);
  let error: boolean = $state(false);
  
  // Detectar tipo de URL y generar embed
  async function detectAndGenerateEmbed(url: string) {
    if (!url || url.trim() === '') {
      console.log('[MediaEmbed] URL vacía, no se procesará');
      loading = false;
      error = true;
      return;
    }
    
    console.log('[MediaEmbed] Procesando URL:', url);
    loading = true;
    error = false;
    
    try {
      // YouTube
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        embedType = 'youtube';
        const videoId = extractYouTubeId(url);
        console.log('[MediaEmbed] YouTube detectado - VideoID:', videoId);
        if (videoId) {
          embedHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&controls=1" allowfullscreen style="width:100%;height:100%;border:none;border-radius:12px;"></iframe>`;
          console.log('[MediaEmbed] YouTube iframe creado');
        } else {
          console.error('[MediaEmbed] No se pudo extraer el videoId de:', url);
          error = true;
        }
        loading = false;
        return;
      }
      
      // Spotify
      if (url.includes('spotify.com')) {
        embedType = 'spotify';
        let embedUrl = url.replace('open.spotify.com', 'open.spotify.com/embed');
        embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'utm_source=generator';
        if (mode === 'full') embedUrl += '&visual=true';
        embedHTML = `<iframe src="${embedUrl}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" style="width:100%;height:100%;border:none;border-radius:12px;"></iframe>`;
        loading = false;
        return;
      }
      
      // Vimeo
      if (url.includes('vimeo.com')) {
        embedType = 'vimeo';
        const videoId = url.split('/').pop()?.split('?')[0];
        if (videoId) {
          embedHTML = `<iframe src="https://player.vimeo.com/video/${videoId}?api=1&controls=1" allow="autoplay; fullscreen; picture-in-picture" style="width:100%;height:100%;border:none;border-radius:12px;"></iframe>`;
        }
        loading = false;
        return;
      }
      
      // SoundCloud
      if (url.includes('soundcloud.com')) {
        embedType = 'soundcloud';
        embedHTML = `<iframe src="https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true" allow="autoplay" style="width:100%;height:100%;border:none;border-radius:12px;"></iframe>`;
        loading = false;
        return;
      }
      
      // Twitch
      if (url.includes('twitch.tv')) {
        embedType = 'twitch';
        const videoId = url.split('/videos/')[1]?.split('?')[0];
        if (videoId) {
          embedHTML = `<iframe src="https://player.twitch.tv/?video=${videoId}&parent=${window.location.hostname}&autoplay=false" allowfullscreen style="width:100%;height:100%;border:none;border-radius:12px;"></iframe>`;
        }
        loading = false;
        return;
      }
      
      // Detectar imágenes directas
      if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) {
        embedType = 'generic';
        metadata = {
          title: 'Imagen',
          description: new URL(url).hostname,
          image: url,
          url: url
        };
        loading = false;
        console.log('[MediaEmbed] Detectada imagen directa');
        return;
      }
      
      // Instagram, TikTok, Twitter/X, Facebook, Pinterest, y otros: usar metadatos
      embedType = 'generic';
      console.log('[MediaEmbed] Fetching metadata para:', url);
      await fetchMetadata(url);
      
    } catch (err) {
      console.error('[MediaEmbed] Error generating embed:', err);
      error = true;
      loading = false;
    }
  }
  
  // Extraer ID de YouTube
  function extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
  
  // Obtener metadatos con Microlink con timeout
  async function fetchMetadata(url: string) {
    try {
      // Timeout de 8 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      console.log('[MediaEmbed] Llamando a Microlink API...');
      const response = await fetch(
        `https://api.microlink.io/?url=${encodeURIComponent(url)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      
      const data = await response.json();
      console.log('[MediaEmbed] Respuesta de Microlink:', data);
      
      if (data.status === 'success' && data.data) {
        let imageUrl = data.data.image?.url || '';
        
        // Fallbacks específicos por plataforma
        if (url.includes('instagram.com')) {
          if (!imageUrl || imageUrl.includes('static/images')) {
            imageUrl = 'https://i.imgur.com/qj8nF2J.jpeg';
          }
        } else if (url.includes('tiktok.com')) {
          // TikTok suele tener imagen en los metadatos
          if (!imageUrl) {
            imageUrl = 'https://placehold.co/220x130/000/FFF?text=TikTok';
          }
        } else if (url.includes('twitter.com') || url.includes('x.com')) {
          // Twitter/X suele tener imagen
          if (!imageUrl) {
            imageUrl = 'https://placehold.co/220x130/1DA1F2/FFF?text=X';
          }
        } else if (url.includes('facebook.com')) {
          if (!imageUrl) {
            imageUrl = 'https://placehold.co/220x130/1877F2/FFF?text=Facebook';
          }
        } else if (url.includes('pinterest.com')) {
          if (!imageUrl) {
            imageUrl = 'https://placehold.co/220x130/E60023/FFF?text=Pinterest';
          }
        }
        
        // Fallback genérico
        if (!imageUrl) {
          imageUrl = 'https://placehold.co/220x130/333/FFF?text=?';
        }
        
        metadata = {
          title: data.data.title || 'Publicación detectada',
          description: data.data.description || new URL(url).hostname,
          image: imageUrl,
          url: url
        };
        console.log('[MediaEmbed] Metadata creada:', metadata);
      } else {
        // Fallback si Microlink falla
        console.log('[MediaEmbed] Microlink falló, usando fallback');
        createFallbackMetadata(url);
      }
    } catch (err) {
      console.error('[MediaEmbed] Error fetching metadata:', err);
      // Si falla por timeout o error, crear metadata fallback
      createFallbackMetadata(url);
    } finally {
      loading = false;
    }
  }
  
  // Crear metadata de fallback
  function createFallbackMetadata(url: string) {
    try {
      const hostname = new URL(url).hostname;
      let placeholder = 'https://placehold.co/220x130/333/FFF?text=?';
      let title = 'Contenido';
      
      if (url.includes('instagram.com')) {
        placeholder = 'https://placehold.co/220x130/E4405F/FFF?text=IG';
        title = 'Instagram';
      } else if (url.includes('tiktok.com')) {
        placeholder = 'https://placehold.co/220x130/000/FFF?text=TikTok';
        title = 'TikTok';
      } else if (url.includes('twitter.com') || url.includes('x.com')) {
        placeholder = 'https://placehold.co/220x130/1DA1F2/FFF?text=X';
        title = 'X (Twitter)';
      } else if (url.includes('facebook.com')) {
        placeholder = 'https://placehold.co/220x130/1877F2/FFF?text=FB';
        title = 'Facebook';
      }
      
      metadata = {
        title: title,
        description: hostname,
        image: placeholder,
        url: url
      };
    } catch {
      error = true;
    }
  }
  
  // Detectar cuando cambia la URL
  $effect(() => {
    if (url) {
      detectAndGenerateEmbed(url);
    }
  });
</script>

<div 
  class="media-embed" 
  class:preview-mode={mode === 'preview'}
  class:full-mode={mode === 'full'}
  style="width: {width}; height: {height};"
>
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Cargando preview...</span>
    </div>
  {:else if error && !metadata}
    <div class="error-state">
      {#if !url || url.trim() === ''}
        <span>⚠️ No hay URL para mostrar</span>
      {:else}
        <span>⚠️ Error al cargar contenido</span>
        <a href={url} target="_blank" rel="noopener noreferrer" class="error-link">
          Abrir enlace ↗
        </a>
      {/if}
    </div>
  {:else if embedType === 'youtube' || embedType === 'spotify' || embedType === 'vimeo' || embedType === 'soundcloud' || embedType === 'twitch'}
    <div class="embed-container">
      {@html embedHTML}
    </div>
  {:else if embedType === 'generic' && metadata}
    <button 
      class="mini-card" 
      onclick={() => window.open(metadata.url, '_blank')}
      type="button"
      aria-label={`Abrir ${metadata.title}`}
    >
      <img 
        src={metadata.image} 
        alt={metadata.title}
        onerror={(e) => {
          const img = e.target as HTMLImageElement;
          if (img.src !== 'https://placehold.co/220x130/333/FFF?text=?') {
            img.src = 'https://placehold.co/220x130/333/FFF?text=?';
          }
        }}
      />
      <div class="info">
        <h4>{metadata.title}</h4>
        <p>{metadata.description}</p>
      </div>
    </button>
  {/if}
</div>

<style>
  .media-embed {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    background: #2c2c2e;
    display: block;
  }
  
  .preview-mode {
    width: 100%;
    height: 100%;
    min-height: 130px;
  }
  
  .full-mode {
    width: 100%;
    height: 100%;
    min-height: 180px;
  }
  
  .loading-state,
  .error-state {
    width: 100%;
    height: 100%;
    min-height: 130px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
    padding: 20px;
    box-sizing: border-box;
  }
  
  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .embed-container {
    width: 100%;
    height: 100%;
    position: relative;
  }
  
  .mini-card {
    width: 100%;
    height: 100%;
    background: #2c2c2e;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: transform 0.2s;
    padding: 0;
    display: block;
  }
  
  .mini-card:hover {
    transform: scale(1.02);
  }
  
  .mini-card img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.9;
    transition: opacity 0.3s;
  }
  
  .mini-card:hover img {
    opacity: 0.75;
  }
  
  .mini-card .info {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    padding: 6px 8px;
    box-sizing: border-box;
  }
  
  .mini-card h4 {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    color: white;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .mini-card p {
    margin: 2px 0 0;
    font-size: 9px;
    color: #ccc;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .error-state {
    color: rgba(255, 100, 100, 0.8);
  }
  
  .error-link {
    color: rgba(100, 150, 255, 0.9);
    text-decoration: none;
    font-size: 0.8rem;
    margin-top: 4px;
    padding: 4px 12px;
    border: 1px solid rgba(100, 150, 255, 0.3);
    border-radius: 6px;
    transition: all 0.2s;
  }
  
  .error-link:hover {
    background: rgba(100, 150, 255, 0.1);
    border-color: rgba(100, 150, 255, 0.6);
  }
</style>
