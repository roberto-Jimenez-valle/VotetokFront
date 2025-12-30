/**
 * Constantes de validación compartidas entre frontend y backend
 * Para mantener sincronizadas las reglas de validación
 */

// ========================================
// TÍTULO
// ========================================
export const TITLE_MIN_LENGTH = 2;
export const TITLE_MAX_LENGTH = 200;

// ========================================
// DESCRIPCIÓN
// ========================================
export const DESCRIPTION_MAX_LENGTH = 500;

// ========================================
// OPCIONES
// ========================================
export const OPTIONS_MIN_COUNT = 1;
export const OPTIONS_MAX_COUNT = 10;
export const OPTION_LABEL_MAX_LENGTH = 200;

// ========================================
// HASHTAGS
// ========================================
export const HASHTAGS_MAX_COUNT = 10;
export const HASHTAG_MAX_LENGTH = 30;
export const HASHTAG_REGEX = /^[\p{L}\p{N}_-]+$/u; // Letras Unicode (incluyendo tildes), números, guiones y underscores

// ========================================
// COLORES
// ========================================
export const HEX_COLOR_REGEX = /^#[0-9A-F]{6}$/i;

// ========================================
// URLS
// ========================================
// URLs válidas (http/https solamente)
export const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

// Dominios permitidos para imágenes/videos (whitelist)
// Si está vacío, permite todos los dominios
export const ALLOWED_MEDIA_DOMAINS = [
  // Vacío = permite todos
  // Para restringir, descomentar y agregar dominios:
  // 'youtube.com',
  // 'youtu.be',
  // 'vimeo.com',
  // 'imgur.com',
  // 'giphy.com',
  // 'tenor.com',
];

// ========================================
// FUNCIONES DE VALIDACIÓN
// ========================================

/**
 * Validar título
 */
export function validateTitle(title: string): { valid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: 'El título es obligatorio' };
  }

  if (title.trim().length < TITLE_MIN_LENGTH) {
    return {
      valid: false,
      error: `El título debe tener al menos ${TITLE_MIN_LENGTH} caracteres`
    };
  }

  if (title.trim().length > TITLE_MAX_LENGTH) {
    return {
      valid: false,
      error: `El título no puede superar ${TITLE_MAX_LENGTH} caracteres`
    };
  }

  return { valid: true };
}

/**
 * Validar descripción
 */
export function validateDescription(description: string | null | undefined): { valid: boolean; error?: string } {
  if (!description) {
    return { valid: true }; // Opcional
  }

  if (description.length > DESCRIPTION_MAX_LENGTH) {
    return {
      valid: false,
      error: `La descripción no puede superar ${DESCRIPTION_MAX_LENGTH} caracteres`
    };
  }

  return { valid: true };
}

/**
 * Validar opciones
 */
export function validateOptions(options: any[]): { valid: boolean; error?: string } {
  // Soportar tanto 'label' (frontend) como 'optionLabel' (backend)
  const validOptions = options.filter(opt => {
    const label = opt?.label || opt?.optionLabel;
    return label && label.trim();
  });

  if (validOptions.length < OPTIONS_MIN_COUNT) {
    return {
      valid: false,
      error: `Debes añadir al menos ${OPTIONS_MIN_COUNT} opciones`
    };
  }

  if (validOptions.length > OPTIONS_MAX_COUNT) {
    return {
      valid: false,
      error: `No puedes tener más de ${OPTIONS_MAX_COUNT} opciones`
    };
  }

  // Validar longitud de cada opción
  for (const opt of validOptions) {
    const label = opt.label || opt.optionLabel;
    if (label.trim().length > OPTION_LABEL_MAX_LENGTH) {
      return {
        valid: false,
        error: `Cada opción no puede superar ${OPTION_LABEL_MAX_LENGTH} caracteres`
      };
    }
  }

  /* 
     PERMITIMOS OPCIONES DUPLICADAS (Requerimiento de usuario)
  */
  // const labels = validOptions.map(opt => {
  //   const label = opt.label || opt.optionLabel;
  //   return label.trim().toLowerCase();
  // });
  // const hasDuplicates = labels.some((label, index) => labels.indexOf(label) !== index);
  //
  // if (hasDuplicates) {
  //   return { valid: false, error: 'No puedes tener opciones duplicadas' };
  // }

  return { valid: true };
}

/**
 * Validar color hexadecimal
 */
export function validateHexColor(color: string): { valid: boolean; error?: string } {
  if (!HEX_COLOR_REGEX.test(color)) {
    return {
      valid: false,
      error: `Color inválido: ${color}. Debe ser formato hex (#RRGGBB)`
    };
  }

  return { valid: true };
}

/**
 * Validar URL
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || url.trim().length === 0) {
    return { valid: true }; // Opcional
  }

  if (!URL_REGEX.test(url)) {
    return { valid: false, error: 'URL inválida. Debe comenzar con http:// o https://' };
  }

  // Validar dominio si hay whitelist
  if (ALLOWED_MEDIA_DOMAINS.length > 0) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      const isAllowed = ALLOWED_MEDIA_DOMAINS.some(domain =>
        hostname === domain || hostname.endsWith(`.${domain}`)
      );

      if (!isAllowed) {
        return {
          valid: false,
          error: `Dominio no permitido: ${hostname}. Dominios permitidos: ${ALLOWED_MEDIA_DOMAINS.join(', ')}`
        };
      }
    } catch (err) {
      return { valid: false, error: 'URL mal formada' };
    }
  }

  return { valid: true };
}

/**
 * Validar hashtag individual
 */
export function validateHashtag(hashtag: string): { valid: boolean; error?: string } {
  // Remover # si está presente
  const cleanTag = hashtag.startsWith('#') ? hashtag.substring(1) : hashtag;

  if (cleanTag.length === 0) {
    return { valid: false, error: 'Hashtag vacío' };
  }

  if (cleanTag.length > HASHTAG_MAX_LENGTH) {
    return {
      valid: false,
      error: `Hashtag demasiado largo: máximo ${HASHTAG_MAX_LENGTH} caracteres`
    };
  }

  if (!HASHTAG_REGEX.test(cleanTag)) {
    return {
      valid: false,
      error: 'Hashtag inválido: solo se permiten letras, números, guiones y underscores'
    };
  }

  return { valid: true };
}

/**
 * Validar array de hashtags
 */
export function validateHashtags(hashtags: string[]): { valid: boolean; error?: string } {
  if (hashtags.length > HASHTAGS_MAX_COUNT) {
    return {
      valid: false,
      error: `Máximo ${HASHTAGS_MAX_COUNT} hashtags permitidos`
    };
  }

  for (const tag of hashtags) {
    const result = validateHashtag(tag);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

/**
 * Validar encuesta completa (útil para backend)
 */
export function validatePoll(data: {
  title: string;
  description?: string;
  options: any[];
  hashtags?: string[];
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const titleResult = validateTitle(data.title);
  if (!titleResult.valid) errors.push(titleResult.error!);

  const descResult = validateDescription(data.description);
  if (!descResult.valid) errors.push(descResult.error!);

  const optionsResult = validateOptions(data.options);
  if (!optionsResult.valid) errors.push(optionsResult.error!);

  if (data.hashtags && data.hashtags.length > 0) {
    const hashtagsResult = validateHashtags(data.hashtags);
    if (!hashtagsResult.valid) errors.push(hashtagsResult.error!);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
