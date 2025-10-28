# Sistema de Validación de Previews y Thumbnails

## Overview

He implementado un sistema completo para validar URLs y generar thumbnails personalizados con nuestro propio diseño. El sistema valida que los previews sean válidos antes de crear encuestas y genera thumbnails consistentes para todas las plataformas.

## Componentes

### 1. Backend API - `/api/validate-preview`

**Endpoint**: `POST /api/validate-preview`
**Body**: `{ url: string }`
**Response**:
```json
{
  "success": true,
  "data": {
    "url": "https://...",
    "title": "Título del contenido",
    "description": "Descripción",
    "image": "https://thumbnail-url",
    "type": "video|audio|image|social|website",
    "isValid": true
  }
}
```

### 2. Metadata Service - `src/lib/server/metadata.ts`

- **Validación de URLs**: Verifica formato y accesibilidad
- **Extracción de metadatos**: Usa Microlink API con fallbacks
- **Optimización de imágenes**: Parámetros específicos por CDN
- **Thumbnails personalizados**: Generados por plataforma

### 3. MediaEmbed Component - Actualizado

- **Validación previa**: Usa API backend antes que Microlink
- **Fallback robusto**: Microlink como fallback si API falla
- **Thumbnails consistentes**: Diseño uniforme por plataforma

### 4. CreatePollModal - Validación mejorada

- **Validación asíncrona**: Verifica URLs antes de submit
- **Errores específicos**: Muestra errores por campo
- **Feedback visual**: Errores en tiempo real

## Plataformas Soportadas

### Social Media
- **Instagram**: Thumbnails personalizados con fallback `#E4405F`
- **TikTok**: Diseño oscuro con placeholder `#000`
- **Twitter/X**: Azul característico `#1DA1F2`
- **Facebook**: Azul Facebook `#1877F2`
- **Pinterest**: Rojo Pinterest `#E60023`

### Video/Audio
- **YouTube**: Rojo YouTube `#FF0000`
- **Spotify**: Verde Spotify `#1DB954`
- **Vimeo**: Reproductor embebido
- **SoundCloud**: Reproductor embebido
- **Twitch**: Reproductor embebido

### Imágenes Directas
- **JPG, PNG, GIF, WebP, SVG**: Sin modificación
- **Optimización automática**: Parámetros por CDN

### Sitios Web Genéricos
- **Thumbnails con letra**: Primera letra del dominio
- **Fallback universal**: Placeholder gris `#333`

## Flujo de Validación

### 1. Detección de URL
```javascript
// Extraer URLs de texto
const url = extractUrlFromText(text);
// O usar URL explícita
const url = imageUrl;
```

### 2. Validación en Backend
```javascript
// API endpoint valida y genera metadata
const response = await fetch('/api/validate-preview', {
  method: 'POST',
  body: JSON.stringify({ url })
});
```

### 3. Generación de Thumbnail
```javascript
// Thumbnails personalizados por plataforma
if (url.includes('instagram.com')) {
  return generateSocialThumbnail('Instagram', title, '#E4405F', '#fff');
}
```

### 4. Manejo de Errores
```javascript
// Validación antes de crear encuesta
const isValid = await validate();
if (!isValid) {
  // Mostrar errores específicos
  return;
}
```

## Características de Validación

### ✅ Verificación de Accesibilidad
- Timeout de 8 segundos
- Validación de formato URL
- Detección de contenido inaccesible

### ✅ Optimización de Imágenes
- Parámetros específicos Cloudinary
- Optimización Instagram
- Reducción de tamaño automática

### ✅ Fallbacks Robustos
- API backend → Microlink → Placeholders
- Thumbnails por plataforma
- Manejo de errores elegante

### ✅ Validación en Tiempo Real
- Errores por campo individual
- Feedback visual inmediato
- Prevención de envíos inválidos

## Ejemplos de Uso

### URL Válida
```
Input: https://www.youtube.com/watch?v=dQw4w9WgXcQ
Output: {
  title: "Never Gonna Give You Up",
  image: "https://ui-avatars.com/api/?name=YouTube&background=FF0000&color=fff&size=220",
  type: "video",
  isValid: true
}
```

### URL Inválida
```
Input: https://sitio-inexistente-123.com
Output: {
  error: "URL no válida o no accesible",
  isValid: false
}
```

### Red Social sin Metadata
```
Input: https://instagram.com/p/ABC123
Output: {
  title: "Instagram",
  image: "https://i.imgur.com/qj8nF2J.jpeg",
  type: "image",
  isValid: true
}
```

## Configuración

### Timeout Settings
```javascript
// Backend: 8 segundos para metadata
const controller = new AbortController();
setTimeout(() => controller.abort(), 8000);

// Frontend: Timeout para validación
const timeoutId = setTimeout(() => controller.abort(), 8000);
```

### Platform Colors
```javascript
const PLATFORM_COLORS = {
  instagram: '#E4405F',
  tiktok: '#000',
  twitter: '#1DA1F2',
  facebook: '#1877F2',
  youtube: '#FF0000',
  spotify: '#1DB954'
};
```

## Testing

### Probar Validación
```javascript
// En consola del navegador
fetch('/api/validate-preview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://youtube.com/watch?v=...' })
})
.then(r => r.json())
.then(console.log);
```

### Probar Errores
```javascript
// URL inválida
fetch('/api/validate-preview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'not-a-url' })
})
.then(r => r.json())
.then(console.log); // Debe mostrar error
```

## Beneficios

1. **Consistencia Visual**: Todos los previews tienen diseño uniforme
2. **Validación Robusta**: Previene contenido roto o inaccesible
3. **Performance**: Thumbnails optimizados y cacheados
4. **UX Mejorada**: Feedback inmediato de errores
5. **Mantenibilidad**: Sistema centralizado y extensible

## Archivos Modificados

1. `src/routes/api/validate-preview/+server.ts` - API de validación
2. `src/lib/server/metadata.ts` - Servicio de metadatos
3. `src/lib/components/MediaEmbed.svelte` - Componente actualizado
4. `src/lib/CreatePollModal.svelte` - Validación mejorada
5. `docs/preview-validation.md` - Documentación
