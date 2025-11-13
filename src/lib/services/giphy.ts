/**
 * Servicio para consultar la API de Giphy
 * Obtiene URLs de GIFs de forma sencilla
 */

import { getUserLanguage } from './geolocation';

// API Key pública de Giphy (beta/testing)
// Para producción, usa tu propia key de https://developers.giphy.com/
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || 'dc6zaTOxFJmzC';

const GIPHY_BASE_URL = 'https://api.giphy.com/v1';

// Log para verificar que la API Key se cargó correctamente
if (typeof window !== 'undefined') {
  const isCustomKey = GIPHY_API_KEY !== 'dc6zaTOxFJmzC';
  console.log(
    `[Giphy] ${isCustomKey ? '✅ Usando API Key personalizada' : '⚠️ Usando API Key pública (beta)'}`,
    `(${GIPHY_API_KEY.substring(0, 8)}...)`
  );
}

/**
 * Resultado de un GIF de Giphy
 */
export interface GiphyGif {
  id: string;
  title: string;
  url: string;
  images: {
    original: {
      url: string;
      width: string;
      height: string;
      size: string;
    };
    downsized: {
      url: string;
      width: string;
      height: string;
      size: string;
    };
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    fixed_height_small: {
      url: string;
      width: string;
      height: string;
    };
    fixed_width: {
      url: string;
      width: string;
      height: string;
    };
    preview_gif: {
      url: string;
      width: string;
      height: string;
    };
  };
}

/**
 * Obtener URL de un GIF por término (primer resultado)
 * Similar al endpoint "translate" de Giphy
 * 
 * @param term - Término de búsqueda (ej: "pizza", "happy", "cat")
 * @param rating - Clasificación (g, pg, pg-13, r)
 * @returns URL del GIF o string vacío si no hay resultados
 */
export async function giphyGifUrl(
  term: string, 
  rating: 'g' | 'pg' | 'pg-13' | 'r' = 'g'
): Promise<string> {
  try {
    // Detectar idioma del usuario automáticamente
    const userLang = await getUserLanguage().catch(() => 'es');
    const url = `${GIPHY_BASE_URL}/gifs/translate?api_key=${GIPHY_API_KEY}&s=${encodeURIComponent(term)}&rating=${rating}&lang=${userLang}`;
    
    const res = await fetch(url);
    
    if (!res.ok) {
      console.error('[Giphy] Error en API:', res.status);
      return '';
    }
    
    const json = await res.json();
    const id = json?.data?.id;
    
    return id ? `https://media.giphy.com/media/${id}/giphy.gif` : '';
  } catch (error) {
    console.error('[Giphy] Error obteniendo GIF:', error);
    return '';
  }
}

/**
 * Buscar múltiples GIFs por término
 * 
 * @param query - Término de búsqueda
 * @param options - Opciones de búsqueda
 * @returns Array de GIFs con metadata completa
 */
export async function searchGiphy(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    rating?: 'g' | 'pg' | 'pg-13' | 'r';
    lang?: string;
    type?: 'gifs' | 'stickers';
  } = {}
): Promise<GiphyGif[]> {
  const {
    limit = 25,
    offset = 0,
    rating = 'g',
    lang,
    type = 'gifs'
  } = options;

  try {
    // Detectar idioma del usuario automáticamente si no se especifica
    const userLang = lang || await getUserLanguage().catch(() => 'es');
    const url = `${GIPHY_BASE_URL}/${type}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&rating=${rating}&lang=${userLang}`;
    
    const res = await fetch(url);
    
    if (!res.ok) {
      console.error('[Giphy] Error en búsqueda:', res.status);
      return [];
    }
    
    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error('[Giphy] Error buscando GIFs:', error);
    return [];
  }
}

/**
 * Obtener GIFs trending (populares del momento)
 * 
 * @param limit - Cantidad de GIFs a obtener
 * @param rating - Clasificación
 * @returns Array de GIFs trending
 */
export async function getTrendingGifs(
  limit: number = 25,
  rating: 'g' | 'pg' | 'pg-13' | 'r' = 'g',
  type: 'gifs' | 'stickers' = 'gifs'
): Promise<GiphyGif[]> {
  try {
    // Detectar idioma del usuario automáticamente para trending localizados
    const userLang = await getUserLanguage().catch(() => 'es');
    const url = `${GIPHY_BASE_URL}/${type}/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&rating=${rating}`;
    
    const res = await fetch(url);
    
    if (!res.ok) {
      console.error('[Giphy] Error obteniendo trending:', res.status);
      return [];
    }
    
    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error('[Giphy] Error obteniendo trending GIFs:', error);
    return [];
  }
}

/**
 * Obtener un GIF por ID
 * 
 * @param id - ID del GIF en Giphy
 * @returns GIF con metadata completa
 */
export async function getGifById(id: string): Promise<GiphyGif | null> {
  try {
    const url = `${GIPHY_BASE_URL}/gifs/${id}?api_key=${GIPHY_API_KEY}`;
    
    const res = await fetch(url);
    
    if (!res.ok) {
      console.error('[Giphy] Error obteniendo GIF por ID:', res.status);
      return null;
    }
    
    const json = await res.json();
    return json.data || null;
  } catch (error) {
    console.error('[Giphy] Error obteniendo GIF por ID:', error);
    return null;
  }
}

/**
 * Obtener URLs de múltiples comidas/términos
 * Útil para generar ejemplos o seeds
 * 
 * @param terms - Array de términos
 * @returns Map de término → URL del GIF
 */
export async function getGifsForTerms(terms: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  for (const term of terms) {
    const url = await giphyGifUrl(term);
    if (url) {
      results.set(term, url);
    }
    
    // Delay para no saturar la API (rate limit)
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}

/**
 * Helper para obtener la mejor URL según el uso
 * 
 * @param gif - GIF de Giphy
 * @param size - Tamaño deseado
 * @returns URL optimizada
 */
export function getBestGifUrl(
  gif: GiphyGif,
  size: 'original' | 'downsized' | 'fixed_height' | 'fixed_height_small' | 'preview' = 'fixed_height'
): string {
  switch (size) {
    case 'original':
      return gif.images.original.url;
    case 'downsized':
      return gif.images.downsized.url;
    case 'fixed_height':
      return gif.images.fixed_height.url;
    case 'fixed_height_small':
      return gif.images.fixed_height_small.url;
    case 'preview':
      return gif.images.preview_gif.url;
    default:
      return gif.images.fixed_height.url;
  }
}

/**
 * Extraer ID de una URL de Giphy
 * 
 * @param url - URL de Giphy
 * @returns ID del GIF o null
 */
export function extractGiphyId(url: string): string | null {
  try {
    // Formato: https://media.giphy.com/media/{ID}/giphy.gif
    // o: https://giphy.com/gifs/{ID}
    const match = url.match(/\/media\/([^\/]+)\/|\/gifs\/([^\/\?]+)/);
    return match ? (match[1] || match[2]) : null;
  } catch {
    return null;
  }
}

/**
 * Verificar si una URL es de Giphy
 */
export function isGiphyUrl(url: string): boolean {
  return url.includes('giphy.com') || url.includes('media.giphy.com');
}
