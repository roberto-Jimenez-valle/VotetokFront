import { apiCall } from '$lib/api/client';

/**
 * Servicio de Geocoding
 * Maneja toda la lógica de geolocalización y geocoding
 */
export class GeocodingService {
  private static instance: GeocodingService;
  private locationCache: Map<string, any> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  private constructor() {}

  /**
   * Singleton pattern
   */
  static getInstance(): GeocodingService {
    if (!GeocodingService.instance) {
      GeocodingService.instance = new GeocodingService();
    }
    return GeocodingService.instance;
  }

  /**
   * Obtener ubicación del usuario usando múltiples métodos
   */
  async getUserLocation(): Promise<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    method: 'gps' | 'ip' | 'default';
  }> {
    // Intentar primero GPS
    try {
      const gpsLocation = await this.getGPSLocation();
      if (gpsLocation) return gpsLocation;
    } catch (error) {
      console.log('[Geocoding] GPS no disponible, intentando IP');
    }

    // Fallback a IP geolocation
    try {
      const ipLocation = await this.getIPLocation();
      if (ipLocation) return ipLocation;
    } catch (error) {
      console.log('[Geocoding] IP geolocation falló, usando default');
    }

    // Fallback final: Madrid
    return {
      latitude: 40.4168,
      longitude: -3.7038,
      method: 'default'
    };
  }

  /**
   * Obtener ubicación por GPS
   */
  private async getGPSLocation(): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number;
    method: 'gps';
  } | null> {
    // Verificar caché
    const cached = this.locationCache.get('gps');
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    if (!navigator.geolocation) {
      throw new Error('Geolocation not supported');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('GPS timeout'));
      }, 5000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeout);
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            method: 'gps' as const
          };
          
          // Guardar en caché
          this.locationCache.set('gps', {
            data: location,
            timestamp: Date.now()
          });
          
          resolve(location);
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 300000 // 5 minutos
        }
      );
    });
  }

  /**
   * Obtener ubicación por IP
   */
  private async getIPLocation(): Promise<{
    latitude: number;
    longitude: number;
    method: 'ip';
  } | null> {
    const cached = this.locationCache.get('ip');
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await fetch('https://ipapi.co/json/', {
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) {
        throw new Error('IP geolocation failed');
      }

      const data = await response.json();
      
      const location = {
        latitude: data.latitude,
        longitude: data.longitude,
        method: 'ip' as const
      };
      
      // Guardar en caché
      this.locationCache.set('ip', {
        data: location,
        timestamp: Date.now()
      });
      
      return location;
    } catch (error) {
      console.error('[Geocoding] IP location error:', error);
      return null;
    }
  }

  /**
   * Geocoding reverso: coordenadas -> subdivisión
   */
  async reverseGeocode(
    latitude: number, 
    longitude: number
  ): Promise<{
    subdivisionId: number;
    subdivisionName: string;
    level: number;
    countryIso: string;
    countryName: string;
    method: 'point-in-polygon' | 'centroid-fallback';
  } | null> {
    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const cached = this.locationCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await apiCall(
        `/api/geocode?lat=${latitude}&lon=${longitude}`
      );

      if (!response.ok) {
        throw new Error('Geocoding failed');
      }

      const result = await response.json();
      
      // Guardar en caché
      this.locationCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      console.error('[Geocoding] Reverse geocode error:', error);
      return null;
    }
  }

  /**
   * Buscar lugares por texto
   */
  async searchPlaces(query: string): Promise<Array<{
    name: string;
    type: 'country' | 'subdivision' | 'city';
    iso?: string;
    id?: string;
    coordinates?: [number, number];
  }>> {
    if (!query || query.length < 2) return [];

    try {
      const response = await apiCall(
        `/api/search/places?q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error('Place search failed');
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('[Geocoding] Search places error:', error);
      return [];
    }
  }

  /**
   * Obtener centroide de una región
   */
  async getRegionCentroid(
    type: 'country' | 'subdivision',
    id: string
  ): Promise<[number, number] | null> {
    const cacheKey = `centroid_${type}_${id}`;
    const cached = this.locationCache.get(cacheKey);
    
    if (cached) {
      return cached.data;
    }

    try {
      const endpoint = type === 'country' 
        ? `/api/data/countries/${id}/centroid`
        : `/api/data/subdivisions/${id}/centroid`;
        
      const response = await apiCall(endpoint);

      if (!response.ok) {
        throw new Error('Failed to get centroid');
      }

      const result = await response.json();
      const centroid: [number, number] = [
        result.longitude || result.lon,
        result.latitude || result.lat
      ];
      
      // Guardar en caché permanente
      this.locationCache.set(cacheKey, {
        data: centroid,
        timestamp: Infinity // No expira
      });
      
      return centroid;
    } catch (error) {
      console.error('[Geocoding] Get centroid error:', error);
      return null;
    }
  }

  /**
   * Verificar si un punto está dentro de un polígono
   */
  async pointInPolygon(
    point: [number, number],
    countryIso: string,
    subdivisionId?: string
  ): Promise<boolean> {
    try {
      const response = await apiCall('/api/geocode/point-in-polygon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          point,
          countryIso,
          subdivisionId
        })
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.inside || false;
    } catch (error) {
      console.error('[Geocoding] Point in polygon error:', error);
      return false;
    }
  }

  /**
   * Limpiar caché
   */
  clearCache() {
    this.locationCache.clear();
  }

  /**
   * Obtener tamaño del caché
   */
  getCacheSize(): number {
    return this.locationCache.size;
  }

  /**
   * Formatear coordenadas para display
   */
  formatCoordinates(lat: number, lon: number): string {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    
    return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
  }

  /**
   * Calcular distancia entre dos puntos (Haversine)
   */
  calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distancia en km
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

// Exportar instancia única
export const geocodingService = GeocodingService.getInstance();

export default geocodingService;
