# 🔗 Sistema de Preview de Enlaces

Sistema completo de detección automática y preview de enlaces con soporte para oEmbed, Open Graph, filtrado de seguridad y proxy de imágenes.

## 🎯 Características Implementadas

### ✅ Detección Automática de URLs
- Detecta URLs en título y opciones de encuestas automáticamente
- Soporta URLs en texto plano y formato markdown `[texto](url)`
- Debounce de 500ms para evitar requests excesivos mientras el usuario escribe
- Extracción inteligente: separa la URL del texto para mejor UX

### ✅ Sistema de Metadatos Multi-Capa

#### 1. oEmbed (Prioritario)
Soporte nativo para **12+ servicios populares**:
- **Video**: YouTube, Vimeo, Twitch, TikTok
- **Social**: Twitter/X, Instagram, Reddit
- **Música**: Spotify, SoundCloud
- **Imágenes**: Flickr, Giphy, Imgur

#### 2. Open Graph (Fallback)
- Extracción de metatags: `og:title`, `og:description`, `og:image`, `og:site_name`
- Twitter Cards como fallback secundario
- Normalización automática de URLs de imágenes relativas

#### 3. Genérico (Última Opción)
- Extracción de `<title>` y meta description
- Preview minimalista con dominio y título

### ✅ Proxy de Imágenes Seguro

**Endpoint**: `/api/media-proxy?url=...`

**Características**:
- Whitelist de 50+ dominios confiables
- Validación de tipos MIME (imágenes, videos, audios)
- Límite de tamaño: 10MB por archivo
- Cache en memoria con TTL de 7 días
- Headers seguros: X-Content-Type-Options, X-Frame-Options
- Timeout de 8 segundos
- Solo protocolo HTTPS

**Dominios Permitidos**:
- Servicios de imágenes: Imgur, Flickr, Unsplash, Pixabay
- CDNs: Cloudinary, CloudFront, Akamai
- Redes sociales: Twitter, Instagram, Facebook
- GIFs: Giphy, Tenor
- Videos: YouTube, Vimeo, Twitch
- Otros: Reddit, Discord, GitHub, Wikipedia

### ✅ Componente LinkPreview.svelte

**Props**:
```typescript
interface Props {
  preview: LinkPreviewData;    // Datos del preview
  onRemove?: () => void;        // Callback para remover
  compact?: boolean;            // Modo compacto (para opciones)
  clickable?: boolean;          // Si se puede hacer click
}
```

**Diseño**:
- Vista completa con imagen, título, descripción y dominio
- Modo compacto horizontal para espacios reducidos
- Botón X para remover el preview
- Badge de advertencia NSFW (si `nsfwScore > 0.7`)
- Indicador de "Dominio no verificado" para sitios no en whitelist
- Lazy loading de imágenes con spinner
- Estados de error manejados graciosamente

### ✅ Servicio Frontend (linkPreview.ts)

**Funciones Principales**:
```typescript
// Detectar URLs en texto
extractUrls(text: string): string[]

// Obtener preview con cache
fetchLinkPreviewCached(url: string): Promise<LinkPreviewData | null>

// Verificar tipo de URL
isDirectImage(url: string): boolean
isEmbeddableVideo(url: string): boolean
isGif(url: string): boolean

// Utilidades
getDomainName(url: string): string
truncateText(text: string, maxLength: number): string
```

**Cache Inteligente**:
- Almacenamiento en sessionStorage
- TTL de 24 horas
- Previene requests duplicados

### ✅ Integración en CreatePollModal

**Comportamiento**:
1. Usuario escribe texto con URL en título o opción
2. Debounce de 500ms
3. Sistema detecta URL automáticamente
4. Carga preview en segundo plano
5. Muestra LinkPreview si tiene metadatos ricos
6. Fallback a MediaEmbed para imágenes directas

**Estados Manejados**:
- Loading: Spinner mientras carga
- Preview con metadatos: Componente LinkPreview
- Imagen directa: MediaEmbed tradicional
- Error: Fallback a Giphy automático

## 🔐 Seguridad

### Validación de Dominios
```typescript
// Solo dominios en whitelist pueden usar el proxy
isDomainAllowed(url: string): boolean

// Dominios seguros conocidos sin filtro adicional
SAFE_DOMAINS = [
  'wikipedia.org', 'github.com', 'stackoverflow.com',
  'bbc.com', 'nytimes.com', 'reuters.com', // etc
]
```

