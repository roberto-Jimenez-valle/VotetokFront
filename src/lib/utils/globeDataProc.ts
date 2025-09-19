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

  // Claves dominantes por ISO y conteo para leyenda
  const isoDominantKey: Record<string, string> = {};
  const counts: Record<string, number> = {};
  for (const f of data) {
    const iso = isoOf(f);
    const key = getDominantKeyUtil(iso, answersData);
    isoDominantKey[iso] = key;
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

  // Intensidad por país
  const isoIntensity: Record<string, number> = {};
  const vals: number[] = [];
  for (const f of data) {
    const iso = isoOf(f);
    const rec = answersData?.[iso];
    if (rec) {
      const sum = Object.values(rec).reduce((acc, v) => acc + (typeof v === 'number' ? v : Number(v) || 0), 0);
      isoIntensity[iso] = sum;
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
