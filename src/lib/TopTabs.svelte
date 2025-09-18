<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';

  export let active: 'Para ti' | 'Tendencias' | 'Amigos' | 'Live' = 'Para ti';
  export let options: Array<'Para ti' | 'Tendencias' | 'Amigos' | 'Live'> = ['Para ti','Tendencias','Amigos','Live'];
  const dispatch = createEventDispatcher<{ change: string; symbolChange: '#' | '@' }>();
  let open = false;
  let rootEl: HTMLDivElement | null = null;
  // Estado del toggle minimal "# / @"
  export let symbolMode: '#' | '@' = '#';

  function toggle() { open = !open; }
  function select(tab: typeof options[number]) {
    active = tab;
    dispatch('change', tab);
    open = false;
  }
  function toggleSymbol() {
    symbolMode = symbolMode === '#' ? '@' : '#';
    dispatch('symbolChange', symbolMode);
  }

  function onWindowClick(e: MouseEvent) {
    if (!rootEl) return;
    if (!(e.target instanceof Node)) return;
    if (!rootEl.contains(e.target)) open = false;
  }
  onMount(() => {
    window.addEventListener('click', onWindowClick, { passive: true } as any);
    return () => window.removeEventListener('click', onWindowClick as any);
  });
</script>

<style>
  .tabs-dd {
    position: relative;
  }
  .tabs-trigger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    height: 36px;
    border-radius: 0;
    border: none;
    background: transparent;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    color: #e5e7eb;
    cursor: pointer;
    font: 700 13px/1 system-ui, sans-serif;
  }
  .tabs-trigger:hover { opacity: .9; }
  .caret { opacity: .8; }
  .menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    min-width: 180px;
    border: 1px solid rgba(255,255,255,0.16);
    background: rgba(0,0,0,0.78);
    border-radius: 12px;
    padding: 6px;
    display: grid;
    gap: 4px;
    z-index: 1201;
  }
  .menu button {
    text-align: left;
    padding: 10px 12px;
    border-radius: 8px;
    color: #e5e7eb;
    background: transparent;
    border: none;
    cursor: pointer;
    font: 13px/1 system-ui, sans-serif;
  }
  .menu button[aria-checked="true"] {
    font-weight: 600;
    background: rgba(255,255,255,0.12);
  }
  .menu button:hover { background: rgba(255,255,255,0.16); }
  /* Toggle pill profesional */
  .symbol-toggle {
    position: relative;
    display: inline-grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    gap: 0;
    margin-left: 10px;
    padding: 2px;
    width: 66px;
    height: 26px;
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 999px;
    background: rgba(255,255,255,0.06);
    color: #e5e7eb;
    cursor: pointer;
    user-select: none;
  }
  .symbol-toggle .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    /* Mitad del ancho interior (padding 2px a cada lado) */
    width: calc(50% - 2px);
    height: calc(100% - 4px);
    background: rgba(255,255,255,0.9);
    border-radius: 999px;
    transition: left 140ms ease, right 140ms ease;
  }
  .symbol-toggle[data-mode='@'] .knob { left: auto; right: 2px; }
  .symbol-toggle .opt {
    text-align: center;
    z-index: 1;
    font: 700 12px/1 system-ui, sans-serif;
    opacity: .9;
  }
  .symbol-toggle[data-mode='#'] .opt.hash { color: #111827; }
  .symbol-toggle[data-mode='@'] .opt.at { color: #111827; }

</style>

<div class="tabs-dd" bind:this={rootEl}>
  <button class="tabs-trigger" on:click={toggle} aria-haspopup="menu" aria-expanded={open}>
    <span>{active}</span>
    <svg class="caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </button>
  {#if active === 'Para ti' || active === 'Tendencias'}
    <div
      class="symbol-toggle"
      role="button"
      tabindex="0"
      aria-label="Alternar entre hashtags y cuentas"
      aria-pressed={symbolMode === '@'}
      data-mode={symbolMode}
      on:click={toggleSymbol}
      on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSymbol(); } }}
      title={symbolMode === '#' ? 'Mostrando hashtags (#). Click para ver cuentas (@)' : 'Mostrando cuentas (@). Click para ver hashtags (#)'}
    >
      <div class="knob" aria-hidden="true"></div>
      <div class="opt hash">#</div>
      <div class="opt at">@</div>
    </div>
  {/if}
  {#if open}
    <div role="menu" class="menu">
      {#each options as opt}
        <button role="menuitemradio" aria-checked={active === opt} on:click={() => select(opt)}>{opt}</button>
      {/each}
    </div>
  {/if}
  
</div>
