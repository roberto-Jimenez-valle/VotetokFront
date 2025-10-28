# 🎨 Ejemplo de Integración: Giphy en CreatePollModal

## 📁 Archivos Creados

1. **`src/lib/services/giphy.ts`** - Servicio para consultar la API de Giphy
2. **`src/lib/components/GiphyPicker.svelte`** - Componente UI para buscar GIFs
3. **`scripts/test-giphy.ts`** - Script de prueba (como el código que compartiste)

---

## 🚀 Uso Básico del Servicio

### Ejemplo 1: Obtener URL de un GIF (simple)

```typescript
import { giphyGifUrl } from '$lib/services/giphy';

// Obtener GIF de "pizza"
const url = await giphyGifUrl('pizza');
console.log(url);
// https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif

// Agregar al título de la encuesta
title += ` ${url}`;
```

### Ejemplo 2: Buscar múltiples GIFs

```typescript
import { searchGiphy, getBestGifUrl } from '$lib/services/giphy';

// Buscar "pizza"
const gifs = await searchGiphy('pizza', {
  limit: 10,
  rating: 'g',
  lang: 'es'
});

// Obtener URLs optimizadas
gifs.forEach(gif => {
  console.log(gif.title);
  console.log(getBestGifUrl(gif, 'fixed_height')); // 200px de alto
});
```

### Ejemplo 3: GIFs Trending

```typescript
import { getTrendingGifs } from '$lib/services/giphy';

const trending = await getTrendingGifs(20, 'g');
console.log(`${trending.length} GIFs trending`);
```

### Ejemplo 4: Obtener GIFs para múltiples términos (como tu código)

```typescript
import { getGifsForTerms } from '$lib/services/giphy';

const comidas = ["pizza", "sushi", "tacos", "curry"];
const results = await getGifsForTerms(comidas);

results.forEach((url, term) => {
  console.log(`${term}: ${url}`);
});
```

---

## 🎨 Integración en CreatePollModal

### Opción A: Botón para abrir GiphyPicker

```svelte
<script lang="ts">
  import GiphyPicker from '$lib/components/GiphyPicker.svelte';
  import { Image } from 'lucide-svelte';
  
  // Estado
  let showGiphyPicker = $state(false);
  let title = $state('');
  
  // Cuando se selecciona un GIF
  function handleGifSelected(gifUrl: string) {
    // Agregar URL al final del título
    title = title.trim() + ` ${gifUrl}`;
    
    // Cerrar el picker
    showGiphyPicker = false;
    
    console.log('GIF seleccionado:', gifUrl);
  }
</script>

<!-- Botón para abrir Giphy -->
<div class="title-section">
  <input 
    type="text" 
    bind:value={title}
    placeholder="Título de la encuesta..."
  />
  
  <button
    type="button"
    class="giphy-btn"
    onclick={() => showGiphyPicker = true}
    title="Buscar GIF"
  >
    <Image class="w-5 h-5" />
    GIF
  </button>
</div>

<!-- Modal de Giphy -->
{#if showGiphyPicker}
  <div class="modal-overlay" onclick={() => showGiphyPicker = false}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <GiphyPicker 
        onSelect={handleGifSelected}
        onClose={() => showGiphyPicker = false}
      />
    </div>
  </div>
{/if}

<style>
  .giphy-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #000, #00ff99);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .giphy-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 255, 153, 0.3);
  }
  
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }
  
  .modal-content {
    width: 100%;
    max-width: 700px;
  }
</style>
```

### Opción B: Búsqueda inline simple

```svelte
<script lang="ts">
  import { giphyGifUrl } from '$lib/services/giphy';
  import { Search, Loader2 } from 'lucide-svelte';
  
  let gifSearchTerm = $state('');
  let isSearchingGif = $state(false);
  let title = $state('');
  
  async function searchAndAddGif() {
    if (!gifSearchTerm.trim()) return;
    
    isSearchingGif = true;
    try {
      const gifUrl = await giphyGifUrl(gifSearchTerm);
      
      if (gifUrl) {
        title = title.trim() + ` ${gifUrl}`;
        gifSearchTerm = '';
        console.log('✅ GIF agregado:', gifUrl);
      } else {
        alert('No se encontró GIF para ese término');
      }
    } finally {
      isSearchingGif = false;
    }
  }
</script>

<!-- Búsqueda rápida de GIF -->
<div class="quick-gif-search">
  <input
    type="text"
    bind:value={gifSearchTerm}
    placeholder="Buscar GIF rápido (ej: pizza)..."
    onkeydown={(e) => e.key === 'Enter' && searchAndAddGif()}
    disabled={isSearchingGif}
  />
  
  <button
    type="button"
    onclick={searchAndAddGif}
    disabled={isSearchingGif || !gifSearchTerm.trim()}
  >
    {#if isSearchingGif}
      <Loader2 class="w-4 h-4 animate-spin" />
    {:else}
      <Search class="w-4 h-4" />
    {/if}
    Buscar GIF
  </button>
</div>
```

