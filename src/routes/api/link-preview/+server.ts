/**
 * API Endpoint: Link Preview
 * 
 * Obtiene metadatos de enlaces via oEmbed, Open Graph o fallback genérico
 * Incluye validación de seguridad y filtrado NSFW
 * 
 * GET /api/link-preview?url=https://...
 */

import { json, error, type RequestHandler } from '@sveltejs/kit';
import { findOEmbedProvider, buildOEmbedUrl, isSafeDomain } from '$lib/server/oembed-providers';
import { isDomainAllowed } from '$lib/server/media-proxy-config';

// Cache simple en memoria
const cache = new Map<string, {
  data: LinkPreviewData;
  timestamp: number;
}>();

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas
const TIMEOUT = 8000; // 8 segundos
const MAX_HTML_SIZE = 1024 * 1024; // 1MB para HTML
const URL_RESOLVE_TIMEOUT = 5000; // 5 segundos para resolver URLs

// Dominios conocidos que usan redirecciones (acortadores/tracking)
const REDIRECT_DOMAINS = [
  'search.app',        // Google Search shared links
  'search.app.goo.gl',
  'goo.gl',
  'bit.ly',
  'bitly.com',
  't.co',
  'tinyurl.com',
  'ow.ly',
  'is.gd',
  'v.gd',
  'buff.ly',
  'adf.ly',
  'j.mp',
  'rb.gy',
  'cutt.ly',
  'shorturl.at',
  'tiny.cc',
  'shorte.st',
  'lnk.to',
  'linktr.ee',
  'amzn.to',
  'amzn.eu',
  'youtu.be',
  'vm.tiktok.com',
  'fb.watch',
  'fb.me',
  'flic.kr',
  'forms.gle',
  'g.co',
  'g.page',
  'maps.app.goo.gl',
  'apple.co',
  'spoti.fi',
  'open.spotify.com', // A veces redirige
  'music.apple.com', // A veces redirige
  'link.springer.com',
  'doi.org',
  'dlvr.it',
  'shor.by',
  'rebrand.ly',
  'short.io',
  'smarturl.it',
]

/**
 * Verifica si un hostname necesita resolución de URL (es un acortador/tracker)
 */
function needsUrlResolution(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, '');
  
  // Verificar contra lista de dominios conocidos
  for (const domain of REDIRECT_DOMAINS) {
    if (normalizedHost === domain || normalizedHost.endsWith('.' + domain)) {
      return true;
    }
  }
  
  // Patrones adicionales que indican URLs de tracking/redirect
  const trackingPatterns = [
    /^l\./,           // l.instagram.com, l.facebook.com
    /^lm\./,          // lm.facebook.com
    /^out\./,         // out.reddit.com
    /^click\./,       // click.mailchimp.com
    /^links?\./,      // link.medium.com, links.example.com
    /^redirect\./,    // redirect.example.com
    /^go\./,          // go.example.com
    /^r\./,           // r.example.com
    /^u\./,           // u.example.com
    /^track\./,       // track.example.com
    /^trk\./,         // trk.example.com
  ];
  
  for (const pattern of trackingPatterns) {
    if (pattern.test(normalizedHost)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Resuelve una URL siguiendo todas las redirecciones (301, 302, 307, 308)
 * Retorna la URL final canónica
 */
async function resolveUrl(url: string): Promise<{ finalUrl: string; redirectChain: string[]; status: number }> {
  const redirectChain: string[] = [url];
  let currentUrl = url;
  let maxRedirects = 10; // Prevenir loops infinitos
  let lastStatus = 200;
  
  console.log('[URL Resolver] 🔍 Iniciando resolución para:', url);
  
  while (maxRedirects > 0) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), URL_RESOLVE_TIMEOUT);
    
    try {
      // Usar HEAD primero (más rápido), fallback a GET si HEAD no funciona
      let response: Response;
      
      try {
        response = await fetch(currentUrl, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'manual', // No seguir redirecciones automáticamente
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          }
        });
      } catch (headError) {
        // Algunos servidores no soportan HEAD, intentar con GET
        console.log('[URL Resolver] HEAD falló, intentando GET...');
        response = await fetch(currentUrl, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          }
        });
      }
      
      clearTimeout(timeoutId);
      lastStatus = response.status;
      
      // Verificar si es una redirección
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('Location');
        
        if (!location) {
          console.log('[URL Resolver] ⚠️ Redirección sin header Location');
          break;
        }
        
        // Resolver URL relativa a absoluta si es necesario
        let nextUrl: string;
        try {
          nextUrl = new URL(location, currentUrl).href;
        } catch {
          console.log('[URL Resolver] ⚠️ URL de redirección inválida:', location);
          break;
        }
        
        // Limpiar parámetros de tracking comunes
        nextUrl = cleanTrackingParams(nextUrl);
        
        console.log(`[URL Resolver] ↪️ ${response.status} → ${nextUrl}`);
        
        // Detectar loop
        if (redirectChain.includes(nextUrl)) {
          console.log('[URL Resolver] ⚠️ Loop detectado, terminando');
          break;
        }
        
        redirectChain.push(nextUrl);
        currentUrl = nextUrl;
        maxRedirects--;
        continue;
      }
      
      // También buscar meta refresh o JavaScript redirect en el HTML
      if (response.status === 200) {
        const contentType = response.headers.get('Content-Type') || '';
        
        // Solo para HTML, verificar meta refresh y JS redirects
        if (contentType.includes('text/html')) {
          // Para HEAD, necesitamos hacer GET para ver el contenido
          const getController = new AbortController();
          const getTimeoutId = setTimeout(() => getController.abort(), URL_RESOLVE_TIMEOUT);
          
          try {
            const getResponse = await fetch(currentUrl, {
              method: 'GET',
              signal: getController.signal,
              redirect: 'manual',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              }
            });
            clearTimeout(getTimeoutId);
            
            if (getResponse.body) {
              // Leer solo los primeros bytes para buscar redirects
              const reader = getResponse.body.getReader();
              const { value } = await reader.read();
              reader.cancel();
              
              if (value) {
                const partialHtml = new TextDecoder().decode(value.slice(0, 4000));
                
                // Buscar meta refresh
                const metaRefresh = partialHtml.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["']\d+;\s*url=([^"']+)["']/i) ||
                                    partialHtml.match(/<meta[^>]+content=["']\d+;\s*url=([^"']+)["'][^>]+http-equiv=["']refresh["']/i);
                
                // Buscar JavaScript redirects (window.location, location.href, etc.)
                const jsRedirect = partialHtml.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i) ||
                                   partialHtml.match(/location\.replace\s*\(\s*["']([^"']+)["']/i) ||
                                   partialHtml.match(/window\.location\.assign\s*\(\s*["']([^"']+)["']/i);
                
                // Buscar canonical link (fallback)
                const canonicalLink = partialHtml.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
                                      partialHtml.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
                
                // Prioridad: meta refresh > JS redirect > canonical
                const redirectUrl = metaRefresh?.[1] || jsRedirect?.[1] || canonicalLink?.[1];
                
                if (redirectUrl) {
                  let resolvedRedirectUrl: string;
                  try {
                    resolvedRedirectUrl = new URL(redirectUrl, currentUrl).href;
                    resolvedRedirectUrl = cleanTrackingParams(resolvedRedirectUrl);
                    
                    // Solo seguir si es diferente y no es un loop
                    if (resolvedRedirectUrl !== currentUrl && !redirectChain.includes(resolvedRedirectUrl)) {
                      const redirectType = metaRefresh?.[1] ? 'meta refresh' : (jsRedirect?.[1] ? 'JS redirect' : 'canonical');
                      console.log(`[URL Resolver] ↪️ ${redirectType} → ${resolvedRedirectUrl}`);
                      redirectChain.push(resolvedRedirectUrl);
                      currentUrl = resolvedRedirectUrl;
                      maxRedirects--;
                      continue;
                    }
                  } catch {
                    // URL inválida, ignorar
                  }
                }
              }
            }
          } catch (getErr) {
            // Error obteniendo contenido HTML, continuar sin redirección
            console.log('[URL Resolver] ⚠️ Error obteniendo HTML para detectar redirects');
          }
        }
      }
      
      // No es redirección, hemos llegado al destino final
      break;
      
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      if (err.name === 'AbortError') {
        console.log('[URL Resolver] ⏱️ Timeout resolviendo URL');
      } else {
        console.log('[URL Resolver] ❌ Error:', err.message);
      }
      
      // Retornar la última URL conocida
      break;
    }
  }
  
  // Limpiar parámetros de tracking de la URL final
  const finalUrl = cleanTrackingParams(currentUrl);
  
  console.log(`[URL Resolver] ✅ Resolución completa: ${url} → ${finalUrl} (${redirectChain.length} pasos)`);
  
  return {
    finalUrl,
    redirectChain,
    status: lastStatus
  };
}

