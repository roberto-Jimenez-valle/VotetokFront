import { json, type RequestHandler } from '@sveltejs/kit';
import { FILE_MAP } from '$lib/config/file-map';
import { isoOf, centroidOf } from '$lib/utils/geo';

// Helper: parse number or fallback
function num(v: string | null, fb: number) {
  const n = v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fb;
}

// Test if a point (lat,lng) is inside bbox; supports antimeridian wrap
function pointInBbox(lat: number, lng: number, bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number }) {
  const { minLat, maxLat, minLng, maxLng } = bbox;
  if (lat < Math.min(minLat, maxLat) || lat > Math.max(minLat, maxLat)) return false;
  // handle wrap-around: if minLng <= maxLng, normal; else it's wrapping
  if (minLng <= maxLng) {
    return lng >= minLng && lng <= maxLng;
  } else {
    // region crosses antimeridian; valid if lng >= minLng OR lng <= maxLng
    return lng >= minLng || lng <= maxLng;
  }
}

export const GET: RequestHandler = async ({ fetch, url }) => {
  try {
    // Read bbox from query
    const minLat = num(url.searchParams.get('minLat'), -90);
    const minLng = num(url.searchParams.get('minLng'), -180);
    const maxLat = num(url.searchParams.get('maxLat'), 90);
    const maxLng = num(url.searchParams.get('maxLng'), 180);
    const bbox = { minLat, minLng, maxLat, maxLng };

    // Load base world map and data
    const [mapRes, dataRes] = await Promise.all([
      fetch(FILE_MAP.getPath('maps', 'world.topojson')),
      fetch(FILE_MAP.getPath('data', 'WORLD.json'))
    ]);
    if (!mapRes.ok) return json({ error: 'Map not found' }, { status: 404 });
    if (!dataRes.ok) return json({ error: 'Data not found' }, { status: 404 });

    const world = await mapRes.json();
    const dataJson = await dataRes.json();

    const features: any[] = Array.isArray(world?.features) ? world.features : [];

    // Build a set of ISO codes whose centroid falls inside the bbox
    const inside = new Set<string>();
    for (const f of features) {
      try {
        const c = centroidOf(f);
        if (pointInBbox(c.lat, c.lng, bbox)) {
          const iso = isoOf(f);
          if (iso) inside.add(iso);
        }
      } catch {}
    }

    // Filter ANSWERS by ISO set
    const ANSWERS: Record<string, Record<string, number>> = {};
    const baseAnswers: Record<string, Record<string, number>> = dataJson?.ANSWERS ?? {};
    for (const [iso, rec] of Object.entries(baseAnswers)) {
      if (inside.has(iso)) ANSWERS[iso] = { ...rec };
    }

    const colors = dataJson?.colors ?? {};

    return json({ ANSWERS, colors, votes: [] });
  } catch (err) {
    console.error('answers bbox endpoint error:', err);
    return json({ error: 'Internal error' }, { status: 500 });
  }
};
