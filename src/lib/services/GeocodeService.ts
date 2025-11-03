/**
 * Geocoding Service
 * Maneja la geolocalización y conversión de coordenadas a subdivisiones
 */

import { apiCall } from '$lib/api/client';

export interface GeocodeResult {
  found: boolean;
  subdivisionId: number | null;
  subdivisionName: string | null;
  subdivisionLevel?: number;
  method?: 'point-in-polygon' | 'centroid-fallback';
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  source: 'gps' | 'ip' | 'default';
}

/**
 * GeocodeService - Servicio para geolocalización y geocoding
 */
export class GeocodeService {
  private gpsCache: {
    coords: GeolocationCoordinates | null;
    timestamp: number;
  } = {
    coords: null,
    timestamp: 0
  };

  private readonly GPS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  private readonly GPS_TIMEOUT = 5000; // 5 segundos
  private readonly IP_TIMEOUT = 3000; // 3 segundos

  /**
   * Obtener ubicación del usuario con fallbacks
   * 1. GPS (más preciso)
   * 2. IP geolocation (no requiere permiso)
   * 3. Default (Madrid)
   */
  async getUserLocation(): Promise<LocationData> {
    console.log('[GeocodeService] 📍 Obteniendo ubicación del usuario...');

    // Intentar GPS primero
    const gpsLocation = await this.getGPSLocation();
    if (gpsLocation) {
      console.log('[GeocodeService] ✅ GPS obtenido:', gpsLocation);
      return gpsLocation;
    }

    // Fallback a IP geolocation
    const ipLocation = await this.getIPLocation();
    if (ipLocation) {
      console.log('[GeocodeService] ✅ IP geolocation obtenido:', ipLocation);
      return ipLocation;
    }

    // Fallback final: Madrid
    console.log('[GeocodeService] ⚠️ Usando ubicación por defecto (Madrid)');
    return {
      latitude: 40.4168,
      longitude: -3.7038,
      source: 'default'
    };
  }

  /**
   * Obtener ubicación por GPS
   */
  private async getGPSLocation(): Promise<LocationData | null> {
    // Check cache
    const now = Date.now();
    if (this.gpsCache.coords && (now - this.gpsCache.timestamp) < this.GPS_CACHE_DURATION) {
      console.log('[GeocodeService] 📦 Usando GPS desde cache');
      return {
        latitude: this.gpsCache.coords.latitude,
        longitude: this.gpsCache.coords.longitude,
        accuracy: this.gpsCache.coords.accuracy,
        source: 'gps'
      };
    }

    // Check browser support
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      console.log('[GeocodeService] ⚠️ Geolocation no soportada por el navegador');
      return null;
    }

    try {
      const position = await this.promiseWithTimeout(
        new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: this.GPS_TIMEOUT,
            maximumAge: this.GPS_CACHE_DURATION
          });
        }),
        this.GPS_TIMEOUT
      );

      // Guardar en cache
      this.gpsCache = {
        coords: position.coords,
        timestamp: Date.now()
      };

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        source: 'gps'
      };
    } catch (error) {
      console.log('[GeocodeService] ⚠️ Error obteniendo GPS:', error);
      return null;
    }
  }

  /**
   * Obtener ubicación por IP
   */
  private async getIPLocation(): Promise<LocationData | null> {
    try {
      const response = await this.promiseWithTimeout(
        fetch('https://ipapi.co/json/'),
        this.IP_TIMEOUT
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.latitude && data.longitude) {
        console.log('[GeocodeService] 📡 IP Location:', {
          city: data.city,
          region: data.region,
          country: data.country_name,
          coords: { lat: data.latitude, lon: data.longitude }
        });

        return {
          latitude: data.latitude,
          longitude: data.longitude,
          source: 'ip'
        };
      }

      return null;
    } catch (error) {
      console.log('[GeocodeService] ⚠️ Error obteniendo IP location:', error);
      return null;
    }
  }

  /**
   * Geocodificar coordenadas a subdivisión
   * Usa el endpoint /api/geocode que implementa point-in-polygon + fallback
   */
  async geocodeCoordinates(lat: number, lon: number): Promise<GeocodeResult> {
    try {
      const response = await apiCall(`/api/geocode?lat=${lat}&lon=${lon}`);
      
      if (!response.ok) {
        throw new Error(`Geocode API error: ${response.status}`);
      }

      const result = await response.json();
      
      console.log('[GeocodeService] 🌍 Geocode result:', result);
      
      return result;
    } catch (error) {
      console.error('[GeocodeService] ❌ Error en geocoding:', error);
      return {
        found: false,
        subdivisionId: null,
        subdivisionName: null
      };
    }
  }

  /**
   * Flujo completo: obtener ubicación y geocodificar
   */
  async getLocationAndGeocode(): Promise<{
    location: LocationData;
    geocode: GeocodeResult;
  }> {
    const location = await this.getUserLocation();
    const geocode = await this.geocodeCoordinates(location.latitude, location.longitude);

    return { location, geocode };
  }

  /**
   * Limpiar cache de GPS
   */
  clearCache(): void {
    this.gpsCache = {
      coords: null,
      timestamp: 0
    };
  }

  /**
   * Helper: Promise con timeout
   */
  private promiseWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]);
  }
}

// Singleton instance
export const geocodeService = new GeocodeService();
