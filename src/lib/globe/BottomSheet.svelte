<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  export let state: 'hidden' | 'peek' | 'collapsed' | 'expanded' = 'hidden';
  export let y = 0; // translateY px
  export let selectedCountryName: string | null = null;
  export let countryChartSegments: Array<{ key: string; pct: number; color: string }> = [];
  export let onPointerDown: (e: PointerEvent | TouchEvent) => void = () => {};
  export let onScroll: (e: Event) => void = () => {};

  const dispatch = createEventDispatcher();
</script>

<div
  class="bottom-sheet {state === 'expanded' ? 'solid' : 'glass'}"
  role="dialog"
  aria-modal="true"
  aria-hidden={state === 'hidden'}
  style={`transform: translateY(${y}px);`}
>
  <div
    class="sheet-header"
    on:pointerdown={onPointerDown}
    on:touchstart|preventDefault={onPointerDown}
  >
    <div class="sheet-grabber"></div>
    <div class="sheet-title">{selectedCountryName ?? 'Selecciona un país'}</div>
    <button
      class="sheet-close"
      type="button"
      aria-label="Cerrar"
      on:pointerdown|stopPropagation
      on:touchstart|stopPropagation
      on:touchend|stopPropagation={() => { dispatch('close'); }}
      on:click|stopPropagation={() => { dispatch('close'); }}
      on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          dispatch('close');
        }
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
  <div class="sheet-content" on:scroll={onScroll}>
    {#if state === 'expanded'}
      <!-- Contenido de feed podría ir aquí como slot en el futuro -->
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
      <div style="opacity:.75; font-size:13px;">Pulsa un país para ver detalles aquí.</div>
    {/if}
  </div>
</div>
