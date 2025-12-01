<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';

  export let active: 'Para ti' | 'Tendencias' | 'Amigos' | 'Live' = 'Para ti';
  export let options: Array<'Para ti' | 'Tendencias' | 'Amigos' | 'Live'> = ['Para ti','Tendencias','Amigos','Live'];
  // Label personalizado para mostrar en el trigger (ej: "Encuesta" cuando hay poll activa)
  export let customActiveLabel: string | null = null;
  const dispatch = createEventDispatcher<{ change: string; symbolChange: '#' | '@' }>();
  let open = false;
  let rootEl: HTMLDivElement | null = null;
  // Estado del toggle minimal "# / @"
  export let symbolMode: '#' | '@' = '#';

  function toggle() { 
    open = !open;
    // Notificar a otros dropdowns que se cierre
    if (open) {
      window.dispatchEvent(new CustomEvent('closeOtherDropdowns', { detail: 'topTabs' }));
    }
  }
  
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
    // Verificar si el clic fue en el menú flotante
    const menu = document.querySelector('.menu');
    if (menu && menu.contains(e.target)) return;
    if (!rootEl.contains(e.target)) open = false;
  }
  
  function onCloseOtherDropdowns(e: CustomEvent) {
    if (e.detail !== 'topTabs') {
      open = false;
    }
  }
  
  onMount(() => {
    window.addEventListener('click', onWindowClick, { passive: true } as any);
    window.addEventListener('closeOtherDropdowns', onCloseOtherDropdowns as any);
    return () => {
      window.removeEventListener('click', onWindowClick as any);
      window.removeEventListener('closeOtherDropdowns', onCloseOtherDropdowns as any);
    };
  });
</script>

<style>
  .tabs-dd {
    position: relative;
  }
  .tabs-trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    height: 36px;
    border-radius: 0;
    border: none;
    background: transparent;
    color: var(--neo-text, #e5e7eb);
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    transition: all 0.2s ease;
  }
  .tabs-trigger:hover { 
    opacity: 0.8;
  }
  .tabs-trigger.has-custom-label {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
    border-radius: 8px;
    padding: 8px 12px;
  }
  .tabs-trigger.has-custom-label span {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .caret { 
    color: var(--neo-text-light, #9ca3af);
    opacity: 0.8;
  }
  .menu {
    position: fixed;
    top: 50px;
    right: 10px;
    min-width: 160px;
    max-width: 200px;
    border: none;
    background: var(--neo-bg, #e0e5ec);
    border-radius: 16px;
    padding: 8px;
    display: grid;
    gap: 4px;
    z-index: 999999;
    isolation: isolate;
    
    /* Neumorfismo elevado */
    box-shadow: 
      6px 6px 18px var(--neo-shadow-dark, rgba(163, 177, 198, 0.6)),
      -6px -6px 18px var(--neo-shadow-light, rgba(255, 255, 255, 0.7));
  }
  .menu button {
    text-align: left;
    padding: 12px 16px;
    border-radius: 10px;
    color: var(--neo-text, #6b7280);
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  .menu button[aria-checked="true"] {
    font-weight: 700;
    box-shadow: 
      inset 2px 2px 5px var(--neo-shadow-dark, rgba(163, 177, 198, 0.5)),
      inset -2px -2px 5px var(--neo-shadow-light, rgba(255, 255, 255, 0.6));
  }
  .menu button:hover { 
    background: var(--neo-bg, #e0e5ec);
    box-shadow: 
      inset 3px 3px 6px var(--neo-shadow-dark, rgba(163, 177, 198, 0.4)),
      inset -3px -3px 6px var(--neo-shadow-light, rgba(255, 255, 255, 0.6));
  }
  .menu button:active {
    box-shadow: 
      inset 4px 4px 8px var(--neo-shadow-dark, rgba(163, 177, 198, 0.5)),
      inset -4px -4px 8px var(--neo-shadow-light, rgba(255, 255, 255, 0.5));
  }
</style>

<div class="tabs-dd" bind:this={rootEl}>
  <button class="tabs-trigger" class:has-custom-label={!!customActiveLabel} on:click={toggle} aria-haspopup="menu" aria-expanded={open}>
    <span>{customActiveLabel || active}</span>
    <svg class="caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </button>
</div>

<!-- Menú renderizado fuera del contenedor para evitar problemas de z-index -->
{#if open}
  <div role="menu" class="menu">
    {#each options as opt}
      <button role="menuitemradio" aria-checked={!customActiveLabel && active === opt} on:click={() => select(opt)}>{opt}</button>
    {/each}
  </div>
{/if}
