<script lang="ts">
  import { hexToRgba, clamp } from '../utils/colors';
  export let panelTop = 52;
  export let mode: 'intensity' | 'trend' = 'intensity';
  export let currentDataset: 'world' | 'world3' = 'world';
  export let capColor = '#ff0000';
  export let capOpacityPct = 100;
  export let sphereColor = '#441220';
  export let sphereOpacityPct = 100;
  export let strokeColor = '#961A50';
  export let strokeOpacityPct = 75;
  export let bgColor = '#111827';
  export let capBaseColor = capColor;
  export let sphereBaseColor = sphereColor;
  export let legendItems: Array<{ key: string; color: string; count: number }> = [];
</script>

<div class="settings-panel" role="dialog" aria-label="Ajustes de colores" style={`top:${panelTop}px; left:10px;`}>
  <div class="panel-row">
    <label for="mode">Modo:</label>
    <select id="mode" bind:value={mode}>
      <option value="intensity">Intensidad</option>
      <option value="trend">Tendencia</option>
    </select>
    <span class="val" style="grid-column: span 2; text-align:left; opacity:.8">
      {mode === 'trend' ? 'Colorea por categoría dominante' : 'Un color, opacidad por volumen'}
    </span>
  </div>
  <div class="panel-row">
    <label for="dataset">Dataset:</label>
    <select id="dataset" bind:value={currentDataset}>
      <option value="world">World</option>
      <option value="world3">World3</option>
    </select>
    <span class="val" style="grid-column: span 2; text-align:left; opacity:.8">{currentDataset.toUpperCase()}</span>
  </div>

  {#if mode === 'trend'}
    <div class="legend-inline">
      <div class="legend-title">Tendencia (categoría dominante)</div>
      {#each legendItems as item}
        <div class="legend-item">
          <span class="legend-color" style={`background:${item.color}`}></span>
          <span class="legend-key">{item.key}</span>
          <span class="legend-count">{item.count}</span>
        </div>
      {/each}
    </div>
  {:else}
    <div class="legend-inline">
      <div class="legend-title">Intensidad (volumen relativo)</div>
      <div class="legend-grad-row">
        <span class="legend-mark">-</span>
        <div
          class="legend-gradient"
          style={`background: linear-gradient(to right, ${hexToRgba(capBaseColor, 0.25)}, ${hexToRgba(capBaseColor, 1)}), linear-gradient(${hexToRgba(sphereBaseColor, clamp(sphereOpacityPct / 100, 0, 1))}, ${hexToRgba(sphereBaseColor, clamp(sphereOpacityPct / 100, 0, 1))})`}
        ></div>
        <span class="legend-mark">+</span>
      </div>
      <div style="opacity:.8; font-size:12px; margin-top:4px;">
        Un color base para todos los países; la opacidad indica el volumen relativo (- bajo, + alto).
      </div>
    </div>
  {/if}
  <div class="panel-row">
    <label for="capColor">Color países:</label>
    <input id="capColor" type="color" bind:value={capColor} />
    <label for="capOpacity">Opacidad</label>
    <input id="capOpacity" type="range" min="0" max="100" bind:value={capOpacityPct} />
  </div>
  <div class="panel-row">
    <label for="sphereColor">Color esfera:</label>
    <input id="sphereColor" type="color" bind:value={sphereColor} />
    <label for="sphereOpacity">Opacidad</label>
    <input id="sphereOpacity" type="range" min="0" max="100" bind:value={sphereOpacityPct} />
  </div>
  <div class="panel-row">
    <label for="strokeColor">Color borde:</label>
    <input id="strokeColor" type="color" bind:value={strokeColor} />
    <label for="strokeOpacity">Opacidad</label>
    <input id="strokeOpacity" type="range" min="0" max="100" bind:value={strokeOpacityPct} />
  </div>
  <div class="panel-row">
    <label for="bgColor">Color fondo:</label>
    <input id="bgColor" type="color" bind:value={bgColor} />
    <span class="val" style="grid-column: span 2; text-align:left; opacity:.8">{bgColor}</span>
  </div>
</div>
