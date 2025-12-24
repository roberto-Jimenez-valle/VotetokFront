<script lang="ts">
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { fade, fly } from "svelte/transition";
    import { Cookie, X, ChevronDown, ChevronUp } from "lucide-svelte";

    const COOKIE_CONSENT_KEY = "voutop-cookie-consent";
    const COOKIE_CONSENT_VERSION = "1.0.0";

    interface CookiePreferences {
        essential: boolean; // Siempre true
        analytics: boolean;
        advertising: boolean;
        version: string;
        timestamp: number;
    }

    let isVisible = $state(false);
    let showDetails = $state(false);
    let isSaving = $state(false);

    // Preferencias de cookies
    let analyticsEnabled = $state(false);
    let advertisingEnabled = $state(false);

    onMount(() => {
        checkCookieConsent();
    });

    function checkCookieConsent() {
        if (!browser) return;

        const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (stored) {
            try {
                const preferences: CookiePreferences = JSON.parse(stored);
                // Si la versión es diferente, mostrar de nuevo
                if (preferences.version !== COOKIE_CONSENT_VERSION) {
                    isVisible = true;
                    return;
                }
                // Restaurar preferencias
                analyticsEnabled = preferences.analytics;
                advertisingEnabled = preferences.advertising;
                applyPreferences(preferences);
            } catch {
                isVisible = true;
            }
        } else {
            isVisible = true;
        }
    }

    function acceptAll() {
        analyticsEnabled = true;
        advertisingEnabled = true;
        savePreferences();
    }

    function acceptEssentialOnly() {
        analyticsEnabled = false;
        advertisingEnabled = false;
        savePreferences();
    }

    function savePreferences() {
        if (!browser) return;

        isSaving = true;

        const preferences: CookiePreferences = {
            essential: true,
            analytics: analyticsEnabled,
            advertising: advertisingEnabled,
            version: COOKIE_CONSENT_VERSION,
            timestamp: Date.now(),
        };

        localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(preferences));
        applyPreferences(preferences);

        // Guardar también en el servidor si el usuario está logueado
        saveToServer(preferences);

        setTimeout(() => {
            isVisible = false;
            isSaving = false;
        }, 300);
    }

    async function saveToServer(preferences: CookiePreferences) {
        try {
            const token = localStorage.getItem("voutop-auth-token");
            if (!token) return; // No logueado, solo guardar local

            await fetch("/api/user/consent", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    cookiesEssential: true,
                    cookiesAnalytics: preferences.analytics,
                    cookiesAdvertising: preferences.advertising,
                }),
            });
        } catch (err) {
            console.warn("[CookieBanner] Error guardando en servidor:", err);
        }
    }

    function applyPreferences(preferences: CookiePreferences) {
        // Aquí se activarían/desactivarían los scripts de analytics, ads, etc.
        if (browser) {
            // Google Analytics
            if (preferences.analytics) {
                // Activar gtag si existe
                (window as any).gaEnabled = true;
            } else {
                (window as any).gaEnabled = false;
            }

            // Publicidad
            if (preferences.advertising) {
                (window as any).adsEnabled = true;
            } else {
                (window as any).adsEnabled = false;
            }

            console.log("[Cookies] Preferencias aplicadas:", preferences);
        }
    }

    export function getCookiePreferences(): CookiePreferences | null {
        if (!browser) return null;
        const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (!stored) return null;
        try {
            return JSON.parse(stored);
        } catch {
            return null;
        }
    }
</script>

