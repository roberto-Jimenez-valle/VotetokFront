<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Snippet } from 'svelte';
  
  let { children }: { children: Snippet } = $props();
  
  let portalTarget: HTMLDivElement | null = $state(null);
  let contentRef: HTMLDivElement | null = $state(null);
  let mounted = $state(false);
  
  // Action para teleportar el contenido
  function teleport(node: HTMLElement) {
    if (portalTarget) {
      portalTarget.appendChild(node);
      node.style.pointerEvents = 'auto';
    }
    
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }
  
  onMount(() => {
    // Crear el portal target en el body
    portalTarget = document.createElement('div');
    portalTarget.className = 'svelte-portal';
    portalTarget.style.cssText = 'position: fixed; inset: 0; z-index: 999999; pointer-events: none;';
    document.body.appendChild(portalTarget);
    mounted = true;
  });
  
  onDestroy(() => {
    if (portalTarget && portalTarget.parentNode) {
      portalTarget.parentNode.removeChild(portalTarget);
    }
  });
</script>

{#if mounted && portalTarget}
  <div use:teleport>
    {@render children()}
  </div>
{/if}
