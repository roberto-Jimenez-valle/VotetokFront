<script lang="ts">
  import { tick } from 'svelte';
  export let show = false;
  export let query = '';
  let inputEl: HTMLInputElement | null = null;
  async function toggle() {
    show = !show;
    if (show) {
      await tick();
      inputEl?.focus();
      inputEl?.select();
    }
  }
</script>

<button
  class="top-search-btn"
  aria-label="Buscar"
  aria-expanded={show}
  on:click={toggle}
>
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
</button>

<div class="floating-search {show ? 'open' : ''}">
  <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
  <input class="tag-search" type="search" placeholder="Buscar hashtag/categoría" bind:value={query} bind:this={inputEl} />
</div>
