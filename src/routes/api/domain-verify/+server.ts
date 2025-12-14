/**
 * API Endpoint: Domain Verification
 * 
 * Verifica la seguridad y reputación de un dominio usando:
 * - Lista Tranco (Top 1M sitios)
 * - Google Safe Browsing API
 * - VirusTotal API
 * 
 * GET /api/domain-verify?url=https://example.com
 * GET /api/domain-verify/stats (estadísticas del servicio)
 */

import { json, error, type RequestHandler } from '@sveltejs/kit';
import { 
  verifyDomain, 
  quickVerify, 
  getTrancoRank,
  getVerificationStats,
  reloadTrancoList
} from '$lib/server/domain-verification';

/**
 * GET /api/domain-verify?url=...
 * Verifica un dominio/URL
 */
export const GET: RequestHandler = async ({ url: requestUrl }) => {
  const targetUrl = requestUrl.searchParams.get('url');
  const quick = requestUrl.searchParams.get('quick') === '1';
  
  // Si no hay URL, devolver stats del servicio
  if (!targetUrl) {
    const stats = getVerificationStats();
    return json({
      success: true,
      stats: {
        trancoSize: stats.trancoSize,
        trancoLastUpdate: stats.trancoLastUpdate?.toISOString() || null,
        cacheSize: stats.cacheSize,
        apisConfigured: {
          googleSafeBrowsing: stats.hasGoogleApiKey,
          virusTotal: stats.hasVirusTotalApiKey
        }
      }
    });
  }
  
  // Validar URL
  let validUrl: URL;
  try {
    // Si es solo dominio, añadir protocolo
    const urlString = targetUrl.includes('://') ? targetUrl : 'https://' + targetUrl;
    validUrl = new URL(urlString);
  } catch {
    throw error(400, 'URL inválida');
  }
  
  try {
    if (quick) {
      // Verificación rápida (solo Tranco)
      const result = await quickVerify(validUrl.hostname);
      return json({
        success: true,
        domain: validUrl.hostname,
        verification: {
          isSafe: result.isSafe,
          trustLevel: result.trustLevel,
          trancoRank: result.trancoRank,
          method: 'quick'
        }
      });
    } else {
      // Verificación completa (Tranco + Safe Browsing + VirusTotal)
      const result = await verifyDomain(targetUrl);
      return json({
        success: true,
        domain: result.domain,
        verification: {
          isSafe: result.isSafe,
          trustLevel: result.trustLevel,
          trancoRank: result.trancoRank,
          safeBrowsing: result.safeBrowsingResult,
          virusTotal: result.virusTotalResult,
          cached: result.cached,
          method: 'full'
        }
      });
    }
  } catch (err: any) {
    console.error('[Domain Verify] Error:', err);
    throw error(500, err.message || 'Error al verificar dominio');
  }
};

/**
 * POST /api/domain-verify
 * Fuerza recarga de la lista Tranco
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    
    if (body.action === 'reload-tranco') {
      console.log('[Domain Verify] Recargando lista Tranco...');
      const size = await reloadTrancoList();
      return json({
        success: true,
        message: `Lista Tranco recargada: ${size} dominios`
      });
    }
    
    throw error(400, 'Acción no válida. Use: { "action": "reload-tranco" }');
  } catch (err: any) {
    if (err.status) throw err;
    throw error(500, err.message || 'Error interno');
  }
};
