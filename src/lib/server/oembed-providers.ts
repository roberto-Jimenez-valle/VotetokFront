/**
 * Proveedores de oEmbed conocidos
 * Configuración de endpoints para servicios populares
 */

export interface OEmbedProvider {
  name: string;
  urlPatterns: RegExp[];
  endpoint: string;
  requiresApiKey?: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

export const OEMBED_PROVIDERS: OEmbedProvider[] = [
  // YouTube
  {
    name: 'YouTube',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
      /^https?:\/\/(?:www\.)?youtu\.be\/([^?]+)/,
      /^https?:\/\/(?:www\.)?youtube\.com\/embed\/([^?]+)/
    ],
    endpoint: 'https://www.youtube.com/oembed',
    maxWidth: 1280,
    maxHeight: 720
  },
  
  // Vimeo
  {
    name: 'Vimeo',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/,
      /^https?:\/\/player\.vimeo\.com\/video\/(\d+)/
    ],
    endpoint: 'https://vimeo.com/api/oembed.json',
    maxWidth: 1280,
    maxHeight: 720
  },
  
  // Twitter/X
  {
    name: 'Twitter',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?(twitter|x)\.com\/[^/]+\/status\/\d+/,
      /^https?:\/\/(?:www\.)?x\.com\/[^/]+\/status\/\d+/, // x.com explícito
      /^https?:\/\/(?:mobile\.)?(twitter|x)\.com\/[^/]+\/status\/\d+/ // mobile variant
    ],
    endpoint: 'https://publish.twitter.com/oembed',
    maxWidth: 550
  },
  
  // Spotify
  {
    name: 'Spotify',
    urlPatterns: [
      /^https?:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\/([^?]+)/
    ],
    endpoint: 'https://open.spotify.com/oembed',
    maxWidth: 300,
    maxHeight: 380
  },
  
  // SoundCloud
  {
    name: 'SoundCloud',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?soundcloud\.com\/.+/
    ],
    endpoint: 'https://soundcloud.com/oembed',
    maxWidth: 500,
    maxHeight: 400
  },
  
  // Flickr
  {
    name: 'Flickr',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?flickr\.com\/photos\/.+/,
      /^https?:\/\/flic\.kr\/.+/
    ],
    endpoint: 'https://www.flickr.com/services/oembed',
    maxWidth: 1024
  },
  
  // Instagram (mejorado con más variantes)
  {
    name: 'Instagram',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?instagram\.com\/(p|reel|tv|reels)\/([^/?]+)/,
      /^https?:\/\/(?:www\.)?instagram\.com\/stories\/[^/]+\/\d+/,
      /^https?:\/\/instagr\.am\/(p|reel)\/([^/?]+)/
    ],
    endpoint: 'https://api.instagram.com/oembed',
    maxWidth: 658
  },
  
  // TikTok (mejorado con más variantes)
  {
    name: 'TikTok',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?tiktok\.com\/@[^/]+\/video\/\d+/,
      /^https?:\/\/(?:vm|vt|m)\.tiktok\.com\/.+/,
      /^https?:\/\/(?:www\.)?tiktok\.com\/t\/.+/
    ],
    endpoint: 'https://www.tiktok.com/oembed',
    maxWidth: 325,
    maxHeight: 730
  },
  
  // Twitch - Sin oEmbed público, usar Open Graph fallback
  // Se deja comentado porque requiere autenticación
  // {
  //   name: 'Twitch',
  //   urlPatterns: [...],
  //   endpoint: 'https://api.twitch.tv/v5/oembed' // Requiere Client-ID header
  // },
  
  // Reddit
  {
    name: 'Reddit',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?reddit\.com\/r\/[^/]+\/comments\/.+/
    ],
    endpoint: 'https://www.reddit.com/oembed'
  },
  
  // Giphy
  {
    name: 'Giphy',
    urlPatterns: [
      /^https?:\/\/giphy\.com\/gifs\/.+/,
      /^https?:\/\/media\.giphy\.com\/media\/.+/
    ],
    endpoint: 'https://giphy.com/services/oembed'
  },
  
  // Imgur
  {
    name: 'Imgur',
    urlPatterns: [
      /^https?:\/\/(?:i\.)?imgur\.com\/([a-zA-Z0-9]+)/,
      /^https?:\/\/imgur\.com\/gallery\/([a-zA-Z0-9]+)/,
      /^https?:\/\/imgur\.com\/a\/([a-zA-Z0-9]+)/
    ],
    endpoint: 'https://api.imgur.com/oembed'
  },
  
  // Facebook (posts y videos)
  {
    name: 'Facebook',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?facebook\.com\/[^/]+\/posts\/[^/]+/,
      /^https?:\/\/(?:www\.)?facebook\.com\/[^/]+\/videos\/[^/]+/,
      /^https?:\/\/(?:www\.)?facebook\.com\/watch\/\?v=\d+/,
      /^https?:\/\/(?:www\.)?fb\.watch\/.+/
    ],
    endpoint: 'https://www.facebook.com/plugins/post/oembed.json'
  },
  
  // LinkedIn
  {
    name: 'LinkedIn',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?linkedin\.com\/posts\/.+/,
      /^https?:\/\/(?:www\.)?linkedin\.com\/feed\/update\/.+/,
      /^https?:\/\/(?:www\.)?linkedin\.com\/embed\/feed\/update\/.+/
    ],
    endpoint: 'https://www.linkedin.com/oembed'
  },
  
  // Pinterest
  {
    name: 'Pinterest',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?pinterest\.com\/pin\/\d+/,
      /^https?:\/\/(?:www\.)?pinterest\.[a-z.]+\/pin\/\d+/,
      /^https?:\/\/pin\.it\/.+/
    ],
    endpoint: 'https://www.pinterest.com/oembed.json'
  },
  
  // Dailymotion
  {
    name: 'Dailymotion',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?dailymotion\.com\/video\/[^_]+/,
      /^https?:\/\/dai\.ly\/.+/
    ],
    endpoint: 'https://www.dailymotion.com/services/oembed',
    maxWidth: 1280,
    maxHeight: 720
  },
  
  // Kickstarter
  {
    name: 'Kickstarter',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?kickstarter\.com\/projects\/.+/
    ],
    endpoint: 'https://www.kickstarter.com/services/oembed'
  },
  
  // CodePen
  {
    name: 'CodePen',
    urlPatterns: [
      /^https?:\/\/codepen\.io\/[^/]+\/(?:pen|details)\/[^/]+/
    ],
    endpoint: 'https://codepen.io/api/oembed'
  },
  
  // SlideShare
  {
    name: 'SlideShare',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?slideshare\.net\/.+/,
      /^https?:\/\/(?:es|fr|de|pt)\.slideshare\.net\/.+/
    ],
    endpoint: 'https://www.slideshare.net/api/oembed/2'
  },
  
  // Scribd
  {
    name: 'Scribd',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?scribd\.com\/document\/.+/,
      /^https?:\/\/(?:www\.)?scribd\.com\/doc\/.+/
    ],
    endpoint: 'https://www.scribd.com/services/oembed'
  },
  
  // Mixcloud
  {
    name: 'Mixcloud',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?mixcloud\.com\/.+/
    ],
    endpoint: 'https://www.mixcloud.com/oembed/'
  },
  
  // Datawrapper (visualizaciones)
  {
    name: 'Datawrapper',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?datawrapper\.dwcdn\.net\/.+/,
      /^https?:\/\/datawrapper\.de\/.+/
    ],
    endpoint: 'https://api.datawrapper.de/v3/oembed/'
  },
  
  // Coub (videos en loop)
  {
    name: 'Coub',
    urlPatterns: [
      /^https?:\/\/coub\.com\/view\/.+/
    ],
    endpoint: 'https://coub.com/api/oembed.json'
  },
  
  // Deezer - Sin oEmbed público, usar Open Graph fallback
  // La API de Deezer pública se usa directamente en el frontend
  
  // Apple Music - Sin oEmbed público, usar Open Graph fallback
  // Apple no tiene endpoint oEmbed público
  
  // Bandcamp
  {
    name: 'Bandcamp',
    urlPatterns: [
      /^https?:\/\/[^.]+\.bandcamp\.com\/(track|album)\/.+/,
      /^https?:\/\/bandcamp\.com\/[^/]+/
    ],
    endpoint: 'https://bandcamp.com/oembed',
    maxWidth: 400,
    maxHeight: 120
  }
];

