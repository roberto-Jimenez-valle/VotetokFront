// Utilidades para trabajar con encuestas y datos de la API

export interface HistoricalDataPoint {
  x: number; // timestamp
  y: number; // percentage
  votes: number;
}

/**
 * Cargar datos históricos desde la API
 */
export async function loadHistoricalData(
  pollId: number, 
  days: number = 30
): Promise<HistoricalDataPoint[]> {
  try {
    const response = await fetch(`/api/polls/${pollId}/history?days=${days}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const { data } = await response.json();
    
    return data.map((item: any) => ({
      x: new Date(item.recordedAt).getTime(),
      y: item.percentage,
      votes: item.voteCount,
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Cargar estadísticas de una encuesta
 */
export async function loadPollStats(pollId: number) {
  try {
    const response = await fetch(`/api/polls/${pollId}/stats`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const { data } = await response.json();
    return data;
  } catch (error) {
    return null;
  }
}

/**
 * Cargar votos geolocalizados
 */
export async function loadGeoVotes(params: {
  pollId: number;
  country?: string;
  subdivision?: string;
  city?: string;
}) {
  try {
    const searchParams = new URLSearchParams({
      poll: params.pollId.toString(),
    });
    
    if (params.country) searchParams.set('country', params.country);
    if (params.subdivision) searchParams.set('subdivision', params.subdivision);
    if (params.city) searchParams.set('city', params.city);
    
    const response = await fetch(`/api/votes/geo?${searchParams}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const { data } = await response.json();
    return data;
  } catch (error) {
    return [];
  }
}

/**
 * Formatear número con k, M
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

/**
 * Formatear tiempo relativo
 */
export function getRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) return `${diffMins}min`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
  if (diffMins < 43200) return `${Math.floor(diffMins / 1440)}d`;
  return `${Math.floor(diffMins / 525600)}a`;
}

/**
 * Obtener avatar por defecto si no existe
 */
export function getAvatarUrl(url?: string | null): string {
  return url || '/default-avatar.png';
}

/**
 * Generar color basado en string (para consistencia)
 */
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
}
