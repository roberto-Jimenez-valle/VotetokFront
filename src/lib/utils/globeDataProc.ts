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

  // 1. Preferir IDs jerárquicos explícitos (GADM style)
  // GID_2: "ESP.1.1_1" -> "ESP.1.1"
  if (p.GID_2) return p.GID_2.split('_')[0];
  // GID_1: "ESP.1_1" -> "ESP.1"
  if (p.GID_1) return p.GID_1.split('_')[0];

  // 2. Extraer ISO base para construcción manual
  // Natural Earth usa ISO_A3, pero si es -99 (disputado), ADM0_A3 suele tener el código
  let iso = (p.ISO_A3 || p.ISO3_CODE || p.iso_a3 || '').toString().toUpperCase();
  if (iso === '-99' || !iso) {
    iso = (p.ADM0_A3 || p.adm0_a3 || p.GID_0 || p.ISO || '').toString().toUpperCase();
  }
  // Limpiar sufijos (ej: ESP_1 -> ESP, ESP.1 -> ESP)
  iso = iso.split('_')[0].split('.')[0];

  // 3. Si tenemos IDs numéricos de subdivisiones, construir el path jerárquico
  // Nivel 3 (sub-subdivisiones): ID_2
  if (p.ID_2 || p.id_2) {
    const id1 = p.ID_1 || p.id_1 || '0';
    const id2 = p.ID_2 || p.id_2;
    return `${iso}.${id1}.${id2}`;
  }

  // Nivel 2 (subdivisiones): ID_1
  if (p.ID_1 || p.id_1) {
    return `${iso}.${p.ID_1 || p.id_1}`;
  }

  // 4. Nivel 1 (países): Usar el ISO normalizado
  if (iso && iso !== '-99' && iso.length >= 2) {
    return iso;
  }

  // 5. Fallbacks finales
  const fallback = p.id || p.ID || p.wb_a3 || p.WB_A3;
  if (fallback && fallback !== '-99') {
    return String(fallback).toUpperCase();
  }

  return '';
}

