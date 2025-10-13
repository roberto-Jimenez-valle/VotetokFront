export type LegendItem = { key: string; color: string; count: number };

export interface GlobeDataJson {
  ANSWERS?: Record<string, Record<string, number>>;
  colors?: Record<string, string>;
}

export interface ComputeResult {
  polygons: any[];
  isoDominantKey: Record<string, string>;
  legendItems: LegendItem[];
  trendingTags: Array<{ key: string; count: number }>;
  tagTotals: Record<string, number>;
  tagMin: number;
  tagMax: number;
  isoIntensity: Record<string, number>;
  intensityMin: number;
  intensityMax: number;
}

import { isoOf } from '$lib/utils/geo';
import { getDominantKey as getDominantKeyUtil } from '$lib/utils/globeHelpers';

/**
 * Extrae el identificador de un feature (puede ser ISO_A3, ID_1, ID_2, etc.)
 * IMPORTANTE: Buscar del más específico al más general
 */
export function getFeatureId(f: any): string {
  const p = f?.properties ?? {};
  
  // Nivel 3 (sub-subdivisiones): ID_2, GID_2, etc. - MÁS ESPECÍFICO
  if (p.ID_2 || p.id_2 || p.GID_2 || p.gid_2) {
    return String(p.ID_2 || p.id_2 || p.GID_2 || p.gid_2);
  }
  
  // Nivel 2 (subdivisiones): ID_1, GID_1, etc.
  if (p.ID_1 || p.id_1 || p.GID_1 || p.gid_1) {
    return String(p.ID_1 || p.id_1 || p.GID_1 || p.gid_1);
  }
  
  // Nivel 1 (países): ISO_A3 - MENOS ESPECÍFICO
  if (p.ISO_A3) {
    return p.ISO_A3.toString().toUpperCase();
  }
  
  // Sin ID válido
  return '';
}

export function computeGlobeViewModel(geo: any, dataJson: GlobeDataJson): ComputeResult {
  const answersData = dataJson?.ANSWERS ?? {};
  const colorMap = dataJson?.colors ?? {};

      
  const features: any[] = Array.isArray(geo?.features) ? geo.features : [];
  // Filtra Antártida si aparece como ISO3 ATA o nombre
  const data = features.filter((f) => {
    const p = f?.properties ?? {};
    const iso3 = (p.ISO_A3 ?? '').toString().toUpperCase();
    const name = (p.ADMIN ?? p.NAME ?? p.name ?? '').toString().toUpperCase();
    return iso3 !== 'ATA' && name !== 'ANTARCTICA';
  });

  
  // Claves dominantes por ID y conteo para leyenda
  const isoDominantKey: Record<string, string> = {};
  const counts: Record<string, number> = {};
  
  for (const f of data) {
    // Usar getFeatureId en lugar de isoOf para soportar todos los niveles
    const featureId = getFeatureId(f);
    
    if (!featureId) {
      continue;
    }
    
    const key = getDominantKeyUtil(featureId, answersData);
    isoDominantKey[featureId] = key;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  
    const legendItems = Object.keys(colorMap || {})
    .filter((k) => k in counts)
    .map((k) => ({ key: k, color: colorMap[k], count: counts[k] }))
    .sort((a, b) => b.count - a.count);

  // Trending por volumen total
  const tagTotals: Record<string, number> = {};
  for (const rec of Object.values(answersData)) {
    for (const [k, v] of Object.entries(rec)) {
      const n = typeof v === 'number' ? v : Number(v) || 0;
      tagTotals[k] = (tagTotals[k] ?? 0) + n;
    }
  }
  const totVals = Object.values(tagTotals);
  const tagMin = totVals.length ? Math.min(...totVals) : 0;
  const tagMax = totVals.length ? Math.max(...totVals) : 1;
  const trendingTags = Object.entries(tagTotals)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Intensidad por región (funciona en todos los niveles)
  const isoIntensity: Record<string, number> = {};
  const vals: number[] = [];
  for (const f of data) {
    const featureId = getFeatureId(f);
    const rec = answersData?.[featureId];
    if (rec) {
      const sum = Object.values(rec).reduce((acc, v) => acc + (typeof v === 'number' ? v : Number(v) || 0), 0);
      isoIntensity[featureId] = sum;
      vals.push(sum);
    }
  }
  const intensityMin = vals.length ? Math.min(...vals) : 0;
  const intensityMax = vals.length ? Math.max(...vals) : 1;
  
    
  return {
    polygons: data,
    isoDominantKey,
    legendItems,
    trendingTags,
    tagTotals,
    tagMin,
    tagMax,
    isoIntensity,
    intensityMin,
    intensityMax,
  };
}
