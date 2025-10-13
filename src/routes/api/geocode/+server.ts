import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

/**
 * GET /api/geocode?lat=40.4168&lon=-3.7038
 * 
 * Determina el país y subdivisión basándose en coordenadas GPS
 * Usa las tablas maestras geográficas para búsqueda rápida por proximidad
 */
export const GET: RequestHandler = async ({ url }) => {
  const lat = parseFloat(url.searchParams.get('lat') || '0');
  const lon = parseFloat(url.searchParams.get('lon') || '0');

  console.log('[Geocode] 📍 Buscando ubicación para:', { lat, lon });

  try {
    // Buscar la subdivisión nivel 1 más cercana
    const subdivisions = await prisma.$queryRaw<Array<{
      id: number;
      subdivision_id: string;
      name: string;
      level: number;
      country_id: number;
      latitude: number;
      longitude: number;
      distance: number;
    }>>`
      SELECT 
        id,
        subdivision_id,
        name,
        level,
        country_id,
        latitude,
        longitude,
        ((latitude - ${lat}) * (latitude - ${lat}) + 
         (longitude - ${lon}) * (longitude - ${lon})) as distance
      FROM subdivisions
      WHERE level = 1
      ORDER BY distance
      LIMIT 1
    `;

    if (!subdivisions || subdivisions.length === 0) {
      console.log('[Geocode] ⚠️ No se encontró subdivisión');
      return json({
        found: false,
        countryIso3: 'ESP',
        countryName: 'España',
        subdivisionId: null,
        subdivisionName: null
      });
    }

    const nearest = subdivisions[0];

    // Obtener información del país
    const country = await prisma.country.findUnique({
      where: { id: nearest.country_id }
    });

    if (!country) {
      console.log('[Geocode] ⚠️ País no encontrado');
      return json({
        found: false,
        countryIso3: 'ESP',
        countryName: 'España',
        subdivisionId: null,
        subdivisionName: null
      });
    }

    const distance = Math.sqrt(nearest.distance);

    console.log('[Geocode] ✅ Ubicación encontrada:', {
      país: country.name,
      iso3: country.iso3,
      subdivisión: nearest.name,
      subdivisionId: nearest.subdivision_id,
      distancia: distance.toFixed(4) + '°'
    });

    return json({
      found: true,
      countryIso3: country.iso3,
      countryName: country.name,
      subdivisionId: nearest.subdivision_id,
      subdivisionName: nearest.name
    });

  } catch (error) {
    console.error('[Geocode] ❌ Error:', error);
    return json({
      found: false,
      countryIso3: 'ESP',
      countryName: 'España',
      subdivisionId: null,
      subdivisionName: null,
      error: String(error)
    }, { status: 500 });
  }
};
