import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import fs from 'fs';
import path from 'path';
import * as topojson from 'topojson-client';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

/**
 * GET /api/geocode?lat=40.4168&lon=-3.7038
 * 
 * Determina el país y subdivisión basándose en coordenadas GPS
 * Sistema híbrido: point-in-polygon para precisión + fallback a centroides
 */
export const GET: RequestHandler = async ({ url }) => {
  const lat = parseFloat(url.searchParams.get('lat') || '0');
  const lon = parseFloat(url.searchParams.get('lon') || '0');

  console.log('[Geocode] 📍 Buscando ubicación para:', { lat, lon });

  try {
    // PASO 1: Determinar país más cercano (nivel 1) para saber qué TopoJSON cargar
    const nearestCountry = await prisma.$queryRaw<Array<{
      subdivision_id: string;
      name: string;
    }>>`
      SELECT subdivision_id, name
      FROM subdivisions
      WHERE level = 1 
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
      ORDER BY 
        ((latitude - ${lat}) * (latitude - ${lat}) + 
         (longitude - ${lon}) * (longitude - ${lon}))
      LIMIT 1
    `;

    if (!nearestCountry || nearestCountry.length === 0) {
      console.log('[Geocode] ⚠️ No se encontró país cercano');
      return json({ found: false, subdivisionId: null, subdivisionName: null });
    }

    const countryCode = nearestCountry[0].subdivision_id;
    console.log('[Geocode] 🌍 País más cercano:', countryCode, '-', nearestCountry[0].name);

    // PASO 2: Intentar point-in-polygon con TopoJSON del país
    const topoPath = path.join(process.cwd(), 'static', 'geojson', countryCode, `${countryCode}.topojson`);
    
    console.log('[Geocode] 📂 Buscando TopoJSON:', topoPath);
    console.log('[Geocode] 📂 Existe:', fs.existsSync(topoPath));
    
    if (fs.existsSync(topoPath)) {
      try {
        console.log('[Geocode] 📖 Leyendo TopoJSON...');
        const topoData = JSON.parse(fs.readFileSync(topoPath, 'utf-8'));
        const geoJSON: any = topojson.feature(topoData, topoData.objects[Object.keys(topoData.objects)[0]]);
        const testPoint = point([lon, lat]);
        
        console.log('[Geocode] 🔍 Probando', geoJSON.features.length, 'polígonos...');

        // Buscar en qué polígono cae el punto
        for (const feature of geoJSON.features) {
          if (booleanPointInPolygon(testPoint, feature)) {
            const props = feature.properties;
            const subdivisionId = props.ID_1 || props.id_1;
            
            console.log('[Geocode] 🎯 Punto dentro de:', props.NAME_1 || props.name_1, `(${subdivisionId})`);
            
            if (subdivisionId) {
              // Encontrado con point-in-polygon!
              const subdivision = await prisma.subdivision.findFirst({
                where: { subdivisionId, level: 2 }
              });

              if (subdivision) {
                console.log('[Geocode] ✅ Point-in-polygon:', subdivision.name, `(${subdivisionId})`);
                return json({
                  found: true,
                  subdivisionId: subdivision.id,
                  subdivisionName: subdivision.name,
                  subdivisionLevel: 2,
                  method: 'point-in-polygon'
                });
              } else {
                console.log('[Geocode] ⚠️ subdivisionId no encontrado en BD:', subdivisionId);
              }
            }
          }
        }
        
        console.log('[Geocode] ⚠️ Punto no está dentro de ningún polígono');
      } catch (error) {
        console.error('[Geocode] ❌ Error en point-in-polygon:', error);
        console.error('[Geocode] Stack:', (error as Error).stack);
      }
    } else {
      console.log('[Geocode] ⚠️ TopoJSON no existe para', countryCode);
    }

    // PASO 3: Fallback inteligente - buscar en subdivisiones del país detectado
    console.log('[Geocode] 🔄 Fallback: buscando subdivisiones del país', countryCode, '...');
    
    // Primero buscar subdivisiones nivel 2 y 3 del país específico
    const countrySubdivisions = await prisma.$queryRaw<Array<{
      id: number;
      subdivision_id: string;
      name: string;
      level: number;
      latitude: number;
      longitude: number;
      distance: number;
    }>>`
      SELECT 
        id,
        subdivision_id,
        name,
        level,
        latitude,
        longitude,
        ((latitude - ${lat}) * (latitude - ${lat}) + 
         (longitude - ${lon}) * (longitude - ${lon})) as distance
      FROM subdivisions
      WHERE subdivision_id LIKE ${countryCode + '.%'}
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
        AND latitude != 0 
        AND longitude != 0
      ORDER BY 
        CASE 
          WHEN level = 3 THEN 1
          WHEN level = 2 THEN 2
        END,
        distance
      LIMIT 1
    `;
    
    // Si no hay subdivisiones, buscar globalmente
    const subdivisions = countrySubdivisions.length > 0 ? countrySubdivisions : await prisma.$queryRaw<Array<{
      id: number;
      subdivision_id: string;
      name: string;
      level: number;
      latitude: number;
      longitude: number;
      distance: number;
    }>>`
      SELECT 
        id,
        subdivision_id,
        name,
        level,
        latitude,
        longitude,
        ((latitude - ${lat}) * (latitude - ${lat}) + 
         (longitude - ${lon}) * (longitude - ${lon})) as distance
      FROM subdivisions
      WHERE latitude IS NOT NULL 
        AND longitude IS NOT NULL
        AND latitude != 0 
        AND longitude != 0
      ORDER BY 
        CASE 
          WHEN level = 3 THEN 1
          WHEN level = 2 THEN 2
          WHEN level = 1 THEN 3
        END,
        distance
      LIMIT 1
    `;

    if (!subdivisions || subdivisions.length === 0) {
      console.log('[Geocode] ⚠️ No se encontró ninguna subdivisión');
      return json({
        found: false,
        subdivisionId: null,
        subdivisionName: null
      });
    }

    const nearest = subdivisions[0];
    const distance = Math.sqrt(nearest.distance);

    console.log('[Geocode] ✅ Centroide más cercano:', {
      id: nearest.id,
      subdivisionId: nearest.subdivision_id,
      subdivisión: nearest.name,
      nivel: nearest.level,
      distancia: distance.toFixed(4) + '°',
      method: 'centroid-fallback'
    });

    return json({
      found: true,
      subdivisionId: nearest.id,  // Retornar ID de BD, no string
      subdivisionName: nearest.name,
      subdivisionLevel: nearest.level,
      method: 'centroid-fallback'
    });

  } catch (error) {
    console.error('[Geocode] ❌ Error:', error);
    return json({
      found: false,
      subdivisionId: null,
      subdivisionName: null,
      error: String(error)
    }, { status: 500 });
  }
};