### Filtro NSFW (Placeholder)
```typescript
interface LinkPreviewData {
  nsfwScore?: number; // 0-1, donde 1 es muy NSFW
  isSafe: boolean;    // Si el dominio es confiable
}
```

**Nota**: El filtrado NSFW activo requiere integración con un clasificador de imágenes como:
- TensorFlow.js con modelo NSFW.js
- API externa como Sightengine
- Cloud Vision API de Google

### Protección Anti-SSRF
- Solo URLs con protocolo `http://` o `https://`
- No se permiten IPs privadas (TODO)
- Timeout estricto de 8 segundos
- Validación de Content-Type antes de procesar

## 📁 Estructura de Archivos

### Backend
```
src/routes/api/
├── link-preview/+server.ts       # API principal de metadatos
└── media-proxy/+server.ts        # Proxy seguro de imágenes (ya existía)

src/lib/server/
├── oembed-providers.ts           # Configuración de proveedores oEmbed
└── media-proxy-config.ts         # Whitelist y configuración (expandida)
```

### Frontend
```
src/lib/
├── services/
│   └── linkPreview.ts            # Servicio de detección y cache
├── components/
│   └── LinkPreview.svelte        # Componente visual de preview
└── CreatePollModal.svelte        # Integración automática

src/routes/api/
└── link-preview/
    └── +server.ts                # TypeScript types exportados
```

## 🚀 Uso

### Detección Automática en CreatePollModal

El sistema funciona **automáticamente** cuando el usuario:
1. Pega o escribe una URL en el título de la encuesta
2. Pega o escribe una URL en el texto de una opción

No requiere acción adicional del usuario.

### Uso Programático del Servicio

```typescript
import { extractUrls, fetchLinkPreviewCached } from '$lib/services/linkPreview';

// Detectar URLs
const urls = extractUrls('Mira este video https://youtube.com/watch?v=abc123');
// ['https://youtube.com/watch?v=abc123']

// Obtener preview (con cache)
const preview = await fetchLinkPreviewCached(urls[0]);
if (preview) {
  console.log(preview.title);       // "Video Title"
  console.log(preview.description); // "Video description..."
  console.log(preview.imageProxied); // "/api/media-proxy?url=..."
  console.log(preview.type);        // "oembed" | "opengraph" | "generic"
}
```

### Uso del Componente

```svelte
<script>
  import LinkPreview from '$lib/components/LinkPreview.svelte';
  import type { LinkPreviewData } from '$routes/api/link-preview/+server';
  
  let preview: LinkPreviewData = {
    url: 'https://youtube.com/watch?v=abc',
    title: 'Video Title',
    description: 'Video description',
    image: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
    imageProxied: '/api/media-proxy?url=...',
    domain: 'youtube.com',
    siteName: 'YouTube',
    type: 'oembed',
    isSafe: true
  };
</script>

<!-- Vista completa -->
<LinkPreview preview={preview} />

<!-- Modo compacto sin click -->
<LinkPreview 
  preview={preview} 
  compact={true}
  clickable={false}
/>

<!-- Con botón de remover -->
<LinkPreview 
  preview={preview}
  onRemove={() => console.log('Removed')}
/>
```

## 🔄 Flujo Completo

### Ejemplo: Usuario pega URL de YouTube

1. **Usuario escribe**: "¿Cuál es mejor? https://youtube.com/watch?v=abc123"

2. **Detección (500ms después)**:
   ```typescript
   extractUrls(title) // ['https://youtube.com/watch?v=abc123']
   ```

3. **Request a API**:
   ```
   GET /api/link-preview?url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3Dabc123
   ```

4. **API busca oEmbed**:
   ```
   GET https://www.youtube.com/oembed?url=...&format=json
   ```

5. **Respuesta con metadatos**:
   ```json
   {
     "success": true,
     "data": {
       "url": "https://youtube.com/watch?v=abc123",
       "title": "Amazing Video Title",
       "description": "Video description",
       "image": "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
       "imageProxied": "/api/media-proxy?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fabc123%2Fhqdefault.jpg",
       "siteName": "YouTube",
       "type": "oembed",
       "embedHtml": "<iframe src='https://youtube.com/embed/abc123'></iframe>",
       "isSafe": true
     }
   }
   ```

6. **Frontend muestra preview**:
   - Thumbnail del video (servida vía proxy)
   - Título del video
   - Nombre del canal
   - Badge "YouTube"
   - Botón X para remover

## 📊 Tipos TypeScript

