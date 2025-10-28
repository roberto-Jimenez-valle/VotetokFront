/**
 * Validador y Sanitizador de iframes
 * 
 * Previene ataques XSS y garantiza que solo se embeben contenidos seguros
 */

export interface IframeValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  error?: string;
  platform?: string;
}

/**
 * Hosts permitidos para iframes embebidos
 */
const ALLOWED_IFRAME_HOSTS = [
  // Video
  'www.youtube.com',
  'youtube.com',
  'player.vimeo.com',
  'vimeo.com',
  'player.twitch.tv',
  'twitch.tv',
  
  // Audio
  'open.spotify.com',
  'w.soundcloud.com',
  'soundcloud.com',
  'player.megaphone.fm',
  'megaphone.fm',
  'omny.fm',
  
  // Social (solo embeds oficiales)
  'www.instagram.com',
  'platform.twitter.com',
  'www.tiktok.com',
  
  // Otros
  'www.slideshare.net',
  'codepen.io'
];

/**
 * Parámetros peligrosos que deben eliminarse
 */
const DANGEROUS_PARAMS = [
  'javascript',
  'data',
  'vbscript',
  'onclick',
  'onerror',
  'onload',
  'onmouseover',
  'onfocus',
  'onblur',
  'eval',
  'script'
];

/**
 * Verifica si un host de iframe está permitido
 */
export function isIframeHostAllowed(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    return ALLOWED_IFRAME_HOSTS.some(host => {
      return hostname === host || hostname.endsWith('.' + host);
    });
  } catch {
    return false;
  }
}

/**
 * Detecta la plataforma del iframe
 */
export function detectPlatform(url: string): string | null {
  const hostname = new URL(url).hostname.toLowerCase();
  
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    return 'youtube';
  }
  if (hostname.includes('vimeo.com')) {
    return 'vimeo';
  }
  if (hostname.includes('spotify.com')) {
    return 'spotify';
  }
  if (hostname.includes('soundcloud.com')) {
    return 'soundcloud';
  }
  if (hostname.includes('twitch.tv')) {
    return 'twitch';
  }
  if (hostname.includes('instagram.com')) {
    return 'instagram';
  }
  if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
    return 'twitter';
  }
  if (hostname.includes('tiktok.com')) {
    return 'tiktok';
  }
  
  return 'generic';
}

/**
 * Sanitiza una URL de iframe
 * Elimina parámetros peligrosos y fuerza HTTPS
 */
export function sanitizeIframeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // 1. Forzar HTTPS
    if (urlObj.protocol !== 'https:') {
      urlObj.protocol = 'https:';
    }
    
    // 2. Eliminar parámetros peligrosos
    DANGEROUS_PARAMS.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.delete(param);
      }
    });
    
    // 3. Eliminar fragmentos potencialmente peligrosos
    if (urlObj.hash && urlObj.hash.includes('javascript:')) {
      urlObj.hash = '';
    }
    
    return urlObj.href;
  } catch (error) {
    throw new Error('URL inválida para sanitizar');
  }
}

/**
 * Valida y sanitiza una URL de iframe completa
 */
export function validateAndSanitizeIframe(url: string): IframeValidationResult {
  // 1. Validar formato básico
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      error: 'URL vacía o inválida'
    };
  }
  
  // 2. Intentar parsear la URL
  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    return {
      isValid: false,
      error: 'Formato de URL inválido'
    };
  }
  
  // 3. Verificar protocolo
  if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
    return {
      isValid: false,
      error: 'Protocolo no permitido (solo HTTP/HTTPS)'
    };
  }
  
  // 4. Verificar host permitido
  if (!isIframeHostAllowed(url)) {
    return {
      isValid: false,
      error: `Host no permitido: ${urlObj.hostname}`
    };
  }
  
  // 5. Detectar plataforma
  const platform = detectPlatform(url);
  
  // 6. Sanitizar URL
  try {
    const sanitizedUrl = sanitizeIframeUrl(url);
    
    return {
      isValid: true,
      sanitizedUrl,
      platform: platform || undefined
    };
  } catch (error: any) {
    return {
      isValid: false,
      error: error.message || 'Error al sanitizar URL'
    };
  }
}

/**
 * Genera atributos seguros para un iframe
 */
export function getSecureIframeAttributes(url: string): {
  src: string;
  sandbox: string;
  allow: string;
  referrerpolicy: string;
  loading: string;
} {
  const platform = detectPlatform(url);
  
  // Sandbox básico (permite scripts y same-origin)
  let sandbox = 'allow-scripts allow-same-origin';
  
  // Allow basado en la plataforma
  let allow = '';
  
  switch (platform) {
    case 'youtube':
    case 'vimeo':
      sandbox += ' allow-presentation allow-fullscreen';
      allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      break;
      
    case 'spotify':
    case 'soundcloud':
      sandbox += ' allow-presentation';
      allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      break;
      
    case 'twitch':
      sandbox += ' allow-presentation allow-fullscreen';
      allow = 'autoplay; fullscreen; picture-in-picture';
      break;
      
    default:
      allow = 'autoplay; encrypted-media';
  }
  
  return {
    src: sanitizeIframeUrl(url),
    sandbox,
    allow,
    referrerpolicy: 'no-referrer',
    loading: 'lazy'
  };
}

/**
 * Valida que un embed code HTML sea seguro
 * Previene inyección de scripts maliciosos
 */
export function validateEmbedCode(embedCode: string): {
  isValid: boolean;
  error?: string;
  sanitized?: string;
} {
  if (!embedCode || typeof embedCode !== 'string') {
    return { isValid: false, error: 'Código embed vacío' };
  }
  
  // 1. Verificar que sea un iframe
  if (!embedCode.includes('<iframe')) {
    return { isValid: false, error: 'No es un iframe válido' };
  }
  
  // 2. Extraer la URL del src
  const srcMatch = embedCode.match(/src=["']([^"']+)["']/i);
  if (!srcMatch) {
    return { isValid: false, error: 'No se encontró atributo src' };
  }
  
  const srcUrl = srcMatch[1];
  
  // 3. Validar la URL
  const validation = validateAndSanitizeIframe(srcUrl);
  if (!validation.isValid) {
    return { isValid: false, error: validation.error };
  }
  
  // 4. Generar iframe seguro
  const attrs = getSecureIframeAttributes(srcUrl);
  const safeIframe = `<iframe src="${attrs.src}" sandbox="${attrs.sandbox}" allow="${attrs.allow}" referrerpolicy="${attrs.referrerpolicy}" loading="${attrs.loading}" style="width:100%;height:100%;border:none;border-radius:12px;"></iframe>`;
  
  return {
    isValid: true,
    sanitized: safeIframe
  };
}

/**
 * Convierte URLs de plataformas a sus versiones embed
 */
export function convertToEmbedUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // YouTube
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
    
    // Vimeo
    if (hostname.includes('vimeo.com')) {
      const videoId = urlObj.pathname.split('/').pop();
      if (videoId) {
        return `https://player.vimeo.com/video/${videoId}`;
      }
    }
    
    // Spotify
    if (hostname.includes('spotify.com')) {
      return url.replace('open.spotify.com', 'open.spotify.com/embed');
    }
    
    // SoundCloud
    if (hostname.includes('soundcloud.com') && !hostname.includes('w.soundcloud.com')) {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}`;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Extrae ID de video de YouTube
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}
