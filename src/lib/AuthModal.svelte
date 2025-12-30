<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { X, Loader2, CheckCircle2, AlertTriangle } from "lucide-svelte";
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import { setAuth, currentUser } from "$lib/stores/auth";
  import { browser } from "$app/environment";

  interface AuthEventDetail {
    provider: string;
    user?: any;
    token?: string;
  }

  interface AuthEvents {
    login: AuthEventDetail;
  }

  interface $$Events {
    login: CustomEvent<AuthEventDetail>;
  }

  const dispatch = createEventDispatcher<AuthEvents>();

  interface Props {
    isOpen?: boolean;
  }

  let { isOpen = $bindable(false) }: Props = $props();

  let isLoading = $state(false);
  let authPopup: Window | null = null;

  // Estados para consentimiento legal
  let isOver16Checked = $state(false);
  let termsAccepted = $state(false);
  let privacyAccepted = $state(false);
  let showConsentError = $state(false);

  // Versión de los documentos legales
  const LEGAL_VERSION = "1.0.0";

  // Verificar si puede proceder con login
  function canProceed(): boolean {
    return isOver16Checked && termsAccepted && privacyAccepted;
  }

  // Guardar consentimiento localmente antes del login
  function saveConsentLocally() {
    if (!browser) return;

    localStorage.setItem(
      "voutop-pending-consent",
      JSON.stringify({
        isOver16: true,
        termsAccepted: true,
        termsVersion: LEGAL_VERSION,
        privacyAccepted: true,
        privacyVersion: LEGAL_VERSION,
        timestamp: Date.now(),
      }),
    );
  }

  // Escuchar mensajes del popup
  function handleMessage(event: MessageEvent) {
    // Verificar origen por seguridad
    if (event.origin !== window.location.origin) return;

    const { type, token, user, error, message } = event.data;

    if (type === "OAUTH_SUCCESS") {
      console.log("[AuthModal] ✅ Login exitoso via popup:", user?.username);

      // Guardar auth en localStorage y store
      setAuth(token, user);

      // Enviar consentimiento al servidor ahora que tenemos token
      sendConsentToServer(token);

      isLoading = false;
      isOpen = false;

      // Limpiar consentimiento pendiente
      if (browser) {
        localStorage.removeItem("voutop-pending-consent");
      }

      // Notificar al componente padre
      dispatch("login", { provider: "google", user, token });
    }

    if (type === "OAUTH_ERROR") {
      console.error("[AuthModal] ❌ Error en popup:", error, message);
      isLoading = false;
      alert(message || "Error en la autenticación");
    }
  }

  async function sendConsentToServer(token: string) {
    try {
      await fetch("/api/user/consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isOver16: true,
          termsAccepted: true,
          termsVersion: LEGAL_VERSION,
          privacyAccepted: true,
          privacyVersion: LEGAL_VERSION,
        }),
      });
      console.log("[AuthModal] ✅ Consentimiento guardado en servidor");
    } catch (err) {
      console.warn("[AuthModal] ⚠️ Error guardando consentimiento:", err);
    }
  }

  onMount(() => {
    window.addEventListener("message", handleMessage);
  });

  onDestroy(() => {
    if (browser) {
      window.removeEventListener("message", handleMessage);
      if (authPopup && !authPopup.closed) {
        authPopup.close();
      }
    }
  });

  // Auto-cerrar modal si detectamos login exitoso en el store
  $effect(() => {
    if (isOpen && $currentUser) {
      console.log("[AuthModal] User detectado en store, cerrando modal");
      isLoading = false;
      isOpen = false;
    }
  });

  // Reset estado cuando se abre el modal
  $effect(() => {
    if (isOpen) {
      isOver16Checked = false;
      termsAccepted = false;
      privacyAccepted = false;
      showConsentError = false;
    }
  });

  function close() {
    console.log("[AuthModal] Cerrando modal");
    isOpen = false;
    isLoading = false;
    if (authPopup && !authPopup.closed) {
      authPopup.close();
    }
  }

  // Importar Capacitor
  import { Capacitor } from "@capacitor/core";
  import { Browser } from "@capacitor/browser";

  // ... (existing imports/code) ...

  async function handleGoogleLogin() {
    // Verificar consentimiento primero
    if (!canProceed()) {
      showConsentError = true;
      return;
    }

    showConsentError = false;
    console.log("[AuthModal] 🔵 Abriendo popup de Google OAuth");

    isLoading = true;

    // Guardar consentimiento localmente primero
    saveConsentLocally();

    // Calcular posición centrada del popup
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // Abrir popup con el endpoint de auth (que redirigirá al callback)
    const popupUrl = "/api/auth/google?popup=1";

    // Detectar si es App Nativa (Capacitor) o solo móvil web
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      console.log(
        "[AuthModal] 📱 App Nativa detectada, abriendo Browser in-app...",
      );
      const targetUrl = new URL("/api/auth/google", "https://voutop.com");

      // USAR CUSTOM SCHEME para asegurar que vuelve a la app
      targetUrl.searchParams.set("redirect", "voutop://auth-callback");

      // Abrir en Browser nativo (mejor UX que _system)
      try {
        await Browser.open({
          url: targetUrl.toString(),
          windowName: "_self", // Intenta abrir en la misma ventana si es posible
          presentationStyle: "popover", // En iOS se ve mejor como modal
        });
      } catch (err) {
        // Fallback si falla el plugin
        console.error("[AuthModal] Error abriendo Browser plugin:", err);
        window.open(targetUrl.toString(), "_system");
      }
      return;
    }

    // En web (móvil y desktop), usar siempre Popup para evitar recargar la página.
    // Google bloquea iframes, así que popup/nueva pestaña es la única forma de mantener el estado de la app.

    // Detectar si es móvil para ajustar tamaño del popup si fuera necesario (opcional)
    // Pero window.open funciona bien abriendo una nueva pestaña en móviles.

    /* COMENTADO: Redirección antigua (causaba recarga)
    // Detectar si es móvil web (navegador normal en móvil, no app)
    const isMobileWeb =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      ) || window.innerWidth < 768;

    // En móviles web, usar redirección directa
    if (isMobileWeb) {
      console.log("[AuthModal] 📱 Web Móvil detectada, redirigiendo...");
      window.location.href =
        "/api/auth/google?redirect=" +
        encodeURIComponent(window.location.pathname);
      return;
    }
    */

    // Usar popup en TODOS los entornos web (Desktop y Móvil)
    authPopup = window.open(
      popupUrl,
      "GoogleAuth",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`,
    );

    if (!authPopup) {
      console.error(
        "[AuthModal] ❌ No se pudo abrir el popup (¿bloqueador de popups?)",
      );
      isLoading = false;
      alert(
        "No se pudo abrir la ventana de autenticación. Desactiva el bloqueador de popups e intenta de nuevo.",
      );
      return;
    }

    // Monitorear si el popup se cierra sin completar
    const checkClosed = setInterval(() => {
      if (authPopup?.closed) {
        clearInterval(checkClosed);
        if (isLoading) {
          console.log("[AuthModal] Popup cerrado sin completar");
          isLoading = false;
        }
      }
    }, 500);
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

      <!-- Consentimiento legal -->
      <div class="consent-section">
        <p class="consent-title">Para continuar, confirma lo siguiente:</p>

        <!-- Checkbox edad +16 -->
        <label class="consent-checkbox" class:checked={isOver16Checked}>
          <input
            type="checkbox"
            bind:checked={isOver16Checked}
            class="sr-only"
          />
          <div class="checkbox-icon">
            {#if isOver16Checked}
              <CheckCircle2 size={20} />
            {:else}
              <div class="empty-circle"></div>
            {/if}
          </div>
          <span class="checkbox-label">Soy mayor de 16 años</span>
        </label>

        <!-- Checkbox términos -->
        <label class="consent-checkbox" class:checked={termsAccepted}>
          <input type="checkbox" bind:checked={termsAccepted} class="sr-only" />
          <div class="checkbox-icon">
            {#if termsAccepted}
              <CheckCircle2 size={20} />
            {:else}
              <div class="empty-circle"></div>
            {/if}
          </div>
          <span class="checkbox-label">
            Acepto los <a
              href="/legal#terminos"
              target="_blank"
              rel="noopener noreferrer"
              onclick={(e) => e.stopPropagation()}>Términos de Uso</a
            >
          </span>
        </label>

        <!-- Checkbox privacidad -->
        <label class="consent-checkbox" class:checked={privacyAccepted}>
          <input
            type="checkbox"
            bind:checked={privacyAccepted}
            class="sr-only"
          />
          <div class="checkbox-icon">
            {#if privacyAccepted}
              <CheckCircle2 size={20} />
            {:else}
              <div class="empty-circle"></div>
            {/if}
          </div>
          <span class="checkbox-label">
            Acepto la <a
              href="/legal#privacidad"
              target="_blank"
              rel="noopener noreferrer"
              onclick={(e) => e.stopPropagation()}>Política de Privacidad</a
            >
          </span>
        </label>

        {#if showConsentError}
          <div class="consent-error" transition:fly={{ y: -5, duration: 200 }}>
            <AlertTriangle size={16} />
            <span>Debes aceptar todas las condiciones para continuar</span>
          </div>
        {/if}
      </div>

      <!-- Botón de Google -->
      <button
        class="auth-btn google-btn"
        class:disabled={!canProceed()}
        type="button"
        onclick={handleGoogleLogin}
        disabled={isLoading}
      >
        {#if isLoading}
          <Loader2 size={24} class="spinner" />
          Conectando...
        {:else}
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
        {/if}
      </button>

      <!-- Aviso legal inferior -->
      <p class="privacy-text">
        Al continuar, confirmas que cumples los requisitos indicados.
        <a href="/legal" target="_blank" rel="noopener noreferrer"
          >Ver documentos legales</a
        >
      </p>
    </div>
  </div>
{/if}

<style>
  .auth-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 2147483646;
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
    z-index: 2147483647;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
  }

  @media (min-width: 768px) {
    .auth-modal-sheet {
      top: 0;
      left: 0;
      right: auto;
      width: 100%;
      max-width: 700px;
      height: 100vh;
      max-height: 100vh;
      border-radius: 0 1.25rem 0 0;
      background: #000000;
    }

    :global(html.dark) .auth-modal-sheet {
      background: #000000;
    }
  }

  @media (min-width: 1024px) {
    .auth-modal-sheet {
      left: 5rem;
    }
  }

  .auth-modal-sheet::-webkit-scrollbar {
    width: 4px;
  }

  .auth-modal-sheet::-webkit-scrollbar-track {
    background: transparent;
  }

  .auth-modal-sheet::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 2px;
  }

  :global(html.dark) .auth-modal-sheet::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
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

  /* Estilos para consentimiento legal */
  .consent-section {
    background: rgba(0, 0, 0, 0.03);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  :global(html.dark) .consent-section {
    background: rgba(255, 255, 255, 0.05);
  }

  .consent-title {
    font-size: 14px;
    font-weight: 600;
    color: #555;
    margin: 0 0 4px;
  }

  :global(html.dark) .consent-title {
    color: #bbb;
  }

  .consent-checkbox {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
  }

  .consent-checkbox:hover {
    background: rgba(255, 255, 255, 0.8);
  }

  .consent-checkbox.checked {
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(139, 92, 246, 0.3);
  }

  :global(html.dark) .consent-checkbox {
    background: rgba(255, 255, 255, 0.05);
  }

  :global(html.dark) .consent-checkbox:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  :global(html.dark) .consent-checkbox.checked {
    background: rgba(139, 92, 246, 0.15);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  .checkbox-icon {
    flex-shrink: 0;
    color: #8b5cf6;
  }

  .empty-circle {
    width: 20px;
    height: 20px;
    border: 2px solid #ccc;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  :global(html.dark) .empty-circle {
    border-color: #555;
  }

  .checkbox-label {
    font-size: 14px;
    color: #333;
  }

  :global(html.dark) .checkbox-label {
    color: #e0e0e0;
  }

  .checkbox-label a {
    color: #8b5cf6;
    text-decoration: none;
    font-weight: 500;
  }

  .checkbox-label a:hover {
    text-decoration: underline;
  }

  .consent-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 8px;
    color: #dc2626;
    font-size: 13px;
  }

  :global(html.dark) .consent-error {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .google-btn.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .google-btn.disabled:hover {
    transform: none;
    box-shadow: none;
  }

  :global(.spinner) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
