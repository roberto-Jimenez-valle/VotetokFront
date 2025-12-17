/**
 * Configuración de seguridad para embeds (iframes externos)
 * 
 * Este archivo controla qué dominios pueden embeber el contenido
 * y configura las políticas de seguridad.
 */

// Dominios permitidos para embeber (vacío = permitir todos)
// Agregar dominios específicos para modo estricto
const ALLOWED_ORIGINS: string[] = [
  // Ejemplos:
  // 'https://tudominio.com',
  // 'https://www.tudominio.com',
  // 'https://app.tudominio.com',
];

// Patrones de dominio permitidos (regex)
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  // Permitir cualquier subdominio de votetok/voutop
  /^https?:\/\/.*\.votetok\.com$/,
  /^https?:\/\/.*\.voutop\.com$/,
  // Localhost para desarrollo
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  // Ejemplos de patrones personalizados:
  // /^https?:\/\/.*\.midominio\.com$/,
];

export const EMBED_CONFIG = {
  // === MODO DE OPERACIÓN ===
  // true = bloquear orígenes no permitidos
  // false = permitir todos pero loggear advertencias
  STRICT_MODE: false,
  
  // === DOMINIOS PERMITIDOS ===
  ALLOWED_ORIGINS,
  ALLOWED_ORIGIN_PATTERNS,
  
  // === RATE LIMITING ===
  RATE_LIMIT: {
    // Máximo de requests por ventana de tiempo
    MAX_REQUESTS: 100,
    // Ventana de tiempo en milisegundos (1 minuto)
    WINDOW_MS: 60 * 1000,
  },
  
  // === HEADERS DE SEGURIDAD ===
  SECURITY_HEADERS: {
    // Política de Content Security Policy para embeds
    // Más permisiva que la CSP principal porque necesita funcionar en iframes
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: http: blob:",
      "font-src 'self' data: https:",
      "connect-src 'self' https: wss:",
      "media-src 'self' https: blob:",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "frame-ancestors *", // Permitir embeber desde cualquier origen
    ].join('; '),
    
    // Otras headers de seguridad
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(self), microphone=(), camera=()',
  },
  
  // === FUNCIONES DE VALIDACIÓN ===
  
  /**
   * Valida si un origen está permitido para embeber
   */
  validateOrigin(origin: string, referer: string): boolean {
    // Si no hay dominios configurados, permitir todos
    if (ALLOWED_ORIGINS.length === 0 && ALLOWED_ORIGIN_PATTERNS.length === 0) {
      return true;
    }
    
    const urlToCheck = origin || referer;
    if (!urlToCheck) {
      // Sin origen/referer - podría ser acceso directo (permitir)
      return true;
    }
    
    // Verificar en lista de dominios exactos
    if (ALLOWED_ORIGINS.includes(urlToCheck)) {
      return true;
    }
    
    // Verificar contra patrones
    for (const pattern of ALLOWED_ORIGIN_PATTERNS) {
      if (pattern.test(urlToCheck)) {
        return true;
      }
    }
    
    return false;
  },
  
  /**
   * Genera los headers de respuesta para embeds
   */
  getResponseHeaders(origin?: string): Record<string, string> {
    const headers: Record<string, string> = {
      ...this.SECURITY_HEADERS,
    };
    
    // CORS headers para embeds
    if (origin) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    } else {
      // Si no hay origen específico, permitir todos
      headers['Access-Control-Allow-Origin'] = '*';
    }
    
    // Permitir que el iframe se muestre
    // X-Frame-Options es obsoleto pero algunos navegadores aún lo usan
    // Usamos 'ALLOWALL' implícito al no incluirlo (o CSP frame-ancestors)
    
    return headers;
  },
  
  /**
   * Valida el ID de una encuesta (soporta IDs numéricos y hashes)
   */
  validatePollId(pollId: string | number): { valid: boolean; id: number | null; error?: string } {
    // Si es número, validar directamente
    if (typeof pollId === 'number') {
      if (pollId <= 0) {
        return { valid: false, id: null, error: 'ID de encuesta debe ser positivo' };
      }
      if (pollId > 2147483647) {
        return { valid: false, id: null, error: 'ID de encuesta fuera de rango' };
      }
      return { valid: true, id: pollId };
    }
    
    // Si es string, intentar parsear como número primero (legacy)
    const numericId = parseInt(pollId, 10);
    if (!isNaN(numericId) && numericId.toString() === pollId) {
      if (numericId <= 0) {
        return { valid: false, id: null, error: 'ID de encuesta debe ser positivo' };
      }
      if (numericId > 2147483647) {
        return { valid: false, id: null, error: 'ID de encuesta fuera de rango' };
      }
      return { valid: true, id: numericId };
    }
    
    // Si no es numérico, intentar decodificar como hash
    // Importación dinámica para evitar problemas de ciclo
    try {
      // Validar formato básico del hash (solo caracteres alfanuméricos)
      if (!/^[a-zA-Z0-9]+$/.test(pollId)) {
        return { valid: false, id: null, error: 'ID de encuesta inválido' };
      }
      
      // El hash se decodificará en el servidor
      // Aquí solo validamos el formato
      return { valid: true, id: null, hash: pollId } as any;
    } catch {
      return { valid: false, id: null, error: 'ID de encuesta inválido' };
    }
  },
  
  /**
   * Sanitiza el tema para evitar XSS
   */
  sanitizeTheme(theme: string | null): 'dark' | 'light' {
    if (theme === 'light') return 'light';
    return 'dark'; // Default
  },
};

export type EmbedConfig = typeof EMBED_CONFIG;
