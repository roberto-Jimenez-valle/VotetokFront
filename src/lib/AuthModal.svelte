<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { X } from "lucide-svelte";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  interface Props {
    isOpen?: boolean;
  }

  let { isOpen = $bindable(false) }: Props = $props();

  // DEBUG: Monitorear cuando el modal se abre/cierra
  $effect(() => {
    console.log("[AuthModal] isOpen cambió a:", isOpen);
  });

  function close() {
    console.log("[AuthModal] Cerrando modal");
    isOpen = false;
  }

  function handleGoogleLogin() {
    console.log("[AuthModal] 🔵 CLICK DETECTADO - Iniciando login con Google");
    console.log("[AuthModal] 🌐 window.location actual:", window.location.href);
    console.log("[AuthModal] 🎯 Redirigiendo a:", "/api/auth/google");

    try {
      // Redirigir al endpoint de Google OAuth
      window.location.href = "/api/auth/google";
      console.log("[AuthModal] ✅ Redirección ejecutada");
    } catch (error) {
      console.error("[AuthModal] ❌ Error al redirigir:", error);
    }
  }
</script>

{#if isOpen}
  <!-- Backdrop -->
  <div
    class="auth-modal-backdrop"
    onclick={close}
    transition:fade={{ duration: 200 }}
    role="presentation"
  ></div>

  <!-- Bottom Sheet Modal -->
  <div
    class="auth-modal-sheet"
    transition:fly={{ y: 400, duration: 300 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="auth-modal-title"
  >
    <!-- Handle bar (indicador de arrastre) -->
    <div class="handle-bar"></div>

    <!-- Header -->
    <div class="auth-modal-header">
      <h2 id="auth-modal-title">Iniciar sesión</h2>
      <button class="close-btn" onclick={close} aria-label="Cerrar">
        <X size={24} />
      </button>
    </div>

    <!-- Content -->
    <div class="auth-modal-content">
      <p class="auth-description">
        Inicia sesión para votar, crear encuestas y participar en la comunidad.
      </p>

      <!-- Botón de Google -->
      <button
        class="auth-btn google-btn"
        type="button"
        onclick={handleGoogleLogin}
      >
        <svg
          class="auth-icon"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continuar con Google
      </button>

      <!-- Política de privacidad -->
      <p class="privacy-text">
        Al continuar, aceptas nuestros <a href="/terms">Términos de servicio</a>
        y <a href="/privacy">Política de privacidad</a>
      </p>
    </div>
  </div>
{/if}

<style>
  .auth-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 100000;
    backdrop-filter: blur(4px);
  }

  .auth-modal-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%);
    border-radius: 24px 24px 0 0;
    padding: 24px;
    max-height: 85vh;
    overflow-y: auto;
    z-index: 100001;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
  }

  :global(html.dark) .auth-modal-sheet {
    background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  }

  .handle-bar {
    width: 40px;
    height: 4px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 2px;
    margin: 0 auto 20px;
  }

  :global(html.dark) .handle-bar {
    background: rgba(255, 255, 255, 0.3);
  }

  .auth-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .auth-modal-header h2 {
    font-size: 24px;
    font-weight: 700;
    color: #1a1a2e;
    margin: 0;
  }

  :global(html.dark) .auth-modal-header h2 {
    color: #ffffff;
  }

  .close-btn {
    background: rgba(0, 0, 0, 0.05);
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #666;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: rgba(0, 0, 0, 0.1);
    transform: scale(1.05);
  }

  :global(html.dark) .close-btn {
    background: rgba(255, 255, 255, 0.1);
    color: #ccc;
  }

  :global(html.dark) .close-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .auth-modal-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .auth-description {
    font-size: 16px;
    color: #666;
    text-align: center;
    margin: 0;
    line-height: 1.5;
  }

  :global(html.dark) .auth-description {
    color: #aaa;
  }

  .auth-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px 24px;
    border: 2px solid transparent;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    width: 100%;
  }

  .google-btn {
    background: white;
    color: #333;
    border-color: #e0e0e0;
  }

  .google-btn:hover {
    background: #f8f8f8;
    border-color: #d0d0d0;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  :global(html.dark) .google-btn {
    background: #2a2a3e;
    color: #ffffff;
    border-color: #3a3a4e;
  }

  :global(html.dark) .google-btn:hover {
    background: #3a3a4e;
    border-color: #4a4a5e;
  }

  .auth-icon {
    width: 24px;
    height: 24px;
  }

  .privacy-text {
    font-size: 12px;
    color: #999;
    text-align: center;
    margin: 8px 0 0;
    line-height: 1.5;
  }

  .privacy-text a {
    color: #8b5cf6;
    text-decoration: none;
  }

  .privacy-text a:hover {
    text-decoration: underline;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .auth-modal-sheet {
      padding: 20px 16px;
      max-height: 90vh;
    }

    .auth-modal-header h2 {
      font-size: 20px;
    }

    .auth-description {
      font-size: 14px;
    }

    .auth-btn {
      padding: 14px 20px;
      font-size: 15px;
    }
  }
</style>
