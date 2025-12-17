/**
 * Store para manejar imágenes fallidas con sistema de reintentos limitados
 * Máximo 3 intentos por URL antes de marcarla como permanentemente fallida
 */

const MAX_RETRIES = 3;

// Map de intentos por URL: url -> número de intentos
const retryCount = new Map<string, number>();

// Set de URLs permanentemente fallidas (después de MAX_RETRIES)
const permanentlyFailed = new Set<string>();

/**
 * Normaliza una URL para comparación consistente
 * Extrae la URL original del media-proxy si es necesario
 */
function normalizeUrl(url: string): string {
  if (!url) return '';
  
  // Si es una URL del media-proxy, extraer la URL original
  if (url.includes('/api/media-proxy')) {
    try {
      const urlObj = new URL(url, 'http://localhost');
      const originalUrl = urlObj.searchParams.get('url');
      if (originalUrl) {
        // Normalizar quitando query params de tracking/timestamp
        const decoded = decodeURIComponent(originalUrl);
        return decoded.split('?')[0]; // Quitar query params
      }
    } catch {
      // Si falla, usar la URL tal cual
    }
  }
  
  // Para URLs normales, quitar query params de timestamp
  try {
    return url.split('?')[0];
  } catch {
    return url;
  }
}

/**
 * Registra un intento fallido para una URL
 * Retorna true si la URL debe dejar de intentarse (alcanzó MAX_RETRIES)
 */
export function markImageFailed(url: string): boolean {
  if (!url) return false;
  
  const normalizedUrl = normalizeUrl(url);
  
  // Si ya está permanentemente fallida, no hacer nada
  if (permanentlyFailed.has(normalizedUrl)) return true;
  
  // Incrementar contador de intentos
  const attempts = (retryCount.get(normalizedUrl) || 0) + 1;
  retryCount.set(normalizedUrl, attempts);
  
  // Si alcanzó el máximo, marcar como permanentemente fallida
  if (attempts >= MAX_RETRIES) {
    permanentlyFailed.add(normalizedUrl);
    console.log(`[FailedImages] 🚫 URL bloqueada después de ${MAX_RETRIES} intentos: ${normalizedUrl.substring(0, 60)}...`);
    return true;
  }
  
  console.log(`[FailedImages] ⚠️ Intento ${attempts}/${MAX_RETRIES}: ${normalizedUrl.substring(0, 60)}...`);
  return false;
}

/**
 * Verifica si una URL ha fallado permanentemente (alcanzó MAX_RETRIES)
 */
export function hasImageFailed(url: string): boolean {
  if (!url) return false;
  const normalizedUrl = normalizeUrl(url);
  return permanentlyFailed.has(normalizedUrl);
}

/**
 * Verifica si una URL debe intentarse (no ha alcanzado MAX_RETRIES)
 */
export function shouldRetryImage(url: string): boolean {
  if (!url) return false;
  const normalizedUrl = normalizeUrl(url);
  if (permanentlyFailed.has(normalizedUrl)) return false;
  return (retryCount.get(normalizedUrl) || 0) < MAX_RETRIES;
}

/**
 * Obtiene el número de intentos para una URL
 */
export function getRetryCount(url: string): number {
  return retryCount.get(url) || 0;
}

/**
 * Limpia el caché de imágenes fallidas (útil para refrescar)
 */
export function clearFailedImages(): void {
  retryCount.clear();
  permanentlyFailed.clear();
}

/**
 * Cantidad de URLs permanentemente fallidas
 */
export function getFailedCount(): number {
  return permanentlyFailed.size;
}
