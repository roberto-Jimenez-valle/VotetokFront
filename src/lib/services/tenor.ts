/**
 * Servicio para consultar la API de Tenor
 * Obtiene URLs de GIFs de forma sencilla
 */

import { getUserLanguage } from './geolocation';

// API Key de Tenor (Google)
const TENOR_API_KEY = import.meta.env.VITE_TENOR_API_KEY || 'AIzaSyAj08hnYs7VSNW3LK1hrgieRTwaz8hVOEQ';

const TENOR_BASE_URL = 'https://tenor.googleapis.com/v2';

// Client key para identificar la app
const TENOR_CLIENT_KEY = 'votetok';

// Log para verificar que la API Key se cargó correctamente
if (typeof window !== 'undefined') {
  console.log(
    `[Tenor] ✅ API Key configurada`,
    `(${TENOR_API_KEY.substring(0, 12)}...)`
  );
}

/**
 * Resultado de un GIF de Tenor (normalizado para compatibilidad con Giphy)
 */
export interface TenorGif {
  id: string;
  title: string;
  url: string;
  source: 'tenor';
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
 * Respuesta cruda de Tenor API
 */
interface TenorApiResponse {
  results: TenorApiResult[];
  next: string;
}

interface TenorApiResult {
  id: string;
  title: string;
  content_description: string;
  itemurl: string;
  url: string;
  media_formats: {
    gif?: TenorMediaFormat;
    tinygif?: TenorMediaFormat;
    mediumgif?: TenorMediaFormat;
    nanogif?: TenorMediaFormat;
    webm?: TenorMediaFormat;
    mp4?: TenorMediaFormat;
  };
  created: number;
  hasaudio: boolean;
}

interface TenorMediaFormat {
  url: string;
  dims: [number, number];
  duration: number;
  size: number;
}

/**
 * Convierte un resultado de Tenor al formato normalizado compatible con Giphy
 */
function normalizeTenorResult(result: TenorApiResult): TenorGif {
  const media = result.media_formats;
  
  // Obtener las diferentes versiones del GIF
  const original = media.gif || media.mediumgif || media.tinygif;
  const medium = media.mediumgif || media.gif || media.tinygif;
  const small = media.tinygif || media.nanogif || media.mediumgif;
  const nano = media.nanogif || media.tinygif;
  
  return {
    id: `tenor_${result.id}`,
    title: result.content_description || result.title || 'Tenor GIF',
    url: result.itemurl,
    source: 'tenor',
    images: {
      original: {
        url: original?.url || '',
        width: String(original?.dims?.[0] || 0),
        height: String(original?.dims?.[1] || 0),
        size: String(original?.size || 0)
      },
      downsized: {
        url: medium?.url || '',
        width: String(medium?.dims?.[0] || 0),
        height: String(medium?.dims?.[1] || 0),
        size: String(medium?.size || 0)
      },
      fixed_height: {
        url: medium?.url || '',
        width: String(medium?.dims?.[0] || 0),
        height: String(medium?.dims?.[1] || 0)
      },
      fixed_height_small: {
        url: small?.url || '',
        width: String(small?.dims?.[0] || 0),
        height: String(small?.dims?.[1] || 0)
      },
      fixed_width: {
        url: medium?.url || '',
        width: String(medium?.dims?.[0] || 0),
        height: String(medium?.dims?.[1] || 0)
      },
      preview_gif: {
        url: nano?.url || '',
        width: String(nano?.dims?.[0] || 0),
        height: String(nano?.dims?.[1] || 0)
      }
    }
  };
}

/**
 * Buscar múltiples GIFs por término en Tenor
 * 
 * @param query - Término de búsqueda
 * @param options - Opciones de búsqueda
 * @returns Array de GIFs con metadata completa
 */
export async function searchTenor(
  query: string,
  options: {
    limit?: number;
    pos?: string; // Para paginación
    contentfilter?: 'off' | 'low' | 'medium' | 'high';
    lang?: string;
  } = {}
): Promise<TenorGif[]> {
  const {
    limit = 20,
    pos,
    contentfilter = 'medium',
    lang
  } = options;

  try {
    // Detectar idioma del usuario automáticamente si no se especifica
    const userLang = lang || await getUserLanguage().catch(() => 'es');
    
    const params = new URLSearchParams({
      key: TENOR_API_KEY,
      client_key: TENOR_CLIENT_KEY,
      q: query,
      limit: String(limit),
      contentfilter,
      locale: userLang,
      media_filter: 'gif,tinygif,mediumgif,nanogif'
    });
    
    if (pos) {
      params.append('pos', pos);
    }
    
    const url = `${TENOR_BASE_URL}/search?${params.toString()}`;
    
    const res = await fetch(url);
    
    if (!res.ok) {
      console.error('[Tenor] Error en búsqueda:', res.status);
      return [];
    }
    
    const json: TenorApiResponse = await res.json();
    const results = (json.results || []).map(normalizeTenorResult);
    // Añadimos el token 'next' como propiedad extra para permitir paginación exacta
    (results as any).next = json.next || "";
    return results;
  } catch (error) {
    console.error('[Tenor] Error buscando GIFs:', error);
    return [];
  }
}

/**
 * Obtener GIFs trending (populares del momento) de Tenor
 * 
 * @param limit - Cantidad de GIFs a obtener
 * @param contentfilter - Nivel de filtrado de contenido
 * @returns Array de GIFs trending
 */
export async function getTrendingTenor(
  limit: number = 20,
  contentfilter: 'off' | 'low' | 'medium' | 'high' = 'medium'
): Promise<TenorGif[]> {
  try {
    const userLang = await getUserLanguage().catch(() => 'es');
    
    const params = new URLSearchParams({
      key: TENOR_API_KEY,
      client_key: TENOR_CLIENT_KEY,
      limit: String(limit),
      contentfilter,
      locale: userLang,
      media_filter: 'gif,tinygif,mediumgif,nanogif'
    });
    
    const url = `${TENOR_BASE_URL}/featured?${params.toString()}`;
    
    const res = await fetch(url);
    
    if (!res.ok) {
      console.error('[Tenor] Error obteniendo trending:', res.status);
      return [];
    }
    
    const json: TenorApiResponse = await res.json();
    return (json.results || []).map(normalizeTenorResult);
  } catch (error) {
    console.error('[Tenor] Error obteniendo trending GIFs:', error);
    return [];
  }
}

/**
 * Obtener categorías de GIFs de Tenor
 */
export async function getTenorCategories(): Promise<{ searchterm: string; path: string; image: string }[]> {
  try {
    const userLang = await getUserLanguage().catch(() => 'es');
    
    const params = new URLSearchParams({
      key: TENOR_API_KEY,
      client_key: TENOR_CLIENT_KEY,
      locale: userLang,
      type: 'featured'
    });
    
    const url = `${TENOR_BASE_URL}/categories?${params.toString()}`;
    
    const res = await fetch(url);
    
    if (!res.ok) {
      console.error('[Tenor] Error obteniendo categorías:', res.status);
      return [];
    }
    
    const json = await res.json();
    return json.tags || [];
  } catch (error) {
    console.error('[Tenor] Error obteniendo categorías:', error);
    return [];
  }
}

/**
 * Helper para obtener la mejor URL según el uso
 * 
 * @param gif - GIF de Tenor
 * @param size - Tamaño deseado
 * @returns URL optimizada
 */
export function getBestTenorUrl(
  gif: TenorGif,
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
 * Verificar si una URL es de Tenor
 */
export function isTenorUrl(url: string): boolean {
  return url.includes('tenor.com') || url.includes('tenor.googleapis.com');
}

/**
 * Registrar que un GIF fue compartido (para mejorar los resultados de Tenor)
 */
export async function registerTenorShare(gifId: string): Promise<void> {
  try {
    // Extraer el ID real de Tenor (sin el prefijo 'tenor_')
    const realId = gifId.startsWith('tenor_') ? gifId.replace('tenor_', '') : gifId;
    
    const params = new URLSearchParams({
      key: TENOR_API_KEY,
      client_key: TENOR_CLIENT_KEY,
      id: realId
    });
    
    await fetch(`${TENOR_BASE_URL}/registershare?${params.toString()}`);
  } catch (error) {
    // Silenciosamente ignorar errores de registro
    console.warn('[Tenor] Error registrando share:', error);
  }
}
