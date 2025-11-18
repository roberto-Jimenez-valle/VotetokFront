/**
 * Servicio para detección y preview de enlaces
 * Detecta URLs en texto y obtiene metadatos
 */

import { apiGet } from '$lib/api/client';

// Tipo de datos del preview
export interface LinkPreviewData {
  url: string;
  title: string;
  description?: string;
  image?: string;
  imageProxied?: string;
  siteName?: string;
  domain: string;
  type: 'oembed' | 'opengraph' | 'generic';
  embedHtml?: string;
  width?: number;
  height?: number;
  providerName?: string;
  isSafe: boolean;
  nsfwScore?: number;
}

// Regex para detectar URLs
const URL_REGEX = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi;

// Regex mejorado para URLs en markdown
const MARKDOWN_URL_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;

/**
 * Detecta todas las URLs en un texto
 */
export function extractUrls(text: string): string[] {
  const urls = new Set<string>();
  
  // 1. Detectar URLs en markdown [texto](url)
  const markdownMatches = text.matchAll(MARKDOWN_URL_REGEX);
  for (const match of markdownMatches) {
    if (match[2]) {
      urls.add(match[2]);
    }
  }
  
  // 2. Detectar URLs directas
  const directMatches = text.matchAll(URL_REGEX);
  for (const match of directMatches) {
    urls.add(match[0]);
  }
  
  return Array.from(urls);
}

/**
 * Obtiene la primera URL de un texto
 */
export function getFirstUrl(text: string): string | null {
  const urls = extractUrls(text);
  return urls.length > 0 ? urls[0] : null;
}

/**
 * Verifica si un texto contiene URLs
 */
export function hasUrls(text: string): boolean {
  return URL_REGEX.test(text) || MARKDOWN_URL_REGEX.test(text);
}

/**
 * Obtiene el preview de un enlace
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  try {
    console.log('[LinkPreview] 🔍 Fetching preview for:', url);
    
    const response = await apiGet(`/api/link-preview?url=${encodeURIComponent(url)}`);
    
    if (response.success && response.data) {
      console.log('[LinkPreview] ✅ Preview fetched successfully:', {
        title: response.data.title,
        type: response.data.type,
        hasImage: !!response.data.image,
        imageUrl: response.data.image,
        imageProxied: response.data.imageProxied
      });
      return response.data;
    }
    
    console.warn('[LinkPreview] ⚠️ No preview data returned');
    return null;
  } catch (error) {
    console.error('[LinkPreview] ❌ Error fetching preview:', error);
    return null;
  }
}

/**
 * Obtiene previews para múltiples URLs
 */
export async function fetchMultiplePreviews(urls: string[]): Promise<Map<string, LinkPreviewData>> {
  const previews = new Map<string, LinkPreviewData>();
  
  // Fetch en paralelo (máximo 5 a la vez)
  const chunks = chunkArray(urls, 5);
  
  for (const chunk of chunks) {
    const promises = chunk.map(async (url) => {
      const preview = await fetchLinkPreview(url);
      if (preview) {
        previews.set(url, preview);
      }
    });
    
    await Promise.all(promises);
  }
  
  return previews;
}

/**
 * Detecta si una URL es de video embebible
 */
export function isEmbeddableVideo(url: string): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com|twitch\.tv/i.test(url);
}

/**
 * Detecta si una URL es de una imagen directa
 */
export function isDirectImage(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url);
}

/**
 * Detecta si una URL es de un GIF
 */
export function isGif(url: string): boolean {
  return /\.gif(\?|$)/i.test(url) || url.includes('giphy.com');
}

/**
 * Detecta si una URL es de Giphy
 */
export function isGiphyUrl(url: string): boolean {
  return url.includes('giphy.com') || url.includes('giphy');
}

/**
 * Obtiene el dominio legible de una URL
 */
export function getDomainName(url: string): string {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    
    // Remover www.
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    return hostname;
  } catch {
    return 'enlace';
  }
}

/**
 * Trunca un texto largo
 */
export function truncateText(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Helper para dividir un array en chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Cache de previews en memoria (session storage)
 */
export class LinkPreviewCache {
  private static CACHE_KEY = 'voutop_link_previews';
  private static CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas
  
  static get(url: string): LinkPreviewData | null {
    if (typeof sessionStorage === 'undefined') return null;
    
    try {
      const cacheData = sessionStorage.getItem(this.CACHE_KEY);
      if (!cacheData) return null;
      
      const cache = JSON.parse(cacheData);
      const entry = cache[url];
      
      if (!entry) return null;
      
      // Verificar si expiró
      if (Date.now() - entry.timestamp > this.CACHE_DURATION) {
        delete cache[url];
        sessionStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
        return null;
      }
      
      return entry.data;
    } catch {
      return null;
    }
  }
  
  static set(url: string, data: LinkPreviewData): void {
    if (typeof sessionStorage === 'undefined') return;
    
    try {
      const cacheData = sessionStorage.getItem(this.CACHE_KEY);
      const cache = cacheData ? JSON.parse(cacheData) : {};
      
      cache[url] = {
        data,
        timestamp: Date.now()
      };
      
      sessionStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.warn('[LinkPreviewCache] Error saving to cache:', error);
    }
  }
  
  static clear(): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(this.CACHE_KEY);
  }
}

/**
 * Obtiene preview con caché
 */
export async function fetchLinkPreviewCached(url: string): Promise<LinkPreviewData | null> {
  // Intentar desde caché primero
  const cached = LinkPreviewCache.get(url);
  if (cached) {
    console.log('[LinkPreview] Using cached preview for:', url);
    return cached;
  }
  
  // Fetch desde API
  const preview = await fetchLinkPreview(url);
  if (preview) {
    LinkPreviewCache.set(url, preview);
  }
  
  return preview;
}
