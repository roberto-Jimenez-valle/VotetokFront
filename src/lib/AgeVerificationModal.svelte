<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import { X, AlertTriangle, CheckCircle2 } from "lucide-svelte";
    import { createEventDispatcher } from "svelte";
    import { browser } from "$app/environment";

    const LEGAL_VERSION = "1.0.0";
    const AGE_CONSENT_KEY = "voutop-age-consent";

    interface AgeConsentData {
        isOver16: boolean;
        termsAccepted: boolean;
        privacyAccepted: boolean;
        version: string;
        timestamp: number;
    }

    interface Props {
        isOpen?: boolean;
    }

    let { isOpen = $bindable(false) }: Props = $props();

    const dispatch = createEventDispatcher<{
        accepted: {
            isOver16: boolean;
            termsAccepted: boolean;
            privacyAccepted: boolean;
        };
        declined: void;
    }>();

    let isOver16Checked = $state(false);
    let termsAccepted = $state(false);
    let privacyAccepted = $state(false);
    let isSubmitting = $state(false);
    let showError = $state(false);

    $effect(() => {
        if (isOpen) {
            // Reset state when opening
            isOver16Checked = false;
            termsAccepted = false;
            privacyAccepted = false;
            showError = false;
        }
    });

    function canSubmit(): boolean {
        return isOver16Checked && termsAccepted && privacyAccepted;
    }

    async function handleAccept() {
        if (!canSubmit()) {
            showError = true;
            return;
        }

        isSubmitting = true;
        showError = false;

        const consentData: AgeConsentData = {
            isOver16: true,
            termsAccepted: true,
            privacyAccepted: true,
            version: LEGAL_VERSION,
            timestamp: Date.now(),
        };

        // Guardar localmente
        if (browser) {
            localStorage.setItem(AGE_CONSENT_KEY, JSON.stringify(consentData));
        }

        // Guardar en servidor si está logueado
        await saveToServer();

        isSubmitting = false;
        isOpen = false;

        dispatch("accepted", {
            isOver16: true,
            termsAccepted: true,
            privacyAccepted: true,
        });
    }

    async function saveToServer() {
        if (!browser) return;

        try {
            const token = localStorage.getItem("voutop-auth-token");
            if (!token) return;

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
        } catch (err) {
            console.warn("[AgeVerification] Error guardando en servidor:", err);
        }
    }

    function handleDecline() {
        isOpen = false;
        dispatch("declined");
    }

    // También exportamos función para verificar si ya tiene consentimiento
    export function hasAgeConsent(): boolean {
        if (!browser) return false;
        const stored = localStorage.getItem(AGE_CONSENT_KEY);
        if (!stored) return false;
        try {
            const data: AgeConsentData = JSON.parse(stored);
            return data.isOver16 && data.termsAccepted && data.privacyAccepted;
        } catch {
            return false;
        }
    }
</script>

