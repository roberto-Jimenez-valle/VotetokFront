/**
 * Utilidades de sanitización HTML
 * Protege contra XSS y contenido malicioso
 */

import sanitizeHtml from 'sanitize-html';

/**
 * Configuración estricta para textos planos
 * No permite ninguna etiqueta HTML
 */
const strictConfig: sanitizeHtml.IOptions = {
  allowedTags: [], // No permitir ninguna etiqueta
  allowedAttributes: {}, // No permitir ningún atributo
  disallowedTagsMode: 'recursiveEscape', // Escapar todas las etiquetas recursivamente
  textFilter: (text: string) => {
    // Eliminar caracteres de control excepto espacios y saltos de línea
    return text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  }
};

/**
 * Configuración permisiva para descripciones
 * Permite algunas etiquetas de formato básico
 */
const descriptionConfig: sanitizeHtml.IOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'br', 'p'],
  allowedAttributes: {},
  disallowedTagsMode: 'recursiveEscape',
  textFilter: (text: string) => {
    return text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  }
};

/**
 * Sanitizar texto plano (títulos, opciones, hashtags)
 * No permite ningún HTML
 */
export function sanitizePlainText(text: string): string {
  if (!text) return '';
  return sanitizeHtml(text, strictConfig).trim();
}

/**
 * Sanitizar descripción
 * Permite formato básico (negrita, cursiva, párrafos)
 */
export function sanitizeDescription(text: string): string {
  if (!text) return '';
  return sanitizeHtml(text, descriptionConfig).trim();
}

/**
 * Sanitizar opción de encuesta
 * Misma lógica que texto plano
 */
export function sanitizeOption(text: string): string {
  return sanitizePlainText(text);
}

/**
 * Sanitizar hashtag
 * Además de sanitizar, limpia caracteres no permitidos
 */
export function sanitizeHashtag(tag: string): string {
  if (!tag) return '';
  
  // Remover # si está presente
  let cleaned = tag.startsWith('#') ? tag.substring(1) : tag;
  
  // Sanitizar HTML
  cleaned = sanitizePlainText(cleaned);
  
  // Solo permitir alfanuméricos, guiones y underscores
  cleaned = cleaned.replace(/[^a-zA-Z0-9_-]/g, '');
  
  return cleaned.toLowerCase();
}

/**
 * Sanitizar URL
 * Verifica que sea una URL válida y no contenga javascript: u otros esquemas peligrosos
 */
export function sanitizeUrl(url: string): string | null {
  if (!url) return null;
  
  // Sanitizar HTML primero
  const cleaned = sanitizePlainText(url);
  
  try {
    const urlObj = new URL(cleaned);
    
    // Solo permitir http y https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      console.warn('[Sanitize] Esquema de URL no permitido:', urlObj.protocol);
      return null;
    }
    
    return urlObj.toString();
  } catch (err) {
    console.warn('[Sanitize] URL inválida:', cleaned);
    return null;
  }
}

/**
 * Sanitizar objeto completo de encuesta
 */
export function sanitizePollData(data: any): any {
  return {
    ...data,
    title: sanitizePlainText(data.title),
    description: data.description ? sanitizeDescription(data.description) : null,
    imageUrl: data.imageUrl ? sanitizeUrl(data.imageUrl) : null,
    options: data.options?.map((opt: any) => ({
      ...opt,
      optionLabel: sanitizeOption(opt.optionLabel),
      optionKey: sanitizePlainText(opt.optionKey),
      // Sanitizar textos de Sí/No personalizados
      yesText: opt.yesText ? sanitizePlainText(opt.yesText) : null,
      noText: opt.noText ? sanitizePlainText(opt.noText) : null,
    })),
    hashtags: data.hashtags?.map((tag: string) => sanitizeHashtag(tag)).filter(Boolean)
  };
}
