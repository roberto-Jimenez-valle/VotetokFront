// Pure helpers used by GlobeGL.svelte

export function nameOf(d: any): string {
  const p = d?.properties ?? {};
  return (
    p.NAME_ENGL ??      // countries-110m-iso-geojson-fixed.json
    p.CNTR_NAME ??      // countries-110m-iso-geojson-fixed.json
    p.ADMIN ??          // Algunos TopoJSON
    p.NAME ??           // Genérico
    p.name ??           // Minúsculas
    p.SOVEREIGNT ??     // Soberanía
    p.ISO3_CODE ??      // Código ISO3 como último recurso
    p.ISO_A3 ??
    p.ISO_A2 ??
    'Country'
  );
}

export function getDominantKey(
  iso: string,
  answersData: Record<string, Record<string, number>>,
  hiddenKeys: string[] = []
): string {
  const rec = answersData?.[iso];
  if (!rec) return 'No data';
  let kBest = '';
  let vBest = -Infinity;
  const hiddenSet = new Set(hiddenKeys);
  for (const [k, v] of Object.entries(rec)) {
    // Skip hidden keys
    if (hiddenSet.has(k)) continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (n > vBest) {
      vBest = n;
      kBest = k;
    }
  }
  return kBest || 'No data';
}

export function opacityForIso(
  iso: string,
  isoIntensity: Record<string, number>,
  min: number,
  max: number
): number {
  const v = isoIntensity[iso];
  if (v == null) return 0.2; // sin datos, opacidad baja
  if (max === min) return 0.6; // todos iguales
  const t = (v - min) / (max - min);
  // mapear a rango [0.25, 1]
  return 0.25 + t * 0.75;
}

export function alphaForTag(
  key: string,
  tagTotals: Record<string, number>,
  min: number,
  max: number
): number {
  const v = tagTotals?.[key];
  if (v == null) return 0.45;
  if (max === min) return 0.8;
  const t = (v - min) / (max - min);
  // Rango suave para visibilidad: [0.45, 1]
  return 0.45 + t * 0.55;
}
