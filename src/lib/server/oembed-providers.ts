/**
 * Proveedores de oEmbed conocidos
 * Configuración de endpoints para servicios populares
 */

export interface OEmbedProvider {
  name: string;
  urlPatterns: RegExp[];
  endpoint: string;
  requiresApiKey?: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

export const OEMBED_PROVIDERS: OEmbedProvider[] = [
  // YouTube (incluye Shorts y Live)
  {
    name: 'YouTube',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
      /^https?:\/\/(?:www\.)?youtu\.be\/([^?]+)/,
      /^https?:\/\/(?:www\.)?youtube\.com\/embed\/([^?]+)/,
      /^https?:\/\/(?:www\.)?youtube\.com\/shorts\/([^?]+)/,
      /^https?:\/\/(?:www\.)?youtube\.com\/live\/([^?]+)/
    ],
    endpoint: 'https://www.youtube.com/oembed',
    maxWidth: 1280,
    maxHeight: 720
  },
  
  // Vimeo
  {
    name: 'Vimeo',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/,
      /^https?:\/\/player\.vimeo\.com\/video\/(\d+)/
    ],
    endpoint: 'https://vimeo.com/api/oembed.json',
    maxWidth: 1280,
    maxHeight: 720
  },
  
  // Twitter/X - Manejado especialmente en link-preview/+server.ts
  // El oEmbed de Twitter no devuelve thumbnail, se usa Open Graph en fetchSpecialPlatformData
  
  // Spotify - height=232 para versión medium
  {
    name: 'Spotify',
    urlPatterns: [
      /^https?:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\/([^?]+)/
    ],
    endpoint: 'https://open.spotify.com/oembed',
    maxWidth: 400,
    maxHeight: 232
  },
  
  // SoundCloud
  {
    name: 'SoundCloud',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?soundcloud\.com\/.+/
    ],
    endpoint: 'https://soundcloud.com/oembed',
    maxWidth: 500,
    maxHeight: 400
  },
  
  // Flickr
  {
    name: 'Flickr',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?flickr\.com\/photos\/.+/,
      /^https?:\/\/flic\.kr\/.+/
    ],
    endpoint: 'https://www.flickr.com/services/oembed',
    maxWidth: 1024
  },
  
  // Instagram (mejorado con más variantes)
  {
    name: 'Instagram',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?instagram\.com\/(p|reel|tv|reels)\/([^/?]+)/,
      /^https?:\/\/(?:www\.)?instagram\.com\/stories\/[^/]+\/\d+/,
      /^https?:\/\/instagr\.am\/(p|reel)\/([^/?]+)/
    ],
    endpoint: 'https://api.instagram.com/oembed',
    maxWidth: 658
  },
  
  // TikTok - Manejado especialmente en link-preview/+server.ts
  // El oEmbed de TikTok es inestable (400/404), se maneja en fetchSpecialPlatformData
  
  // Twitch - Sin oEmbed público, usar Open Graph fallback
  // Se deja comentado porque requiere autenticación
  // {
  //   name: 'Twitch',
  //   urlPatterns: [...],
  //   endpoint: 'https://api.twitch.tv/v5/oembed' // Requiere Client-ID header
  // },
  
  // Reddit
  {
    name: 'Reddit',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?reddit\.com\/r\/[^/]+\/comments\/.+/
    ],
    endpoint: 'https://www.reddit.com/oembed'
  },
  
  // Giphy
  {
    name: 'Giphy',
    urlPatterns: [
      /^https?:\/\/giphy\.com\/gifs\/.+/,
      /^https?:\/\/media\.giphy\.com\/media\/.+/
    ],
    endpoint: 'https://giphy.com/services/oembed'
  },
  
  // Imgur
  {
    name: 'Imgur',
    urlPatterns: [
      /^https?:\/\/(?:i\.)?imgur\.com\/([a-zA-Z0-9]+)/,
      /^https?:\/\/imgur\.com\/gallery\/([a-zA-Z0-9]+)/,
      /^https?:\/\/imgur\.com\/a\/([a-zA-Z0-9]+)/
    ],
    endpoint: 'https://api.imgur.com/oembed'
  },
  
  // Facebook (posts y videos)
  {
    name: 'Facebook',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?facebook\.com\/[^/]+\/posts\/[^/]+/,
      /^https?:\/\/(?:www\.)?facebook\.com\/[^/]+\/videos\/[^/]+/,
      /^https?:\/\/(?:www\.)?facebook\.com\/watch\/\?v=\d+/,
      /^https?:\/\/(?:www\.)?fb\.watch\/.+/
    ],
    endpoint: 'https://www.facebook.com/plugins/post/oembed.json'
  },
  
  // LinkedIn
  {
    name: 'LinkedIn',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?linkedin\.com\/posts\/.+/,
      /^https?:\/\/(?:www\.)?linkedin\.com\/feed\/update\/.+/,
      /^https?:\/\/(?:www\.)?linkedin\.com\/embed\/feed\/update\/.+/
    ],
    endpoint: 'https://www.linkedin.com/oembed'
  },
  
  // Pinterest
  {
    name: 'Pinterest',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?pinterest\.com\/pin\/\d+/,
      /^https?:\/\/(?:www\.)?pinterest\.[a-z.]+\/pin\/\d+/,
      /^https?:\/\/pin\.it\/.+/
    ],
    endpoint: 'https://www.pinterest.com/oembed.json'
  },
  
  // Dailymotion
  {
    name: 'Dailymotion',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?dailymotion\.com\/video\/[^_]+/,
      /^https?:\/\/dai\.ly\/.+/
    ],
    endpoint: 'https://www.dailymotion.com/services/oembed',
    maxWidth: 1280,
    maxHeight: 720
  },
  
  // Kickstarter
  {
    name: 'Kickstarter',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?kickstarter\.com\/projects\/.+/
    ],
    endpoint: 'https://www.kickstarter.com/services/oembed'
  },
  
  // CodePen
  {
    name: 'CodePen',
    urlPatterns: [
      /^https?:\/\/codepen\.io\/[^/]+\/(?:pen|details)\/[^/]+/
    ],
    endpoint: 'https://codepen.io/api/oembed'
  },
  
  // SlideShare
  {
    name: 'SlideShare',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?slideshare\.net\/.+/,
      /^https?:\/\/(?:es|fr|de|pt)\.slideshare\.net\/.+/
    ],
    endpoint: 'https://www.slideshare.net/api/oembed/2'
  },
  
  // Scribd
  {
    name: 'Scribd',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?scribd\.com\/document\/.+/,
      /^https?:\/\/(?:www\.)?scribd\.com\/doc\/.+/
    ],
    endpoint: 'https://www.scribd.com/services/oembed'
  },
  
  // Mixcloud
  {
    name: 'Mixcloud',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?mixcloud\.com\/.+/
    ],
    endpoint: 'https://www.mixcloud.com/oembed/'
  },
  
  // Datawrapper (visualizaciones)
  {
    name: 'Datawrapper',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?datawrapper\.dwcdn\.net\/.+/,
      /^https?:\/\/datawrapper\.de\/.+/
    ],
    endpoint: 'https://api.datawrapper.de/v3/oembed/'
  },
  
  // Coub (videos en loop)
  {
    name: 'Coub',
    urlPatterns: [
      /^https?:\/\/coub\.com\/view\/.+/
    ],
    endpoint: 'https://coub.com/api/oembed.json'
  },
  
  // Deezer - Sin oEmbed público, usar Open Graph fallback
  // La API de Deezer pública se usa directamente en el frontend
  
  // Apple Music - Sin oEmbed público, usar Open Graph fallback
  // Apple no tiene endpoint oEmbed público
  
  // Bandcamp
  {
    name: 'Bandcamp',
    urlPatterns: [
      /^https?:\/\/[^.]+\.bandcamp\.com\/(track|album)\/.+/,
      /^https?:\/\/bandcamp\.com\/[^/]+/
    ],
    endpoint: 'https://bandcamp.com/oembed',
    maxWidth: 400,
    maxHeight: 120
  }
];