/**
 * Limpia parámetros de tracking conocidos de una URL
 */
function cleanTrackingParams(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Parámetros de tracking comunes a eliminar
    const trackingParams = [
      // UTM
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
      // Facebook
      'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref',
      // Google
      'gclid', 'gclsrc', 'dclid',
      // Microsoft
      'msclkid',
      // Twitter
      'twclid',
      // TikTok
      'ttclid',
      // MailChimp
      'mc_cid', 'mc_eid',
      // HubSpot
      'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad', 'hsa_src', 'hsa_net', 'hsa_tgt', 'hsa_kw',
      // Otros
      'ref', 'ref_src', 'ref_url', '_ga', '_gl', 'vero_id', 'zanpid', 'si',
      // Affiliate
      'aff_id', 'affiliate_id', 'partner', 'campaign_id',
      // Misc
      'trk', 'tracking_id', 's', 'ss', 'igsh', 'igshid',
    ];
    
    let modified = false;
    for (const param of trackingParams) {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.delete(param);
        modified = true;
      }
    }
    
    if (modified) {
      console.log('[URL Resolver] 🧹 Parámetros de tracking eliminados');
    }
    
    // Limpiar hash de tracking (ej: #xtor=...)
    if (urlObj.hash && /^#(xtor|pk_|utm_|mtm_)/.test(urlObj.hash)) {
      urlObj.hash = '';
    }
    
    return urlObj.href;
  } catch {
    return url;
  }
}

/**
 * Lista de acortadores/redirectores confiables
 * Los enlaces de estas fuentes se marcarán como seguros aunque el destino final no lo sea
 */
const TRUSTED_REDIRECTORS = [
  'search.app',        // Google Search
  'google.com',        // Google directo
  'youtube.com',       // YouTube
  'youtu.be',          // YouTube corto
  'spotify.com',       // Spotify
  'spoti.fi',          // Spotify corto
  'twitter.com',       // Twitter/X
  'x.com',             // X
  't.co',              // Twitter corto
  'facebook.com',      // Facebook
  'fb.me',             // Facebook corto
  'fb.watch',          // Facebook Watch
  'instagram.com',     // Instagram
  'linkedin.com',      // LinkedIn
  'tiktok.com',        // TikTok
  'vm.tiktok.com',     // TikTok corto
  'reddit.com',        // Reddit
  'redd.it',           // Reddit corto
  'pinterest.com',     // Pinterest
  'pin.it',            // Pinterest corto
  'apple.co',          // Apple
  'music.apple.com',   // Apple Music
  'open.spotify.com',  // Spotify
  'soundcloud.com',    // SoundCloud
  'vimeo.com',         // Vimeo
  'twitch.tv',         // Twitch
  'github.com',        // GitHub
  'medium.com',        // Medium
  'wikipedia.org',     // Wikipedia
  'amazon.com',        // Amazon
  'amzn.to',           // Amazon corto
  'amzn.eu',           // Amazon EU corto
];

/**
 * Verifica si un hostname es un redirector confiable
 */
function isTrustedRedirector(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, '');
  
  for (const trusted of TRUSTED_REDIRECTORS) {
    if (normalizedHost === trusted || normalizedHost.endsWith('.' + trusted)) {
      return true;
    }
  }
  
  return false;
}

export interface LinkPreviewData {
  url: string;
  originalUrl?: string; // URL original antes de resolución (si hubo redirección)
  trustedSource?: string; // Dominio del acortador confiable (ej: 'search.app')
  title: string;
  description?: string;
  image?: string;
  imageProxied?: string; // URL a través de nuestro proxy
  siteName?: string;
  domain: string;
  type: 'oembed' | 'opengraph' | 'generic';
  embedHtml?: string; // HTML para iframes (solo oEmbed)
  width?: number;
  height?: number;
  providerName?: string;
  isSafe: boolean;
  nsfwScore?: number; // 0-1, donde 1 es muy NSFW
}

