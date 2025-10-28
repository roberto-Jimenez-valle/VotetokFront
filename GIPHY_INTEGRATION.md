# 🎬 Integración de Giphy - Guía Completa

## ✅ Configuración Completada

El sistema ahora soporta **GIFs de Giphy** automáticamente cuando se crean encuestas.

---

## 🔧 Dominios Configurados

Los siguientes dominios de Giphy están en la **whitelist del proxy**:

```
✅ media.giphy.com
✅ giphy.com
✅ i.giphy.com
✅ media0.giphy.com
✅ media1.giphy.com
✅ media2.giphy.com
✅ media3.giphy.com
✅ media4.giphy.com
```

---

## 🎨 Uso Básico (Sin API)

### Opción 1: Copiar enlace directo del GIF

1. Ve a [Giphy.com](https://giphy.com)
2. Busca un GIF
3. Click derecho en el GIF → **"Copiar dirección de imagen"**
4. Pega la URL en CreatePollModal:

```
Título: ¿Cuál te gusta más? https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif
```

### Resultado:
- ✅ El GIF se muestra animado en el preview
- ✅ Se usa el proxy automáticamente
- ✅ Sin errores CORS

---

## 🚀 Uso Avanzado (Con API de Giphy)

### 1. Obtener API Key de Giphy

1. Regístrate en [Giphy Developers](https://developers.giphy.com/)
2. Crea una nueva app
3. Copia tu **API Key**

**API Key de prueba** (límite de requests):
```
dc6zaTOxFJmzC
```

### 2. Endpoints de la API

#### Buscar GIFs
```javascript
const API_KEY = 'tu_api_key_aqui';
const searchTerm = 'happy';

const response = await fetch(
  `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${searchTerm}&limit=10`
);
const data = await response.json();

// URLs de las imágenes
data.data.forEach(gif => {
  console.log('GIF URL:', gif.images.original.url);
  console.log('GIF Thumbnail:', gif.images.fixed_height.url);
});
```

#### GIFs Trending
```javascript
const response = await fetch(
  `https://api.giphy.com/v1/gifs/trending?api_key=${API_KEY}&limit=10`
);
const data = await response.json();
```

#### GIF por ID
```javascript
const gifId = '3oEjI6SIIHBdRxXI40';
const response = await fetch(
  `https://api.giphy.com/v1/gifs/${gifId}?api_key=${API_KEY}`
);
const data = await response.json();
const gifUrl = data.data.images.original.url;
```

---

## 📦 Formatos de URL Soportados

Giphy proporciona múltiples tamaños:

### 1. **Original** (calidad completa)
```
https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif
```

### 2. **Fixed Height** (altura fija 200px)
```
https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/200.gif
```

### 3. **Fixed Width** (ancho fijo 200px)
```
https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/200w.gif
```

### 4. **Downsized** (optimizado, más ligero)
```
https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy-downsized.gif
```

**Recomendación**: Usa `fixed_height` (200px) o `downsized` para mejor rendimiento.

---

## 🧪 Ejemplo de Integración en CreatePollModal

### Código de Ejemplo

```svelte
<script>
  const GIPHY_API_KEY = 'dc6zaTOxFJmzC'; // API Key de prueba
  let giphySearchTerm = '';
  let giphyResults = [];
  let isSearchingGiphy = false;

  async function searchGiphy() {
    if (!giphySearchTerm.trim()) return;
    
    isSearchingGiphy = true;
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(giphySearchTerm)}&limit=20`
      );
      const data = await response.json();
      
      giphyResults = data.data.map(gif => ({
        id: gif.id,
        title: gif.title,
        url: gif.images.fixed_height.url, // 200px altura
        originalUrl: gif.images.original.url
      }));
    } catch (error) {
      console.error('Error buscando GIFs:', error);
    } finally {
      isSearchingGiphy = false;
    }
  }

  function selectGif(gifUrl) {
    // Agregar URL al título o a una opción
    title += ` ${gifUrl}`;
    giphyResults = [];
    giphySearchTerm = '';
  }
</script>

<!-- UI para buscar GIFs -->
<div class="giphy-search">
  <input 
    type="text" 
    bind:value={giphySearchTerm}
    placeholder="Buscar GIFs en Giphy..."
    onkeydown={(e) => e.key === 'Enter' && searchGiphy()}
  />
  <button onclick={searchGiphy} disabled={isSearchingGiphy}>
    {isSearchingGiphy ? 'Buscando...' : '🔍 Buscar'}
  </button>
</div>

{#if giphyResults.length > 0}
  <div class="giphy-results">
    {#each giphyResults as gif}
      <button 
        class="gif-thumbnail"
        onclick={() => selectGif(gif.url)}
        type="button"
      >
        <img src={gif.url} alt={gif.title} />
      </button>
    {/each}
  </div>
{/if}
```

---

## 🎯 Uso en Producción

### 1. Variables de Entorno

Crea un archivo `.env`:

```bash
VITE_GIPHY_API_KEY=JiEJUHdqINWZXrJe9Qya0nJ6piG4kZ6Z
```

### 2. Acceder a la API Key

```typescript
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY;
```

### 3. Rate Limits

| Plan | Requests/Day | Requests/Hour |
|------|--------------|---------------|
| Free | 42,000 | 1,000 |
| Paid | 1M+ | Sin límite |

---

## 📊 Estructura de Respuesta de la API

```json
{
  "data": [
    {
      "id": "3oEjI6SIIHBdRxXI40",
      "title": "Happy Cat GIF",
      "images": {
        "original": {
          "url": "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif",
          "width": "480",
          "height": "270"
        },
        "fixed_height": {
          "url": "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/200.gif",
          "width": "356",
          "height": "200"
        },
        "downsized": {
          "url": "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy-downsized.gif",
          "size": "456789"
        }
      }
    }
  ]
}
```

---

## ✅ Testing

### Test 1: URL directa de Giphy

```powershell
# En CreatePollModal, pega:
https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif

# Resultado esperado: GIF animado aparece en el preview
```

### Test 2: API Search

```bash
curl "https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=happy&limit=5"
```

### Test 3: Proxy funcionando

```powershell
# Verificar que el proxy maneja Giphy
Invoke-WebRequest -Uri "http://localhost:5173/api/media-proxy?url=https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif" -Method Head
```

**Resultado esperado**:
```
StatusCode: 200
Content-Type: image/gif
X-Cache: MISS (primera vez) o HIT (segunda vez)
```

---

## 🎨 Estilos CSS para Grid de GIFs

```css
.giphy-results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
}

.gif-thumbnail {
  width: 100%;
  aspect-ratio: 1;
  border: none;
  padding: 0;
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  transition: transform 0.2s;
}

.gif-thumbnail:hover {
  transform: scale(1.05);
}

.gif-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

---

## 🔒 Seguridad

✅ Todos los GIFs pasan por el **proxy de medios**  
✅ Dominios de Giphy están en la **whitelist**  
✅ Solo se permiten URLs **HTTPS**  
✅ Límite de tamaño: **10MB**  
✅ Timeout: **8 segundos**  

---

## 📚 Documentación Oficial

- **API Docs**: https://developers.giphy.com/docs/api/
- **Endpoints**: https://developers.giphy.com/docs/api/endpoint
- **SDKs**: https://developers.giphy.com/docs/sdk

---

## 🎉 Ejemplo Completo

### Crear encuesta con GIF de Giphy:

```
Título: ¿Qué prefieres? https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/200.gif

Opción 1: Pizza 🍕
Opción 2: Hamburguesa 🍔
Opción 3: Tacos 🌮
```

**Resultado**:
1. El GIF aparece animado en el preview del título
2. Se usa el proxy automáticamente
3. El GIF se guarda con la encuesta
4. Los usuarios ven el GIF animado al votar

---

## 🚀 Próximos Pasos (Opcional)

Si quieres agregar un selector de Giphy integrado:

1. **Instalar SDK de Giphy**:
   ```bash
   npm install @giphy/js-fetch-api
   ```

2. **Componente GiphyPicker**:
   - Input de búsqueda
   - Grid de resultados
   - Click para seleccionar
   - Auto-insertar en título/opción

3. **Rate limiting**:
   - Debounce en búsqueda (300ms)
   - Caché de resultados
   - Lazy loading

---

## ✅ Resumen

| Característica | Estado |
|----------------|--------|
| Dominios Giphy en whitelist | ✅ Configurado |
| Proxy soporta GIFs | ✅ Funcionando |
| URLs directas funcionan | ✅ Sí |
| API de Giphy funciona | ✅ Sí |
| Integración CreatePollModal | ⚠️ Opcional (manual) |
| Selector de Giphy UI | ❌ No implementado |

**Tu sistema ya está listo para usar Giphy.** Solo pega URLs de GIFs en CreatePollModal y funcionarán automáticamente. 🎉

---

**Última actualización**: Octubre 2024
