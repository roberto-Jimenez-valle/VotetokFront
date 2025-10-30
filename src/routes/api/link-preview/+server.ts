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

export interface LinkPreviewData {
  url: string;
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
  
  // 3. Verificar caché
  const cacheKey = targetUrl;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    console.log('[Link Preview] Cache hit:', targetUrl);
    return json({
      success: true,
      data: cached.data,
      cached: true
    });
  }
  
  try {
    console.log('[Link Preview] 🔍 Fetching metadata for:', targetUrl);
    
    // 4. Intentar oEmbed primero
    const oembedProvider = findOEmbedProvider(targetUrl);
    console.log('[Link Preview] oEmbed provider found:', oembedProvider ? oembedProvider.name : 'NONE');
    
    if (oembedProvider) {
      try {
        const oembedData = await fetchOEmbed(oembedProvider, targetUrl);
        if (oembedData) {
          // Si oEmbed no tiene imagen, intentar obtenerla de Open Graph
          if (!oembedData.image) {
            console.log('[Link Preview] ⚠️ oEmbed sin imagen, intentando Open Graph...');
            try {
              const ogData = await fetchOpenGraphMetadata(targetUrl);
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
          
          // Guardar en caché
          cache.set(cacheKey, { data: oembedData, timestamp: now });
          cleanCache();
          
          return json({
            success: true,
            data: oembedData,
            cached: false
          });
        }
      } catch (err) {
        console.warn('[Link Preview] oEmbed failed, trying Open Graph:', err);
      }
    }
    
    // 5. Fallback: Open Graph + metatags
    const openGraphData = await fetchOpenGraph(targetUrl);
    
    // Guardar en caché
    cache.set(cacheKey, { data: openGraphData, timestamp: now });
    cleanCache();
    
    return json({
      success: true,
      data: openGraphData,
      cached: false
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
