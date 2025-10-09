<script lang="ts">
  import { onMount } from 'svelte';
  
  let isDark = $state(true);
  
  onMount(() => {
    // Detectar tema actual
    isDark = document.documentElement.classList.contains('dark');
  });
  
  function toggleTheme() {
    isDark = !isDark;
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
</script>

<button 
  class="theme-toggle" 
  onclick={toggleTheme}
  aria-label="Toggle theme"
  title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
>
  <div class="toggle-track">
    <div class="toggle-thumb" class:dark={isDark}>
      {#if isDark}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      {:else}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      {/if}
    </div>
  </div>
</button>

<style>
  .theme-toggle {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 99999;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  
  .toggle-track {
    width: 56px;
    height: 28px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    position: relative;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .theme-toggle:hover .toggle-track {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  .toggle-thumb {
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    position: absolute;
    top: 2px;
    left: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  .toggle-thumb.dark {
    transform: translateX(28px);
    background: linear-gradient(135deg, #1f6feb 0%, #1a56db 100%);
  }
  
  .toggle-thumb svg {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }
  
  /* Animación de entrada */
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .theme-toggle {
    animation: slideIn 0.4s ease-out;
  }
</style>
