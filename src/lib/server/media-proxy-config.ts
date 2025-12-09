/**
 * Configuración del Proxy de Medios para VouTop
 * 
 * Sistema de whitelist de dominios seguros para imágenes, videos y audios
 * Previene abuso y ataques XSS/SSRF
 */

export interface MediaProxyConfig {
  allowedDomains: string[];
  allowAllDomains: boolean; // Si es true, permite cualquier dominio (para imágenes de fuentes confiables)
  allowedMimeTypes: {
    images: string[];
    videos: string[];
    audios: string[];
  };
  maxFileSize: number; // bytes
  cacheMaxAge: number; // segundos
  timeout: number; // ms
  allowedIframeHosts: string[];
}

export const MEDIA_PROXY_CONFIG: MediaProxyConfig = {
  // Por defecto NO permite todos los dominios
  // Solo permite todos si viene con el parámetro trusted=1 (de fuentes confiables como search.app)
  allowAllDomains: false,
  
  // Whitelist de dominios (se usa si allowAllDomains es false y no hay trusted=1)
  allowedDomains: [
    // Servicios de imágenes populares
    'i.imgur.com',
    'imgur.com',
    'live.staticflickr.com',
    'staticflickr.com',
    'upload.wikimedia.org',
    'images.unsplash.com',
    'unsplash.com',
    'cdn.pixabay.com',
    'pixabay.com',
    'picsum.photos',
    
    // Giphy (GIFs animados)
    'media.giphy.com',
    'giphy.com',
    'i.giphy.com',
    'media0.giphy.com',
    'media1.giphy.com',
    'media2.giphy.com',
    'media3.giphy.com',
    'media4.giphy.com',
    
    // CDNs de video populares
    'i.vimeocdn.com',
    'vimeocdn.com',
    'i.ytimg.com',
    'ytimg.com',
    'img.youtube.com',
    
    // CDNs generales
    'cloudinary.com',
    'cloudfront.net',
    'akamaized.net',
    'fastly.net',
    
    // Redes sociales (CDN de imágenes)
    'pbs.twimg.com',
    'scontent.cdninstagram.com',
    'cdninstagram.com',
    'scontent-*.fbcdn.net',
    'fbcdn.net',
    
    // Servicios de UI
    'ui-avatars.com',
    'placehold.co',
    'via.placeholder.com',
    'dummyimage.com',
    
    // Otros servicios conocidos
    'gravatar.com',
    'githubusercontent.com',
    'github.com',
    
    // Servicios de video adicionales
    'dailymotion.com',
    's1.dmcdn.net',
    's2.dmcdn.net',
    'streamable.com',
    'twitch.tv',
    'ttvnw.net',
    'static-cdn.jtvnw.net',
    'jtvnw.net',
    
    // Reddit
    'redd.it',
    'reddit.com',
    'preview.redd.it',
    'external-preview.redd.it',
    
    // ============================================
    // PLATAFORMAS MULTIMEDIA - TODOS LOS SUBDOMINIOS
    // ============================================
    
    // Twitter/X - todos los subdominios
    '*.twimg.com',
    '*.x.com',
    '*.twitter.com',
    '*.fxtwitter.com',
    '*.video.twimg.com',
    'twimg.com',
    'x.com',
    'twitter.com',
    'fxtwitter.com',
    'video.twimg.com',
    
    // TikTok - todos los CDNs globales
    '*.tiktok.com',
    '*.tiktokcdn.com',
    '*.tiktokcdn-eu.com',
    '*.tiktokcdn-us.com',
    '*.tiktokv.com',
    'tiktok.com',
    'tiktokcdn.com',
    'tiktokcdn-eu.com',
    'tiktokcdn-us.com',
    
    // Twitch - todos los subdominios
    '*.twitch.tv',
    '*.ttvnw.net',
    '*.jtvnw.net',
    'twitch.tv',
    'ttvnw.net',
    'jtvnw.net',
    
    // Spotify - todos los CDNs
    '*.spotify.com',
    '*.spotifycdn.com',
    '*.scdn.co',
    'spotify.com',
    'spotifycdn.com',
    'scdn.co',
    
    // SoundCloud - todos los subdominios
    '*.soundcloud.com',
    '*.sndcdn.com',
    'soundcloud.com',
    'sndcdn.com',
    
    // YouTube - todos los subdominios
    '*.youtube.com',
    '*.ytimg.com',
    '*.googlevideo.com',
    'youtube.com',
    'ytimg.com',
    
    // Vimeo - todos los subdominios
    '*.vimeo.com',
    '*.vimeocdn.com',
    'vimeo.com',
    'vimeocdn.com',
    
    // Dailymotion - todos los subdominios
    '*.dailymotion.com',
    '*.dmcdn.net',
    'dailymotion.com',
    'dmcdn.net',
    
    // Deezer - todos los subdominios
    '*.deezer.com',
    '*.dzcdn.net',
    'deezer.com',
    'dzcdn.net',
    
    // Apple Music - todos los subdominios
    '*.apple.com',
    '*.mzstatic.com',
    'apple.com',
    'mzstatic.com',
    
    // Bandcamp - todos los subdominios
    '*.bandcamp.com',
    '*.bcbits.com',
    'bandcamp.com',
    'bcbits.com',
    
    // Discord - todos los subdominios
    '*.discordapp.com',
    '*.discordapp.net',
    '*.discord.com',
    'discordapp.com',
    'discord.com',
    
    // Tenor (GIFs) - todos los subdominios
    '*.tenor.com',
    'tenor.com',
    
    // Imgur - todos los subdominios
    '*.imgur.com',
    'imgur.com',
    
    // Wikipedia/Wikimedia - todos los subdominios
    '*.wikimedia.org',
    '*.wikipedia.org',
    'wikimedia.org',
    'wikipedia.org',
    
    // Otros servicios
    '*.railway.app',
    'railway.app',
    
    // Dominio propio de VouTop
    'voutop.com',
    '*.voutop.com',
    'www.voutop.com',
    'localhost',
    '127.0.0.1'
  ],
  
  // Tipos MIME permitidos
  allowedMimeTypes: {
    images: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
      'image/tiff'
    ],
    videos: [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime'
    ],
    audios: [
      'audio/mpeg',
      'audio/mp3',
      'audio/ogg',
      'audio/wav',
      'audio/webm'
    ]
  },
  
  // Tamaño máximo: 10MB
  maxFileSize: 10 * 1024 * 1024,
  
  // Cache por 7 días
  cacheMaxAge: 7 * 24 * 60 * 60,
  
  // Timeout de 8 segundos
  timeout: 8000,
  
  // Hosts permitidos para iframes (embeds seguros)
  allowedIframeHosts: [
    'www.youtube.com',
    'youtube.com',
    'player.vimeo.com',
    'vimeo.com',
    'open.spotify.com',
    'w.soundcloud.com',
    'soundcloud.com',
    'player.twitch.tv',
    'twitch.tv',
    'player.megaphone.fm',
    'megaphone.fm',
    'omny.fm'
  ]
};

