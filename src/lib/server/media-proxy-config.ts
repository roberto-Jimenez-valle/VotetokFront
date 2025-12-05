/**
 * Configuración del Proxy de Medios para VouTop
 * 
 * Sistema de whitelist de dominios seguros para imágenes, videos y audios
 * Previene abuso y ataques XSS/SSRF
 */

export interface MediaProxyConfig {
  allowedDomains: string[];
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
  // Whitelist de dominios permitidos para imágenes
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
    
    // Twitter/X adicionales
    'twimg.com',
    'x.com',
    
    // TikTok - todos los subdominios de CDN
    'tiktokcdn.com',
    'tiktok.com',
    'p16-sign-va.tiktokcdn.com',
    'p16-sign-sg.tiktokcdn.com',
    'p77-sign-va.tiktokcdn.com',
    'p16-sign.tiktokcdn-us.com',
    'p19-sign.tiktokcdn-us.com',
    'v16-webapp.tiktok.com',
    'v19-webapp.tiktok.com',
    
    // Twitter/X - CDN de imágenes
    'pbs.twimg.com',
    'abs.twimg.com',
    'video.twimg.com',
    'ton.twimg.com',
    
    // Spotify
    'scdn.co',
    'i.scdn.co',
    'spotify.com',
    
    // SoundCloud
    'sndcdn.com',
    'i1.sndcdn.com',
    
    // Deezer
    'dzcdn.net',
    'cdn-images.dzcdn.net',
    'e-cdns-images.dzcdn.net',
    
    // Apple Music
    'mzstatic.com',
    'is1-ssl.mzstatic.com',
    'is2-ssl.mzstatic.com',
    'is3-ssl.mzstatic.com',
    'is4-ssl.mzstatic.com',
    'is5-ssl.mzstatic.com',
    
    // Bandcamp
    'bcbits.com',
    'f4.bcbits.com',
    
    // Discord
    'cdn.discordapp.com',
    'media.discordapp.net',
    
    // Tenor (GIFs)
    'tenor.com',
    'media.tenor.com',
    
    // Imgur adicionales
    'i.stack.imgur.com',
    
    // Wikipedia/Wikimedia adicionales
    'wikimedia.org',
    'wikipedia.org',
    
    // Otros servicios
    'railway.com',
    'railway.app'
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
 * Verifica si un dominio está en la whitelist
 */
export function isDomainAllowed(url: string): boolean {
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
 */
export function getSecureFetchHeaders(): HeadersInit {
  return {
    'User-Agent': 'VouTop-MediaProxy/1.0 (https://voutop.app)',
    'Accept': 'image/*,video/*,audio/*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
}
