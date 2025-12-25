<script lang="ts">
  import {
    searchGiphy,
    getTrendingGifs,
    getBestGifUrl,
    type GiphyGif,
  } from "$lib/services/giphy";
  import {
    searchTenor,
    getTrendingTenor,
    getBestTenorUrl,
    type TenorGif,
    registerTenorShare,
  } from "$lib/services/tenor";
  import { getUserLocation } from "$lib/services/geolocation";
  import { Search, Loader2, TrendingUp, Globe } from "lucide-svelte";

  // Tipo unificado para GIFs de ambas fuentes
  type UnifiedGif = (GiphyGif & { source?: "giphy" }) | TenorGif;

  // Props
  interface Props {
    onSelect: (gifUrl: string) => void;
    onClose?: () => void;
    optionColor?: string; // Color de la opción para personalizar el picker
    initialSearch?: string; // Búsqueda inicial automática
  }

  let {
    onSelect,
    onClose,
    optionColor = "#00ff99",
    initialSearch = "",
  }: Props = $props();

  // Estado
  let searchTerm = $state(initialSearch);
  let gifs = $state<UnifiedGif[]>([]);
  let isLoading = $state(false);
  let showTrending = $state(true);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let userCountry = $state<string>("");
  let userLanguage = $state<string>("");

  // Detectar ubicación del usuario al inicio
  $effect(() => {
    getUserLocation()
      .then((location) => {
        userCountry = location.country;
        userLanguage = location.language.toUpperCase();
        console.log(
          `[GiphyPicker] Resultados localizados para: ${location.country} (${location.language})`,
        );
      })
      .catch((err) => {
        console.warn("[GiphyPicker] No se pudo detectar ubicación:", err);
      });
  });

  // Cargar trending al inicio o buscar si hay initialSearch
  $effect(() => {
    if (initialSearch && initialSearch.trim()) {
      // Si hay búsqueda inicial, buscar automáticamente
      showTrending = false;
      handleSearch();
    } else if (showTrending) {
      loadTrending();
    }
  });

  /**
   * Mezclar e intercalar resultados de ambas fuentes
   */
  function shuffleAndMerge(
    giphyGifs: GiphyGif[],
    tenorGifs: TenorGif[],
  ): UnifiedGif[] {
    // Marcar la fuente en los GIFs de Giphy
    const giphyMarked = giphyGifs.map((g) => ({
      ...g,
      source: "giphy" as const,
    }));

    // Intercalar: alternar empezando por Tenor
    const merged: UnifiedGif[] = [];
    const maxLen = Math.max(giphyMarked.length, tenorGifs.length);

    for (let i = 0; i < maxLen; i++) {
      // Tenor primero, luego Giphy
      if (i < tenorGifs.length) merged.push(tenorGifs[i]);
      if (i < giphyMarked.length) merged.push(giphyMarked[i]);
    }

    return merged;
  }

  async function loadTrending() {
    isLoading = true;
    try {
      // Cargar de ambas fuentes en paralelo y mezclar
      const [giphyGifs, tenorGifs] = await Promise.all([
        getTrendingGifs(12, "g", "gifs"),
        getTrendingTenor(12, "medium"),
      ]);
      gifs = shuffleAndMerge(giphyGifs, tenorGifs);
      showTrending = true;
      console.log(`[GifPicker] Cargados ${gifs.length} GIFs trending`);
    } catch (error) {
      console.error("Error cargando trending GIFs:", error);
    } finally {
      isLoading = false;
    }
  }

  async function handleSearch() {
    if (!searchTerm.trim()) {
      loadTrending();
      return;
    }

    // Limpiar timer anterior
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Debounce de 500ms
    debounceTimer = setTimeout(async () => {
      isLoading = true;
      showTrending = false;

      try {
        // Buscar en ambas fuentes en paralelo y mezclar
        const [giphyGifs, tenorGifs] = await Promise.all([
          searchGiphy(searchTerm, {
            limit: 12,
            rating: "g",
            lang: "es",
            type: "gifs",
          }),
          searchTenor(searchTerm, {
            limit: 12,
            contentfilter: "medium",
            lang: "es",
          }),
        ]);
        gifs = shuffleAndMerge(giphyGifs, tenorGifs);
        console.log(
          `[GifPicker] Buscados ${gifs.length} GIFs para "${searchTerm}"`,
        );
      } catch (error) {
        console.error("Error buscando GIFs:", error);
      } finally {
        isLoading = false;
      }
    }, 500);
  }

  function selectGif(gif: UnifiedGif) {
    // Determinar la fuente y obtener la mejor URL
    let gifUrl: string;

    if (gif.source === "tenor") {
      gifUrl = getBestTenorUrl(gif as TenorGif, "fixed_height");
      // Registrar el share en Tenor para mejorar resultados futuros
      registerTenorShare(gif.id);
    } else {
      gifUrl = getBestGifUrl(gif as GiphyGif, "fixed_height");
    }

    onSelect(gifUrl);
  }

  // Helper para obtener la URL de preview (thumbnail)
  function getPreviewUrl(gif: UnifiedGif): string {
    if (gif.source === "tenor") {
      return getBestTenorUrl(gif as TenorGif, "fixed_height_small");
    }
    return getBestGifUrl(gif as GiphyGif, "fixed_height_small");
  }
</script>