export const GET: RequestHandler = async ({ url: requestUrl }) => {
  const targetUrl = requestUrl.searchParams.get('url');
  
  // 1. Validar URL
  if (!targetUrl) {
    throw error(400, {
      message: 'Parámetro "url" es requerido',
      code: 'MISSING_URL'
    });
  }
  
  let validUrl: URL;
  try {
    validUrl = new URL(targetUrl);
  } catch {
    throw error(400, {
      message: 'URL inválida',
      code: 'INVALID_URL'
    });
  }
  
  // 2. Solo HTTPS
  if (validUrl.protocol !== 'https:' && validUrl.protocol !== 'http:') {
    throw error(400, {
      message: 'Solo se permiten URLs HTTP/HTTPS',
      code: 'INVALID_PROTOCOL'
    });
  }
  
  // 2.5 NUEVO: Resolver redirecciones para obtener URL final canónica
  let resolvedUrl = targetUrl;
  let wasRedirected = false;
  
  if (needsUrlResolution(validUrl.hostname)) {
    console.log('[Link Preview] 🔄 URL necesita resolución:', targetUrl);
    try {
      const resolution = await resolveUrl(targetUrl);
      if (resolution.finalUrl !== targetUrl) {
        resolvedUrl = resolution.finalUrl;
        wasRedirected = true;
        console.log('[Link Preview] ✅ URL resuelta:', targetUrl, '→', resolvedUrl);
        
        // Actualizar validUrl con la URL resuelta
        try {
          validUrl = new URL(resolvedUrl);
        } catch {
          console.warn('[Link Preview] ⚠️ URL resuelta inválida, usando original');
          resolvedUrl = targetUrl;
          wasRedirected = false;
        }
      } else {
        console.log('[Link Preview] ℹ️ URL no redirigió:', targetUrl);
      }
    } catch (err) {
      console.warn('[Link Preview] ⚠️ Error resolviendo URL, usando original:', err);
      // Continuar con la URL original si falla la resolución
    }
  }
  
  // 3. Verificar caché (usar URL resuelta como key principal)
  const cacheKey = resolvedUrl;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  
  // Plataformas que necesitan thumbnail - no usar cache si no tiene imagen
  // Verificar tanto URL original como resuelta
  const urlToCheck = resolvedUrl || targetUrl;
  const needsThumbnail = urlToCheck.includes('tiktok.com') || 
                         urlToCheck.includes('twitter.com') || 
                         urlToCheck.includes('x.com') ||
                         urlToCheck.includes('twitch.tv') ||
                         urlToCheck.includes('youtube.com') ||
                         urlToCheck.includes('youtu.be');
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    // Si es una plataforma que necesita thumbnail y el cache no tiene imagen, ignorar cache
    if (needsThumbnail && !cached.data.image && !cached.data.imageProxied) {
      console.log('[Link Preview] Cache invalidated (no image):', targetUrl);
      cache.delete(cacheKey);
    } else {
      console.log('[Link Preview] Cache hit:', targetUrl);
      return json({
        success: true,
        data: cached.data,
        cached: true
      });
    }
  }
  
  try {
    console.log('[Link Preview] 🔍 Fetching metadata for:', resolvedUrl, wasRedirected ? `(original: ${targetUrl})` : '');
    
    // 4a. Manejo especial para plataformas sin oEmbed público
    // Usar URL resuelta para detectar correctamente la plataforma
    const specialData = await fetchSpecialPlatformData(resolvedUrl);
    if (specialData) {
      // Guardar URL original y resuelta en los datos
      if (wasRedirected) {
        specialData.originalUrl = targetUrl;
        specialData.url = resolvedUrl;
      }
      cache.set(cacheKey, { data: specialData, timestamp: now });
      // También cachear por URL original si fue redirigida
      if (wasRedirected && targetUrl !== resolvedUrl) {
        cache.set(targetUrl, { data: specialData, timestamp: now });
      }
      cleanCache();
      return json({
        success: true,
        data: specialData,
        cached: false,
        resolved: wasRedirected
      });
    }
    
    // 4b. Intentar oEmbed primero (usar URL resuelta)
    const oembedProvider = findOEmbedProvider(resolvedUrl);
    console.log('[Link Preview] oEmbed provider found:', oembedProvider ? oembedProvider.name : 'NONE');
    
    if (oembedProvider) {
      try {
        const oembedData = await fetchOEmbed(oembedProvider, resolvedUrl);
        if (oembedData) {
          // Si oEmbed no tiene imagen, intentar obtenerla de Open Graph
          if (!oembedData.image) {
            console.log('[Link Preview] ⚠️ oEmbed sin imagen, intentando Open Graph...');
            try {
              const ogData = await fetchOpenGraphMetadata(resolvedUrl);
              if (ogData.image) {
                // Combinar: datos de oEmbed + imagen de Open Graph
                oembedData.image = ogData.image;
                oembedData.imageProxied = `/api/media-proxy?url=${encodeURIComponent(ogData.image)}`;
                console.log('[Link Preview] ✅ Imagen añadida desde Open Graph:', ogData.image);
                
                // También agregar descripción si falta
                if (!oembedData.description && ogData.description) {
                  oembedData.description = ogData.description;
                }
              }
            } catch (ogErr) {
              console.warn('[Link Preview] Open Graph fallback fallido:', ogErr);
            }
          }
          
          // Guardar URL original si fue redirigida
          if (wasRedirected) {
            oembedData.originalUrl = targetUrl;
            oembedData.url = resolvedUrl;
          }
          
          // Guardar en caché
          cache.set(cacheKey, { data: oembedData, timestamp: now });
          // También cachear por URL original si fue redirigida
          if (wasRedirected && targetUrl !== resolvedUrl) {
            cache.set(targetUrl, { data: oembedData, timestamp: now });
          }
          cleanCache();
          
          return json({
            success: true,
            data: oembedData,
            cached: false,
            resolved: wasRedirected
          });
        }
      } catch (err) {
        console.warn('[Link Preview] oEmbed failed, trying Open Graph:', err);
      }
    }
    
    // 5. Fallback: Open Graph + metatags (usar URL resuelta)
    const openGraphData = await fetchOpenGraph(resolvedUrl);
    
    // Guardar URL original si fue redirigida
    if (wasRedirected) {
      openGraphData.originalUrl = targetUrl;
      openGraphData.url = resolvedUrl;
      
      // Si vino de un acortador confiable, marcar como seguro
      // El usuario compartió este enlace intencionalmente desde una fuente conocida
      const originalHostname = new URL(targetUrl).hostname.toLowerCase();
      if (isTrustedRedirector(originalHostname)) {
        openGraphData.isSafe = true;
        openGraphData.trustedSource = originalHostname;
        
        // Añadir &trusted=1 a la URL del proxy para que permita cualquier dominio
        if (openGraphData.imageProxied) {
          openGraphData.imageProxied = openGraphData.imageProxied + '&trusted=1';
        }
        
        console.log('[Link Preview] ✅ Marcado como seguro (fuente confiable):', originalHostname);
      }
    }
    
    // Guardar en caché
    cache.set(cacheKey, { data: openGraphData, timestamp: now });
    // También cachear por URL original si fue redirigida
    if (wasRedirected && targetUrl !== resolvedUrl) {
      cache.set(targetUrl, { data: openGraphData, timestamp: now });
    }
    cleanCache();
    
    return json({
      success: true,
      data: openGraphData,
      cached: false,
      resolved: wasRedirected
    });
    
  } catch (err: any) {
    console.error('[Link Preview] Error:', err);
    
    throw error(500, {
      message: err.message || 'Error al obtener preview del enlace',
      code: 'PREVIEW_ERROR'
    });
  }
};

