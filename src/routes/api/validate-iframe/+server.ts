/**
 * API Endpoint: Validate Iframe
 * 
 * Valida y sanitiza URLs de iframes para embeds seguros
 * 
 * POST /api/validate-iframe
 * Body: { url: string } o { embedCode: string }
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import {
  validateAndSanitizeIframe,
  validateEmbedCode,
  getSecureIframeAttributes,
  convertToEmbedUrl
} from '$lib/server/iframe-validator';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { url, embedCode } = body;
    
    // Caso 1: Validar código embed completo
    if (embedCode) {
      console.log('[Validate Iframe] Validando embed code');
      
      const result = validateEmbedCode(embedCode);
      
      if (!result.isValid) {
        return json({
          message: result.error || 'Código embed inválido',
          code: 'INVALID_EMBED_CODE'
        }, { status: 400 });
      }
      
      return json({
        success: true,
        data: {
          isValid: true,
          sanitizedEmbed: result.sanitized,
          message: 'Código embed validado y sanitizado'
        }
      });
    }
    
    // Caso 2: Validar URL de iframe
    if (url) {
      console.log('[Validate Iframe] Validando URL:', url);
      
      // Intentar convertir a URL embed si es necesario
      let targetUrl = url;
      const embedUrl = convertToEmbedUrl(url);
      if (embedUrl) {
        console.log('[Validate Iframe] Convertido a embed URL:', embedUrl);
        targetUrl = embedUrl;
      }
      
      // Validar y sanitizar
      const validation = validateAndSanitizeIframe(targetUrl);
      
      if (!validation.isValid) {
        return json({
          message: validation.error || 'URL de iframe inválida',
          code: 'INVALID_IFRAME_URL'
        }, { status: 400 });
      }
      
      // Obtener atributos seguros
      const attributes = getSecureIframeAttributes(validation.sanitizedUrl!);
      
      return json({
        success: true,
        data: {
          isValid: true,
          originalUrl: url,
          sanitizedUrl: validation.sanitizedUrl,
          platform: validation.platform,
          attributes,
          embedHtml: generateSafeIframeHtml(attributes),
          message: 'URL de iframe validada y sanitizada'
        }
      });
    }
    
    // Sin URL ni embed code
    return json({
      message: 'Se requiere "url" o "embedCode"',
      code: 'MISSING_PARAMETER'
    }, { status: 400 });
    
  } catch (err: any) {
    console.error('[Validate Iframe] Error:', err);
    
    // Si ya es un error de SvelteKit, relanzar
    if (err.status) {
      throw err;
    }
    
    // Error genérico
    return json({
      message: err.message || 'Error al validar iframe',
      code: 'VALIDATION_ERROR'
    }, { status: 500 });
  }
};

/**
 * Genera HTML seguro de iframe
 */
function generateSafeIframeHtml(attributes: ReturnType<typeof getSecureIframeAttributes>): string {
  return `<iframe 
  src="${attributes.src}"
  sandbox="${attributes.sandbox}"
  allow="${attributes.allow}"
  referrerpolicy="${attributes.referrerpolicy}"
  loading="${attributes.loading}"
  style="width: 100%; height: 100%; border: none; border-radius: 12px;"
></iframe>`;
}

/**
 * Endpoint GET para testing rápido
 */
export const GET: RequestHandler = async ({ url }) => {
  const testUrl = url.searchParams.get('url');
  
  if (!testUrl) {
    return json({
      message: 'Iframe Validator API',
      usage: {
        method: 'POST',
        endpoint: '/api/validate-iframe',
        body: {
          url: 'URL del iframe a validar',
          embedCode: 'Código HTML embed a validar (alternativo a url)'
        }
      },
      examples: [
        {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          description: 'Valida y convierte URL de YouTube a embed'
        },
        {
          url: 'https://player.vimeo.com/video/123456789',
          description: 'Valida iframe de Vimeo'
        },
        {
          embedCode: '<iframe src="..."></iframe>',
          description: 'Valida código embed completo'
        }
      ]
    });
  }
  
  // Testing rápido con GET
  try {
    const validation = validateAndSanitizeIframe(testUrl);
    
    if (!validation.isValid) {
      return json({
        success: false,
        error: validation.error
      }, { status: 400 });
    }
    
    const attributes = getSecureIframeAttributes(validation.sanitizedUrl!);
    
    return json({
      success: true,
      data: {
        originalUrl: testUrl,
        sanitizedUrl: validation.sanitizedUrl,
        platform: validation.platform,
        attributes
      }
    });
  } catch (err: any) {
    return json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
};
