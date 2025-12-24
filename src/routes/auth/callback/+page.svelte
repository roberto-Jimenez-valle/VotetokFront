<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import { get } from "svelte/store";

  let status = $state<"loading" | "success" | "error">("loading");
  let message = $state("Verificando tu cuenta...");
  let userName = $state("");
  let userAvatar = $state("");
  let countdown = $state(3);
  let countdownInterval: ReturnType<typeof setInterval> | null = null;

  function startCountdown(seconds: number, onComplete: () => void) {
    countdown = seconds;
    countdownInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        if (countdownInterval) clearInterval(countdownInterval);
        onComplete();
      }
    }, 1000);
  }

  onMount(() => {
    if (!browser) return;

    // Usar get($page) para obtener los parámetros correctamente
    const pageData = get(page);
    const params = pageData.url.searchParams;
    const authStatus = params.get("auth");
    const userData = params.get("user");
    const token = params.get("token");
    const error = params.get("error");

    // Debug: mostrar qué parámetros llegaron
    console.log("[Auth Callback Popup] Parámetros recibidos:", {
      auth: authStatus,
      hasUser: !!userData,
      hasToken: !!token,
      error: error,
      fullUrl: pageData.url.href,
    });

    if (error) {
      status = "error";
      const errorMessages: Record<string, string> = {
        google_auth_cancelled: "Autenticación cancelada",
        google_auth_failed: "Error al autenticar con Google",
        google_config_missing: "Configuración de Google incompleta",
        google_token_failed: "Error al obtener tokens de Google",
        google_userinfo_failed: "Error al obtener información del usuario",
        google_auth_error: "Error en el proceso de autenticación",
      };
      message = errorMessages[error] || "Error desconocido";

      // Comunicar error a la ventana padre
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "OAUTH_ERROR",
            error: error,
            message: message,
          },
          window.location.origin,
        );

        startCountdown(3, () => window.close());
      }
      return;
    }

    if (authStatus === "success" && userData && token) {
      try {
        const user = JSON.parse(decodeURIComponent(userData));

        status = "success";
        userName = user.displayName || user.username;
        userAvatar = user.avatarUrl || "";
        message = "¡Autenticación exitosa!";

        // Comunicar éxito a la ventana padre
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "OAUTH_SUCCESS",
              token: token,
              user: user,
            },
            window.location.origin,
          );

          startCountdown(2, () => window.close());
        }
      } catch (err) {
        status = "error";
        message = "Error al procesar la autenticación";

        if (window.opener) {
          window.opener.postMessage(
            {
              type: "OAUTH_ERROR",
              error: "parse_error",
              message: message,
            },
            window.location.origin,
          );

          startCountdown(3, () => window.close());
        }
      }
    } else {
      status = "error";
      message = "Respuesta de autenticación inválida";

      if (window.opener) {
        window.opener.postMessage(
          {
            type: "OAUTH_ERROR",
            error: "invalid_response",
            message: message,
          },
          window.location.origin,
        );

        startCountdown(3, () => window.close());
      }
    }
  });

  onDestroy(() => {
    if (countdownInterval) clearInterval(countdownInterval);
  });
</script>

<svelte:head>
  <title>VouTop - Autenticación</title>
</svelte:head>