### Opción C: Auto-sugerencias al escribir

```svelte
<script lang="ts">
  import { giphyGifUrl } from '$lib/services/giphy';
  
  let title = $state('');
  let suggestedGif = $state('');
  let lastSearchedTerm = $state('');
  
  // Detectar palabras clave y sugerir GIF
  $effect(() => {
    const words = title.split(' ');
    const lastWord = words[words.length - 1]?.trim().toLowerCase();
    
    // Lista de palabras que activan sugerencias
    const foodKeywords = ['pizza', 'sushi', 'tacos', 'burger', 'pasta'];
    
    if (lastWord && foodKeywords.includes(lastWord) && lastWord !== lastSearchedTerm) {
      lastSearchedTerm = lastWord;
      giphyGifUrl(lastWord).then(url => {
        if (url) {
          suggestedGif = url;
        }
      });
    }
  });
  
  function addSuggestedGif() {
    if (suggestedGif) {
      title = title.trim() + ` ${suggestedGif}`;
      suggestedGif = '';
      lastSearchedTerm = '';
    }
  }
</script>

<!-- Sugerencia de GIF -->
{#if suggestedGif}
  <div class="gif-suggestion">
    <img src={suggestedGif} alt="Sugerencia" />
    <div class="suggestion-actions">
      <button onclick={addSuggestedGif}>
        ✅ Agregar este GIF
      </button>
      <button onclick={() => suggestedGif = ''}>
        ✕ Ignorar
      </button>
    </div>
  </div>
{/if}
```

---

## 🧪 Probar el Script de Testing

```bash
# Instalar tsx si no lo tienes
npm install -D tsx

# Ejecutar el script de prueba
npx tsx scripts/test-giphy.ts
```

**Salida esperada**:
```
🎬 Probando API de Giphy...

📋 Buscando GIFs para 12 comidas:

✅ pizza          → https://media.giphy.com/media/.../giphy.gif
✅ sushi          → https://media.giphy.com/media/.../giphy.gif
✅ tacos          → https://media.giphy.com/media/.../giphy.gif
...

✨ Test completado!

🔍 Probando búsqueda con múltiples resultados...
...

🔥 Probando GIFs trending...
...
```

---

## 🔧 Configuración de API Key (Opcional)

Si quieres usar tu propia API Key de Giphy:

### 1. Crear `.env` en la raíz del proyecto

```bash
# .env
VITE_GIPHY_API_KEY=tu_api_key_real_aqui
```

### 2. Reiniciar el servidor

```bash
npm run dev
```

El servicio automáticamente usará tu API Key en lugar de la pública.

---

## 📊 Comparación de Métodos

| Método | Pros | Contras | Uso Recomendado |
|--------|------|---------|-----------------|
| **GiphyPicker** | UI completa, búsqueda interactiva | Más código | Mejor UX, apps complejas |
| **Búsqueda inline** | Simple, rápido de implementar | Menos visual | Prototipado rápido |
| **Auto-sugerencias** | UX innovadora, mágico | Puede ser intrusivo | Features premium |

---

## 🎯 Recomendación

Para CreatePollModal, recomiendo usar **Opción A (GiphyPicker)** porque:

1. ✅ UX profesional tipo Twitter/Instagram
2. ✅ Búsqueda + Trending integrados
3. ✅ Grid visual de GIFs
4. ✅ Fácil de agregar a opciones también
5. ✅ Ya está completamente implementado

---

## 🚀 Próximos Pasos

1. **Agregar botón GIF** en CreatePollModal (junto al botón de emojis)
2. **Implementar GiphyPicker** como modal
3. **Probar con diferentes búsquedas**
4. **Ajustar estilos** según tu diseño

¿Quieres que implemente la integración completa en CreatePollModal? 🎨

---

**Última actualización**: Octubre 2024
