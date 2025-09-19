// Geographic utilities for Globe components

export function isoOf(d: any): string {
  const p = d?.properties ?? {};
  return (p.ISO_A3 ?? '').toString().toUpperCase();
}

export function centroidOf(feat: any): { lat: number; lng: number } {
  const geom = feat?.geometry ?? {};
  const type = geom.type;
  const coords = geom.coordinates;

  // Calculate area-weighted centroid using Shoelace formula
  const calculatePolygonCentroid = (ring: any[]): { lat: number; lng: number; area: number } => {
    if (!ring || ring.length < 3) return { lat: 0, lng: 0, area: 0 };
    
    let area = 0;
    let centroidLat = 0;
    let centroidLng = 0;
    
    // Ensure ring is closed
    const points = ring.slice();
    if (points.length > 0 && (points[0][0] !== points[points.length - 1][0] || points[0][1] !== points[points.length - 1][1])) {
      points.push(points[0]);
    }
    
    for (let i = 0; i < points.length - 1; i++) {
      const x0 = Number(points[i][0]);
      const y0 = Number(points[i][1]);
      const x1 = Number(points[i + 1][0]);
      const y1 = Number(points[i + 1][1]);
      
      if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) continue;
      
      const cross = x0 * y1 - x1 * y0;
      area += cross;
      centroidLat += (y0 + y1) * cross;
      centroidLng += (x0 + x1) * cross;
    }
    
    area = area / 2;
    if (Math.abs(area) < 1e-10) {
      // Fallback to simple average if area is too small
      let sumLat = 0, sumLng = 0, count = 0;
      for (const point of points) {
        if (Array.isArray(point) && point.length >= 2) {
          sumLat += Number(point[1]);
          sumLng += Number(point[0]);
          count++;
        }
      }
      return count > 0 ? { lat: sumLat / count, lng: sumLng / count, area: 0 } : { lat: 0, lng: 0, area: 0 };
    }
    
    centroidLat = centroidLat / (6 * area);
    centroidLng = centroidLng / (6 * area);
    
    return { lat: centroidLat, lng: centroidLng, area: Math.abs(area) };
  };

  let totalArea = 0;
  let weightedLat = 0;
  let weightedLng = 0;

  if (type === 'Polygon' && Array.isArray(coords)) {
    const outer: any[] = coords[0] ?? [];
    const result = calculatePolygonCentroid(outer);
    if (result.area > 0) {
      return { lat: result.lat, lng: result.lng };
    }
  } else if (type === 'MultiPolygon' && Array.isArray(coords)) {
    for (const poly of coords) {
      const outer: any[] = poly?.[0] ?? [];
      const result = calculatePolygonCentroid(outer);
      if (result.area > 0) {
        totalArea += result.area;
        weightedLat += result.lat * result.area;
        weightedLng += result.lng * result.area;
      }
    }
    
    if (totalArea > 0) {
      return { lat: weightedLat / totalArea, lng: weightedLng / totalArea };
    }
  }

  // Fallback: use properties or simple coordinate average
  const p = feat?.properties ?? {};
  const propLat = Number(p.LAT ?? p.lat ?? 0);
  const propLng = Number(p.LON ?? p.LONG ?? p.lng ?? 0);
  
  if (propLat !== 0 || propLng !== 0) {
    return { lat: propLat, lng: propLng };
  }

  // Final fallback: simple coordinate average
  let sumLat = 0, sumLng = 0, count = 0;
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

  return count > 0 ? { lat: sumLat / count, lng: sumLng / count } : { lat: 0, lng: 0 };
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

// Point-in-polygon test using ray casting algorithm
export function pointInPolygon(lat: number, lng: number, ring: number[][]): boolean {
  if (!ring || ring.length < 3) return false;
  
  let inside = false;
  const x = lng;
  const y = lat;
  
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

// Check if a point is inside any polygon of a feature (Polygon or MultiPolygon)
export function pointInFeature(lat: number, lng: number, feat: any): boolean {
  const geom = feat?.geometry ?? {};
  const type = geom.type;
  const coords = geom.coordinates;
  
  if (type === 'Polygon' && Array.isArray(coords)) {
    const outer: number[][] = coords[0] ?? [];
    return pointInPolygon(lat, lng, outer);
  } else if (type === 'MultiPolygon' && Array.isArray(coords)) {
    for (const poly of coords) {
      const outer: number[][] = poly?.[0] ?? [];
      if (pointInPolygon(lat, lng, outer)) {
        return true;
      }
    }
  }
  
  return false;
}