<div class="giphy-picker">
  <!-- Header -->
  <div class="header">
    <div class="title-row">
      <h3>
        {#if showTrending}
          <TrendingUp class="icon" />
        {:else}
          <Search class="icon" />
        {/if}
        {showTrending ? "GIFs Trending" : "Buscar GIFs"}
      </h3>
      <div class="header-actions">
        {#if userCountry && userLanguage}
          <div
            class="location-badge"
            title="Resultados localizados para tu país"
          >
            <Globe size={12} />
            <span>{userLanguage}</span>
          </div>
        {/if}
        {#if onClose}
          <button class="close-btn" onclick={onClose} type="button">✕</button>
        {/if}
      </div>
    </div>

    <!-- Barra de búsqueda -->
    <div class="search-bar">
      <Search class="search-icon" />
      <input
        type="text"
        bind:value={searchTerm}
        oninput={handleSearch}
        placeholder="Buscar GIFs..."
        class="search-input"
      />
      {#if searchTerm}
        <button
          class="clear-btn"
          onclick={() => {
            searchTerm = "";
            loadTrending();
          }}
          type="button"
        >
          ✕
        </button>
      {/if}
    </div>
  </div>

  <!-- Loading -->
  {#if isLoading}
    <div class="loading">
      <Loader2 class="spinner" />
      <p>Cargando GIFs...</p>
    </div>
  {/if}

  <!-- Grid de GIFs -->
  {#if !isLoading && gifs.length > 0}
    <div class="gifs-grid">
      {#each gifs as gif (gif.id)}
        <button
          class="gif-item"
          onclick={() => selectGif(gif)}
          type="button"
          title={gif.title}
        >
          <img src={getPreviewUrl(gif)} alt={gif.title} loading="lazy" />
          <div class="gif-overlay">
            <span class="gif-title">{gif.title}</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}

  <!-- Empty state -->
  {#if !isLoading && gifs.length === 0 && !showTrending}
    <div class="empty-state">
      <p>No se encontraron GIFs para "{searchTerm}"</p>
      <button class="trending-btn" onclick={loadTrending} type="button">
        <TrendingUp class="icon" />
        Ver Trending
      </button>
    </div>
  {/if}

  <!-- Footer -->
  <div class="footer">
    <span class="powered-by">
      Powered by <strong>GIPHY</strong> + <strong>TENOR</strong>
    </span>
  </div>
</div>

<style>
  .giphy-picker {
    display: flex;
    flex-direction: column;
    background: rgba(20, 20, 22, 0.98);
    border-radius: 16px;
    overflow: hidden;
    height: 100%;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .header {
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.4);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: white;
    display: flex;
    align-items: center;
    gap: 6px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global(.icon) {
    width: 16px;
    height: 16px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .location-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 10px;
    font-weight: 600;
    transition: all 0.2s;
  }

  .location-badge:hover {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.9);
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 6px;
    width: 24px;
    height: 24px;
    cursor: pointer;
    color: white;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }

  .search-bar {
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: 10px;
    width: 14px;
    height: 14px;
    color: rgba(255, 255, 255, 0.5);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 8px 32px 8px 32px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: white;
    font-size: 13px;
    outline: none;
    transition: all 0.2s;
  }

  .search-input:focus {
    background: rgba(255, 255, 255, 0.12);
    border-color: var(--option-color);
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .clear-btn {
    position: absolute;
    right: 6px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    width: 20px;
    height: 20px;
    cursor: pointer;
    color: white;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .clear-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: rgba(255, 255, 255, 0.6);
    flex: 1;
  }

  :global(.spinner) {
    width: 32px;
    height: 32px;
    animation: spin 1s linear infinite;
    margin-bottom: 8px;
    color: var(--option-color);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .gifs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 6px;
    padding: 8px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .gif-item {
    position: relative;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: 8px;
    overflow: hidden;
    background: #000000;
    transition: all 0.2s;
    min-height: 80px;
  }

  .gif-item:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 12px var(--option-color-shadow);
    z-index: 1;
  }

  .gif-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .gif-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent);
    padding: 12px 6px 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .gif-item:hover .gif-overlay {
    opacity: 1;
  }

  .gif-title {
    font-size: 9px;
    color: white;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-clamp: 2;
    overflow: hidden;
    line-height: 1.2;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: rgba(255, 255, 255, 0.6);
    flex: 1;
  }

  .empty-state p {
    margin: 0 0 12px;
    font-size: 13px;
  }

  .trending-btn {
    background: var(--option-color-light);
    border: 1px solid var(--option-color);
    border-radius: 6px;
    padding: 8px 16px;
    color: var(--option-color);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
  }

  .trending-btn:hover {
    background: var(--option-color-medium);
    transform: translateY(-1px);
  }

  .footer {
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.6);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    text-align: center;
    flex-shrink: 0;
  }

  .powered-by {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    letter-spacing: 0.05em;
  }

  .powered-by strong {
    color: var(--option-color);
    font-weight: 700;
  }

  /* Scrollbar personalizado */
  .gifs-grid::-webkit-scrollbar {
    width: 6px;
  }

  .gifs-grid::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }

  .gifs-grid::-webkit-scrollbar-thumb {
    background: var(--option-color-medium);
    border-radius: 3px;
  }

  .gifs-grid::-webkit-scrollbar-thumb:hover {
    background: var(--option-color);
  }

  /* Variables CSS para el color de la opción */
  .giphy-picker {
    --option-color: v-bind(optionColor);
    --option-color-light: color-mix(
      in srgb,
      v-bind(optionColor) 15%,
      transparent
    );
    --option-color-medium: color-mix(
      in srgb,
      v-bind(optionColor) 35%,
      transparent
    );
    --option-color-shadow: color-mix(
      in srgb,
      v-bind(optionColor) 40%,
      transparent
    );
  }
</style>
