/**
 * Domain Verification Service
 * 
 * Sistema automatizado de verificación de dominios usando:
 * 1. Lista Tranco (Top 1M sitios más visitados) - Autoridad
 * 2. Google Safe Browsing API - Seguridad (phishing, malware)
 * 3. VirusTotal API (opcional) - Reputación adicional
 * 
 * Reemplaza las listas manuales de dominios seguros por verificación en tiempo real.
 */

import { env } from '$env/dynamic/private';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const TRANCO_LIST_URL = 'https://tranco-list.eu/top-1m.csv.zip';
const TRANCO_UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas
const VERIFICATION_CACHE_TTL = 60 * 60 * 1000; // 1 hora

// Umbrales de confianza basados en ranking Tranco
const TRANCO_THRESHOLDS = {
  HIGHLY_TRUSTED: 10_000,    // Top 10k: Sitios muy confiables
  TRUSTED: 100_000,          // Top 100k: Sitios confiables
  KNOWN: 500_000,            // Top 500k: Sitios conocidos
  LISTED: 1_000_000          // Top 1M: En la lista
};

// ============================================================================
// TIPOS
// ============================================================================

export interface DomainVerificationResult {
  domain: string;
  isSafe: boolean;
  trustLevel: 'highly_trusted' | 'trusted' | 'known' | 'listed' | 'unknown' | 'unsafe';
  trancoRank: number | null;
  safeBrowsingResult: SafeBrowsingResult | null;
  virusTotalResult: VirusTotalResult | null;
  cached: boolean;
  timestamp: number;
}

export interface SafeBrowsingResult {
  isSafe: boolean;
  threats: string[];
}

export interface VirusTotalResult {
  isSafe: boolean;
  positives: number;
  total: number;
  scanDate: string;
}

// ============================================================================
// CACHE Y ESTADO
// ============================================================================

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Ruta del archivo de caché persistente
const TRANCO_CACHE_FILE = join(process.cwd(), 'prisma', 'tranco-cache.json');

// Cache de la lista Tranco en memoria (dominio -> ranking)
let trancoList: Map<string, number> = new Map();
let trancoLastUpdate: number = 0;
let trancoLoading: Promise<void> | null = null;
let trancoLastError: number = 0;
const TRANCO_ERROR_COOLDOWN = 5 * 60 * 1000; // 5 minutos de cooldown
let fallbackListLoaded = false;

// Cache de verificaciones
const verificationCache = new Map<string, DomainVerificationResult>();

// ============================================================================
// LISTA TRANCO
// ============================================================================

/**
 * Descarga y parsea la lista Tranco (Top 1M sitios)
 * La lista se actualiza diariamente en https://tranco-list.eu/
 */
/**
 * Carga la lista Tranco desde el caché persistente (archivo JSON)
 */
function loadTrancoFromCache(): { list: Map<string, number>; timestamp: number } | null {
  try {
    if (!existsSync(TRANCO_CACHE_FILE)) {
      return null;
    }
    
    const data = JSON.parse(readFileSync(TRANCO_CACHE_FILE, 'utf-8'));
    const list = new Map<string, number>(Object.entries(data.domains));
    
    console.log(`[DomainVerification] 📂 Caché cargado: ${list.size} dominios (${new Date(data.timestamp).toISOString()})`);
    return { list, timestamp: data.timestamp };
  } catch (err) {
    console.warn('[DomainVerification] Error cargando caché:', err);
    return null;
  }
}

/**
 * Guarda la lista Tranco en caché persistente (archivo JSON)
 */
function saveTrancoToCache(list: Map<string, number>): void {
  try {
    const data = {
      timestamp: Date.now(),
      count: list.size,
      domains: Object.fromEntries(list)
    };
    writeFileSync(TRANCO_CACHE_FILE, JSON.stringify(data), 'utf-8');
    console.log(`[DomainVerification] 💾 Caché guardado: ${list.size} dominios`);
  } catch (err) {
    console.warn('[DomainVerification] Error guardando caché:', err);
  }
}

/**
 * Descarga la lista Tranco desde la web
 */
