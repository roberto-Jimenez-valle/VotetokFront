/**
 * Servicio para obtener la ubicación del usuario
 */

interface LocationInfo {
  country: string;
  countryCode: string;
  language: string;
  timezone: string;
}

let cachedLocation: LocationInfo | null = null;

/**
 * Detectar el país del usuario usando múltiples fuentes
 */
export async function getUserLocation(): Promise<LocationInfo> {
  // Si ya tenemos la ubicación en caché, retornarla
  if (cachedLocation) {
    return cachedLocation;
  }

  try {
    // Intentar con la API de ipapi.co (gratuita, sin necesidad de API key)
    const response = await fetch('https://ipapi.co/json/', {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      cachedLocation = {
        country: data.country_name || 'Unknown',
        countryCode: data.country_code || 'US',
        language: data.languages?.split(',')[0] || 'en',
        timezone: data.timezone || 'UTC'
      };
      
      console.log('[Geolocation] País detectado:', cachedLocation.country, `(${cachedLocation.countryCode})`);
      return cachedLocation;
    }
  } catch (error) {
    console.warn('[Geolocation] Error detectando ubicación con ipapi.co:', error);
  }

  // Fallback: usar el timezone del navegador para inferir el idioma
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const locale = navigator.language || 'en-US';
    const [lang, country] = locale.split('-');

    cachedLocation = {
      country: country || 'US',
      countryCode: country || 'US',
      language: lang || 'en',
      timezone: timezone
    };

    console.log('[Geolocation] Usando configuración del navegador:', locale);
    return cachedLocation;
  } catch (error) {
    console.warn('[Geolocation] Error usando configuración del navegador:', error);
  }

  // Fallback final: valores por defecto
  cachedLocation = {
    country: 'Spain',
    countryCode: 'ES',
    language: 'es',
    timezone: 'Europe/Madrid'
  };

  console.log('[Geolocation] Usando valores por defecto (España)');
  return cachedLocation;
}

/**
 * Obtener el código de idioma para usar en APIs
 */
export async function getUserLanguage(): Promise<string> {
  const location = await getUserLocation();
  return location.language;
}

/**
 * Obtener el código de país ISO 3166-1 alpha-2
 */
export async function getUserCountryCode(): Promise<string> {
  const location = await getUserLocation();
  return location.countryCode;
}

/**
 * Limpiar caché de ubicación (útil para testing)
 */
export function clearLocationCache(): void {
  cachedLocation = null;
}