/**
 * Manejo especial para plataformas sin oEmbed público (Deezer, Twitch, etc.)
 */
async function fetchSpecialPlatformData(targetUrl: string): Promise<LinkPreviewData | null> {
  const urlObj = new URL(targetUrl);
  
  // Deezer - usar su API pública
  if (urlObj.hostname.includes('deezer.com')) {
    console.log('[Link Preview] 🎵 Detectado Deezer, usando API pública...');
    const trackMatch = targetUrl.match(/track\/(\d+)/);
    const albumMatch = targetUrl.match(/album\/(\d+)/);
    const playlistMatch = targetUrl.match(/playlist\/(\d+)/);
    
    try {
      let apiUrl = '';
      if (trackMatch) {
        apiUrl = `https://api.deezer.com/track/${trackMatch[1]}`;
      } else if (albumMatch) {
        apiUrl = `https://api.deezer.com/album/${albumMatch[1]}`;
      } else if (playlistMatch) {
        apiUrl = `https://api.deezer.com/playlist/${playlistMatch[1]}`;
      }
      
      if (apiUrl) {
        const response = await fetch(apiUrl);
        if (response.ok) {
          const data = await response.json();
          const image = data.cover_big || data.cover_medium || data.album?.cover_big || data.album?.cover_medium || data.picture_big;
          
          console.log('[Link Preview] ✅ Deezer API response:', { title: data.title, hasImage: !!image });
          
          return {
            url: targetUrl,
            title: data.title || 'Deezer',
            description: data.artist?.name || data.description || '',
            image: image,
            imageProxied: image ? `/api/media-proxy?url=${encodeURIComponent(image)}` : undefined,
            siteName: 'Deezer',
            domain: 'deezer.com',
            type: 'oembed',
            providerName: 'Deezer',
            isSafe: true,
            nsfwScore: 0
          };
        }
      }
    } catch (err) {
      console.warn('[Link Preview] Deezer API failed:', err);
    }
  }
  
  // TikTok - usar oEmbed API
  if (urlObj.hostname.includes('tiktok.com') || urlObj.hostname.includes('vm.tiktok.com')) {
    console.log('[Link Preview] 🎵 Detectado TikTok, usando oEmbed API...');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`;
      console.log('[Link Preview] TikTok oEmbed URL:', oembedUrl);
      
      const response = await fetch(oembedUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      console.log('[Link Preview] TikTok oEmbed status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Link Preview] TikTok oEmbed data:', { 
          title: data.title, 
          author: data.author_name,
          thumbnail: data.thumbnail_url 
        });
        
        if (data.thumbnail_url) {
          console.log('[Link Preview] ✅ TikTok thumbnail found:', data.thumbnail_url);
          return {
            url: targetUrl,
            title: data.title || 'TikTok',
            description: data.author_name || '',
            image: data.thumbnail_url,
            imageProxied: `/api/media-proxy?url=${encodeURIComponent(data.thumbnail_url)}`,
            siteName: 'TikTok',
            domain: 'tiktok.com',
            type: 'oembed',
            providerName: 'TikTok',
            isSafe: true,
            nsfwScore: 0
          };
        } else {
          console.log('[Link Preview] ⚠️ TikTok oEmbed no tiene thumbnail_url');
        }
      }
    } catch (err) {
      console.warn('[Link Preview] TikTok oEmbed error:', err);
    }
    return null;
  }
  
  // X (antes Twitter) - usar API de fxtwitter directamente (más rápido y confiable)
  if (urlObj.hostname.includes('twitter.com') || urlObj.hostname.includes('x.com')) {
    console.log('[Link Preview] 🐦 Detectado X, usando API fxtwitter...');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos
      
      // Usar directamente la API JSON (más rápida que HTML)
      const pathname = new URL(targetUrl).pathname;
      const apiUrl = `https://api.fxtwitter.com${pathname}`;
      console.log('[Link Preview] X API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'VoteTok/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      console.log('[Link Preview] X API status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        const tweet = data.tweet;
        
        console.log('[Link Preview] X API data:', { 
          hasMedia: !!tweet?.media,
          photos: tweet?.media?.photos?.length || 0,
          videos: tweet?.media?.videos?.length || 0,
          author: tweet?.author?.name
        });
        
        // Buscar imagen: fotos > videos thumbnail > avatar del autor
        let mediaUrl = null;
        if (tweet?.media?.photos?.[0]?.url) {
          mediaUrl = tweet.media.photos[0].url;
        } else if (tweet?.media?.videos?.[0]?.thumbnail_url) {
          mediaUrl = tweet.media.videos[0].thumbnail_url;
        } else if (tweet?.author?.avatar_url) {
          // Fallback: usar avatar del autor si no hay media
          mediaUrl = tweet.author.avatar_url.replace('_normal', '_400x400');
        }
        
        if (mediaUrl) {
          console.log('[Link Preview] ✅ X image found:', mediaUrl);
          
          // Generar embed HTML usando fxtwitter para videos
          let embedHtml: string | undefined;
          const hasVideo = tweet?.media?.videos?.length > 0;
          
          if (hasVideo && tweet?.media?.videos?.[0]?.url) {
            // Video directo de fxtwitter
            const videoUrl = tweet.media.videos[0].url;
            console.log('[Link Preview] 🎬 X video URL:', videoUrl);
            embedHtml = `<video src="${videoUrl}" controls playsinline style="width:100%;height:100%;object-fit:contain;background:#000;border-radius:12px;" poster="${mediaUrl}"></video>`;
          } else {
            // Para tweets con imágenes, usar iframe de fxtwitter
            const fxUrl = targetUrl.replace('twitter.com', 'fxtwitter.com').replace('x.com', 'fxtwitter.com');
            embedHtml = `<iframe src="${fxUrl}" style="width:100%;height:100%;border:none;border-radius:12px;" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
          }
          
          return {
            url: targetUrl,
            title: tweet?.text?.substring(0, 100) || 'X',
            description: tweet?.author?.name || '',
            image: mediaUrl,
            imageProxied: `/api/media-proxy?url=${encodeURIComponent(mediaUrl)}`,
            siteName: 'X',
            domain: 'x.com',
            type: 'oembed',
            embedHtml: embedHtml,
            providerName: 'X',
            isSafe: true,
            nsfwScore: 0
          };
        } else {
          console.log('[Link Preview] ⚠️ X API no tiene media');
        }
      } else {
        console.log('[Link Preview] ❌ X API response not ok:', response.status);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn('[Link Preview] X API timeout (15s)');
      } else {
        console.warn('[Link Preview] X error:', err.message);
      }
    }
    return null;
  }
  
  // Twitch - extraer thumbnail de clips o canales
  if (urlObj.hostname.includes('twitch.tv') || urlObj.hostname.includes('clips.twitch.tv')) {
    console.log('[Link Preview] 🎮 Detectado Twitch, obteniendo thumbnail...');
    
    // Para clips, extraer el slug y construir URL de thumbnail
    const clipMatch = targetUrl.match(/(?:clips\.twitch\.tv\/|twitch\.tv\/\w+\/clip\/)([A-Za-z0-9_-]+)/);
    if (clipMatch) {
      const clipSlug = clipMatch[1];
      console.log('[Link Preview] Twitch clip detectado, slug:', clipSlug);
      
      // Intentar obtener el thumbnail del clip via Open Graph
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const clipUrl = `https://clips.twitch.tv/${clipSlug}`;
        const response = await fetch(clipUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
            'Accept': 'text/html'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const html = await response.text();
          // Twitch clips usan twitter:image
          const twitterImage = html.match(/<meta\s+(?:property|name)=["']twitter:image["']\s+content=["']([^"']+)["']/i) ||
                               html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']twitter:image["']/i);
          const ogImage = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                          html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
          const ogTitle = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                          html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i);
          
          const imageUrl = twitterImage?.[1] || ogImage?.[1];
          
          if (imageUrl) {
            console.log('[Link Preview] ✅ Twitch clip image found:', imageUrl);
            return {
              url: targetUrl,
              title: ogTitle?.[1] || 'Twitch Clip',
              description: '',
              image: imageUrl,
              imageProxied: `/api/media-proxy?url=${encodeURIComponent(imageUrl)}`,
              siteName: 'Twitch',
              domain: 'twitch.tv',
              type: 'opengraph',
              providerName: 'Twitch',
              isSafe: true,
              nsfwScore: 0
            };
          } else {
            console.log('[Link Preview] ⚠️ Twitch clip no tiene imagen, HTML preview:', html.substring(0, 1000));
          }
        }
      } catch (err) {
        console.warn('[Link Preview] Twitch clip error:', err);
      }
    }
    
    // Para canales/videos, intentar Open Graph normal
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
          'Accept': 'text/html'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const html = await response.text();
        const twitterImage = html.match(/<meta\s+(?:property|name)=["']twitter:image["']\s+content=["']([^"']+)["']/i) ||
                             html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']twitter:image["']/i);
        const ogImage = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                        html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
        const ogTitle = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                        html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i);
        
        const imageUrl = twitterImage?.[1] || ogImage?.[1];
        
        if (imageUrl) {
          console.log('[Link Preview] ✅ Twitch image found:', imageUrl);
          return {
            url: targetUrl,
            title: ogTitle?.[1] || 'Twitch',
            description: '',
            image: imageUrl,
            imageProxied: `/api/media-proxy?url=${encodeURIComponent(imageUrl)}`,
            siteName: 'Twitch',
            domain: 'twitch.tv',
            type: 'opengraph',
            providerName: 'Twitch',
            isSafe: true,
            nsfwScore: 0
          };
        } else {
          console.log('[Link Preview] ⚠️ Twitch no tiene imagen, HTML preview:', html.substring(0, 1000));
        }
      }
    } catch (err) {
      console.warn('[Link Preview] Twitch error:', err);
    }
    return null;
  }
  
  // Apple Music - usar Open Graph
  if (urlObj.hostname.includes('music.apple.com')) {
    console.log('[Link Preview] 🍎 Detectado Apple Music, obteniendo Open Graph...');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const html = await response.text();
        const ogImage = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                        html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
        const ogTitle = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                        html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i);
        
        if (ogImage?.[1]) {
          console.log('[Link Preview] ✅ Apple Music Open Graph image found:', ogImage[1]);
          return {
            url: targetUrl,
            title: ogTitle?.[1] || 'Apple Music',
            description: '',
            image: ogImage[1],
            imageProxied: `/api/media-proxy?url=${encodeURIComponent(ogImage[1])}`,
            siteName: 'Apple Music',
            domain: 'music.apple.com',
            type: 'opengraph',
            providerName: 'Apple Music',
            isSafe: true,
            nsfwScore: 0
          };
        }
      }
    } catch (err) {
      console.warn('[Link Preview] Apple Music Open Graph failed:', err);
    }
    return null;
  }
  
  // Bandcamp - usar Open Graph
  if (urlObj.hostname.includes('bandcamp.com')) {
    console.log('[Link Preview] 🎸 Detectado Bandcamp, obteniendo Open Graph...');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const html = await response.text();
        const ogImage = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                        html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
        const ogTitle = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                        html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i);
        
        if (ogImage?.[1]) {
          console.log('[Link Preview] ✅ Bandcamp Open Graph image found:', ogImage[1]);
          return {
            url: targetUrl,
            title: ogTitle?.[1] || 'Bandcamp',
            description: '',
            image: ogImage[1],
            imageProxied: `/api/media-proxy?url=${encodeURIComponent(ogImage[1])}`,
            siteName: 'Bandcamp',
            domain: 'bandcamp.com',
            type: 'opengraph',
            providerName: 'Bandcamp',
            isSafe: true,
            nsfwScore: 0
          };
        }
      }
    } catch (err) {
      console.warn('[Link Preview] Bandcamp Open Graph failed:', err);
    }
    return null;
  }
  
  return null;
}