/**
 * Verifica si un dominio está permitido
 * Si allowAllDomains es true, permite cualquier dominio (URLs ya validadas desde fuentes confiables)
 */
export function isDomainAllowed(url: string): boolean {
  // Si allowAllDomains está habilitado, permitir todo
  if (MEDIA_PROXY_CONFIG.allowAllDomains) {
    return true;
  }
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    return MEDIA_PROXY_CONFIG.allowedDomains.some(domain => {
      // Soporte para wildcards (*.fbcdn.net)
      if (domain.startsWith('*.')) {
        const baseDomain = domain.substring(2);
        return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
      }
      
      // Match exacto o subdominio
      return hostname === domain || hostname.endsWith('.' + domain);
    });
  } catch {
    return false;
  }
}

/**
 * Verifica si un tipo MIME es permitido
 */
export function isMimeTypeAllowed(contentType: string): boolean {
  const lowerType = contentType.toLowerCase().split(';')[0].trim();
  
  return [
    ...MEDIA_PROXY_CONFIG.allowedMimeTypes.images,
    ...MEDIA_PROXY_CONFIG.allowedMimeTypes.videos,
    ...MEDIA_PROXY_CONFIG.allowedMimeTypes.audios
  ].includes(lowerType);
}

/**
 * Verifica si un host de iframe es seguro
 */
export function isIframeHostAllowed(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    return MEDIA_PROXY_CONFIG.allowedIframeHosts.some(host => {
      return hostname === host || hostname.endsWith('.' + host);
    });
  } catch {
    return false;
  }
}

/**
 * Sanitiza una URL de iframe para prevenir XSS
 */
export function sanitizeIframeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Remover parámetros potencialmente peligrosos
    const dangerousParams = ['javascript', 'data', 'vbscript', 'onclick', 'onerror', 'onload'];
    dangerousParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.delete(param);
      }
    });
    
    // Solo permitir https para iframes
    if (urlObj.protocol !== 'https:') {
      urlObj.protocol = 'https:';
    }
    
    return urlObj.href;
  } catch {
    throw new Error('URL de iframe inválida');
  }
}

/**
 * Obtiene headers seguros para el fetch
 * @param url - URL del recurso para determinar headers específicos
 */
export function getSecureFetchHeaders(url?: string): HeadersInit {
  const baseHeaders: Record<string, string> = {
    'Accept': 'image/*,video/*,audio/*,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
  
  // Headers específicos por plataforma
  if (url) {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // TikTok necesita User-Agent de navegador y Referer
    if (hostname.includes('tiktok')) {
      baseHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      baseHeaders['Referer'] = 'https://www.tiktok.com/';
      baseHeaders['Origin'] = 'https://www.tiktok.com';
    }
    // Spotify CDN puede requerir headers similares
    else if (hostname.includes('spotify') || hostname.includes('scdn.co')) {
      baseHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      baseHeaders['Referer'] = 'https://open.spotify.com/';
    }
    // Default User-Agent para otros servicios
    else {
      baseHeaders['User-Agent'] = 'Mozilla/5.0 (compatible; VouTopBot/1.0; +https://voutop.app)';
    }
  } else {
    baseHeaders['User-Agent'] = 'Mozilla/5.0 (compatible; VouTopBot/1.0; +https://voutop.app)';
  }
  
  return baseHeaders;
}
