// Mapeo de archivos TopoJSON ofuscados
// En desarrollo: usa nombres originales
// En producción: usa nombres hash ofuscados

// Detectar si estamos en producción
// En cliente: import.meta.env.PROD
// En servidor: process.env.NODE_ENV === 'production'
const isProduction = typeof import.meta !== 'undefined' 
  ? import.meta.env.PROD 
  : process.env.NODE_ENV === 'production';

export const FILE_MAP = {
  // Mapeo: nombre lógico → nombre real en desarrollo → nombre hash en producción
  'world.topojson': { dev: 'world.topojson.json', prod: 'a7f9d2c1b5e8.json' },
  'WORLD.json': { dev: 'WORLD.json', prod: 'f3e9a2d7b1c8.json' },
  'WORLD3.json': { dev: 'WORLD3.json', prod: 'c8b1d7a2e9f3.json' },
  'countries-110m-iso.json': { dev: 'countries-110m-iso.json', prod: 'd5c7a9f2e4b1.json' },
  'countries-110m-iso-geojson-fixed.json': { dev: 'countries-110m-iso-geojson-fixed.json', prod: 'b4e2f7a9c5d1.json' },
  
  // Función helper para obtener nombre real
  getFileName(logicalName: string): string {
    const mapping = this[logicalName as keyof typeof FILE_MAP];
    if (typeof mapping === 'object' && mapping !== null && 'dev' in mapping) {
      return isProduction ? mapping.prod : mapping.dev;
    }
    // Fallback: retornar el nombre lógico
    return logicalName;
  },
  
  // Función para obtener path completo
  getPath(type: 'maps' | 'data', logicalName: string): string {
    const fileName = this.getFileName(logicalName);
    return `/${type}/${fileName}`;
  }
} as const;

// Mapeo de países y subdivisiones (se generan dinámicamente)
export function getCountryFileName(countryCode: string, subdivisionId?: string): string {
  const identifier = subdivisionId || countryCode;
  
  if (!isProduction) {
    // En desarrollo, usar nombres originales
    return `${identifier}.topojson`;
  }
  
  // En producción, generar hash ofuscado
  const hash = btoa(identifier).replace(/=/g, '').substring(0, 12);
  return `${hash}.json`;
}

export function getCountryPath(countryCode: string, subdivisionId?: string): string {
  const fileName = getCountryFileName(countryCode, subdivisionId);
  return `/geojson/${countryCode}/${fileName}`;
}