/**
 * Fetch metadatos vía oEmbed
 */
async function fetchOEmbed(provider: any, targetUrl: string): Promise<LinkPreviewData | null> {
  const oembedUrl = buildOEmbedUrl(provider, targetUrl);
  
  console.log('[Link Preview] 🔗 Fetching oEmbed from:', oembedUrl);
  console.log('[Link Preview] 🎯 Original URL:', targetUrl);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  
  try {
    const response = await fetch(oembedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'VouTop-LinkPreview/1.0',
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn('[Link Preview] oEmbed request failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    console.log('[Link Preview] 📦 oEmbed response:', {
      title: data.title,
      author: data.author_name,
      provider: data.provider_name,
      hasThumbnail: !!data.thumbnail_url,
      hasHtml: !!data.html
    });
    
    const urlObj = new URL(targetUrl);
    
    // Crear imagen proxied si existe
    let imageProxied: string | undefined;
    let thumbnailUrl = data.thumbnail_url;
    
    // Si no hay thumbnail pero hay HTML embebido, intentar extraer imagen del HTML
    if (!thumbnailUrl && data.html) {
      console.log(`[Link Preview] 🔍 ${provider.name} sin thumbnail, extrayendo del HTML embebido...`);
      thumbnailUrl = extractImageFromEmbed(data.html, targetUrl, provider.name);
      if (thumbnailUrl) {
        console.log(`[Link Preview] ✅ Imagen extraída del HTML de ${provider.name}:`, thumbnailUrl);
      }
    }
    
    if (thumbnailUrl) {
      imageProxied = `/api/media-proxy?url=${encodeURIComponent(thumbnailUrl)}`;
      console.log('[Link Preview] 🖼️ oEmbed image found:', {
        original: thumbnailUrl,
        proxied: imageProxied
      });
    } else {
      console.log('[Link Preview] ⚠️ oEmbed NO retornó thumbnail_url');
    }
    
    return {
      url: targetUrl,
      title: data.title || data.author_name || 'Sin título',
      description: data.description || '',
      image: thumbnailUrl,
      imageProxied,
      siteName: data.provider_name || provider.name,
      domain: urlObj.hostname,
      type: 'oembed',
      embedHtml: data.html,
      width: data.width,
      height: data.height,
      providerName: data.provider_name,
      isSafe: true, // oEmbed providers son generalmente seguros
      nsfwScore: 0
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Transforma URL de imagen pequeña de Amazon a alta resolución
 */
function transformAmazonImageToHighRes(url: string): string {
  // Patrones de tamaño a reemplazar por versión grande
  const sizePatterns = [
    // _AC_US40_ → _AC_SL1500_ (thumbnail a large)
    /_AC_US\d+_/g,
    // _AC_UL40_ → _AC_SL1500_
    /_AC_UL\d+_/g,
    // _AC_SR40,40_ → _AC_SL1500_
    /_AC_SR\d+,\d+_/g,
    // ._SS40_ → ._AC_SL1500_
    /\._SS\d+_/g,
    // ._SX40_ → ._AC_SL1500_
    /\._SX\d+_/g,
    // ._SY40_ → ._AC_SL1500_
    /\._SY\d+_/g,
  ];
  
  let transformed = url;
  for (const pattern of sizePatterns) {
    if (pattern.test(transformed)) {
      transformed = transformed.replace(pattern, '_AC_SL1500_');
      console.log('[Amazon] 🔄 URL transformada:', url, '→', transformed);
      return transformed;
    }
  }
  
  return url;
}

/**
 * Verifica si una URL de Amazon tiene un tamaño aceptable (>= 200px)
 */
function isAcceptableAmazonImageSize(url: string): boolean {
  // Extraer tamaño de patrones como _AC_US40_, _SL1500_, etc.
  const sizeMatch = url.match(/_(?:AC_)?(?:US|UL|SR|SS|SX|SY|SL)(\d+)/);
  if (sizeMatch) {
    const size = parseInt(sizeMatch[1]);
    return size >= 200; // Mínimo 200px
  }
  // Si no tiene tamaño en la URL, aceptar (probablemente es original)
  return true;
}

/**
 * Extrae imagen de producto de Amazon usando patrones específicos
 */
function extractAmazonImage(html: string): string | undefined {
  const foundImages: string[] = [];
  
  // Patrón 1: Buscar en JSON embebido (data-a-state, colorImages, etc.)
  const jsonPatterns = [
    /"hiRes":"(https:\/\/[^"]*images-[^"]*amazon[^"]*\.jpg[^"]*)"/gi,
    /"large":"(https:\/\/[^"]*images-[^"]*amazon[^"]*\.jpg[^"]*)"/gi,
    /"main":"(https:\/\/[^"]*images-[^"]*amazon[^"]*\.jpg[^"]*)"/gi,
  ];
  
  for (const pattern of jsonPatterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      if (match[1]) foundImages.push(match[1]);
    }
  }
  
  // Patrón 2: Buscar imágenes directas del CDN de Amazon
  const cdnPatterns = [
    /(?:src|data-old-hires)=["'](https?:\/\/[^"']*(?:images-na\.ssl-images-amazon\.com|m\.media-amazon\.com|images-eu\.ssl-images-amazon\.com)[^"']*\.jpg)[^"']*/gi,
    /data-a-dynamic-image=["']({[^}]*"(https?:\/\/[^"]*amazon[^"]*\.jpg)"[^}]*})/gi,
  ];
  
  for (const pattern of cdnPatterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      let imageUrl = match[1];
      // Si capturó JSON, extraer todas las URLs
      if (imageUrl.startsWith('{')) {
        const urlMatches = imageUrl.matchAll(/"(https?:\/\/[^"]*\.jpg)"/g);
        for (const urlMatch of urlMatches) {
          foundImages.push(urlMatch[1]);
        }
      } else {
        foundImages.push(imageUrl);
      }
    }
  }
  
  // Patrón 3: Buscar en el div de imagen principal
  const imgDivPattern = /<div[^>]+id=["'](?:imgTagWrapperId|landingImage|main-image-container)[^>]*>[\s\S]{0,500}?<img[^>]+src=["'](https?:\/\/[^"']*amazon[^"']*\.jpg)[^"']*/gi;
  const imgDivMatches = [...html.matchAll(imgDivPattern)];
  for (const match of imgDivMatches) {
    if (match[1]) foundImages.push(match[1]);
  }
  
  console.log(`[Amazon] 📸 Encontradas ${foundImages.length} imágenes candidatas`);
  
  // Filtrar y priorizar imágenes
  const validImages = foundImages
    .filter(url => {
      const isValid = isAcceptableAmazonImageSize(url);
      if (!isValid) {
        console.log('[Amazon] ❌ Imagen muy pequeña descartada:', url);
      }
      return isValid;
    })
    .sort((a, b) => {
      // Priorizar por tamaño (más grande primero)
      const sizeA = a.match(/_(?:SL|AC_SL)(\d+)_/)?.[1] || '0';
      const sizeB = b.match(/_(?:SL|AC_SL)(\d+)_/)?.[1] || '0';
      return parseInt(sizeB) - parseInt(sizeA);
    });
  
  if (validImages.length > 0) {
    const selectedImage = validImages[0];
    console.log('[Amazon] ✅ Imagen seleccionada:', selectedImage);
    return selectedImage;
  }
  
  // Fallback: Intentar transformar una imagen pequeña a grande
  if (foundImages.length > 0) {
    const transformed = transformAmazonImageToHighRes(foundImages[0]);
    if (transformed !== foundImages[0]) {
      console.log('[Amazon] ✅ Usando imagen transformada');
      return transformed;
    }
  }
  
  console.log('[Amazon] ⚠️ No se encontró imagen del producto adecuada');
  return undefined;
}

/**
 * Extrae imagen de un HTML embebido (genérico para múltiples plataformas)
 */
function extractImageFromEmbed(html: string, url: string, providerName: string): string | undefined {
  // Patrones comunes de imágenes en HTML embebido
  const patterns = [
    /<img[^>]+src=["']([^"']+)["']/gi,
    /<img[^>]+data-src=["']([^"']+)["']/gi,
    /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi,
  ];
  
  // Extraer todas las posibles imágenes
  const foundImages: string[] = [];
  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      const imgUrl = match[1];
      if (imgUrl && imgUrl.startsWith('http')) {
        foundImages.push(imgUrl);
      }
    }
  }
  
  // Filtros específicos por plataforma
  if (providerName === 'Twitter') {
    // Twitter: buscar imágenes de medios, no avatares
    for (const imgUrl of foundImages) {
      if (imgUrl.includes('pbs.twimg.com') && 
          !imgUrl.includes('profile_images') &&
          !imgUrl.includes('profile_banners') &&
          (imgUrl.includes('/media/') || imgUrl.includes('/tweet_video_thumb/'))) {
        return imgUrl;
      }
    }
  } else if (providerName === 'Instagram') {
    // Instagram: buscar imágenes de cdninstagram
    for (const imgUrl of foundImages) {
      if ((imgUrl.includes('cdninstagram.com') || imgUrl.includes('fbcdn.net')) &&
          !imgUrl.includes('profile') &&
          imgUrl.includes('/v/')) {
        return imgUrl;
      }
    }
  } else if (providerName === 'TikTok') {
    // TikTok: buscar thumbnails de videos
    for (const imgUrl of foundImages) {
      if ((imgUrl.includes('tiktokcdn.com') || imgUrl.includes('muscdn.com')) &&
          imgUrl.includes('tos-')) {
        return imgUrl;
      }
    }
  } else if (providerName === 'Facebook') {
    // Facebook: buscar imágenes de contenido
    for (const imgUrl of foundImages) {
      if (imgUrl.includes('fbcdn.net') && 
          !imgUrl.includes('profile') &&
          (imgUrl.includes('/v/') || imgUrl.includes('/s'))) {
        return imgUrl;
      }
    }
  } else if (providerName === 'LinkedIn') {
    // LinkedIn: buscar imágenes de posts
    for (const imgUrl of foundImages) {
      if (imgUrl.includes('licdn.com') && 
          imgUrl.includes('/dms/image/')) {
        return imgUrl;
      }
    }
  } else if (providerName === 'Amazon') {
    // Amazon: usar función específica
    return extractAmazonImage(html);
  }
  
  // Fallback: retornar primera imagen grande encontrada (min 200x200 aprox)
  for (const imgUrl of foundImages) {
    // Filtrar iconos pequeños y logos comunes
    if (!imgUrl.includes('icon') &&
        !imgUrl.includes('logo') &&
        !imgUrl.includes('avatar') &&
        !imgUrl.includes('profile') &&
        !imgUrl.match(/\d+x\d+/) || // Si tiene dimensiones, verificar que sean grandes
        (imgUrl.match(/(\d+)x(\d+)/) && 
         parseInt(RegExp.$1) >= 200 && 
         parseInt(RegExp.$2) >= 200)) {
      return imgUrl;
    }
  }
  
  return undefined;
}