async function downloadTrancoList(): Promise<Map<string, number>> {
  const now = Date.now();
  
  // Si hubo un error reciente, usar caché/fallback sin reintentar
  if (trancoLastError > 0 && (now - trancoLastError) < TRANCO_ERROR_COOLDOWN) {
    if (!fallbackListLoaded) {
      console.log('[DomainVerification] ⏳ Cooldown activo, cargando fallback...');
      const fallback = createFallbackList();
      fallbackListLoaded = true;
      return fallback;
    }
    return trancoList.size > 0 ? trancoList : createFallbackList();
  }
  
  // Intentar cargar desde caché persistente primero
  const cached = loadTrancoFromCache();
  if (cached && (now - cached.timestamp) < TRANCO_UPDATE_INTERVAL) {
    console.log('[DomainVerification] ✅ Usando caché válido (menos de 24h)');
    return cached.list;
  }
  
  console.log('[DomainVerification] 📥 Descargando lista Tranco...');
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    // URL directa del top 10k (más pequeño y confiable)
    const response = await fetch('https://raw.githubusercontent.com/AUC-MISC/Tranco-Top-10000/main/tranco_top10000.csv', {
      signal: controller.signal,
      headers: { 'Accept': 'text/csv, text/plain, */*' }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const csv = await response.text();
    const list = new Map<string, number>();
    
    for (const line of csv.trim().split('\n')) {
      const [rankStr, domain] = line.split(',');
      if (domain && rankStr) {
        const rank = parseInt(rankStr, 10);
        if (!isNaN(rank)) {
          list.set(domain.trim().toLowerCase(), rank);
        }
      }
    }
    
    if (list.size > 0) {
      // Combinar con fallback para tener más dominios
      const fallback = createFallbackList();
      for (const [domain, rank] of fallback) {
        if (!list.has(domain)) {
          list.set(domain, 10000 + rank); // Añadir después del top 10k
        }
      }
      
      console.log(`[DomainVerification] ✅ Lista Tranco: ${list.size} dominios`);
      saveTrancoToCache(list);
      trancoLastError = 0;
      return list;
    }
    
    throw new Error('Lista vacía');
    
  } catch (err: any) {
    console.error('[DomainVerification] ❌ Error descargando Tranco:', err.message);
    trancoLastError = now;
    
    // Usar caché antiguo si existe
    if (cached) {
      console.log('[DomainVerification] ⚠️ Usando caché antiguo');
      return cached.list;
    }
    
    // Último recurso: fallback hardcodeado
    console.log('[DomainVerification] ⚠️ Usando fallback hardcodeado');
    return createFallbackList();
  }
}

/**
 * Lista fallback extensa de dominios populares (~500 dominios)
 * Se usa cuando Tranco no está disponible
 */
function createFallbackList(): Map<string, number> {
  const fallbackDomains = [
    // === TOP GLOBAL ===
    'google.com', 'youtube.com', 'facebook.com', 'twitter.com', 'instagram.com',
    'wikipedia.org', 'amazon.com', 'reddit.com', 'tiktok.com', 'linkedin.com',
    'x.com', 'whatsapp.com', 'yahoo.com', 'bing.com', 'duckduckgo.com',
    'microsoft.com', 'apple.com', 'netflix.com', 'office.com', 'live.com',
    
    // === VIDEO/STREAMING ===
    'twitch.tv', 'vimeo.com', 'dailymotion.com', 'hulu.com', 'disneyplus.com',
    'hbomax.com', 'max.com', 'peacocktv.com', 'paramountplus.com', 'primevideo.com',
    'crunchyroll.com', 'funimation.com', 'bilibili.com', 'niconico.jp',
    
    // === MÚSICA ===
    'spotify.com', 'soundcloud.com', 'bandcamp.com', 'deezer.com', 'pandora.com',
    'music.apple.com', 'tidal.com', 'last.fm', 'genius.com', 'discogs.com',
    'mixcloud.com', 'audiomack.com',
    
    // === REDES SOCIALES ===
    'discord.com', 'telegram.org', 'snapchat.com', 'pinterest.com', 'tumblr.com',
    'threads.net', 'mastodon.social', 'bsky.app', 'weibo.com', 'vk.com',
    
    // === ENTRETENIMIENTO/CINE ===
    'imdb.com', 'rottentomatoes.com', 'metacritic.com', 'letterboxd.com',
    'trakt.tv', 'themoviedb.org', 'tvdb.com', 'thetvdb.com', 'fandango.com',
    'justwatch.com', 'reelgood.com',
    
    // === GAMING ===
    'steampowered.com', 'steamcommunity.com', 'store.steampowered.com',
    'epicgames.com', 'gog.com', 'itch.io', 'humble.com', 'origin.com',
    'ea.com', 'ubisoft.com', 'blizzard.com', 'battle.net',
    'minecraft.net', 'mojang.com', 'roblox.com', 'rbxcdn.com',
    'playstation.com', 'xbox.com', 'nintendo.com', 'nintendo.co.jp',
    'ign.com', 'gamespot.com', 'kotaku.com', 'polygon.com', 'pcgamer.com',
    'gamesradar.com', 'eurogamer.net', 'rockpapershotgun.com',
    
    // === NOTICIAS ===
    'bbc.com', 'bbc.co.uk', 'cnn.com', 'nytimes.com', 'washingtonpost.com',
    'theguardian.com', 'reuters.com', 'apnews.com', 'aljazeera.com',
    'forbes.com', 'bloomberg.com', 'wsj.com', 'ft.com', 'economist.com',
    'usatoday.com', 'nbcnews.com', 'cbsnews.com', 'abcnews.go.com',
    'npr.org', 'pbs.org', 'time.com', 'newsweek.com', 'theatlantic.com',
    'vox.com', 'axios.com', 'politico.com', 'thehill.com',
    
    // === TECH NEWS ===
    'techcrunch.com', 'theverge.com', 'wired.com', 'arstechnica.com',
    'engadget.com', 'mashable.com', 'cnet.com', 'zdnet.com', 'gizmodo.com',
    'thenextweb.com', 'venturebeat.com', 'siliconvalley.com',
    
    // === DESARROLLO ===
    'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com',
    'stackexchange.com', 'dev.to', 'hashnode.com', 'medium.com',
    'npmjs.com', 'pypi.org', 'rubygems.org', 'crates.io', 'nuget.org',
    'docker.com', 'hub.docker.com', 'kubernetes.io', 'vercel.com',
    'netlify.com', 'heroku.com', 'railway.app', 'render.com',
    'codepen.io', 'jsfiddle.net', 'codesandbox.io', 'replit.com',
    'glitch.com', 'stackblitz.com',
    
    // === DISEÑO ===
    'figma.com', 'canva.com', 'dribbble.com', 'behance.net', 'deviantart.com',
    'artstation.com', 'creativebloq.com', 'designernews.co', 'awwwards.com',
    'adobe.com', 'sketch.com', 'invisionapp.com', 'framer.com',
    
    // === PRODUCTIVIDAD ===
    'notion.so', 'trello.com', 'asana.com', 'monday.com', 'clickup.com',
    'airtable.com', 'miro.com', 'lucid.app', 'dropbox.com', 'box.com',
    'evernote.com', 'todoist.com', 'slack.com', 'zoom.us', 'teams.microsoft.com',
    
    // === E-COMMERCE ===
    'ebay.com', 'etsy.com', 'aliexpress.com', 'alibaba.com', 'wish.com',
    'walmart.com', 'target.com', 'bestbuy.com', 'costco.com', 'homedepot.com',
    'lowes.com', 'ikea.com', 'wayfair.com', 'overstock.com',
    'newegg.com', 'bhphotovideo.com', 'adorama.com',
    
    // === FINANZAS ===
    'paypal.com', 'stripe.com', 'square.com', 'venmo.com', 'cashapp.com',
    'coinbase.com', 'binance.com', 'kraken.com', 'robinhood.com',
    'fidelity.com', 'schwab.com', 'vanguard.com', 'etrade.com',
    'bankofamerica.com', 'chase.com', 'wellsfargo.com', 'citi.com',
    'tradingview.com', 'investing.com', 'marketwatch.com', 'seekingalpha.com',
    
    // === EDUCACIÓN ===
    'coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org', 'skillshare.com',
    'masterclass.com', 'lynda.com', 'pluralsight.com', 'codecademy.com',
    'freecodecamp.org', 'w3schools.com', 'mdn.io', 'developer.mozilla.org',
    'ted.com', 'duolingo.com', 'quizlet.com', 'chegg.com',
    
    // === REFERENCIA ===
    'quora.com', 'answers.com', 'britannica.com', 'dictionary.com',
    'thesaurus.com', 'merriam-webster.com', 'oxforddictionaries.com',
    'archive.org', 'wikimedia.org', 'wikidata.org', 'wolframalpha.com',
    
    // === SALUD ===
    'healthline.com', 'webmd.com', 'wbmdstatic.com', 'mayoclinic.org',
    'nih.gov', 'medlineplus.gov', 'cdc.gov', 'who.int', 'drugs.com',
    'everydayhealth.com', 'medicalnewstoday.com', 'health.com',
    
    // === IMÁGENES/MEMES ===
    'imgur.com', 'giphy.com', 'tenor.com', 'gfycat.com', 'knowyourmeme.com',
    'kym-cdn.com', '9gag.com', 'funnyjunk.com', 'cheezburger.com',
    'unsplash.com', 'pexels.com', 'pixabay.com', 'flickr.com',
    'shutterstock.com', 'gettyimages.com', 'istockphoto.com',
    
    // === VIAJES ===
    'booking.com', 'airbnb.com', 'tripadvisor.com', 'expedia.com',
    'hotels.com', 'kayak.com', 'skyscanner.com', 'google.com/travel',
    
    // === COMIDA ===
    'doordash.com', 'ubereats.com', 'grubhub.com', 'postmates.com',
    'yelp.com', 'allrecipes.com', 'food.com', 'epicurious.com',
    'bonappetit.com', 'seriouseats.com', 'foodnetwork.com',
    
    // === DEPORTES ===
    'espn.com', 'sports.yahoo.com', 'bleacherreport.com', 'cbssports.com',
    'nba.com', 'nfl.com', 'mlb.com', 'nhl.com', 'fifa.com', 'uefa.com',
    
    // === CDNs E INFRAESTRUCTURA ===
    'cloudflare.com', 'cloudflare-dns.com', 'cdnjs.cloudflare.com',
    'akamai.net', 'akamaized.net', 'fastly.net', 'cloudfront.net',
    'jsdelivr.net', 'unpkg.com', 'bootstrapcdn.com', 'fontawesome.com',
    'googleusercontent.com', 'gstatic.com', 'googleapis.com',
    'fbcdn.net', 'twimg.com', 'redd.it', 'redditmedia.com',
    'pinimg.com', 'wp.com', 'wordpress.com', 'gravatar.com',
    'media-amazon.com', 'ssl-images-amazon.com', 'images-amazon.com',
    'media-imdb.com',
    
    // === CDNs EDUCATIVOS ===
    'udemy.com', 'udimg.com', 'udemycdn.com', // Udemy
    'coursera-course-photos.s3.amazonaws.com', 'coursera.org',
    'edx.org', 'edxuploads.s3.amazonaws.com',
    'skillshare.com', 'static.skillshare.com',
    'lynda.com', 'pluralsight.com',
    
    // === MARCAS Y EMPRESAS ===
    'ferrero.com', 'nutella.com', 'kinder.com', // Ferrero
    'nestle.com', 'coca-cola.com', 'pepsi.com',
    'mcdonalds.com', 'starbucks.com', 'nike.com', 'adidas.com',
    'apple.com', 'samsung.com', 'sony.com', 'lg.com',
    'toyota.com', 'ford.com', 'bmw.com', 'mercedes-benz.com',
    'ikea.com', 'zara.com', 'hm.com', 'uniqlo.com',
    
    // === OTROS POPULARES ===
    'weather.com', 'accuweather.com', 'wunderground.com',
    'maps.google.com', 'openstreetmap.org', 'mapbox.com',
    'craigslist.org', 'nextdoor.com', 'meetup.com',
    'goodreads.com', 'librarything.com', 'scribd.com',
    'archive.today', 'web.archive.org'
  ];
  
  const list = new Map<string, number>();
  fallbackDomains.forEach((domain, index) => {
    list.set(domain, index + 1);
  });
  
  console.log(`[DomainVerification] 📝 Fallback: ${list.size} dominios`);
  return list;
}

/**
 * Obtiene la lista Tranco, descargándola si es necesario
 */
async function getTrancoList(): Promise<Map<string, number>> {
  const now = Date.now();
  
  // Si la lista está actualizada, devolverla
  if (trancoList.size > 0 && (now - trancoLastUpdate) < TRANCO_UPDATE_INTERVAL) {
    return trancoList;
  }
  
  // Si ya se está cargando, esperar
  if (trancoLoading) {
    await trancoLoading;
    return trancoList;
  }
  
  // Descargar lista
  trancoLoading = (async () => {
    trancoList = await downloadTrancoList();
    trancoLastUpdate = now;
    trancoLoading = null;
  })();
  
  await trancoLoading;
  return trancoList;
}

/**
 * Busca un dominio en la lista Tranco
 * Intenta con el dominio exacto y luego con el dominio base
 */
export async function getTrancoRank(hostname: string): Promise<number | null> {
  const list = await getTrancoList();
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, '');
  
  // Buscar dominio exacto
  if (list.has(normalizedHost)) {
    return list.get(normalizedHost) || null;
  }
  
  // Buscar dominio base (ej: sub.example.com -> example.com)
  const parts = normalizedHost.split('.');
  if (parts.length > 2) {
    const baseDomain = parts.slice(-2).join('.');
    if (list.has(baseDomain)) {
      return list.get(baseDomain) || null;
    }
  }
  
  // Para dominios de país (co.uk, com.es, etc.)
  if (parts.length > 3) {
    const countryBase = parts.slice(-3).join('.');
    if (list.has(countryBase)) {
      return list.get(countryBase) || null;
    }
  }
  
  return null;
}