```typescript
export interface LinkPreviewData {
  url: string;              // URL original
  title: string;            // Título del contenido
  description?: string;     // Descripción
  image?: string;           // URL de imagen original
  imageProxied?: string;    // URL vía proxy seguro
  siteName?: string;        // Nombre del sitio/proveedor
  domain: string;           // Dominio (ej: "youtube.com")
  type: 'oembed' | 'opengraph' | 'generic';
  embedHtml?: string;       // HTML de iframe (solo oEmbed)
  width?: number;           // Ancho del embed
  height?: number;          // Alto del embed
  providerName?: string;    // Nombre del proveedor oEmbed
  isSafe: boolean;          // Si el dominio es confiable
  nsfwScore?: number;       // Puntuación NSFW (0-1)
}
```

## 🎨 Personalización CSS

El componente LinkPreview usa CSS modules con selectores `:global()` para permitir personalización:

```css
/* Personalizar tamaño del preview en título */
.main-media-preview :global(.link-preview) {
  width: 100%;
  max-width: 600px;
}

/* Personalizar preview en opciones */
.option-link-preview-wrapper :global(.link-preview) {
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
}

/* Cambiar colores del preview */
:global(.link-preview) {
  --preview-bg: rgba(255, 255, 255, 0.05);
  --preview-border: rgba(255, 255, 255, 0.15);
}
```

## ⚙️ Configuración

### Agregar Nuevo Dominio a Whitelist

```typescript
// src/lib/server/media-proxy-config.ts
export const MEDIA_PROXY_CONFIG: MediaProxyConfig = {
  allowedDomains: [
    // ... existentes
    'nuevo-dominio.com',
    '*.cdn-de-nuevo-dominio.com', // Soporta wildcards
  ]
};
```

### Agregar Nuevo Proveedor oEmbed

```typescript
// src/lib/server/oembed-providers.ts
export const OEMBED_PROVIDERS: OEmbedProvider[] = [
  // ... existentes
  {
    name: 'NuevoServicio',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?nuevoservicio\.com\/video\/([^\/]+)/
    ],
    endpoint: 'https://nuevoservicio.com/api/oembed',
    maxWidth: 1280,
    maxHeight: 720
  }
];
```

## 🐛 Debugging

### Logs en Consola

El sistema proporciona logs detallados:

```
[Link Preview] Fetching metadata for: https://...
[Link Preview] Preview fetched: { title: '...', type: 'oembed' }
[LinkPreview] Using cached preview for: https://...
[Media Proxy] Cache hit: https://...
[Media Proxy] Success: https://... (123456 bytes)
```

### Probar Manualmente

```typescript
// En consola del navegador
import { fetchLinkPreviewCached } from '$lib/services/linkPreview';

// Test YouTube
const yt = await fetchLinkPreviewCached('https://youtube.com/watch?v=dQw4w9WgXcQ');
console.log(yt);

// Test Wikipedia
const wiki = await fetchLinkPreviewCached('https://en.wikipedia.org/wiki/JavaScript');
console.log(wiki);
```

## 🔮 TODOs Futuros

### Filtro NSFW Activo
```typescript
// Opción 1: TensorFlow.js (cliente)
import * as nsfwjs from 'nsfwjs';
const model = await nsfwjs.load();
const predictions = await model.classify(imageElement);

// Opción 2: API externa (servidor)
const response = await fetch('https://api.sightengine.com/1.0/check.json', {
  method: 'POST',
  body: formData
});
```

### Rate Limiting
```typescript
// Implementar rate limiting por IP
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite de requests
});
```

### Cache Redis
```typescript
// Reemplazar Map en memoria con Redis
import { createClient } from 'redis';
const redis = createClient();

cache.set(key, value, 'EX', 86400); // 24 horas
```

### Validación Anti-SSRF
```typescript
// Bloquear IPs privadas
function isPrivateIP(ip: string): boolean {
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(ip);
}
```

## 📝 Notas de Implementación

- El proxy de imágenes **ya existía** (`/api/media-proxy`), solo se expandió la whitelist
- El sistema es **completamente automático** en CreatePollModal
- Cache de sesión previene requests duplicados en la misma sesión
- Cache del servidor (7 días) reduce carga en servicios externos
- Fallback gracioso: si oEmbed falla → Open Graph → genérico
- Compatible con Svelte 5 (`$state`, `$derived`, `$effect`)

---

**Creado por**: Sistema de Preview de Enlaces VoteTok  
**Versión**: 1.0.0  
**Última actualización**: 2024
