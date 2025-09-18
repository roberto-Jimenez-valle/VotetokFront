// Geographic utilities for Globe components

export function isoOf(d: any): string {
  const p = d?.properties ?? {};
  return (p.ISO_A3 ?? '').toString().toUpperCase();
}

export function centroidOf(feat: any): { lat: number; lng: number } {
  const geom = feat?.geometry ?? {};
  const type = geom.type;
  const coords = geom.coordinates;
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;

  const accRing = (ring: any[]) => {
    for (const c of ring) {
      if (Array.isArray(c) && c.length >= 2) {
        const lng = Number(c[0]);
        const lat = Number(c[1]);
        if (isFinite(lat) && isFinite(lng)) {
          sumLat += lat;
          sumLng += lng;
          count++;
        }
      }
    }
  };

  if (type === 'Polygon' && Array.isArray(coords)) {
    const outer: any[] = coords[0] ?? [];
    accRing(outer);
  } else if (type === 'MultiPolygon' && Array.isArray(coords)) {
    for (const poly of coords) {
      const outer: any[] = poly?.[0] ?? [];
      accRing(outer);
    }
  }

  if (count === 0) {
    const p = feat?.properties ?? {};
    const lat = Number(p.LAT ?? p.lat ?? 0) || 0;
    const lng = Number(p.LON ?? p.LONG ?? p.lng ?? 0) || 0;
    return { lat, lng };
  }
  return { lat: sumLat / count, lng: sumLng / count };
}

export function toRad(v: number): number { return (v * Math.PI) / 180; }

export function distKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371; // km
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s1 + s2)));
}
