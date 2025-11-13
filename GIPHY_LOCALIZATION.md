# Localización de Búsquedas en Giphy

## 🌍 Detección Automática de País

El sistema ahora detecta automáticamente el país del usuario para proporcionar resultados de Giphy más relevantes y localizados.

## Cómo Funciona

### 1. Servicio de Geolocalización (`src/lib/services/geolocation.ts`)

El servicio detecta la ubicación del usuario usando:

1. **API de ipapi.co** (primera opción)
   - Servicio gratuito sin necesidad de API key
   - Proporciona país, código de país, idioma y timezone

2. **Configuración del Navegador** (fallback)
   - Usa `navigator.language` para detectar el idioma
   - Usa `Intl.DateTimeFormat().resolvedOptions().timeZone` para el timezone

3. **Valores por Defecto** (último fallback)
   - País: España (ES)
   - Idioma: español (es)

### 2. Integración con Giphy (`src/lib/services/giphy.ts`)

Las funciones de búsqueda de Giphy ahora incluyen automáticamente:

- **`giphyGifUrl()`**: Añade parámetro `lang` basado en el usuario
- **`searchGiphy()`**: Detecta idioma automáticamente si no se especifica
- **`getTrendingGifs()`**: Preparado para localización futura

### 3. Visualización en UI (`GiphyPicker.svelte`)

El componente GiphyPicker muestra:
- Badge con el código de idioma del usuario (ej: "ES", "EN", "FR")
- Icono de globo para indicar localización activa
- Tooltip: "Resultados localizados para tu país"

## Ejemplo de Uso

```typescript
import { searchGiphy } from '$lib/services/giphy';

// Búsqueda automática con idioma del usuario
const gifs = await searchGiphy('pizza');

// O especificar idioma manualmente
const gifsEN = await searchGiphy('pizza', { lang: 'en' });
```

## Códigos de Idioma Soportados

Giphy soporta los siguientes códigos de idioma (ISO 639-1):

- `es` - Español
- `en` - Inglés
- `fr` - Francés
- `de` - Alemán
- `it` - Italiano
- `pt` - Portugués
- `ja` - Japonés
- `ko` - Coreano
- `zh` - Chino
- Y muchos más...

## Ventajas

✅ **Mejores Resultados**: Los GIFs son más relevantes para el contexto cultural del usuario
✅ **Automático**: No requiere configuración manual
✅ **Fallback Robusto**: Si falla la detección, usa valores sensatos por defecto
✅ **Caché Inteligente**: La ubicación se detecta una sola vez por sesión
✅ **Privacidad**: Solo se usa para mejorar resultados, no se almacena

## Personalización

### Cambiar Idioma Manualmente

```typescript
import { searchGiphy } from '$lib/services/giphy';

// Forzar inglés
const gifs = await searchGiphy('funny cat', { lang: 'en' });
```

### Limpiar Caché de Ubicación

```typescript
import { clearLocationCache } from '$lib/services/geolocation';

// Útil para testing o cambio de contexto
clearLocationCache();
```

## Notas Técnicas

- **API de ipapi.co**: Límite de 1,000 requests/día (gratuito)
- **Caché**: La ubicación se almacena en memoria durante la sesión
- **Timeout**: Las llamadas a la API tienen timeout implícito del navegador
- **Error Handling**: Si falla todo, usa 'es' como idioma por defecto

## Mejoras Futuras

- [ ] Permitir al usuario cambiar su idioma preferido manualmente
- [ ] Almacenar preferencia en localStorage
- [ ] Añadir más servicios de geolocalización como fallback
- [ ] Soporte para dialectos regionales (es-MX, es-AR, etc.)