{#if isVisible}
    <div class="cookie-backdrop" transition:fade={{ duration: 200 }}></div>

    <div
        class="cookie-banner"
        transition:fly={{ y: 100, duration: 300 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-title"
    >
        <div class="cookie-header">
            <div class="cookie-icon">
                <Cookie size={24} />
            </div>
            <div class="cookie-title-wrap">
                <h3 id="cookie-title">🍪 Usamos cookies</h3>
                <p class="cookie-subtitle">
                    Para mejorar tu experiencia en Voutop
                </p>
            </div>
        </div>

        <div class="cookie-body">
            <p class="cookie-description">
                Utilizamos cookies esenciales para el funcionamiento del sitio,
                y cookies opcionales para analíticas y publicidad. Puedes
                aceptar todas o personalizar tus preferencias.
            </p>

            <button
                class="toggle-details"
                onclick={() => (showDetails = !showDetails)}
            >
                {showDetails ? "Ocultar detalles" : "Ver detalles"}
                {#if showDetails}
                    <ChevronUp size={16} />
                {:else}
                    <ChevronDown size={16} />
                {/if}
            </button>

            {#if showDetails}
                <div
                    class="cookie-details"
                    transition:fly={{ y: -10, duration: 200 }}
                >
                    <div class="cookie-option">
                        <div class="option-info">
                            <span class="option-label"
                                >🔒 Cookies esenciales</span
                            >
                            <span class="option-desc"
                                >Necesarias para el funcionamiento básico</span
                            >
                        </div>
                        <label class="toggle disabled">
                            <input type="checkbox" checked disabled />
                            <span class="slider"></span>
                        </label>
                    </div>

                    <div class="cookie-option">
                        <div class="option-info">
                            <span class="option-label"
                                >📊 Cookies analíticas</span
                            >
                            <span class="option-desc"
                                >Nos ayudan a mejorar el servicio</span
                            >
                        </div>
                        <label class="toggle">
                            <input
                                type="checkbox"
                                bind:checked={analyticsEnabled}
                            />
                            <span class="slider"></span>
                        </label>
                    </div>

                    <div class="cookie-option">
                        <div class="option-info">
                            <span class="option-label"
                                >🎯 Cookies publicitarias</span
                            >
                            <span class="option-desc"
                                >Para anuncios personalizados</span
                            >
                        </div>
                        <label class="toggle">
                            <input
                                type="checkbox"
                                bind:checked={advertisingEnabled}
                            />
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
            {/if}
        </div>

        <div class="cookie-actions">
            <button
                class="btn btn-secondary"
                onclick={acceptEssentialOnly}
                disabled={isSaving}
            >
                Solo esenciales
            </button>

            {#if showDetails}
                <button
                    class="btn btn-primary"
                    onclick={savePreferences}
                    disabled={isSaving}
                >
                    Guardar preferencias
                </button>
            {:else}
                <button
                    class="btn btn-primary"
                    onclick={acceptAll}
                    disabled={isSaving}
                >
                    Aceptar todas
                </button>
            {/if}
        </div>

        <a
            href="/legal#cookies"
            class="cookie-policy-link"
            target="_blank"
            rel="noopener noreferrer"
        >
            Ver Política de Cookies completa
        </a>
    </div>
{/if}

<style>
    .cookie-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(4px);
        z-index: 99998;
    }

    .cookie-banner {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%);
        border-radius: 24px 24px 0 0;
        padding: 24px;
        z-index: 99999;
        box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.15);
        max-height: 90vh;
        overflow-y: auto;
    }

    :global(html.dark) .cookie-banner {
        background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
        box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.4);
    }

    .cookie-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
    }

    .cookie-icon {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        flex-shrink: 0;
    }

    .cookie-title-wrap h3 {
        font-size: 20px;
        font-weight: 700;
        color: #1a1a2e;
        margin: 0 0 4px;
    }

    :global(html.dark) .cookie-title-wrap h3 {
        color: #fff;
    }

    .cookie-subtitle {
        font-size: 14px;
        color: #888;
        margin: 0;
    }

    .cookie-body {
        margin-bottom: 20px;
    }

    .cookie-description {
        font-size: 14px;
        line-height: 1.6;
        color: #555;
        margin: 0 0 12px;
    }

    :global(html.dark) .cookie-description {
        color: #aaa;
    }

    .toggle-details {
        display: flex;
        align-items: center;
        gap: 6px;
        background: none;
        border: none;
        color: #8b5cf6;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        padding: 0;
        margin-bottom: 12px;
    }

    .toggle-details:hover {
        text-decoration: underline;
    }

    .cookie-details {
        background: rgba(0, 0, 0, 0.03);
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    :global(html.dark) .cookie-details {
        background: rgba(255, 255, 255, 0.05);
    }

    .cookie-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
    }

    .option-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .option-label {
        font-size: 14px;
        font-weight: 600;
        color: #1a1a2e;
    }

    :global(html.dark) .option-label {
        color: #e0e0e0;
    }

    .option-desc {
        font-size: 12px;
        color: #888;
    }

    /* Toggle Switch */
    .toggle {
        position: relative;
        display: inline-block;
        width: 48px;
        height: 28px;
        flex-shrink: 0;
    }

    .toggle input {
        opacity: 0;
        width: 0;
        height: 0;
    }

    .slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background: #ccc;
        border-radius: 28px;
        transition: 0.3s;
    }

    .slider::before {
        position: absolute;
        content: "";
        height: 22px;
        width: 22px;
        left: 3px;
        bottom: 3px;
        background: white;
        border-radius: 50%;
        transition: 0.3s;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    }

    .toggle input:checked + .slider {
        background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
    }

    .toggle input:checked + .slider::before {
        transform: translateX(20px);
    }

    .toggle.disabled .slider {
        background: #10b981;
        cursor: not-allowed;
        opacity: 0.7;
    }

    .toggle.disabled input:checked + .slider::before {
        transform: translateX(20px);
    }

    /* Actions */
    .cookie-actions {
        display: flex;
        gap: 12px;
    }

    .btn {
        flex: 1;
        padding: 14px 20px;
        border: none;
        border-radius: 12px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .btn-secondary {
        background: rgba(0, 0, 0, 0.05);
        color: #555;
    }

    .btn-secondary:hover:not(:disabled) {
        background: rgba(0, 0, 0, 0.1);
    }

    :global(html.dark) .btn-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: #ccc;
    }

    :global(html.dark) .btn-secondary:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.15);
    }

    .btn-primary {
        background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
        color: white;
        box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
    }

    .btn-primary:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);
    }

    .cookie-policy-link {
        display: block;
        text-align: center;
        margin-top: 16px;
        font-size: 13px;
        color: #8b5cf6;
        text-decoration: none;
    }

    .cookie-policy-link:hover {
        text-decoration: underline;
    }

    /* Responsive */
    @media (max-width: 480px) {
        .cookie-banner {
            padding: 20px 16px;
        }

        .cookie-header {
            gap: 12px;
        }

        .cookie-icon {
            width: 40px;
            height: 40px;
        }

        .cookie-title-wrap h3 {
            font-size: 18px;
        }

        .cookie-actions {
            flex-direction: column;
        }

        .btn {
            padding: 12px 16px;
            font-size: 14px;
        }
    }
</style>
