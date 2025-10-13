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
    console.log('[TopTabs] 🔘 Tab seleccionado:', tab);
    console.log('[TopTabs] 🔘 Tab anterior:', active);
    active = tab;
    console.log('[TopTabs] 📤 Disparando evento change con:', tab);
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
    position: fixed;
    top: 50px;
    right: 10px;
    min-width: 160px;
    max-width: 200px;
    border: 1px solid rgba(255,255,255,0.2);
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.95) 0%,
      rgba(0, 0, 0, 0.98) 100%
    );
    backdrop-filter: blur(20px) saturate(120%);
    -webkit-backdrop-filter: blur(20px) saturate(120%);
    border-radius: 14px;
    padding: 8px;
    display: grid;
    gap: 4px;
    z-index: 999999;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    isolation: isolate;
  }
  .menu button {
    text-align: left;
    padding: 12px 16px;
    border-radius: 10px;
    color: #e5e7eb;
    background: transparent;
    border: none;
    cursor: pointer;
    font: 14px/1.2 system-ui, sans-serif;
    transition: all 0.2s ease;
    white-space: nowrap;
  }
  .menu button[aria-checked="true"] {
    font-weight: 600;
    background: rgba(255,255,255,0.15);
    color: #ffffff;
  }
  .menu button:hover { 
    background: rgba(255,255,255,0.2);
    transform: translateX(-2px);
  }
  .menu button:active {
    transform: scale(0.98);
  }
</style>

<div class="tabs-dd" bind:this={rootEl}>
  <button class="tabs-trigger" on:click={toggle} aria-haspopup="menu" aria-expanded={open}>
    <span>{active}</span>
    <svg class="caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </button>
</div>

<!-- Menú renderizado fuera del contenedor para evitar problemas de z-index -->
{#if open}
  <div role="menu" class="menu">
    {#each options as opt}
      <button role="menuitemradio" aria-checked={active === opt} on:click={() => select(opt)}>{opt}</button>
    {/each}
  </div>
{/if}
