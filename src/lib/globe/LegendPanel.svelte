<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { hexToRgba, clamp } from '../utils/colors';

  export let mode: 'intensity' | 'trend' = 'intensity';
  export let capBaseColor: string = '#ff0000';
  export let sphereBaseColor: string = '#441220';
  export let sphereOpacityPct: number = 100;

  const dispatch = createEventDispatcher();
  let legendBarEl: HTMLDivElement | null = null;

  function onToggle() { dispatch('toggleMode'); }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
  }
  function onOpenSettings() {
    const rect = legendBarEl?.getBoundingClientRect?.();
    dispatch('openSettings', { rect });
  }
</script>

<div class="legend-panel" role="group" aria-label="Controles de modo y ajustes">
  <div
    class="legend-grad-row"
    role="button"
    tabindex="0"
    aria-label={mode === 'intensity' ? 'Barra de intensidad (clic para cambiar a Tendencia)' : 'Barra de tendencia (clic para cambiar a Intensidad)'}
    bind:this={legendBarEl}
    on:click={onToggle}
    on:keydown={onKey}
    title={mode === 'intensity' ? 'Mostrando Intensidad. Click para ver Tendencia' : 'Mostrando Tendencia. Click para ver Intensidad'}
  >
    <span class="legend-mark">-</span>
    <div
      class="legend-gradient"
      style={`background: linear-gradient(to right, ${hexToRgba(capBaseColor, 0.25)}, ${hexToRgba(capBaseColor, 1)}), linear-gradient(${hexToRgba(sphereBaseColor, clamp(sphereOpacityPct / 100, 0, 1))}, ${hexToRgba(sphereBaseColor, clamp(sphereOpacityPct / 100, 0, 1))})`}
    ></div>
    <span class="legend-mark">+</span>
  </div>
  <button
    class="legend-menu-btn"
    type="button"
    aria-label="Abrir ajustes de colores"
    title="Ajustes de colores"
    on:click|stopPropagation={onOpenSettings}
  >
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="2"></circle>
      <circle cx="12" cy="12" r="2"></circle>
      <circle cx="12" cy="19" r="2"></circle>
    </svg>
  </button>
</div>