/**
 * Encuentra el proveedor de oEmbed para una URL
 */
export function findOEmbedProvider(url: string): OEmbedProvider | null {
  for (const provider of OEMBED_PROVIDERS) {
    for (const pattern of provider.urlPatterns) {
      if (pattern.test(url)) {
        return provider;
      }
    }
  }
  return null;
}

/**
 * Construye la URL del endpoint oEmbed con parámetros
 */
export function buildOEmbedUrl(provider: OEmbedProvider, targetUrl: string): string {
  const params = new URLSearchParams({
    url: targetUrl,
    format: 'json'
  });
  
  if (provider.maxWidth) {
    params.set('maxwidth', provider.maxWidth.toString());
  }
  
  if (provider.maxHeight) {
    params.set('maxheight', provider.maxHeight.toString());
  }
  
  return `${provider.endpoint}?${params.toString()}`;
}

/**
 * Lista de dominios seguros conocidos (sin necesidad de oEmbed)
 */
export const SAFE_DOMAINS = [
  // Wikis y Conocimiento
  'wikipedia.org',
  'wikimedia.org',
  'wikidata.org',
  'commons.wikimedia.org',
  'mediawiki.org',
  'wiktionary.org',
  'wikiquote.org',
  'wikisource.org',
  'wikinews.org',
  'wikiversity.org',
  'wikibooks.org',
  'wikivoyage.org',
  
  // E-commerce y Retail
  'amazon.com',
  'amazon.es',
  'amazon.co.uk',
  'amazon.de',
  'amazon.fr',
  'amazon.it',
  'amazon.ca',
  'ebay.com',
  'etsy.com',
  'aliexpress.com',
  
  // Desarrollo y Tecnología
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'stackoverflow.com',
  'stackexchange.com',
  'developer.mozilla.org',
  'npmjs.com',
  'pypi.org',
  'docs.python.org',
  'docs.oracle.com',
  'microsoft.com',
  'apple.com',
  
  // Publicaciones y Blogs
  'medium.com',
  'dev.to',
  'substack.com',
  'wordpress.com',
  'blogger.com',
  'tumblr.com',
  'ghost.org',
  
  // Noticias Internacionales
  'bbc.com',
  'bbc.co.uk',
  'cnn.com',
  'theguardian.com',
  'nytimes.com',
  'washingtonpost.com',
  'reuters.com',
  'apnews.com',
  'bloomberg.com',
  'economist.com',
  'ft.com',
  'wsj.com',
  'forbes.com',
  'fortune.com',
  'businessinsider.com',
  
  // Noticias Tecnología
  'techcrunch.com',
  'wired.com',
  'arstechnica.com',
  'theverge.com',
  'engadget.com',
  'gizmodo.com',
  'zdnet.com',
  'cnet.com',
  'venturebeat.com',
  'thenextweb.com',
  
  // Noticias en Español - España
  'elpais.com',
  'elmundo.es',
  'lavanguardia.com',
  'abc.es',
  'eldiario.es',
  'publico.es',
  '20minutos.es',
  'elconfidencial.com',
  'elespanol.com',
  'expansion.com',
  'cincodias.com',
  'vozpopuli.com',
  'okdiario.com',
  'periodistadigital.com',
  'huffingtonpost.es',
  
  // Noticias en Español - Latinoamérica
  'clarin.com',
  'lanacion.com.ar',
  'infobae.com',
  'pagina12.com.ar',
  'ambito.com',
  'perfil.com',
  'ole.com.ar',
  'eluniversal.com.mx',
  'reforma.com',
  'excelsior.com.mx',
  'milenio.com',
  'jornada.com.mx',
  'proceso.com.mx',
  'eleconomista.com.mx',
  'eltiempo.com',
  'semana.com',
  'elespectador.com',
  'portafolio.co',
  'emol.com',
  'latercera.com',
  'elmercurio.com',
  'lun.com',
  'elcomercio.pe',
  'gestion.pe',
  'elpopular.pe',
  'eluniverso.com',
  'elcomercio.com',
  'larepublica.co',
  'caracol.com.co',
  'rcnradio.com',
  
  // Periódicos Europa - Francia
  'lemonde.fr',
  'lefigaro.fr',
  'liberation.fr',
  'leparisien.fr',
  'humanite.fr',
  'lexpress.fr',
  'lepoint.fr',
  'nouvelobs.com',
  'mediapart.fr',
  'lesechos.fr',
  
  // Periódicos Europa - Alemania
  'spiegel.de',
  'bild.de',
  'welt.de',
  'faz.net',
  'sueddeutsche.de',
  'zeit.de',
  'handelsblatt.com',
  'focus.de',
  'tagesspiegel.de',
  'taz.de',
  
  // Periódicos Europa - Italia
  'corriere.it',
  'repubblica.it',
  'lastampa.it',
  'ilsole24ore.com',
  'ilgiornale.it',
  'ilmessaggero.it',
  'gazzetta.it',
  'ansa.it',
  
  // Periódicos Europa - Reino Unido (adicionales)
  'independent.co.uk',
  'mirror.co.uk',
  'telegraph.co.uk',
  'thetimes.co.uk',
  'express.co.uk',
  'dailymail.co.uk',
  'standard.co.uk',
  'metro.co.uk',
  
  // Periódicos Europa - Portugal
  'publico.pt',
  'expresso.pt',
  'dn.pt',
  'jn.pt',
  'cmjornal.pt',
  'observador.pt',
  
  // Periódicos Europa - Otros
  'nrc.nl',
  'volkskrant.nl',
  'telegraaf.nl',
  'standaard.be',
  'demorgen.be',
  'lesoir.be',
  'tages-anzeiger.ch',
  'nzz.ch',
  
  // Periódicos Asia
  'japantimes.co.jp',
  'asahi.com',
  'yomiuri.co.jp',
  'mainichi.jp',
  'timesofindia.com',
  'hindustantimes.com',
  'thehindu.com',
  'indianexpress.com',
  'scmp.com',
  'straitstimes.com',
  'bangkokpost.com',
  'koreaherald.com',
  
  // Periódicos Oceanía
  'smh.com.au',
  'theage.com.au',
  'news.com.au',
  'heraldsun.com.au',
  'abc.net.au',
  'nzherald.co.nz',
  'stuff.co.nz',
  
  // Educación
  'coursera.org',
  'udemy.com',
  'edx.org',
  'khanacademy.org',
  'mit.edu',
  'stanford.edu',
  'harvard.edu',
  'ox.ac.uk',
  'cam.ac.uk',
  
  // Comunidad y Foros
  'news.ycombinator.com',
  'reddit.com',
  'quora.com',
  'stackexchange.com',
  'discourse.org',
  
  // Ciencia y Académico
  'nature.com',
  'science.org',
  'sciencedirect.com',
  'arxiv.org',
  'researchgate.net',
  'academia.edu',
  'ncbi.nlm.nih.gov',
  'pubmed.gov',
  
  // Gobierno y Organizaciones
  'gov',
  'edu',
  'europa.eu',
  'un.org',
  'who.int',
  'worldbank.org',
  'imf.org',
  'oecd.org',
  
  // Mapas y Localización
  'google.com/maps',
  'maps.google.com',
  'openstreetmap.org',
  
  // Diseño y Creatividad
  'behance.net',
  'dribbble.com',
  'unsplash.com',
  'pexels.com',
  'pixabay.com',
  'canva.com',
  'figma.com',
  
  // Empresas Tecnológicas - Big Tech
  'google.com',
  'youtube.com',
  'android.com',
  'google.es',
  'microsoft.com',
  'azure.microsoft.com',
  'office.com',
  'linkedin.com',
  'apple.com',
  'icloud.com',
  'meta.com',
  'facebook.com',
  'instagram.com',
  'whatsapp.com',
  'amazon.com',
  'aws.amazon.com',
  'netflix.com',
  'adobe.com',
  'salesforce.com',
  'oracle.com',
  'ibm.com',
  'intel.com',
  'amd.com',
  'nvidia.com',
  'dell.com',
  'hp.com',
  'lenovo.com',
  'samsung.com',
  'lg.com',
  'sony.com',
  'huawei.com',
  'xiaomi.com',
  'oppo.com',
  
  // Empresas Tecnológicas - Software y Servicios
  'atlassian.com',
  'jira.atlassian.com',
  'confluence.atlassian.com',
  'asana.com',
  'monday.com',
  'airtable.com',
  'notion.so',
  'evernote.com',
  'onenote.com',
  'dropbox.com',
  'box.com',
  'onedrive.com',
  'drive.google.com',
  'icloud.com',
  'wetransfer.com',
  'slack.com',
  'discord.com',
  'teams.microsoft.com',
  'zoom.us',
  'meet.google.com',
  'webex.com',
  'gotomeeting.com',
  'skype.com',
  'telegram.org',
  'signal.org',
  
  // Servicios Financieros
  'paypal.com',
  'stripe.com',
  'square.com',
  'visa.com',
  'mastercard.com',
  'americanexpress.com',
  'chase.com',
  'bankofamerica.com',
  'wellsfargo.com',
  'citibank.com',
  'hsbc.com',
  'santander.com',
  'bbva.com',
  'caixabank.com',
  'unicredit.it',
  'bnpparibas.com',
  'deutschebank.de',
  'creditsuisse.com',
  'ubs.com',
  'goldmansachs.com',
  'morganstanley.com',
  'jpmorgan.com',
  'blackrock.com',
  'vanguard.com',
  'fidelity.com',
  'schwab.com',
  'robinhood.com',
  'coinbase.com',
  'binance.com',
  'kraken.com',
  
  // Retail y E-commerce
  'amazon.com',
  'ebay.com',
  'walmart.com',
  'target.com',
  'bestbuy.com',
  'homedepot.com',
  'lowes.com',
  'costco.com',
  'ikea.com',
  'zara.com',
  'hm.com',
  'gap.com',
  'nike.com',
  'adidas.com',
  'puma.com',
  'underarmour.com',
  'reebok.com',
  'newbalance.com',
  'levis.com',
  'uniqlo.com',
  'shein.com',
  'asos.com',
  'zalando.com',
  'aliexpress.com',
  'alibaba.com',
  'jd.com',
  'rakuten.com',
  'mercadolibre.com',
  'shopee.com',
  'lazada.com',
  'etsy.com',
  'wayfair.com',
  'overstock.com',
  
  // Entretenimiento y Streaming
  'netflix.com',
  'disneyplus.com',
  'hulu.com',
  'hbomax.com',
  'primevideo.com',
  'paramount.com',
  'peacocktv.com',
  'crunchyroll.com',
  'funimation.com',
  'spotify.com',
  'applemusic.com',
  'deezer.com',
  'pandora.com',
  'tidal.com',
  'soundcloud.com',
  'twitch.tv',
  'youtube.com',
  'vimeo.com',
  'dailymotion.com',
  
  // Viajes y Turismo
  'booking.com',
  'expedia.com',
  'hotels.com',
  'trivago.com',
  'kayak.com',
  'skyscanner.com',
  'airbnb.com',
  'vrbo.com',
  'tripadvisor.com',
  'lonely-planet.com',
  'hostelworld.com',
  'rentalcars.com',
  'enterprise.com',
  'hertz.com',
  'uber.com',
  'lyft.com',
  'bolt.eu',
  'cabify.com',
  'blablacar.com',
  'flixbus.com',
  'omio.com',
  'rome2rio.com',
  
  // Comida y Delivery
  'ubereats.com',
  'doordash.com',
  'grubhub.com',
  'deliveroo.com',
  'justeat.com',
  'glovo.com',
  'rappi.com',
  'ifood.com.br',
  'postmates.com',
  'instacart.com',
  'seamless.com',
  'yelp.com',
  'opentable.com',
  'thefork.com',
  'zomato.com',
  'swiggy.com',
  
  // Redes Profesionales y Corporativas
  'linkedin.com',
  'xing.com',
  'indeed.com',
  'glassdoor.com',
  'monster.com',
  'careerbuilder.com',
  'ziprecruiter.com',
  'wellfound.com',
  'angel.co',
  'crunchbase.com',
  'pitchbook.com',
  'producthunt.com',
  
  // Salud y Fitness
  'webmd.com',
  'mayoclinic.org',
  'clevelandclinic.org',
  'nih.gov',
  'cdc.gov',
  'who.int',
  'medlineplus.gov',
  'drugs.com',
  'healthline.com',
  'verywellhealth.com',
  'fitbit.com',
  'myfitnesspal.com',
  'strava.com',
  'garmin.com',
  'polar.com',
  'peloton.com',
  
  // Gaming
  'steam.com',
  'epicgames.com',
  'ea.com',
  'activision.com',
  'ubisoft.com',
  'rockstargames.com',
  'nintendo.com',
  'playstation.com',
  'xbox.com',
  'blizzard.com',
  'riotgames.com',
  'minecraft.net',
  'roblox.com',
  'twitch.tv',
  'ign.com',
  'gamespot.com',
  'polygon.com',
  'kotaku.com',
  'eurogamer.net',
  
  // Otros Servicios Populares
  'trello.com',
  'canva.com',
  'figma.com',
  'miro.com',
  'lucidchart.com',
  'docusign.com',
  'adobesign.com',
  'mailchimp.com',
  'constantcontact.com',
  'hubspot.com',
  'intercom.com',
  'zendesk.com',
  'freshdesk.com',
  'calendly.com',
  'doodle.com',
  'eventbrite.com',
  'meetup.com',
  'change.org',
  'gofundme.com',
  'patreon.com',
  'kickstarter.com',
  'indiegogo.com'
];

/**
 * Verifica si un dominio es seguro
 */
export function isSafeDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    return SAFE_DOMAINS.some(domain => {
      return hostname === domain || hostname.endsWith('.' + domain);
    });
  } catch {
    return false;
  }
}
