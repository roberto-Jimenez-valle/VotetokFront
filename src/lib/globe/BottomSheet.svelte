<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  export let state: 'hidden' | 'peek' | 'collapsed' | 'expanded' = 'hidden';
  export let y = 0; // translateY px
  export let selectedCountryName: string | null = null;
  export let selectedSubdivisionName: string | null = null;
  export let selectedCityName: string | null = null;
  export let countryChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let worldChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let cityChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let onPointerDown: (e: PointerEvent | TouchEvent) => void = () => {};
  export let onScroll: (e: Event) => void = () => {};
  export let navigationManager: any = null; // Used by parent component
  export let onNavigateToView: (level: 'world' | 'country' | 'subdivision' | 'city') => void = () => {};

  const dispatch = createEventDispatcher();
  
  // Debug: log when world chart segments change
  $: if (worldChartSegments) {
    console.log('[BottomSheet] World chart segments:', worldChartSegments);
  }

  // Auto-scroll to active button when navigation changes
  let navContainer: HTMLElement;
  
  $: if (selectedCountryName || selectedSubdivisionName || selectedCityName) {
    // Wait for DOM update then scroll to active button
    setTimeout(() => {
      if (navContainer) {
        const activeButton = navContainer.querySelector('.nav-chip.active');
        if (activeButton) {
          activeButton.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest', 
            inline: 'center' 
          });
        }
      }
    }, 100);
  }
</script>

<div
  class="bottom-sheet {state === 'expanded' ? 'solid' : 'glass'}"
  role="dialog"
  aria-modal="true"
  aria-hidden={state === 'hidden'}
  style={`transform: translateY(${y}px);`}
>
  <!-- Header simplificado solo para arrastrar -->
  <div
    class="sheet-drag-area"
    on:pointerdown={onPointerDown}
    on:touchstart|preventDefault={onPointerDown}
  >
    <div class="sheet-grabber"></div>
  </div>
  
  <!-- Navegación minimalista -->
  <div class="nav-minimal" bind:this={navContainer}>
    <button
      class="nav-chip {!selectedCountryName ? 'active' : ''}"
      on:click={() => onNavigateToView('world')}
    >
      Global
    </button>
    
    {#if selectedCountryName}
      <div class="nav-divider">/</div>
      <button
        class="nav-chip {selectedCountryName && !selectedSubdivisionName ? 'active' : ''}"
        on:click={() => onNavigateToView('country')}
      >
        {selectedCountryName}
      </button>
    {/if}
    
    {#if selectedSubdivisionName}
      <div class="nav-divider">/</div>
      <button
        class="nav-chip {selectedSubdivisionName && !selectedCityName ? 'active' : ''}"
        on:click={() => onNavigateToView('subdivision')}
      >
        {selectedSubdivisionName}
      </button>
    {/if}
    
    {#if selectedCityName}
      <div class="nav-divider">/</div>
      <button
        class="nav-chip {selectedCityName ? 'active' : ''}"
        on:click={() => onNavigateToView('city')}
      >
        {selectedCityName}
      </button>
    {/if}
  </div>
  
  <div class="sheet-content" on:scroll={onScroll}>
    {#if state === 'expanded'}
      <!-- Contenido de feed podría ir aquí como slot en el futuro -->
    {:else if selectedCityName}
      <!-- Mostrar gráfico de ciudad específica -->
      {#if cityChartSegments.length}
        <div
          class="country-chart"
          role="img"
          aria-label={`Distribución por categorías en ${selectedCityName}`}
          title={`Top categorías en ${selectedCityName}`}
        >
          {#each cityChartSegments as seg}
            <div
              class="seg"
              style={`width:${seg.pct}%; background:${seg.color}`}
              title={`${seg.key}: ${seg.pct.toFixed(1)}%`}
            ></div>
          {/each}
        </div>
        <div class="country-chart-pcts">
          {#each cityChartSegments as seg}
            <div class="pct-item" title={`${seg.key}: ${seg.pct.toFixed(1)}%`}>
              <span class="sw" style={`background:${seg.color}`}></span>
              <span class="pct">{seg.pct.toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      {:else}
        <div style="opacity:.75; font-size:13px;">Sin datos específicos para {selectedCityName}.</div>
      {/if}
    {:else if selectedCountryName}
      {#if countryChartSegments.length}
        <div
          class="country-chart"
          role="img"
          aria-label={`Distribución por categorías en ${selectedCountryName}`}
          title={`Top categorías en ${selectedCountryName}`}
        >
          {#each countryChartSegments as seg}
            <div
              class="seg"
              style={`width:${seg.pct}%; background:${seg.color}`}
              title={`${seg.key}: ${seg.pct.toFixed(1)}%`}
            ></div>
          {/each}
        </div>
        <div class="country-chart-pcts">
          {#each countryChartSegments as seg}
            <div class="pct-item" title={`${seg.key}: ${seg.pct.toFixed(1)}%`}>
              <span class="sw" style={`background:${seg.color}`}></span>
              <span class="pct">{seg.pct.toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      {:else}
        <div style="opacity:.75; font-size:13px;">Sin datos de categorías para este país.</div>
      {/if}
    {:else}
      <!-- Mostrar información mundial cuando no hay país seleccionado -->
      {#if worldChartSegments.length}
        <div
          class="country-chart"
          role="img"
          aria-label="Distribución global por categorías"
          title="Top categorías a nivel mundial"
        >
          {#each worldChartSegments as seg}
            <div
              class="seg"
              style={`width:${seg.pct}%; background:${seg.color}`}
              title={`${seg.key}: ${seg.pct.toFixed(1)}%`}
            ></div>
          {/each}
        </div>
        <div class="country-chart-pcts">
          {#each worldChartSegments as seg}
            <div class="pct-item" title={`${seg.key}: ${seg.pct.toFixed(1)}%`}>
              <span class="sw" style={`background:${seg.color}`}></span>
              <span class="pct">{seg.pct.toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      {:else}
        <div style="opacity:.75; font-size:13px;">Vista global - Explora el mundo haciendo clic en los países.</div>
      {/if}
    {/if}
  </div>
</div>
