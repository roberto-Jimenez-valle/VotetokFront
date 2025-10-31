// Mapeo simple de archivos TopoJSON
// Todos los archivos usan nombres originales

export const FILE_MAP = {
  // Mapeo de nombres de archivos
  'world.topojson': 'world.topojson.json',
  'WORLD.json': 'WORLD.json',
  'WORLD3.json': 'WORLD3.json',
  'countries-110m-iso.json': 'countries-110m-iso.json',
  'countries-110m-iso-geojson-fixed.json': 'countries-110m-iso-geojson-fixed.json',
} as const;

// Función helper para obtener nombre real
export function getFileName(logicalName: string): string {
  return (FILE_MAP as any)[logicalName] || logicalName;
}

// Obtener nombre de archivo para países/subdivisiones
export function getCountryFileName(countryCode: string, subdivisionId?: string): string {
  const identifier = subdivisionId || countryCode;
  return `${identifier}.topojson`;
}

export function getCountryPath(countryCode: string, subdivisionId?: string): string {
  const fileName = getCountryFileName(countryCode, subdivisionId);
  return `/geojson/${countryCode}/${fileName}`;
}