/**
 * Fetch solo metadatos de Open Graph (sin crear LinkPreviewData completo)
 */
async function fetchOpenGraphMetadata(targetUrl: string): Promise<{ image?: string; description?: string; title?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  
  try {
    // Headers más completos para evadir bloqueos (especialmente Twitter)
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return {};
    }
    
    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.includes('text/html')) {
      return {};
    }
    
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_HTML_SIZE) {
      return {};
    }
    
    const html = new TextDecoder('utf-8').decode(arrayBuffer);
    const urlObj = new URL(targetUrl);
    
    return extractMetadata(html, urlObj);
  } catch (err) {
    clearTimeout(timeoutId);
    return {};
  }
}

/**
 * Fetch metadatos vía Open Graph y metatags
 */
async function fetchOpenGraph(targetUrl: string): Promise<LinkPreviewData> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  
  try {
    // Headers más completos para evadir bloqueos
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.includes('text/html')) {
      throw new Error('El recurso no es HTML');
    }
    
    // Limitar tamaño del HTML
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_HTML_SIZE) {
      throw new Error('HTML demasiado grande');
    }
    
    const html = new TextDecoder('utf-8').decode(arrayBuffer);
    const urlObj = new URL(targetUrl);
    
    // Extraer metadatos
    const metadata = extractMetadata(html, urlObj);
    
    // Verificar seguridad del dominio
    const isSafe = isSafeDomain(targetUrl) || isDomainAllowed(targetUrl);
    
    // Crear imagen proxied si existe
    let imageProxied: string | undefined;
    if (metadata.image) {
      imageProxied = `/api/media-proxy?url=${encodeURIComponent(metadata.image)}`;
      console.log('[Link Preview] 🖼️ Open Graph image found:', {
        original: metadata.image,
        proxied: imageProxied
      });
    }
    
    return {
      url: targetUrl,
      title: metadata.title || urlObj.hostname,
      description: metadata.description,
      image: metadata.image,
      imageProxied,
      siteName: metadata.siteName || urlObj.hostname,
      domain: urlObj.hostname,
      type: 'opengraph',
      isSafe,
      nsfwScore: 0 // TODO: Integrar clasificador NSFW
    };
    
  } catch (err) {
    clearTimeout(timeoutId);
    
    // Si falla, retornar datos mínimos con nombre legible
    const urlObj = new URL(targetUrl);
    
    // Nombres legibles para dominios conocidos
    const friendlyNames: Record<string, string> = {
      'primevideo.com': 'Prime Video',
      'netflix.com': 'Netflix',
      'disneyplus.com': 'Disney+',
      'hbomax.com': 'HBO Max',
      'hulu.com': 'Hulu',
      'twitch.tv': 'Twitch',
      'spotify.com': 'Spotify'
    };
    
    const domain = urlObj.hostname.replace('www.', '');
    const title = friendlyNames[domain] || urlObj.hostname;
    
    console.log(`[Link Preview] ⚠️ Fetch failed for ${targetUrl}, returning minimal data:`, err);
    
    return {
      url: targetUrl,
      title: title,
      description: 'Haz clic para ver en ' + title,
      domain: urlObj.hostname,
      type: 'generic',
      isSafe: isSafeDomain(targetUrl),
      nsfwScore: 0
    };
  }
}