export function computeGlobeViewModel(geo: any, dataJson: GlobeDataJson): ComputeResult {
  // Normalizar ANSWERS a mayúsculas para evitar problemas de case-sensitivity del API
  const rawAnswersData = dataJson?.ANSWERS ?? {};
  const answersData: Record<string, Record<string, number>> = {};
  for (const [k, v] of Object.entries(rawAnswersData)) {
    answersData[k.toUpperCase()] = v as Record<string, number>;
  }

  const colorMap = dataJson?.colors ?? {};


  const features: any[] = Array.isArray(geo?.features) ? geo.features : [];
  // Filtra Antártida si aparece como ISO3 ATA o nombre
  const data = features.filter((f) => {
    const p = f?.properties ?? {};
    const iso3 = (p.ISO_A3 || p.ISO3_CODE || p.iso_a3 || '').toString().toUpperCase();
    const name = (p.NAME_ENGL ?? p.CNTR_NAME ?? p.ADMIN ?? p.NAME ?? p.name ?? '').toString().toUpperCase();
    return iso3 !== 'ATA' && name !== 'ANTARCTICA';
  });


  // Claves dominantes por ID y conteo para leyenda
  const isoDominantKey: Record<string, string> = {};
  const counts: Record<string, number> = {};

  // DEBUG: Verificar países con datos
  let matchedCount = 0;
  let unmatchedCount = 0;
  const unmatchedCountries: string[] = [];

  for (const f of data) {
    // Usar getFeatureId en lugar de isoOf para soportar todos los niveles
    const featureId = getFeatureId(f);

    if (!featureId) {
      unmatchedCount++;
      unmatchedCountries.push('[EMPTY_ID]');
      continue;
    }

    // 🔧 MEJORA: Buscar datos tanto en el ID exacto como en subdivisiones
    let hasData = answersData[featureId];

    //Si no hay datos directos y el ID es de país (sin puntos), 
    // buscar datos en subdivisiones y agregarlos
    if (!hasData && !featureId.includes('.')) {
      // Este es un polígono de país (nivel 0), buscar subdivisiones
      const countryPrefix = featureId + '.';
      const subdivisionKeys = Object.keys(answersData).filter(key => key.startsWith(countryPrefix));

      if (subdivisionKeys.length > 0) {
        // Agregar todos los votos de subdivisiones al país
        console.debug(`[computeGlobeViewModel] 📊 Agregando ${subdivisionKeys.length} subdivisiones al país: ${featureId}`);
        const aggregatedVotes: Record<string, number> = {};

        for (const subKey of subdivisionKeys) {
          const subVotes = answersData[subKey];
          for (const [option, count] of Object.entries(subVotes)) {
            aggregatedVotes[option] = (aggregatedVotes[option] || 0) + (count as number);
          }
        }

        // Guardar los votos agregados
        answersData[featureId] = aggregatedVotes;
        hasData = aggregatedVotes;
      }
    }

    if (hasData) {
      matchedCount++;
      if (matchedCount === 1) {
        // Mostrar el primer match como ejemplo
        console.log(`[computeGlobeViewModel] 🎯 PRIMER MATCH - ID: "${featureId}", datos:`, Object.keys(hasData));
      }
    } else {
      unmatchedCount++;
      unmatchedCountries.push(featureId);
      if (unmatchedCount === 1) {
        // Mostrar el primer no-match como ejemplo
        console.log(`[computeGlobeViewModel] ❌ PRIMER NO-MATCH - ID: "${featureId}"`);
        console.log(`[computeGlobeViewModel] ❌ Buscado en answersData:`, Object.keys(answersData).slice(0, 10));
      }
    }

    const key = getDominantKeyUtil(featureId, answersData);
    isoDominantKey[featureId] = key;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  console.log(`[computeGlobeViewModel] Polígonos procesados: ${data.length}`);
  console.log(`[computeGlobeViewModel] ✅ Con datos: ${matchedCount}`);
  console.log(`[computeGlobeViewModel] ❌ Sin datos: ${unmatchedCount}`);
  console.log(`[computeGlobeViewModel] TODOS los sin datos (${unmatchedCountries.length}):`, unmatchedCountries);
  console.log(`[computeGlobeViewModel] answersData total keys:`, Object.keys(answersData).length);
  console.log(`[computeGlobeViewModel] 📝 Primeras 10 claves de answersData:`, Object.keys(answersData).slice(0, 10));
  console.log(`[computeGlobeViewModel] 📝 Primeras 10 claves de polígonos:`, data.slice(0, 10).map(f => getFeatureId(f)));


  // DEBUG específico para Brasil
  const brasilPolygons = data.filter(f => getFeatureId(f)?.startsWith('BRA.'));
  const brasilWithData = brasilPolygons.filter(f => {
    const id = getFeatureId(f);
    return id && answersData[id];
  });
  if (brasilPolygons.length > 0) {
    console.log(`[computeGlobeViewModel] 🇧🇷 Brasil: ${brasilPolygons.length} polígonos, ${brasilWithData.length} con datos`);
    console.log(`[computeGlobeViewModel] 🇧🇷 Brasil IDs con datos:`, brasilWithData.map(f => getFeatureId(f)).slice(0, 5));
    console.log(`[computeGlobeViewModel] 🇧🇷 Brasil dominant keys:`, brasilWithData.map(f => isoDominantKey[getFeatureId(f)!]).slice(0, 5));
  }

  // Verificar si hay algún país en answersData que NO esté en el archivo mundial
  const worldCountries = new Set(data.map(f => getFeatureId(f)).filter(id => id));
  const missingInWorld = Object.keys(answersData).filter(iso => !worldCountries.has(iso));
  if (missingInWorld.length > 0) {
    console.log(`[computeGlobeViewModel] ⚠️ Países con datos pero NO en archivo mundial:`, missingInWorld);
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

  // IMPORTANTE: Ordenar polígonos por área (pequeños primero, grandes al final)
  // Esto asegura que países pequeños como Vaticano se DETECTEN PRIMERO en el raycasting
  const sortedData = [...data].sort((a, b) => {
    const areaA = calculatePolygonArea(a);
    const areaB = calculatePolygonArea(b);
    return areaA - areaB; // Ascendente: pequeños primero
  });

  console.log(`[computeGlobeViewModel] ✅ Polígonos ordenados por área (pequeños primero para raycasting)`);
  const smallest = sortedData.slice(0, 5);
  console.log(`[computeGlobeViewModel] 🔍 5 polígonos más pequeños (detectados primero):`,
    smallest.map(f => `${getFeatureId(f)} (${calculatePolygonArea(f).toFixed(6)})`));

  return {
    polygons: sortedData,
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

// Función auxiliar para calcular área aproximada de un polígono
function calculatePolygonArea(feature: any): number {
  try {
    const geom = feature?.geometry;
    if (!geom || !geom.coordinates) return 0;

    let totalArea = 0;

    const calculateRingArea = (ring: number[][]): number => {
      if (!ring || ring.length < 3) return 0;
      let area = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        area += x1 * y2 - x2 * y1;
      }
      return Math.abs(area / 2);
    };

    if (geom.type === 'Polygon') {
      totalArea = calculateRingArea(geom.coordinates[0]);
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        totalArea += calculateRingArea(poly[0]);
      }
    }

    return totalArea;
  } catch {
    return 0;
  }
}