{#if isOpen}
    <!-- Backdrop -->
    <div
        class="age-modal-backdrop"
        onclick={handleDecline}
        transition:fade={{ duration: 200 }}
        role="presentation"
    ></div>

    <!-- Modal -->
    <div
        class="age-modal"
        transition:fly={{ y: 50, duration: 300 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-modal-title"
    >
        <!-- Header -->
        <div class="modal-header">
            <div class="header-icon">
                <AlertTriangle size={28} />
            </div>
            <h2 id="age-modal-title">Antes de continuar</h2>
            <button
                class="close-btn"
                onclick={handleDecline}
                aria-label="Cerrar"
            >
                <X size={20} />
            </button>
        </div>

        <!-- Content -->
        <div class="modal-content">
            <p class="intro-text">
                Para poder interactuar en Voutop (votar, crear encuestas,
                comentar, etc.), necesitamos que confirmes lo siguiente:
            </p>

            <!-- Checkboxes -->
            <div class="consent-grid">
                <!-- Age verification -->
                <label class="consent-item" class:checked={isOver16Checked}>
                    <input
                        type="checkbox"
                        bind:checked={isOver16Checked}
                        class="sr-only"
                    />
                    <div class="checkbox-icon">
                        {#if isOver16Checked}
                            <CheckCircle2 size={22} />
                        {:else}
                            <div class="empty-circle"></div>
                        {/if}
                    </div>
                    <div class="consent-text">
                        <span class="consent-label">Soy mayor de 16 años</span>
                        <span class="consent-desc">
                            Confirmo que tengo al menos 16 años de edad
                        </span>
                    </div>
                </label>

                <!-- Terms acceptance -->
                <label class="consent-item" class:checked={termsAccepted}>
                    <input
                        type="checkbox"
                        bind:checked={termsAccepted}
                        class="sr-only"
                    />
                    <div class="checkbox-icon">
                        {#if termsAccepted}
                            <CheckCircle2 size={22} />
                        {:else}
                            <div class="empty-circle"></div>
                        {/if}
                    </div>
                    <div class="consent-text">
                        <span class="consent-label"
                            >Acepto los Términos y Condiciones</span
                        >
                        <span class="consent-desc">
                            He leído y acepto los <a
                                href="/legal#terminos"
                                target="_blank"
                                rel="noopener noreferrer"
                                onclick={(e) => e.stopPropagation()}
                                >Términos de Uso</a
                            >
                        </span>
                    </div>
                </label>

                <!-- Privacy acceptance -->
                <label class="consent-item" class:checked={privacyAccepted}>
                    <input
                        type="checkbox"
                        bind:checked={privacyAccepted}
                        class="sr-only"
                    />
                    <div class="checkbox-icon">
                        {#if privacyAccepted}
                            <CheckCircle2 size={22} />
                        {:else}
                            <div class="empty-circle"></div>
                        {/if}
                    </div>
                    <div class="consent-text">
                        <span class="consent-label"
                            >Acepto la Política de Privacidad</span
                        >
                        <span class="consent-desc">
                            He leído y acepto la <a
                                href="/legal#privacidad"
                                target="_blank"
                                rel="noopener noreferrer"
                                onclick={(e) => e.stopPropagation()}
                                >Política de Privacidad</a
                            >
                        </span>
                    </div>
                </label>
            </div>

            {#if showError}
                <div
                    class="error-message"
                    transition:fly={{ y: -10, duration: 200 }}
                >
                    <AlertTriangle size={16} />
                    <span
                        >Debes aceptar todas las condiciones para continuar</span
                    >
                </div>
            {/if}
        </div>

        <!-- Actions -->
        <div class="modal-actions">
            <button
                class="btn btn-secondary"
                onclick={handleDecline}
                disabled={isSubmitting}
            >
                Cancelar
            </button>
            <button
                class="btn btn-primary"
                class:disabled={!canSubmit()}
                onclick={handleAccept}
                disabled={isSubmitting}
            >
                {#if isSubmitting}
                    Guardando...
                {:else}
                    Confirmar y continuar
                {/if}
            </button>
        </div>
    </div>
{/if}

<style>
    .age-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        z-index: 100000;
    }

    .age-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: calc(100% - 32px);
        max-width: 480px;
        background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%);
        border-radius: 24px;
        padding: 24px;
        z-index: 100001;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
        max-height: 90vh;
        overflow-y: auto;
    }

    :global(html.dark) .age-modal {
        background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }

    .modal-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
    }

    .header-icon {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }

    .modal-header h2 {
        flex: 1;
        font-size: 20px;
        font-weight: 700;
        color: #1a1a2e;
        margin: 0;
    }

    :global(html.dark) .modal-header h2 {
        color: #fff;
    }

    .close-btn {
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.05);
        color: #666;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
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

    .modal-content {
        margin-bottom: 24px;
    }

    .intro-text {
        font-size: 15px;
        line-height: 1.6;
        color: #555;
        margin: 0 0 20px;
    }

    :global(html.dark) .intro-text {
        color: #aaa;
    }

    .consent-grid {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .consent-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px;
        background: rgba(0, 0, 0, 0.03);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px solid transparent;
    }

    .consent-item:hover {
        background: rgba(0, 0, 0, 0.05);
    }

    .consent-item.checked {
        background: rgba(139, 92, 246, 0.08);
        border-color: rgba(139, 92, 246, 0.3);
    }

    :global(html.dark) .consent-item {
        background: rgba(255, 255, 255, 0.05);
    }

    :global(html.dark) .consent-item:hover {
        background: rgba(255, 255, 255, 0.08);
    }

    :global(html.dark) .consent-item.checked {
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
        margin-top: 2px;
        color: #8b5cf6;
    }

    .empty-circle {
        width: 22px;
        height: 22px;
        border: 2px solid #ccc;
        border-radius: 50%;
        transition: all 0.2s ease;
    }

    :global(html.dark) .empty-circle {
        border-color: #555;
    }

    .consent-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .consent-label {
        font-size: 15px;
        font-weight: 600;
        color: #1a1a2e;
    }

    :global(html.dark) .consent-label {
        color: #e0e0e0;
    }

    .consent-desc {
        font-size: 13px;
        color: #888;
    }

    .consent-desc a {
        color: #8b5cf6;
        text-decoration: none;
    }

    .consent-desc a:hover {
        text-decoration: underline;
    }

    .error-message {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
        padding: 12px 14px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
        border-radius: 10px;
        color: #dc2626;
        font-size: 14px;
    }

    :global(html.dark) .error-message {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
    }

    .modal-actions {
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

    .btn-primary {
        background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
        color: white;
        box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
    }

    .btn-primary:hover:not(:disabled):not(.disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);
    }

    .btn-primary.disabled {
        opacity: 0.5;
    }

    /* Responsive */
    @media (max-width: 480px) {
        .age-modal {
            padding: 20px;
        }

        .modal-header h2 {
            font-size: 18px;
        }

        .consent-item {
            padding: 12px;
        }

        .modal-actions {
            flex-direction: column;
        }
    }
</style>