/**
 * Encuentra el proveedor de oEmbed para una URL
 */
export function findOEmbedProvider(url: string): OEmbedProvider | null {
  for (const provider of OEMBED_PROVIDERS) {
    for (const pattern of provider.urlPatterns) {
      if (pattern.test(url)) {
        return provider;
      }
    }
  }
  return null;
}

/**
 * Construye la URL del endpoint oEmbed con parámetros
 */
export function buildOEmbedUrl(provider: OEmbedProvider, targetUrl: string): string {
  const params = new URLSearchParams({
    url: targetUrl,
    format: 'json'
  });
  
  if (provider.maxWidth) {
    params.set('maxwidth', provider.maxWidth.toString());
  }
  
  if (provider.maxHeight) {
    params.set('maxheight', provider.maxHeight.toString());
  }
  
  return `${provider.endpoint}?${params.toString()}`;
}

/**
 * Lista de dominios seguros conocidos (fallback cuando no hay API keys)
 * Esta lista se usa como respaldo si la verificación automática no está disponible
 * 
 * NOTA: La verificación principal ahora usa:
 * - Lista Tranco (Top 1M sitios) - Autoridad
 * - Google Safe Browsing API - Seguridad
 * - VirusTotal API - Reputación
 * 
 * Ver: src/lib/server/domain-verification.ts
 */
export const SAFE_DOMAINS_FALLBACK = [
  // Plataformas principales (siempre seguras)
  'youtube.com',
  'youtu.be',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'spotify.com',
  'soundcloud.com',
  'vimeo.com',
  'twitch.tv',
  'reddit.com',
  'github.com',
  'wikipedia.org',
  'google.com',
  'microsoft.com',
  'apple.com',
  'amazon.com',
  'linkedin.com',
  'netflix.com'
];

/**
 * Verifica si un dominio es seguro (versión síncrona - fallback)
 * 
 * NOTA: Para verificación completa usar isSafeDomainAuto() de domain-verification.ts
 * Esta función es un fallback rápido para cuando no se puede esperar la verificación async
 */
export function isSafeDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Verificar contra lista de fallback
    return SAFE_DOMAINS_FALLBACK.some(domain => {
      return hostname === domain || hostname.endsWith('.' + domain);
    });
  } catch {
    return false;
  }
}

/**
 * Re-exportar funciones de verificación automática
 * Usar estas para verificación completa con APIs externas
 */
export { 
  verifyDomain, 
  quickVerify, 
  isSafeDomainAuto,
  getTrancoRank,
  getVerificationStats 
} from './domain-verification';