// ============================================================================
// GOOGLE SAFE BROWSING
// ============================================================================

/**
 * Verifica una URL con Google Safe Browsing API
 * Detecta: phishing, malware, software no deseado, sitios potencialmente dañinos
 * 
 * Requiere: GOOGLE_SAFE_BROWSING_API_KEY en variables de entorno
 * Documentación: https://developers.google.com/safe-browsing/v4/lookup-api
 */
export async function checkGoogleSafeBrowsing(url: string): Promise<SafeBrowsingResult | null> {
  const apiKey = env.GOOGLE_SAFE_BROWSING_API_KEY;
  
  if (!apiKey) {
    console.log('[DomainVerification] ⚠️ Google Safe Browsing API key no configurada');
    return null;
  }
  
  try {
    const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client: {
          clientId: 'votetok',
          clientVersion: '1.0.0'
        },
        threatInfo: {
          threatTypes: [
            'MALWARE',
            'SOCIAL_ENGINEERING',
            'UNWANTED_SOFTWARE',
            'POTENTIALLY_HARMFUL_APPLICATION'
          ],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }]
        }
      })
    });
    
    if (!response.ok) {
      console.warn('[DomainVerification] ⚠️ Safe Browsing API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    // Si hay matches, la URL es peligrosa
    if (data.matches && data.matches.length > 0) {
      const threats = data.matches.map((m: any) => m.threatType);
      console.log('[DomainVerification] 🚨 Safe Browsing detectó amenazas:', threats);
      return {
        isSafe: false,
        threats
      };
    }
    
    return {
      isSafe: true,
      threats: []
    };
    
  } catch (err: any) {
    console.error('[DomainVerification] ❌ Error Safe Browsing:', err.message);
    return null;
  }
}

