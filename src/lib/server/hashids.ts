import Hashids from 'hashids';

// Salt secreta para hacer los hashes únicos a esta aplicación
// En producción, esto debería venir de una variable de entorno
const SALT = process.env.HASHIDS_SALT || 'VouTop-S3cr3t-S4lt-2024!';

// Longitud mínima del hash (para que sean más difíciles de adivinar)
const MIN_LENGTH = 8;

// Alfabeto personalizado (sin caracteres confusos como 0/O, 1/l/I)
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Instancia de Hashids para polls
const pollHashids = new Hashids(`${SALT}-polls`, MIN_LENGTH, ALPHABET);

// Instancia de Hashids para users (salt diferente)
const userHashids = new Hashids(`${SALT}-users`, MIN_LENGTH, ALPHABET);

// Instancia de Hashids para options
const optionHashids = new Hashids(`${SALT}-options`, 6, ALPHABET);

/**
 * Codifica un ID numérico de poll a un hash string
 */
export function encodePollId(id: number): string {
  return pollHashids.encode(id);
}

/**
 * Decodifica un hash string a ID numérico de poll
 * Retorna null si el hash es inválido
 */
export function decodePollId(hash: string): number | null {
  try {
    const decoded = pollHashids.decode(hash);
    if (decoded.length === 0) return null;
    return decoded[0] as number;
  } catch {
    return null;
  }
}

/**
 * Codifica un ID numérico de usuario a un hash string
 */
export function encodeUserId(id: number): string {
  return userHashids.encode(id);
}

/**
 * Decodifica un hash string a ID numérico de usuario
 */
export function decodeUserId(hash: string): number | null {
  try {
    const decoded = userHashids.decode(hash);
    if (decoded.length === 0) return null;
    return decoded[0] as number;
  } catch {
    return null;
  }
}

/**
 * Codifica un ID numérico de opción a un hash string
 */
export function encodeOptionId(id: number): string {
  return optionHashids.encode(id);
}

/**
 * Decodifica un hash string a ID numérico de opción
 */
export function decodeOptionId(hash: string): number | null {
  try {
    const decoded = optionHashids.decode(hash);
    if (decoded.length === 0) return null;
    return decoded[0] as number;
  } catch {
    return null;
  }
}

/**
 * Verifica si un string parece ser un ID numérico (legacy) o un hash
 */
export function isNumericId(id: string): boolean {
  return /^\d+$/.test(id);
}

/**
 * Parsea un ID de poll SOLO desde hash (rutas públicas)
 * NO acepta IDs numéricos - solo hashIds
 * Retorna el ID numérico o null si es inválido
 */
export function parsePollId(id: string): number | null {
  // Rechazar IDs numéricos - solo aceptar hashes
  if (isNumericId(id)) {
    return null;
  }
  // Intentar decodificar como hash
  return decodePollId(id);
}

/**
 * Parsea un ID de poll que puede ser numérico O hash
 * SOLO para uso interno (APIs internas, no rutas públicas)
 */
export function parsePollIdInternal(id: string): number | null {
  if (isNumericId(id)) {
    return parseInt(id, 10);
  }
  return decodePollId(id);
}

/**
 * Parsea un ID de usuario SOLO desde hash (rutas públicas)
 */
export function parseUserId(id: string): number | null {
  if (isNumericId(id)) {
    return null;
  }
  return decodeUserId(id);
}

/**
 * Parsea un ID de usuario que puede ser numérico O hash
 * SOLO para uso interno
 */
export function parseUserIdInternal(id: string): number | null {
  if (isNumericId(id)) {
    return parseInt(id, 10);
  }
  return decodeUserId(id);
}

// Log de ejemplo para verificar que funciona
if (process.env.NODE_ENV === 'development') {
  console.log('[Hashids] Ejemplo de codificación:');
  console.log('  Poll ID 1 ->', encodePollId(1));
  console.log('  Poll ID 100 ->', encodePollId(100));
  console.log('  Poll ID 760 ->', encodePollId(760));
  console.log('  User ID 1 ->', encodeUserId(1));
}
