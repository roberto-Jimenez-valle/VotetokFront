interface Metadata {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  siteName?: string;
  type?: string;
}

/**
 * Dominios que necesitan proxy
 * (excluyendo placeholders que funcionan sin CORS)
 */
const NO_PROXY_DOMAINS = [
  'picsum.photos',
  'placehold.co',
  'via.placeholder.com',
  'ui-avatars.com',
  'dummyimage.com'
];

/**
 * Convierte una URL de imagen para usar el proxy si es necesario
 * (versión servidor - solo retorna la URL, el cliente hace el fetch)
 */
function shouldUseProxy(imageUrl: string): boolean {
  if (!imageUrl) return false;
  
  try {
    const hostname = new URL(imageUrl).hostname.toLowerCase();
    return !NO_PROXY_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * Marca una URL para que el cliente sepa que debe usar el proxy
 * El cliente (MediaEmbed) aplicará el proxy automáticamente
 */
function prepareImageUrl(imageUrl: string): string {
  if (!imageUrl) return imageUrl;
  
  // El cliente (MediaEmbed) ya maneja el proxy automáticamente
  // Solo retornamos la URL original
  return imageUrl;
}

// Función para extraer metadatos directamente del HTML (método LinkedIn)
async function fetchMetadataFromHTML(url: string): Promise<Metadata | null> {
  try {
    console.log('[Metadata HTML] Fetching HTML from:', url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log('[Metadata HTML] HTTP error:', response.status);
      return null;
    }
    
    const html = await response.text();
    console.log('[Metadata HTML] HTML fetched, length:', html.length);
    
    // Extraer meta tags usando regex (más rápido que parser completo)
    const metadata: Metadata = { url };
    
    // Open Graph tags (probar ambos órdenes de atributos)
    const ogTitle = html.match(/<meta\s+(?:property=["']og:title["']\s+content=["']([^"']+)["']|content=["']([^"']+)["']\s+property=["']og:title["'])/i);
    const ogDescription = html.match(/<meta\s+(?:property=["']og:description["']\s+content=["']([^"']+)["']|content=["']([^"']+)["']\s+property=["']og:description["'])/i);
    const ogImage = html.match(/<meta\s+(?:property=["']og:image(?::secure_url)?["']\s+content=["']([^"']+)["']|content=["']([^"']+)["']\s+property=["']og:image(?::secure_url)?["'])/i);
    const ogSiteName = html.match(/<meta\s+(?:property=["']og:site_name["']\s+content=["']([^"']+)["']|content=["']([^"']+)["']\s+property=["']og:site_name["'])/i);
    
    // Twitter Card tags (probar ambos órdenes)
    const twitterTitle = html.match(/<meta\s+(?:name=["']twitter:title["']\s+content=["']([^"']+)["']|content=["']([^"']+)["']\s+name=["']twitter:title["'])/i);
    const twitterDescription = html.match(/<meta\s+(?:name=["']twitter:description["']\s+content=["']([^"']+)["']|content=["']([^"']+)["']\s+name=["']twitter:description["'])/i);
    const twitterImage = html.match(/<meta\s+(?:name=["']twitter:image(?::src)?["']\s+content=["']([^"']+)["']|content=["']([^"']+)["']\s+name=["']twitter:image(?::src)?["'])/i);
    
    // Regular meta tags (fallback)
    const metaDescription = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const pageTitle = html.match(/<title>([^<]+)<\/title>/i);
    
    // Asignar valores con prioridad: OG > Twitter > Regular
    // Los regex tienen 2 grupos de captura alternativos, capturamos el que tenga valor
    metadata.title = ogTitle?.[1] || ogTitle?.[2] || twitterTitle?.[1] || twitterTitle?.[2] || pageTitle?.[1] || extractTitleFromUrl(url);
    metadata.description = ogDescription?.[1] || ogDescription?.[2] || twitterDescription?.[1] || twitterDescription?.[2] || metaDescription?.[1] || extractDescriptionFromUrl(url);
    const rawImageUrl = ogImage?.[1] || ogImage?.[2] || twitterImage?.[1] || twitterImage?.[2] || getPlatformFallback(url);
    metadata.image = prepareImageUrl(rawImageUrl);
    metadata.siteName = ogSiteName?.[1] || ogSiteName?.[2] || new URL(url).hostname;
    metadata.type = 'website';
    
    // Limpiar HTML entities
    if (metadata.title) {
      metadata.title = decodeHTMLEntities(metadata.title);
      // Truncar títulos muy largos
      if (metadata.title.length > 100) {
        metadata.title = metadata.title.substring(0, 97) + '...';
      }
    }
    if (metadata.description) {
      metadata.description = decodeHTMLEntities(metadata.description);
      // Truncar descripciones muy largas
      if (metadata.description.length > 200) {
        metadata.description = metadata.description.substring(0, 197) + '...';
      }
    }
    
    console.log('[Metadata HTML] Extracted:', metadata);
    return metadata;
    
  } catch (err: any) {
    console.error('[Metadata HTML] Error:', err.message);
    return null;
  }
}

// Decodificar HTML entities
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' '
  };
  
  return text.replace(/&[a-z0-9#]+;/gi, (match) => entities[match] || match);
}

export async function fetchMetadata(url: string): Promise<Metadata | null> {
  try {
    console.log('[Metadata] Fetching for:', url);
    
    // Primero intentar parsear directamente el HTML (método LinkedIn)
    const htmlMetadata = await fetchMetadataFromHTML(url);
    if (htmlMetadata && htmlMetadata.title && htmlMetadata.title !== 'Contenido') {
      console.log('[Metadata] HTML parsing successful:', htmlMetadata);
      return htmlMetadata;
    }
    
    // Timeout de 8 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    // Usar Microlink API como fallback
    const response = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}`,
      { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'VoteTok/1.0 (https://votetok.app)'
        }
      }
    );
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Microlink API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[Metadata] Microlink response:', data);
    
    if (data.status === 'success' && data.data) {
      let imageUrl = data.data.image?.url || '';
      
      // Procesar y optimizar la imagen
      if (imageUrl) {
        imageUrl = optimizeImageUrl(imageUrl);
      }
      
      // Fallbacks específicos por plataforma
      if (!imageUrl || imageUrl.includes('static/images')) {
        imageUrl = getPlatformFallback(url);
      }
      
      const metadata: Metadata = {
        title: data.data.title || extractTitleFromUrl(url),
        description: data.data.description || extractDescriptionFromUrl(url),
        image: prepareImageUrl(imageUrl),
        url: url,
        siteName: data.data.url || new URL(url).hostname,
        type: data.data.type || 'website'
      };
      
      console.log('[Metadata] Processed metadata:', metadata);
      return metadata;
    }
    
    // Fallback si Microlink falla
    console.log('[Metadata] Microlink failed, using fallback');
    return createFallbackMetadata(url);
    
  } catch (err: any) {
    console.error('[Metadata] Error fetching metadata:', err);
    
    if (err.name === 'AbortError') {
      console.log('[Metadata] Request timeout, using fallback');
    }
    
    // Si falla por timeout o error, crear metadata fallback
    return createFallbackMetadata(url);
  }
}

function optimizeImageUrl(imageUrl: string): string {
  try {
    const url = new URL(imageUrl);
    
    // Optimizar imágenes de known CDNs
    if (url.hostname.includes('cloudinary.com')) {
      // Añadir parámetros de optimización para Cloudinary
      url.searchParams.set('w', '400');
      url.searchParams.set('h', '220');
      url.searchParams.set('c', 'fill');
      url.searchParams.set('q', 'auto');
      url.searchParams.set('f', 'auto');
    }
    
    // Para imágenes de Instagram, usar la versión de mejor calidad
    if (url.hostname.includes('cdninstagram.com')) {
      // Reemplazar parámetros de baja calidad por alta
      url.searchParams.delete('tp');
      url.searchParams.set('stp', 'dst-jpg');
    }
    
    return url.href;
    
  } catch {
    return imageUrl;
  }
}

function getPlatformFallback(url: string): string {
  if (url.includes('instagram.com')) {
    return 'https://i.imgur.com/qj8nF2J.jpeg'; // Instagram placeholder
  }
  if (url.includes('tiktok.com')) {
    return 'https://placehold.co/220x130/000/FFF?text=TikTok';
  }
  if (url.includes('twitter.com') || url.includes('x.com')) {
    return 'https://placehold.co/220x130/1DA1F2/FFF?text=X';
  }
  if (url.includes('facebook.com')) {
    return 'https://placehold.co/220x130/1877F2/FFF?text=Facebook';
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'https://placehold.co/220x130/FF0000/FFF?text=YouTube';
  }
  if (url.includes('spotify.com')) {
    return 'https://placehold.co/220x130/1DB954/FFF?text=Spotify';
  }
  if (url.includes('pinterest.com')) {
    return 'https://placehold.co/220x130/E60023/FFF?text=Pinterest';
  }
  if (url.includes('giphy.com')) {
    return 'https://placehold.co/220x130/000000/00FF99?text=GIPHY';
  }
  
  return 'https://placehold.co/220x130/333/FFF?text=?';
}

function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
    
    if (url.includes('instagram.com') && pathParts.length > 0) {
      return `Instagram post - ${pathParts[pathParts.length - 1]}`;
    }
    
    if (url.includes('twitter.com') || url.includes('x.com')) {
      if (pathParts.length > 0 && pathParts[0] !== 'home') {
        return `Post by @${pathParts[0]}`;
      }
    }
    
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'YouTube video';
    }
    
    if (url.includes('tiktok.com')) {
      return 'TikTok video';
    }
    
    return `Contenido de ${urlObj.hostname}`;
    
  } catch {
    return 'Contenido web';
  }
}

function extractDescriptionFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return `Enlace de ${hostname}`;
  } catch {
    return 'Enlace externo';
  }
}

function createFallbackMetadata(url: string): Metadata {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    
    let title = 'Contenido';
    let description = hostname;
    let image = getPlatformFallback(url);
    
    // Detectar plataforma específica
    if (url.includes('instagram.com')) {
      title = 'Instagram';
      description = 'Publicación de Instagram';
    } else if (url.includes('tiktok.com')) {
      title = 'TikTok';
      description = 'Video de TikTok';
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      title = 'X (Twitter)';
      description = 'Post de X';
    } else if (url.includes('facebook.com')) {
      title = 'Facebook';
      description = 'Publicación de Facebook';
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      title = 'YouTube';
      description = 'Video de YouTube';
    } else if (url.includes('spotify.com')) {
      title = 'Spotify';
      description = 'Contenido de Spotify';
    }
    
    return {
      title,
      description,
      image: prepareImageUrl(image),
      url,
      siteName: hostname,
      type: 'website'
    };
    
  } catch {
    return {
      title: 'Contenido',
      description: 'Enlace externo',
      image: prepareImageUrl('https://placehold.co/220x130/333/FFF?text=?'),
      url,
      siteName: 'web',
      type: 'website'
    };
  }
}