/**
 * Extrae metadatos de Open Graph, Twitter Cards y metatags genéricos
 */
function extractMetadata(html: string, urlObj: URL): {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
} {
  const metadata: any = {};
  
  // Open Graph tags (con variaciones de orden de atributos)
  const ogTitle = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                  html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i);
  const ogDesc = html.match(/<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                 html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:description["']/i);
  const ogImage = html.match(/<meta\s+(?:property|name)=["']og:image(?::src)?["']\s+content=["']([^"']+)["']/i) ||
                  html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image(?::src)?["']/i);
  const ogSite = html.match(/<meta\s+(?:property|name)=["']og:site_name["']\s+content=["']([^"']+)["']/i) ||
                 html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:site_name["']/i);
  
  // Twitter Card tags (con variaciones)
  const twitterTitle = html.match(/<meta\s+(?:name|property)=["']twitter:title["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/<meta\s+content=["']([^"']+)["']\s+(?:name|property)=["']twitter:title["']/i);
  const twitterDesc = html.match(/<meta\s+(?:name|property)=["']twitter:description["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+content=["']([^"']+)["']\s+(?:name|property)=["']twitter:description["']/i);
  const twitterImage = html.match(/<meta\s+(?:name|property)=["']twitter:image(?::src)?["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/<meta\s+content=["']([^"']+)["']\s+(?:name|property)=["']twitter:image(?::src)?["']/i);
  
  // Title tag
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  
  // Description meta
  const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                   html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  
  // Prioridad: OG > Twitter > Generic
  metadata.title = ogTitle?.[1] || twitterTitle?.[1] || titleTag?.[1];
  metadata.description = ogDesc?.[1] || twitterDesc?.[1] || metaDesc?.[1];
  metadata.image = ogImage?.[1] || twitterImage?.[1];
  metadata.siteName = ogSite?.[1];
  
  // Extracción específica para Amazon (si no hay imagen)
  if (!metadata.image && (urlObj.hostname.includes('amazon.') || urlObj.hostname.includes('amzn.'))) {
    metadata.image = extractAmazonImage(html);
  }
  
  // Normalizar URL de imagen (convertir relativas a absolutas)
  if (metadata.image && !metadata.image.startsWith('http')) {
    if (metadata.image.startsWith('//')) {
      metadata.image = urlObj.protocol + metadata.image;
    } else if (metadata.image.startsWith('/')) {
      metadata.image = urlObj.origin + metadata.image;
    } else {
      metadata.image = new URL(metadata.image, urlObj.href).href;
    }
  }
  
  return metadata;
}

/**
 * Limpia caché antigua
 */
function cleanCache() {
  if (cache.size > 200) {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        cache.delete(key);
      }
    }
  }
}

/**
 * DELETE endpoint para limpiar caché (solo development)
 */
export const DELETE: RequestHandler = async () => {
  cache.clear();
  console.log('[Link Preview] 🗑️ Caché limpiado manualmente');
  return json({ success: true, message: 'Caché limpiado' });
};

// Limpieza periódica de caché
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        cache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[Link Preview] Cache cleaned: ${cleaned} entries removed. Size: ${cache.size}`);
    }
  }, 60 * 60 * 1000); // Cada hora
}
