<script lang="ts">
  /**
   * Tarjeta de anuncio patrocinado
   */
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let title: string = 'voutop Premium';
  export let description: string = 'Accede a encuestas exclusivas y análisis detallados';
  export let ctaText: string = 'Probar gratis';
  export let imageUrl: string = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=200&h=200&fit=crop';
  export let isSponsored: boolean = true;
  
  // Event handlers
  function handleClick() {
    dispatch('click');
  }
</script>

<div class="ad-card">
  {#if isSponsored}
    <span class="ad-label">Patrocinado</span>
  {/if}
  <div class="ad-content">
    <div class="ad-image ad-image-real">
      <img src={imageUrl} alt={title} />
    </div>
    <div class="ad-text">
      <h4>{title}</h4>
      <p>{description}</p>
      <button 
        class="ad-cta"
        onclick={handleClick}
        type="button"
      >
        {ctaText}
      </button>
    </div>
  </div>
</div>