<div class="callback-container">
  <!-- Fondo animado -->
  <div class="bg-gradient"></div>
  <div class="bg-particles">
    {#each Array(20) as _, i}
      <div
        class="particle"
        style="--delay: {i * 0.3}s; --x: {Math.random() *
          100}%; --duration: {3 + Math.random() * 4}s"
      ></div>
    {/each}
  </div>

  <div class="callback-card">
    <!-- Logo -->
    <div class="logo-container">
      <img src="/logo.png" alt="VouTop" class="logo" />
    </div>

    {#if status === "loading"}
      <!-- Estado: Cargando -->
      <div class="status-section loading">
        <div class="spinner-ring">
          <div class="spinner-inner"></div>
        </div>
        <h2>{message}</h2>
        <p class="subtitle">
          Espera un momento mientras verificamos tu identidad
        </p>
      </div>
    {:else if status === "success"}
      <!-- Estado: Éxito -->
      <div class="status-section success">
        <!-- Avatar del usuario -->
        {#if userAvatar}
          <div class="user-avatar-container">
            <img src={userAvatar} alt={userName} class="user-avatar" />
            <div class="check-badge">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
              >
                <polyline points="20,6 9,17 4,12"></polyline>
              </svg>
            </div>
          </div>
        {:else}
          <div class="icon-container success">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
          </div>
        {/if}

        <h2>¡Bienvenido, {userName}!</h2>
        <p class="subtitle">{message}</p>

        <!-- Cuenta atrás -->
        <div class="countdown-section">
          <div class="countdown-ring">
            <svg viewBox="0 0 36 36">
              <circle class="countdown-bg" cx="18" cy="18" r="16" />
              <circle
                class="countdown-progress"
                cx="18"
                cy="18"
                r="16"
                style="stroke-dashoffset: {100.53 - (countdown / 2) * 100.53}"
              />
            </svg>
            <span class="countdown-number">{countdown}</span>
          </div>
          <p class="countdown-text">
            Cerrando ventana en {countdown} segundo{countdown !== 1
              ? "s"
              : ""}...
          </p>
        </div>
      </div>
    {:else}
      <!-- Estado: Error -->
      <div class="status-section error">
        <div class="icon-container error">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>

        <h2>Algo salió mal</h2>
        <p class="subtitle error-message">{message}</p>

        <!-- Cuenta atrás -->
        <div class="countdown-section">
          <div class="countdown-ring error">
            <svg viewBox="0 0 36 36">
              <circle class="countdown-bg" cx="18" cy="18" r="16" />
              <circle
                class="countdown-progress"
                cx="18"
                cy="18"
                r="16"
                style="stroke-dashoffset: {100.53 - (countdown / 3) * 100.53}"
              />
            </svg>
            <span class="countdown-number">{countdown}</span>
          </div>
          <p class="countdown-text">
            Cerrando ventana en {countdown} segundo{countdown !== 1
              ? "s"
              : ""}...
          </p>
        </div>

        <button class="retry-btn" onclick={() => window.close()}>
          Cerrar ahora
        </button>
      </div>
    {/if}

    <!-- Footer -->
    <div class="footer">
      <p>Powered by <strong>VouTop</strong></p>
    </div>
  </div>
</div>

<style>
  /* ===== LAYOUT ===== */
  .callback-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family:
      "Inter",
      system-ui,
      -apple-system,
      sans-serif;
    position: relative;
    overflow: hidden;
  }

  /* ===== ANIMATED BACKGROUND ===== */
  .bg-gradient {
    position: fixed;
    inset: 0;
    background: #000000;
    z-index: 0;
  }

  .bg-particles {
    position: fixed;
    inset: 0;
    z-index: 1;
    pointer-events: none;
  }

  .particle {
    position: absolute;
    width: 4px;
    height: 4px;
    background: rgba(99, 102, 241, 0.4);
    border-radius: 50%;
    left: var(--x);
    bottom: -10px;
    animation: float-up var(--duration) ease-in-out infinite;
    animation-delay: var(--delay);
  }

  @keyframes float-up {
    0% {
      transform: translateY(0) scale(1);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      transform: translateY(-100vh) scale(0.5);
      opacity: 0;
    }
  }

  /* ===== CARD ===== */
  .callback-card {
    position: relative;
    z-index: 10;
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 24px;
    padding: 48px 40px;
    text-align: center;
    color: white;
    width: 100%;
    max-width: 420px;
    margin: 20px;
    box-shadow:
      0 25px 50px -12px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  }

  /* ===== LOGO ===== */
  .logo-container {
    margin-bottom: 32px;
  }

  .logo {
    width: 80px;
    height: 80px;
    object-fit: contain;
    filter: drop-shadow(0 4px 12px rgba(99, 102, 241, 0.3));
    animation: logo-pulse 2s ease-in-out infinite;
  }

  @keyframes logo-pulse {
    0%,
    100% {
      transform: scale(1);
      filter: drop-shadow(0 4px 12px rgba(99, 102, 241, 0.3));
    }
    50% {
      transform: scale(1.05);
      filter: drop-shadow(0 8px 24px rgba(99, 102, 241, 0.5));
    }
  }

  /* ===== STATUS SECTIONS ===== */
  .status-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .status-section h2 {
    font-size: 24px;
    font-weight: 700;
    margin: 0;
    background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
    max-width: 280px;
    line-height: 1.5;
  }

  .error-message {
    color: rgba(239, 68, 68, 0.9);
  }

  /* ===== SPINNER ===== */
  .spinner-ring {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: conic-gradient(from 0deg, transparent, #6366f1, transparent);
    animation: spin 1.2s linear infinite;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .spinner-inner {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: #000000;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ===== ICONS ===== */
  .icon-container {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: icon-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  .icon-container svg {
    width: 36px;
    height: 36px;
  }

  .icon-container.success {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    box-shadow: 0 8px 32px rgba(34, 197, 94, 0.4);
  }

  .icon-container.success svg {
    stroke: white;
  }

  .icon-container.error {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    box-shadow: 0 8px 32px rgba(239, 68, 68, 0.4);
  }

  .icon-container.error svg {
    stroke: white;
  }

  @keyframes icon-pop {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* ===== USER AVATAR ===== */
  .user-avatar-container {
    position: relative;
    animation: icon-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  .user-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid rgba(99, 102, 241, 0.5);
    box-shadow: 0 8px 32px rgba(99, 102, 241, 0.3);
  }

  .check-badge {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 28px;
    height: 28px;
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #1a1a3e;
    animation: badge-pop 0.3s 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  }

  .check-badge svg {
    width: 14px;
    height: 14px;
    stroke: white;
  }

  @keyframes badge-pop {
    0% {
      transform: scale(0);
    }
    100% {
      transform: scale(1);
    }
  }

  /* ===== COUNTDOWN ===== */
  .countdown-section {
    margin-top: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .countdown-ring {
    position: relative;
    width: 48px;
    height: 48px;
  }

  .countdown-ring svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .countdown-bg {
    fill: none;
    stroke: rgba(255, 255, 255, 0.1);
    stroke-width: 2;
  }

  .countdown-progress {
    fill: none;
    stroke: #22c55e;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-dasharray: 100.53;
    transition: stroke-dashoffset 1s linear;
  }

  .countdown-ring.error .countdown-progress {
    stroke: #ef4444;
  }

  .countdown-number {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 700;
    color: white;
  }

  .countdown-text {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
  }

  /* ===== BUTTONS ===== */
  .retry-btn {
    margin-top: 16px;
    padding: 12px 24px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
  }

  /* ===== FOOTER ===== */
  .footer {
    margin-top: 32px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .footer p {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    margin: 0;
  }

  .footer strong {
    color: rgba(99, 102, 241, 0.8);
    font-weight: 600;
  }

  /* ===== RESPONSIVE ===== */
  @media (max-width: 480px) {
    .callback-card {
      padding: 32px 24px;
      margin: 16px;
      border-radius: 20px;
    }

    .logo {
      width: 64px;
      height: 64px;
    }

    .status-section h2 {
      font-size: 20px;
    }

    .user-avatar {
      width: 64px;
      height: 64px;
    }
  }
</style>