// ============================================================================
// VIRUSTOTAL
// ============================================================================

/**
 * Verifica una URL con VirusTotal API
 * Escanea contra 70+ motores antivirus y listas de bloqueo
 * 
 * Requiere: VIRUSTOTAL_API_KEY en variables de entorno
 * Documentación: https://developers.virustotal.com/reference/url-info
 */
export async function checkVirusTotal(url: string): Promise<VirusTotalResult | null> {
  const apiKey = env.VIRUSTOTAL_API_KEY;
  
  if (!apiKey) {
    console.log('[DomainVerification] ⚠️ VirusTotal API key no configurada');
    return null;
  }
  
  try {
    // Codificar URL en base64 para la API v3
    const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');
    const endpoint = `https://www.virustotal.com/api/v3/urls/${urlId}`;
    
    const response = await fetch(endpoint, {
      headers: {
        'x-apikey': apiKey,
        'Accept': 'application/json'
      }
    });
    
    // 404 significa que la URL no ha sido escaneada antes
    if (response.status === 404) {
      console.log('[DomainVerification] ℹ️ URL no encontrada en VirusTotal (no escaneada)');
      return null;
    }
    
    if (!response.ok) {
      console.warn('[DomainVerification] ⚠️ VirusTotal API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    const stats = data.data?.attributes?.last_analysis_stats;
    
    if (!stats) {
      return null;
    }
    
    const positives = (stats.malicious || 0) + (stats.suspicious || 0);
    const total = Object.values(stats).reduce((a: number, b: any) => a + (b || 0), 0) as number;
    
    console.log(`[DomainVerification] 🔍 VirusTotal: ${positives}/${total} detecciones`);
    
    return {
      isSafe: positives === 0,
      positives,
      total,
      scanDate: data.data?.attributes?.last_analysis_date || ''
    };
    
  } catch (err: any) {
    console.error('[DomainVerification] ❌ Error VirusTotal:', err.message);
    return null;
  }
}

// ============================================================================
// VERIFICACIÓN PRINCIPAL
// ============================================================================

/**
 * Determina el nivel de confianza basado en el ranking Tranco
 */
function getTrustLevelFromRank(rank: number | null): DomainVerificationResult['trustLevel'] {
  if (rank === null) return 'unknown';
  if (rank <= TRANCO_THRESHOLDS.HIGHLY_TRUSTED) return 'highly_trusted';
  if (rank <= TRANCO_THRESHOLDS.TRUSTED) return 'trusted';
  if (rank <= TRANCO_THRESHOLDS.KNOWN) return 'known';
  if (rank <= TRANCO_THRESHOLDS.LISTED) return 'listed';
  return 'unknown';
}

/**
 * Verifica un dominio/URL de forma completa
 * 
 * Flujo de verificación:
 * 1. Consulta caché
 * 2. Busca en lista Tranco (autoridad)
 * 3. Si no está en Top 100k, consulta Google Safe Browsing
 * 4. Si es sospechoso, consulta VirusTotal (opcional)
 * 5. Devuelve resultado combinado
 */
export async function verifyDomain(urlOrDomain: string): Promise<DomainVerificationResult> {
  // Normalizar input
  let url: URL;
  let domain: string;
  
  try {
    // Si es solo dominio, añadir protocolo
    if (!urlOrDomain.includes('://')) {
      urlOrDomain = 'https://' + urlOrDomain;
    }
    url = new URL(urlOrDomain);
    domain = url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return {
      domain: urlOrDomain,
      isSafe: false,
      trustLevel: 'unsafe',
      trancoRank: null,
      safeBrowsingResult: null,
      virusTotalResult: null,
      cached: false,
      timestamp: Date.now()
    };
  }
  
  // 1. Verificar caché
  const cached = verificationCache.get(domain);
  if (cached && (Date.now() - cached.timestamp) < VERIFICATION_CACHE_TTL) {
    return { ...cached, cached: true };
  }
  
  console.log(`[DomainVerification] 🔍 Verificando: ${domain}`);
  
  // 2. Buscar en Tranco
  const trancoRank = await getTrancoRank(domain);
  const trustLevel = getTrustLevelFromRank(trancoRank);
  
  if (trancoRank !== null) {
    console.log(`[DomainVerification] 📊 Tranco rank: #${trancoRank} (${trustLevel})`);
  }
  
  // 3. Para sitios muy confiables (Top 100k), no necesitamos más verificación
  if (trustLevel === 'highly_trusted' || trustLevel === 'trusted') {
    const result: DomainVerificationResult = {
      domain,
      isSafe: true,
      trustLevel,
      trancoRank,
      safeBrowsingResult: null,
      virusTotalResult: null,
      cached: false,
      timestamp: Date.now()
    };
    verificationCache.set(domain, result);
    return result;
  }
  
  // 4. Para sitios desconocidos o menos confiables, usar Safe Browsing
  let safeBrowsingResult: SafeBrowsingResult | null = null;
  let virusTotalResult: VirusTotalResult | null = null;
  
  safeBrowsingResult = await checkGoogleSafeBrowsing(url.href);
  
  // Si Safe Browsing detecta amenazas, es inseguro
  if (safeBrowsingResult && !safeBrowsingResult.isSafe) {
    const result: DomainVerificationResult = {
      domain,
      isSafe: false,
      trustLevel: 'unsafe',
      trancoRank,
      safeBrowsingResult,
      virusTotalResult: null,
      cached: false,
      timestamp: Date.now()
    };
    verificationCache.set(domain, result);
    return result;
  }
  
  // 5. Para sitios completamente desconocidos, usar VirusTotal como capa adicional
  if (trustLevel === 'unknown') {
    virusTotalResult = await checkVirusTotal(url.href);
    
    // Si VirusTotal detecta positivos, marcar como inseguro
    if (virusTotalResult && !virusTotalResult.isSafe) {
      const result: DomainVerificationResult = {
        domain,
        isSafe: false,
        trustLevel: 'unsafe',
        trancoRank,
        safeBrowsingResult,
        virusTotalResult,
        cached: false,
        timestamp: Date.now()
      };
      verificationCache.set(domain, result);
      return result;
    }
  }
  
  // 6. Determinar resultado final
  // Si está en Tranco (cualquier posición) y no tiene amenazas detectadas, es seguro
  // Si no está en Tranco pero Safe Browsing dice que es seguro, lo permitimos con cautela
  const isSafe = trancoRank !== null || (safeBrowsingResult?.isSafe ?? true);
  
  const result: DomainVerificationResult = {
    domain,
    isSafe,
    trustLevel: isSafe ? (trustLevel === 'unknown' ? 'known' : trustLevel) : 'unsafe',
    trancoRank,
    safeBrowsingResult,
    virusTotalResult,
    cached: false,
    timestamp: Date.now()
  };
  
  verificationCache.set(domain, result);
  return result;
}

/**
 * Verificación rápida: solo comprueba Tranco (sin llamadas a APIs externas)
 * Útil para validación inicial antes de mostrar preview
 */
export async function quickVerify(hostname: string): Promise<{
  isSafe: boolean;
  trustLevel: DomainVerificationResult['trustLevel'];
  trancoRank: number | null;
}> {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, '');
  
  // Verificar caché primero
  const cached = verificationCache.get(normalizedHost);
  if (cached && (Date.now() - cached.timestamp) < VERIFICATION_CACHE_TTL) {
    return {
      isSafe: cached.isSafe,
      trustLevel: cached.trustLevel,
      trancoRank: cached.trancoRank
    };
  }
  
  // Solo Tranco
  const trancoRank = await getTrancoRank(normalizedHost);
  const trustLevel = getTrustLevelFromRank(trancoRank);
  
  return {
    isSafe: trancoRank !== null, // Si está en Top 1M, es "seguro"
    trustLevel,
    trancoRank
  };
}

/**
 * Verifica si un dominio es seguro (reemplazo de isSafeDomain)
 * Compatible con la API anterior
 */
export async function isSafeDomainAuto(url: string): Promise<boolean> {
  try {
    const urlObj = new URL(url);
    const result = await quickVerify(urlObj.hostname);
    return result.isSafe;
  } catch {
    return false;
  }
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Limpia caché de verificaciones antiguas
 */
export function cleanVerificationCache(): void {
  const now = Date.now();
  const entries = Array.from(verificationCache.entries());
  for (const [key, value] of entries) {
    if ((now - value.timestamp) > VERIFICATION_CACHE_TTL) {
      verificationCache.delete(key);
    }
  }
}

/**
 * Fuerza la recarga de la lista Tranco
 */
export async function reloadTrancoList(): Promise<number> {
  trancoLastUpdate = 0;
  await getTrancoList();
  return trancoList.size;
}

/**
 * Obtiene estadísticas del servicio
 */
export function getVerificationStats(): {
  trancoSize: number;
  trancoLastUpdate: Date | null;
  cacheSize: number;
  hasGoogleApiKey: boolean;
  hasVirusTotalApiKey: boolean;
} {
  return {
    trancoSize: trancoList.size,
    trancoLastUpdate: trancoLastUpdate > 0 ? new Date(trancoLastUpdate) : null,
    cacheSize: verificationCache.size,
    hasGoogleApiKey: !!env.GOOGLE_SAFE_BROWSING_API_KEY,
    hasVirusTotalApiKey: !!env.VIRUSTOTAL_API_KEY
  };
}

// Limpiar caché periódicamente
setInterval(cleanVerificationCache, 10 * 60 * 1000); // Cada 10 minutos
