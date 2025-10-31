import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { GeocodingService } from '../GeocodingService';

// Mock de fetch global
global.fetch = vi.fn();

// Mock de navigator.geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn()
};

Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true
});

describe('GeocodingService', () => {
  let service: GeocodingService;

  beforeEach(() => {
    service = GeocodingService.getInstance();
    service.clearCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = GeocodingService.getInstance();
      const instance2 = GeocodingService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getUserLocation', () => {
    it('should get GPS location when available', async () => {
      const mockPosition = {
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10
        }
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition);
      });

      const location = await service.getUserLocation();

      expect(location).toEqual({
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10,
        method: 'gps'
      });

      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 300000
        }
      );
    });

    it('should fallback to IP location when GPS fails', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
        error(new Error('GPS not available'));
      });

      const mockIPResponse = {
        latitude: 40.7128,
        longitude: -74.0060,
        city: 'New York',
        country_name: 'United States'
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockIPResponse
      });

      const location = await service.getUserLocation();

      expect(location).toEqual({
        latitude: 40.7128,
        longitude: -74.0060,
        method: 'ip'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://ipapi.co/json/',
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });

    it('should return default location when all methods fail', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
        error(new Error('GPS not available'));
      });

      (global.fetch as Mock).mockRejectedValueOnce(new Error('Network error'));

      const location = await service.getUserLocation();

      expect(location).toEqual({
        latitude: 40.4168,
        longitude: -3.7038,
        method: 'default'
      });
    });

    it('should use cached GPS location within cache duration', async () => {
      const mockPosition = {
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10
        }
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition);
      });

      // Primera llamada
      await service.getUserLocation();
      
      // Segunda llamada (debería usar cache)
      const location = await service.getUserLocation();

      // getCurrentPosition solo debe llamarse una vez
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
      
      expect(location).toEqual({
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10,
        method: 'gps'
      });
    });
  });

  describe('reverseGeocode', () => {
    it('should return subdivision from coordinates', async () => {
      const mockResponse = {
        subdivisionId: 123,
        subdivisionName: 'Madrid',
        level: 2,
        countryIso: 'ESP',
        countryName: 'Spain',
        method: 'point-in-polygon'
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await service.reverseGeocode(40.4168, -3.7038);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/geocode?lat=40.4168&lon=-3.7038')
      );
    });

    it('should cache geocoding results', async () => {
      const mockResponse = {
        subdivisionId: 123,
        subdivisionName: 'Madrid',
        level: 2,
        countryIso: 'ESP',
        countryName: 'Spain',
        method: 'point-in-polygon'
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Primera llamada
      await service.reverseGeocode(40.4168, -3.7038);
      
      // Segunda llamada (debería usar cache)
      const result = await service.reverseGeocode(40.4168, -3.7038);

      // Fetch solo debe llamarse una vez
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse);
    });

    it('should return null on API error', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await service.reverseGeocode(40.4168, -3.7038);

      expect(result).toBeNull();
    });
  });

  describe('searchPlaces', () => {
    it('should search places by query', async () => {
      const mockResults = [
        {
          name: 'Madrid',
          type: 'city',
          iso: 'ESP',
          coordinates: [-3.7038, 40.4168]
        },
        {
          name: 'Madrid Province',
          type: 'subdivision',
          id: '123',
          coordinates: [-3.7038, 40.4168]
        }
      ];

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockResults })
      });

      const results = await service.searchPlaces('Madrid');

      expect(results).toEqual(mockResults);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/places?q=Madrid')
      );
    });

    it('should return empty array for short queries', async () => {
      const results = await service.searchPlaces('M');
      
      expect(results).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return empty array on API error', async () => {
      (global.fetch as Mock).mockRejectedValueOnce(new Error('Network error'));

      const results = await service.searchPlaces('Madrid');

      expect(results).toEqual([]);
    });
  });

  describe('getRegionCentroid', () => {
    it('should get country centroid', async () => {
      const mockCentroid = {
        longitude: -3.7038,
        latitude: 40.4168
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCentroid
      });

      const result = await service.getRegionCentroid('country', 'ESP');

      expect(result).toEqual([-3.7038, 40.4168]);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/data/countries/ESP/centroid')
      );
    });

    it('should get subdivision centroid', async () => {
      const mockCentroid = {
        lon: -3.7038,
        lat: 40.4168
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCentroid
      });

      const result = await service.getRegionCentroid('subdivision', '123');

      expect(result).toEqual([-3.7038, 40.4168]);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/data/subdivisions/123/centroid')
      );
    });

    it('should cache centroid permanently', async () => {
      const mockCentroid = {
        longitude: -3.7038,
        latitude: 40.4168
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCentroid
      });

      // Primera llamada
      await service.getRegionCentroid('country', 'ESP');
      
      // Segunda llamada (debería usar cache)
      const result = await service.getRegionCentroid('country', 'ESP');

      // Fetch solo debe llamarse una vez
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual([-3.7038, 40.4168]);
    });
  });

  describe('pointInPolygon', () => {
    it('should check if point is inside polygon', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ inside: true })
      });

      const result = await service.pointInPolygon(
        [-3.7038, 40.4168],
        'ESP',
        '123'
      );

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/geocode/point-in-polygon'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            point: [-3.7038, 40.4168],
            countryIso: 'ESP',
            subdivisionId: '123'
          })
        })
      );
    });

    it('should return false on API error', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false
      });

      const result = await service.pointInPolygon(
        [-3.7038, 40.4168],
        'ESP'
      );

      expect(result).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    describe('formatCoordinates', () => {
      it('should format coordinates correctly', () => {
        expect(service.formatCoordinates(40.4168, -3.7038))
          .toBe('40.4168°N, 3.7038°W');
        
        expect(service.formatCoordinates(-33.8688, 151.2093))
          .toBe('33.8688°S, 151.2093°E');
        
        expect(service.formatCoordinates(0, 0))
          .toBe('0.0000°N, 0.0000°E');
      });
    });

    describe('calculateDistance', () => {
      it('should calculate distance between two points', () => {
        // Madrid to Barcelona (approx 504 km)
        const distance = service.calculateDistance(
          40.4168, -3.7038, // Madrid
          41.3851, 2.1734   // Barcelona
        );
        
        expect(distance).toBeCloseTo(504, -1);
      });

      it('should return 0 for same points', () => {
        const distance = service.calculateDistance(
          40.4168, -3.7038,
          40.4168, -3.7038
        );
        
        expect(distance).toBe(0);
      });
    });

    describe('Cache Management', () => {
      it('should clear cache', () => {
        service.clearCache();
        expect(service.getCacheSize()).toBe(0);
      });

      it('should report cache size', async () => {
        const mockResponse = {
          subdivisionId: 123,
          subdivisionName: 'Madrid'
        };

        (global.fetch as Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        });

        await service.reverseGeocode(40.4168, -3.7038);
        
        expect(service.getCacheSize()).toBeGreaterThan(0);
      });
    });
  });
});
