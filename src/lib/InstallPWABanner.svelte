<script lang="ts">
  import { onMount } from 'svelte';
  import { X, Download } from 'lucide-svelte';

  let showBanner = $state(false);
  let deferredPrompt: any = null;
  let isIOS = $state(false);
  let isStandalone = $state(false);

  onMount(() => {
    // Detectar si ya está instalada
    isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                   (window.navigator as any).standalone === true;

    // Detectar iOS
    isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    // Verificar si el usuario ya rechazó el banner
    const dismissed = localStorage.getItem('voutop-install-banner-dismissed');
    
    if (!isStandalone && !dismissed) {
      // En iOS mostrar banner después de 3 segundos (no hay beforeinstallprompt)
      if (isIOS) {
        setTimeout(() => {
          showBanner = true;
        }, 3000);
      } else {
        // En otros navegadores, esperar el evento beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
          e.preventDefault();
          deferredPrompt = e;
          showBanner = true;
        });
      }
    }
  });

  async function handleInstall() {
    if (isIOS) {
      // En iOS no hay API programática, solo mostrar instrucciones
      return;
    }

    if (!deferredPrompt) {
      return;
    }

    // Mostrar el prompt de instalación
    deferredPrompt.prompt();

    // Esperar la respuesta del usuario
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[InstallPWA] User response: ${outcome}`);

    if (outcome === 'accepted') {
      showBanner = false;
    }

    deferredPrompt = null;
  }

  function dismissBanner() {
    showBanner = false;
    // Guardar que el usuario rechazó el banner (expires en 7 días)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);
    localStorage.setItem('voutop-install-banner-dismissed', expiryDate.toISOString());
  }
</script>

{#if showBanner}
  <div class="install-banner">
    <div class="install-content">
      <div class="install-icon">
        <Download size={24} />
      </div>
      <div class="install-text">
        <h3>Instala Voutop</h3>
        {#if isIOS}
          <p>Toca <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display: inline; vertical-align: text-bottom;"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> y luego "Añadir a pantalla de inicio"</p>
        {:else}
          <p>Acceso rápido desde tu pantalla de inicio</p>
        {/if}
      </div>
      {#if !isIOS}
        <button class="install-btn" onclick={handleInstall}>
          Instalar
        </button>
      {/if}
      <button class="close-btn" onclick={dismissBanner} aria-label="Cerrar">
        <X size={18} />
      </button>
    </div>
  </div>
{/if}

<style>
  .install-banner {
    position: fixed;
    bottom: calc(72px + env(safe-area-inset-bottom));
    left: 0;
    right: 0;
    max-width: 700px;
    margin: 0 auto;
    padding: 0 12px;
    z-index: 29999;
    animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .install-content {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .install-icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .install-text {
    flex: 1;
    min-width: 0;
  }

  .install-text h3 {
    color: white;
    font-size: 15px;
    font-weight: 700;
    margin: 0 0 2px 0;
    letter-spacing: 0.3px;
  }

  .install-text p {
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    margin: 0;
    line-height: 1.3;
  }

  .install-btn {
    flex-shrink: 0;
    padding: 8px 20px;
    background: white;
    color: #667eea;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .install-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .install-btn:active {
    transform: scale(0.98);
  }

  .close-btn {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.15);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: scale(1.1);
  }

  @media (max-width: 640px) {
    .install-banner {
      bottom: calc(64px + env(safe-area-inset-bottom));
      padding: 0 8px;
    }

    .install-content {
      padding: 12px 14px;
      gap: 10px;
    }

    .install-icon {
      width: 36px;
      height: 36px;
    }

    .install-text h3 {
      font-size: 14px;
    }

    .install-text p {
      font-size: 12px;
    }

    .install-btn {
      padding: 7px 16px;
      font-size: 13px;
    }
  }
</style>
